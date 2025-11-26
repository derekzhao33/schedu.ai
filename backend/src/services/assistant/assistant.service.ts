import Anthropic from '@anthropic-ai/sdk';
import config from '../../config/config.js';
import prisma from '../../shared/prisma.js';
import { format, addDays, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { createTask, deleteTask } from '../tasks/task.service.js';

const anthropic = new Anthropic({
  apiKey: config.claudeApiKey,
});

// PST timezone constant
const PST_TIMEZONE = 'America/Los_Angeles';

interface ParsedTask {
  name: string;
  description?: string;
  startTime: string; // ISO format or time string
  endTime: string;
  date: string; // YYYY-MM-DD
  priority?: 'low' | 'medium' | 'high';
  estimatedDuration?: number; // in minutes
  label?: string;
  colour?: string;
  recurrence?: string[];
  dependsOn?: string[]; // Task names this task depends on
  template?: string; // Template name if task is from a template
}

interface AIResponse {
  message: string;
  tasks: ParsedTask[];
  tasksCreated: number;
  missingInfo?: string[];
  conflicts?: string[];
  suggestedAlternatives?: string[];
  tasksToReschedule?: string[]; // Tasks that need rescheduling
  reschedulingOptions?: Record<string, string[]>; // Alternatives for rescheduled tasks
  tasksToDelete?: string[]; // Tasks to delete (by name)
  status?: 'complete' | 'needs_confirmation' | 'reschedule_confirmation' | 'deletion_confirmation';
}

interface DbTask {
  id: number;
  start_time: Date;
  end_time: Date;
  user_id: number;
  name?: string;
  priority?: 'low' | 'medium' | 'high';
  recurrence?: string[]; // RRULE format
  isRecurring?: boolean; // Quick check if task is recurring
  dependsOn?: number[]; // Task IDs this task depends on
  template?: string; // Template name if task is from a template
}

// Get user's existing tasks for pattern analysis from database
async function getUserTasks(userId: number): Promise<DbTask[]> {
  try {
    const tasks = await prisma.task.findMany({
      where: { user_id: userId },
      orderBy: { start_time: 'asc' }
    });
    
    return tasks.map(task => ({
      id: task.id,
      start_time: task.start_time,
      end_time: task.end_time,
      user_id: task.user_id,
      name: task.name || undefined,
      priority: (task.priority as 'low' | 'medium' | 'high') || undefined,
      recurrence: task.recurrence && task.recurrence.length > 0 ? task.recurrence : undefined,
      isRecurring: task.is_recurring || false
    }));
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    return [];
  }
}

// Check for new Canvas events and generate notifications
async function checkCanvasEventsNotification(userId: number): Promise<string[]> {
  try {
    // Get user to check if Canvas is connected
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.canvas_ics_url) {
      return []; // No Canvas integration
    }

    // Get Canvas tasks (tasks with canvas_event_id)
    const canvasTasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        canvas_event_id: { not: null }
      },
      orderBy: { start_time: 'asc' }
    });

    if (canvasTasks.length === 0) {
      return [];
    }

    const notifications: string[] = [];
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const task of canvasTasks) {
      const dueDate = new Date(task.end_time);
      
      // Only notify about upcoming tasks (within next 7 days)
      if (dueDate > now && dueDate <= sevenDaysFromNow) {
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const dueDateFormatted = format(dueDate, 'MMM d');
        const dueTimeFormatted = format(dueDate, 'h:mm a');
        
        let urgencyPrefix = '';
        if (daysUntilDue === 0) {
          urgencyPrefix = '🔴 URGENT: ';
        } else if (daysUntilDue === 1) {
          urgencyPrefix = '⚠️ Tomorrow: ';
        } else if (daysUntilDue <= 3) {
          urgencyPrefix = '📅 Upcoming: ';
        }

        notifications.push(
          `${urgencyPrefix}Canvas Assignment: "${task.name}" is due on ${dueDateFormatted} at ${dueTimeFormatted} (${daysUntilDue} days). ` +
          `I can help you schedule focused work time for it!`
        );
      }
    }

    return notifications;
  } catch (error) {
    console.error('Error checking Canvas events:', error);
    return [];
  }
}

// Get Canvas tasks for context
async function getCanvasTasks(userId: number): Promise<Array<{
  name: string;
  dueDate: Date;
  daysUntilDue: number;
  subject?: string;
}>> {
  try {
    const canvasTasks = await prisma.task.findMany({
      where: {
        user_id: userId,
        canvas_event_id: { not: null },
        end_time: { gte: new Date() } // Only future tasks
      },
      orderBy: { end_time: 'asc' }
    });

    const now = new Date();
    return canvasTasks.map(task => ({
      name: task.name || 'Untitled Assignment',
      dueDate: new Date(task.end_time),
      daysUntilDue: Math.ceil((new Date(task.end_time).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      subject: task.description || undefined
    }));
  } catch (error) {
    console.error('Error fetching Canvas tasks:', error);
    return [];
  }
}

// Analyze patterns from existing tasks
function analyzeTaskPatterns(tasks: DbTask[]): {
  averageDuration: number;
  commonStartHour: number;
  typicalTaskLength: Record<string, number>;
} {
  if (tasks.length === 0) {
    return {
      averageDuration: 60, // default 1 hour
      commonStartHour: 9, // default 9 AM
      typicalTaskLength: {},
    };
  }

  // Calculate average duration
  const durations = tasks.map(task => {
    const start = new Date(task.start_time);
    const end = new Date(task.end_time);
    return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
  });
  const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

  // Find most common start hour
  const startHours = tasks.map(task => new Date(task.start_time).getHours());
  const hourFrequency: Record<number, number> = {};
  startHours.forEach(hour => {
    hourFrequency[hour] = (hourFrequency[hour] || 0) + 1;
  });
  const commonStartHour = parseInt(
    Object.entries(hourFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || '9'
  );

  return {
    averageDuration: Math.round(averageDuration),
    commonStartHour,
    typicalTaskLength: {},
  };
}

// Priority levels
const PRIORITY_LEVELS = {
  'low': 1,
  'medium': 2,
  'high': 3,
};

// Check for conflicts with existing tasks
function checkConflicts(
  newTask: { startTime: Date; endTime: Date },
  existingTasks: DbTask[]
): DbTask[] {
  return existingTasks.filter(task => {
    const existingStart = new Date(task.start_time);
    const existingEnd = new Date(task.end_time);
    
    // Check if times overlap
    return (
      (newTask.startTime >= existingStart && newTask.startTime < existingEnd) ||
      (newTask.endTime > existingStart && newTask.endTime <= existingEnd) ||
      (newTask.startTime <= existingStart && newTask.endTime >= existingEnd)
    );
  });
}

// Check for conflicts and return conflicting tasks with their priorities
interface ConflictingTask extends DbTask {
  priority?: 'low' | 'medium' | 'high';
}

function checkConflictsWithPriority(
  newTask: { startTime: Date; endTime: Date; priority?: 'low' | 'medium' | 'high' },
  existingTasks: ConflictingTask[]
): ConflictingTask[] {
  return existingTasks.filter(task => {
    const existingStart = new Date(task.start_time);
    const existingEnd = new Date(task.end_time);
    
    // Check if times overlap
    return (
      (newTask.startTime >= existingStart && newTask.startTime < existingEnd) ||
      (newTask.endTime > existingStart && newTask.endTime <= existingEnd) ||
      (newTask.startTime <= existingStart && newTask.endTime >= existingEnd)
    );
  });
}

// Find available time slots for a given day
function findAvailableTimeSlots(
  existingTasks: DbTask[],
  targetDate: string,
  minDuration: number = 60
): string[] {
  const dayStart = new Date(`${targetDate}T00:00:00`);
  const dayEnd = new Date(`${targetDate}T23:59:59`);
  
  // Filter tasks for this day and sort by start time
  const dayTasks = existingTasks
    .filter(task => {
      const taskDate = format(new Date(task.start_time), 'yyyy-MM-dd');
      return taskDate === targetDate;
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  
  const slots: string[] = [];
  let currentTime = 9 * 60; // Start from 9 AM (in minutes)
  const endTime = 18 * 60; // End at 6 PM (in minutes)
  
  for (const task of dayTasks) {
    const taskStart = new Date(task.start_time);
    const taskMinutes = taskStart.getHours() * 60 + taskStart.getMinutes();
    
    if (currentTime + minDuration <= taskMinutes) {
      const hour = Math.floor(currentTime / 60);
      const min = currentTime % 60;
      slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
    
    const taskEnd = new Date(task.end_time);
    currentTime = Math.max(currentTime, taskEnd.getHours() * 60 + taskEnd.getMinutes());
  }
  
  // Add final slot if time available
  if (currentTime + minDuration <= endTime) {
    const hour = Math.floor(currentTime / 60);
    const min = currentTime % 60;
    slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  
  return slots;
}

// Determine priority level
function getPriorityLevel(priority?: string): number {
  return PRIORITY_LEVELS[priority?.toLowerCase() as keyof typeof PRIORITY_LEVELS] || PRIORITY_LEVELS.medium;
}

// Find alternative time slots for a task given a date and duration
function findAlternativeSlots(
  existingTasks: ConflictingTask[],
  targetDate: string,
  duration: number,
  googleCalendarEvents?: Array<any>
): Array<{ startTime: string; endTime: string }> {
  const alternatives: Array<{ startTime: string; endTime: string }> = [];
  const workStart = 9 * 60; // 9 AM
  const workEnd = 18 * 60; // 6 PM
  
  // Combine existing tasks and Google Calendar events for this day
  const allBlockedTimes: Array<{ start: number; end: number }> = [];
  
  // Add existing tasks
  existingTasks
    .filter(task => {
      const taskDate = format(new Date(task.start_time), 'yyyy-MM-dd');
      return taskDate === targetDate;
    })
    .forEach(task => {
      const taskStart = new Date(task.start_time);
      const taskEnd = new Date(task.end_time);
      allBlockedTimes.push({
        start: taskStart.getHours() * 60 + taskStart.getMinutes(),
        end: taskEnd.getHours() * 60 + taskEnd.getMinutes()
      });
    });
  
  // Add Google Calendar events
  (googleCalendarEvents || [])
    .filter((gcEvent: any) => gcEvent.date === targetDate)
    .forEach((gcEvent: any) => {
      if (gcEvent.startTime && gcEvent.endTime) {
        const [startHour, startMin] = gcEvent.startTime.split(':').map(Number);
        const [endHour, endMin] = gcEvent.endTime.split(':').map(Number);
        allBlockedTimes.push({
          start: startHour * 60 + startMin,
          end: endHour * 60 + endMin
        });
      }
    });
  
  // Sort by start time
  allBlockedTimes.sort((a, b) => a.start - b.start);
  
  // Find gaps between blocked times
  let currentTime = workStart;
  
  for (const blocked of allBlockedTimes) {
    // Check if there's a gap before this blocked time
    if (currentTime + duration <= blocked.start) {
      const hour = Math.floor(currentTime / 60);
      const min = currentTime % 60;
      const startTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      
      const endMinutes = currentTime + duration;
      const endHour = Math.floor(endMinutes / 60);
      const endMin = endMinutes % 60;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
      
      alternatives.push({ startTime, endTime });
      
      if (alternatives.length >= 3) return alternatives;
    }
    
    currentTime = Math.max(currentTime, blocked.end);
  }
  
  // Check final slot if available
  if (currentTime + duration <= workEnd && alternatives.length < 3) {
    const hour = Math.floor(currentTime / 60);
    const min = currentTime % 60;
    const startTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    
    const endMinutes = currentTime + duration;
    const endHour = Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
    
    alternatives.push({ startTime, endTime });
  }
  
  return alternatives;
}

// Convert 12/24 hour format to 24-hour format
function parseTimeFormat(timeStr: string): string {
  const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!timeMatch) return timeStr;
  
  let hours = parseInt(timeMatch[1] || '0');
  const minutes = timeMatch[2] || '00';
  const period = timeMatch[3]?.toLowerCase();
  
  if (period === 'pm' && hours !== 12) {
    hours += 12;
  } else if (period === 'am' && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

// Process natural language input with Claude
export async function processNaturalLanguageInput(
  input: string,
  userId: number,
  userTimezone: string = 'America/Los_Angeles',
  conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>,
  googleCalendarEvents?: Array<any>
): Promise<AIResponse> {
  try {
    // Check for Canvas event notifications
    const canvasNotifications = await checkCanvasEventsNotification(userId);
    
    // Get Canvas tasks for context
    const canvasTasks = await getCanvasTasks(userId);
    
    // Get user's existing tasks for context and pattern analysis
    const existingTasks = await getUserTasks(userId);
    const patterns = analyzeTaskPatterns(existingTasks);

    // Create context in user's timezone - using proper timezone-aware date
    const now = new Date();
    const currentDate = formatInTimeZone(now, userTimezone, 'yyyy-MM-dd');
    const currentTime = formatInTimeZone(now, userTimezone, 'HH:mm');
    const dayOfWeek = formatInTimeZone(now, userTimezone, 'EEEE');

    // Format existing tasks for Claude to see
    const existingTasksInfo = existingTasks.length > 0 
      ? existingTasks.map(task => {
          const startTime = formatInTimeZone(task.start_time, userTimezone, 'HH:mm');
          const endTime = formatInTimeZone(task.end_time, userTimezone, 'HH:mm');
          const taskDate = formatInTimeZone(task.start_time, userTimezone, 'yyyy-MM-dd');
          const duration = (new Date(task.end_time).getTime() - new Date(task.start_time).getTime()) / (1000 * 60);
          const recurringInfo = task.isRecurring ? ` [RECURRING: ${task.recurrence?.join(', ')}]` : '';
          return `  - "${task.name || 'Untitled'}" on ${taskDate} from ${startTime} to ${endTime} (${duration} mins, Priority: ${task.priority || 'medium'})${recurringInfo}`;
        }).join('\n')
      : '  (No tasks scheduled yet)';

    // Format Google Calendar events for Claude to see
    const googleEventsInfo = (googleCalendarEvents && googleCalendarEvents.length > 0)
      ? googleCalendarEvents.map((event: any) => {
          const isAllDay = !event.startTime;
          if (isAllDay) {
            return `  - "${event.name}" on ${event.date} (ALL DAY - BLOCKED) [GOOGLE CALENDAR]`;
          } else {
            return `  - "${event.name}" on ${event.date} from ${event.startTime} to ${event.endTime} [GOOGLE CALENDAR - CANNOT MOVE]`;
          }
        }).join('\n')
      : null;

    // Format Canvas tasks for Claude to see
    const canvasTasksInfo = (canvasTasks && canvasTasks.length > 0)
      ? canvasTasks.map(task => {
          const dueDateFormatted = format(task.dueDate, 'MMM d, yyyy');
          const dueTimeFormatted = format(task.dueDate, 'h:mm a');
          const urgencyEmoji = task.daysUntilDue === 0 ? '🔴' : task.daysUntilDue === 1 ? '⚠️' : task.daysUntilDue <= 3 ? '📅' : '';
          return `  ${urgencyEmoji} "${task.name}" due on ${dueDateFormatted} at ${dueTimeFormatted} (in ${task.daysUntilDue} days) [CANVAS ASSIGNMENT - CANNOT MOVE]`;
        }).join('\n')
      : null;

    // Format next 14 days with EXACT day of week for reference
    const next14Days = Array.from({ length: 14 }, (_, i) => {
      // Parse current date in user's timezone and add days
      const baseDate = new Date(currentDate + 'T12:00:00'); // Noon to avoid timezone edge cases
      const futureDate = addDays(baseDate, i);
      const dayName = formatInTimeZone(futureDate, userTimezone, 'EEEE');
      const dateStr = formatInTimeZone(futureDate, userTimezone, 'MMMM d, yyyy');
      const label = i === 0 ? '← TODAY' : i === 1 ? '← TOMORROW' : '';
      return `  ${dayName.padEnd(10)} | ${dateStr} ${label}`;
    }).join('\n');

    // Day of week mapping for calendar accuracy
    const dayOfWeekMap = `
CRITICAL: 2025 Calendar Reference (November-December):
Week of Nov 24-30, 2025:
  Monday    Nov 24
  Tuesday   Nov 25
  Wednesday Nov 26 ← TODAY
  Thursday  Nov 27
  Friday    Nov 28
  Saturday  Nov 29
  Sunday    Nov 30

Week of Dec 1-7, 2025:
  Monday    Dec 1
  Tuesday   Dec 2
  Wednesday Dec 3
  Thursday  Dec 4
  Friday    Dec 5
  Saturday  Dec 6
  Sunday    Dec 7

Week of Dec 8-14, 2025:
  Monday    Dec 8
  Tuesday   Dec 9
  Wednesday Dec 10
  Thursday  Dec 11
  Friday    Dec 12
  Saturday  Dec 13
  Sunday    Dec 14

Week of Dec 15-21, 2025:
  Monday    Dec 15
  Tuesday   Dec 16
  Wednesday Dec 17
  Thursday  Dec 18
  Friday    Dec 19
  Saturday  Dec 20
  Sunday    Dec 21

Week of Dec 22-31, 2025:
  Monday    Dec 22
  Tuesday   Dec 23
  Wednesday Dec 24
  Thursday  Dec 25 (Christmas)
  Friday    Dec 26
  Saturday  Dec 27
  Sunday    Dec 28
  Monday    Dec 29
  Tuesday   Dec 30
  Wednesday Dec 31

2026 Calendar (January-March):
Week of Jan 1-4, 2026:
  Thursday  Jan 1 (New Year)
  Friday    Jan 2
  Saturday  Jan 3
  Sunday    Jan 4

Week of Jan 5-11, 2026:
  Monday    Jan 5
  Tuesday   Jan 6
  Wednesday Jan 7
  Thursday  Jan 8
  Friday    Jan 9
  Saturday  Jan 10
  Sunday    Jan 11
`;

    // Comprehensive system prompt for Claude
    const systemPrompt = `You are an expert task scheduling AI assistant. Your job is to extract task information from natural language and help users schedule events intelligently.

🗓️ CRITICAL DATE AWARENESS - READ THIS CAREFULLY:
- **TODAY IS**: ${currentDate} which is a ${dayOfWeek}
- **Current time**: ${currentTime}
- **Timezone**: ${userTimezone}

${dayOfWeekMap}

📅 NEXT 14 DAYS WITH EXACT DAY OF WEEK:
${next14Days}

⚠️ CRITICAL DATE CALCULATION RULES - FOLLOW EXACTLY:

**UNDERSTANDING DAY NAMES**:
- Today is ${dayOfWeek}, ${currentDate}
- When user says "Monday", "Tuesday", "Friday", etc., they mean the DAY OF THE WEEK, not just a date
- You MUST match both the DATE and the DAY NAME together

**DAY-OF-WEEK MATCHING RULES**:

1. **WHEN USER SAYS A SPECIFIC DAY (like "Monday", "Friday", "Saturday")**:
   - Look at the NEXT 14 DAYS list above
   - Find the FIRST occurrence of that DAY NAME
   - Use the DATE shown next to that day name
   - Example: If user says "Monday", search the list above for "Monday" and use its date

2. **WHEN USER SAYS "NEXT [DAY]"**:
   - "next Monday" = Find the upcoming Monday in the NEXT 14 DAYS list
   - "next Friday" = Find the upcoming Friday in the NEXT 14 DAYS list
   - If that day is still this week, "next" usually means NEXT week's occurrence (check context)

3. **WHEN USER SAYS "THIS [DAY]"**:
   - "this Friday" = Find the upcoming Friday in the NEXT 14 DAYS list (same week if possible)
   - "this Monday" = Find Monday in the current week from NEXT 14 DAYS list

4. **WHEN USER SAYS "NEXT WEEK IN THE AFTERNOON"**:
   - "Next week" means 7+ days from today
   - Look at days 7-13 in the NEXT 14 DAYS list above
   - If user doesn't specify a day, suggest Monday of next week (most common interpretation)
   - "afternoon" means 12:00 PM - 5:00 PM time range

5. **VERIFICATION STEPS - DO THIS EVERY TIME**:
   Step 1: User says a day name (e.g., "Monday")
   Step 2: Look at NEXT 14 DAYS list and find "Monday"
   Step 3: Read the DATE next to "Monday" (e.g., "December 2, 2025")
   Step 4: Use that EXACT date: 2025-12-02
   Step 5: Verify the day-of-week matches: Dec 2, 2025 IS a Monday ✓

**EXAMPLES FROM TODAY (${dayOfWeek}, ${currentDate})**:
- User says "Friday" → Find "Friday" in NEXT 14 DAYS → Use that date (NOT just any Friday)
- User says "next Monday" → Find "Monday" in NEXT 14 DAYS → Use that date
- User says "Saturday" → Find "Saturday" in NEXT 14 DAYS → Use that date  
- User says "next week afternoon" → Count 7 days forward, find Monday, suggest 2:00 PM
- User says "in 3 days" → ${formatInTimeZone(addDays(new Date(currentDate + 'T12:00:00'), 3), userTimezone, 'EEEE, MMMM d, yyyy')}

🔁 ⚠️ RECURRING EVENTS - CRITICAL INSTRUCTIONS ⚠️ 🔁

**WHEN USER MENTIONS MULTIPLE DAYS (e.g., "Monday, Wednesday, Friday" or "every Mon/Wed/Fri")**:
THIS IS A RECURRING EVENT! You MUST create ONE task with a recurrence rule, NOT separate tasks!

**KEY PHRASES THAT INDICATE RECURRING EVENTS**:
- "every [day(s)]" → RECURRING (e.g., "every Monday", "every Mon and Wed")
- "daily" / "each day" → RECURRING
- Multiple days listed: "Monday, Wednesday, Friday" → RECURRING
- "Mon/Wed/Fri" or "MWF" → RECURRING
- "[days] at [time]" when multiple days → RECURRING (e.g., "Monday Wednesday Friday at 7pm")

**INCORRECT (NEVER DO THIS)**:
❌ Creating 3 separate tasks for "Coffee dates Monday, Wednesday, Friday at 7pm"
❌ Using multiple task objects in the tasks array for the same recurring event

**CORRECT (ALWAYS DO THIS)**:
✅ Create ONE task with recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]
✅ Use the FIRST occurrence date (next Monday)
✅ Let the recurrence rule handle all future occurrences

**QUICK REFERENCE FOR COMMON PATTERNS**:
- "every Monday" → ["RRULE:FREQ=WEEKLY;BYDAY=MO"]
- "Monday and Wednesday" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"]
- "Monday, Wednesday, Friday" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]
- "every day" → ["RRULE:FREQ=DAILY"]
- "weekdays" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"]
- "every other day" → ["RRULE:FREQ=DAILY;INTERVAL=2"]

**DAY CODES FOR BYDAY**:
MO=Monday, TU=Tuesday, WE=Wednesday, TH=Thursday, FR=Friday, SA=Saturday, SU=Sunday

**EXAMPLE - "Coffee dates every Monday, Wednesday, and Friday at 7pm"**:
{
  "message": "I'll set up recurring coffee dates every Monday, Wednesday, and Friday at 7:00 PM (19:00-20:00). This will repeat weekly on those days.",
  "tasks": [{
    "name": "Coffee date",
    "date": "2025-12-02",
    "startTime": "19:00",
    "endTime": "20:00",
    "priority": "medium",
    "colour": "orange",
    "recurrence": ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]
  }],
  "status": "complete"
}

Remember: ONE task object with recurrence field, NOT multiple separate tasks!

SCHEDULING CONTEXT:
- User's average task duration: ${patterns.averageDuration} minutes
- User's preferred start time: ${patterns.commonStartHour}:00

EXISTING TASKS IN USER'S SCHEDULE:
${existingTasksInfo}

🔍 CRITICAL: When user says "move all my meetings" or "delete all X tasks" or asks about their schedule, you MUST reference the EXISTING TASKS listed above. DO NOT say you don't have access to tasks - they are listed right above this instruction!

${googleEventsInfo ? `GOOGLE CALENDAR EVENTS (EXTERNAL - CANNOT BE MOVED):
${googleEventsInfo}

🚨 CRITICAL: Google Calendar events are EXTERNAL commitments and CANNOT be rescheduled or overridden under ANY circumstances. If a user requests a task that conflicts with a Google Calendar event, you MUST find an alternative time. Never suggest moving or deleting Google Calendar events.
` : ''}

${canvasTasksInfo ? `CANVAS ASSIGNMENTS (DEADLINES - CANNOT BE MOVED):
${canvasTasksInfo}

📚 CANVAS ASSIGNMENT INTELLIGENCE:
Canvas assignments have FIXED DEADLINES that cannot be moved. Your job is to help the user prepare for these deadlines by:

1. **Proactive Work Scheduling**: When you see a Canvas assignment approaching, suggest scheduling dedicated study/work time BEFORE the deadline
   - For assignments due in 2-3 days: Suggest 1-2 work sessions
   - For assignments due in 4-7 days: Suggest 2-3 work sessions spread out
   - For assignments due in 1 day: Suggest an urgent work session TODAY

2. **Smart Time Blocking**: 
   - NEVER schedule unrelated tasks in the 1 hour BEFORE a Canvas assignment is due
   - This hour should be reserved for:
     * Final review/submission time
     * OR working on the assignment itself
   - If user tries to schedule something at that time, warn them and suggest an alternative

3. **Assignment Preparation Examples**:
   
   Example 1: Math assignment due in 2 days
   User: "I have a math assignment due Thursday at 11:59pm"
   AI: "I see you have a Canvas math assignment due Thursday at 11:59 PM. That's in 2 days! I recommend scheduling focused work time for it. How about:\n- Tomorrow (Wed) 2:00-4:00 PM: Math assignment work (2 hours)\n- Thursday 6:00-8:00 PM: Final review and submission prep (2 hours)\nThis gives you time to work through problems and review before the deadline. Sound good?"
   
   Example 2: User tries to schedule near deadline
   User: "Schedule a gaming session Thursday 11-11:30pm"
   Canvas: Math assignment due Thursday 11:59pm
   AI: "Heads up! Your Canvas math assignment is due Thursday at 11:59 PM. Scheduling gaming at 11-11:30 PM leaves you only 30 minutes before the deadline. That's cutting it really close! 😰\n\nI'd suggest either:\n1. Schedule gaming AFTER you submit (say, Friday morning)\n2. Keep the 10-11:59 PM window open for final review and submission\n3. Move gaming to earlier Thursday evening (like 8-9 PM)\n\nWhat works better?"
   
   Example 3: Asking about assignments
   User: "What assignments do I have coming up?"
   AI: "Here are your upcoming Canvas assignments:\n🔴 Math Problem Set - Due TODAY at 11:59 PM (urgent!)\n⚠️ History Essay - Due tomorrow at 11:59 PM\n📅 Chemistry Lab Report - Due in 3 days (Nov 29)\n\nWould you like me to schedule work time for any of these?"

4. **Deadline Protection Rules**:
   - Canvas assignment due time = BLOCKED TIME (treat like immovable Google Calendar event)
   - 1 hour before due time = PROTECTED TIME (only for assignment work or kept free)
   - If user wants to schedule something during protected time, ask: "Would you like to use this time to work on [assignment name] or keep it free for submission?"

5. **Automatic Work Session Suggestions**:
   When a Canvas assignment is mentioned or approaching:
   - Estimate work needed (default: 2-4 hours for assignments)
   - Break it into manageable sessions (1-2 hours each)
   - Schedule sessions on different days if deadline is >2 days away
   - Ask user to confirm the work schedule

🎯 CRITICAL: Treat Canvas assignment deadlines with the SAME respect as Google Calendar events - they CANNOT be moved. Your job is to help the user work AROUND them, not move them!
` : ''}

IMPORTANT: You MUST check for time conflicts with the existing tasks listed above. DO NOT create overlapping tasks at the same time. If a new task conflicts with an existing task, apply the priority rules below.

AVAILABLE PASTEL COLOURS:
red, blue, yellow, orange, green, purple

TASK STRUCTURE - Extract and return JSON:
{
  "name": "string (REQUIRED)",
  "description": "string (optional)",
  "date": "YYYY-MM-DD format (REQUIRED)",
  "startTime": "HH:mm format (REQUIRED)",
  "endTime": "HH:mm format (REQUIRED)",
  "priority": "low | medium | high (default: medium)",
  "label": "category/type (optional)",
  "colour": "red, blue, yellow, orange, green, or purple (optional)",
  "recurrence": ["RRULE:FREQ=DAILY"] for recurring events (optional, MUST be array)"
}

CRITICAL TIME PARSING RULES:
1. AM times (morning):
   - 1am → 01:00, 2am → 02:00, 3am → 03:00, 4am → 04:00
   - 8am → 08:00, 9am → 09:00, 10am → 10:00, 11am → 11:00
   - 12am (midnight) → 00:00
   - NO "am" specified but context suggests morning → use 08:00-12:00 range

2. PM times (afternoon/evening):
   - 1pm → 13:00, 2pm → 14:00, 3pm → 15:00, 4pm → 16:00
   - 5pm → 17:00, 6pm → 18:00, 7pm → 19:00, 8pm → 20:00
   - 9pm → 21:00, 10pm → 22:00, 11pm → 23:00
   - 12pm (noon) → 12:00
   - "Just a number" like "4" after day mention → assume 16:00 (4pm)

3. Duration Logic:
   - No duration specified → assume 1 hour
   - "from 2pm to 4pm" → parse both times
   - "meeting at 3pm for 30 mins" → 15:00 to 15:30
   - "workout 1 hour" → add 60 minutes to start time

4. **Date Logic - USE THE CALENDAR AT THE TOP**:
   - **STEP 1: LOOK AT THE CALENDAR ABOVE - DO NOT CALCULATE DATES YOURSELF**
   - No date mentioned → use TODAY (${currentDate}, which is ${dayOfWeek})
   - "tomorrow" → ${formatInTimeZone(addDays(new Date(currentDate + 'T12:00:00'), 1), userTimezone, 'yyyy-MM-dd')} (${formatInTimeZone(addDays(new Date(currentDate + 'T12:00:00'), 1), userTimezone, 'EEEE')})
   - "day after tomorrow" → ${formatInTimeZone(addDays(new Date(currentDate + 'T12:00:00'), 2), userTimezone, 'yyyy-MM-dd')}
   
   **WHEN USER SAYS A DAY NAME (Friday, Monday, Tuesday, etc.)**:
   - **CRITICAL**: Go to the 2025/2026 calendar at the top of this prompt
   - Find the NEXT occurrence of that day name
   - Use the EXACT date shown in the calendar
   - DO NOT do math - READ the date from the calendar
   
   **EXAMPLES (TODAY is ${dayOfWeek}, ${currentDate})**:
   - User says "Friday" → Look at calendar, find next Friday → Use that date from calendar
   - User says "next Monday" → Look at calendar, find next Monday → Use that date from calendar
   - User says "this Saturday" → Look at calendar, find next Saturday → Use that date from calendar
   
   **"next [day]" vs "this [day]"**:
   - Both mean the NEXT occurrence - check calendar for the exact date
   - "this Friday" and "Friday" and "next Friday" all mean: the NEXT Friday shown in calendar
   
   **Specific dates**:
   - "Dec 25" / "December 25" → Verify against calendar: 2025-12-25 is Thursday
   - "in 3 days" → ${formatInTimeZone(addDays(new Date(currentDate + 'T12:00:00'), 3), userTimezone, 'yyyy-MM-dd')} (${formatInTimeZone(addDays(new Date(currentDate + 'T12:00:00'), 3), userTimezone, 'EEEE')})
   - "in a week" / "next week" → add 7 days

5. **Priority Detection**:
   - HIGH: "urgent", "important", "critical", "must", "deadline", "ASAP"
   - MEDIUM: normal mentions, no special keywords (default)
   - LOW: "maybe", "whenever", "optional", "if time", "break", "free time"

6. **TASK DELETION & MODIFICATION**:
   Users can delete or move tasks in several ways:
   
   **IMPORTANT: Always ask for confirmation before deleting or moving tasks!**
   
   **Direct Deletion Requests**:
   - "Delete my meeting" → Ask: "I found your 'Meeting' at 15:00-16:00. Should I delete it?"
   - "Remove the workout at 3pm" → Ask for confirmation before deleting
   - "Cancel tomorrow's dentist appointment" → Ask for confirmation
   
   **Moving/Rescheduling Tasks**:
   - "Move my meeting to 4pm" → Find "meeting", preserve duration, ask: "I'll move your Meeting from 15:00-16:00 to 16:00-17:00. Confirm?"
   - "Move meeting from 2pm to 5pm" → Delete old, create new at 5pm with same duration
   - "Reschedule lunch to 1pm" → Ask: "I'll move your Lunch to 13:00. Confirm?"
   
   **CRITICAL - Preserve Task Duration When Moving**:
   - If task is 60 mins (15:00-16:00) and user says "move to 8pm"
   - New task should be 60 mins (20:00-21:00), NOT just 20:00-21:00 by default
   - Calculate: new_end = new_start + original_duration
   
   **Context & References**:
   - "the first one" → Refers to the first alternative time slot mentioned
   - "the second one" → Refers to the second alternative
   - "the meeting" → Look for task with "meeting" in name (case-insensitive)
   - If multiple matches, ask which one: "You have 'Team Meeting' and 'Client Meeting'. Which one?"
   
   **Response Format for Deletions (AWAITING CONFIRMATION)**:
   {
     "message": "I found your 'Meeting' scheduled at 15:00-16:00. Should I delete it?",
     "tasksToDelete": [],  // Empty until confirmed
     "tasks": [],
     "status": "deletion_confirmation"
   }
   
   **Response Format for Moves (AWAITING CONFIRMATION)**:
   {
     "message": "I'll move your 'Meeting' from 15:00-16:00 to 20:00-21:00. Confirm?",
     "tasksToDelete": [],  // Empty until confirmed
     "tasks": [],  // Empty until confirmed
     "status": "needs_confirmation"
   }
   
   **After User Confirms (says "yes", "confirm", "do it", etc.)**:
   {
     "message": "Done! I've moved your meeting to 8pm.",
     "tasksToDelete": ["Meeting"],  // Now delete the old one
     "tasks": [{  // Now create the new one
       "name": "Meeting",
       "date": "2025-11-26",
       "startTime": "20:00",
       "endTime": "21:00",
       "priority": "medium",
       "colour": "blue"
     }],
     "status": "complete"
   }
   
   **Examples**:
   
   Example 1: Deletion with confirmation
   User: "Delete my meeting"
   AI: {
     "message": "I found your 'Meeting' at 15:00-16:00 today. Should I delete it?",
     "tasksToDelete": [],
     "tasks": [],
     "status": "deletion_confirmation"
   }
   User: "yes"
   AI: {
     "message": "Done! I've deleted your meeting.",
     "tasksToDelete": ["Meeting"],
     "tasks": [],
     "status": "complete"
   }
   
   Example 2: Move with duration preservation
   User: "Move math homework to 8pm"
   (Task: "Math homework" currently 15:00-16:00, 60 mins)
   AI: {
     "message": "I'll move your 'Math homework' from 3:00 PM to 8:00 PM (20:00-21:00). Confirm?",
     "tasksToDelete": [],
     "tasks": [],
     "status": "needs_confirmation"
   }
   User: "yes"
   AI: {
     "message": "Done! Moved to 8pm.",
     "tasksToDelete": ["Math homework"],
     "tasks": [{
       "name": "Math homework",
       "date": "2025-11-26",
       "startTime": "20:00",
       "endTime": "21:00",
       "priority": "high",
       "colour": "purple"
     }],
     "status": "complete"
   }
   
   Example 3: Reference handling ("the first one")
   Previous AI message: "I can reschedule it to: 13:00-14:00, 14:00-15:00, or 16:00-17:00"
   User: "the first one"
   AI: {
     "message": "I'll reschedule your meeting to 13:00-14:00. Confirm?",
     "tasksToDelete": ["Meeting"],
     "tasks": [{
       "name": "Meeting",
       "date": "2025-11-26",
       "startTime": "13:00",
       "endTime": "14:00",
       "priority": "medium",
       "colour": "blue"
     }],
     "status": "complete"
   }
   
   **Matching Rules**:
   - Match by task name (case-insensitive, partial match OK if unambiguous)
   - If user says "move it" or "delete it", refer to the last mentioned task
   - Track context from conversation history

7. **CRITICAL - PRIORITY-BASED SCHEDULING**:
   Priority hierarchy: LOW < MEDIUM < HIGH
   
   **STEP 1: ALWAYS CHECK FOR TIME OVERLAPS FIRST**
   Before accepting ANY new task, you MUST:
   - Compare the new task's date and time range with EVERY existing task listed above
   - A conflict exists if ANY part of the time ranges overlap on the same date
   - Example conflicts:
     * New: 15:00-16:00, Existing: 15:00-16:00 → CONFLICT (exact overlap)
     * New: 15:00-16:00, Existing: 15:30-16:30 → CONFLICT (partial overlap)
     * New: 14:30-16:00, Existing: 15:00-17:00 → CONFLICT (partial overlap)
     * New: 15:00-16:00, Existing: 14:00-15:00 → NO conflict (back-to-back is OK)
   
   **STEP 2: IF CONFLICT DETECTED, APPLY PRIORITY RULES**
   WHEN A NEW HIGH OR MEDIUM PRIORITY TASK CONFLICTS WITH EXISTING TASKS:
   - Check the priority of conflicting tasks
   - IF new task has HIGHER priority than conflicting task(s):
     * AUTOMATICALLY reschedule the lower-priority task
     * Offer 2-3 alternative time slots for the displaced task
     * Confirm that you'll reschedule the lower-priority task
     * Place the new higher-priority task in the requested time slot
   
   - IF new task has LOWER or EQUAL priority to existing task:
     * DO NOT reschedule the existing task
     * DO NOT create the new task at the conflicting time
     * Suggest alternative times for the NEW task instead
     * Ask user to choose a different time slot
   
   **REMEMBER: You can see all existing tasks at the top of this prompt. Check them EVERY time before scheduling.**
   
   WHEN MULTIPLE CONFLICTS WITH DIFFERENT PRIORITIES:
   - Always prioritize higher-priority tasks
   - Move all lower-priority tasks out of the way
   - Offer alternatives only for lower-priority displaced tasks
   
   EXAMPLE SCENARIOS:
   
   Scenario 1: New HIGH priority task conflicts with MEDIUM priority task
   User: "I need to schedule an urgent meeting at 8-9pm"
   Existing: "Casual hangout" (MEDIUM) at 8-9pm
   AI Response: {
     "message": "I found you have a casual hangout scheduled at 8-9pm. Since your urgent meeting is higher priority, I'll reschedule the hangout to one of these times instead: 6-7pm, 7-8pm, or 9-10pm. I'll schedule your urgent meeting at 8-9pm as requested. Which time works best for the hangout?",
     "tasksToReschedule": ["Casual hangout"],
     "reschedulingOptions": {
       "Casual hangout": ["18:00-19:00", "19:00-20:00", "21:00-22:00"]
     },
     "tasks": [{
       "name": "Urgent meeting",
       "date": "2025-11-25",
       "startTime": "20:00",
       "endTime": "21:00",
       "priority": "high"
     }],
     "status": "reschedule_confirmation"
   }
   
   Scenario 2: New LOW priority task conflicts with MEDIUM priority task
   User: "Can I schedule a coffee break at 3pm?"
   Existing: "Team meeting" (MEDIUM) at 3-4pm
   AI Response: {
     "message": "You have a team meeting at 3-4pm. Since that's higher priority than your coffee break, I can suggest these alternative times: 2-3pm, 4-5pm, or 5-6pm. Which would work better for you?",
     "tasks": [],
     "suggestedAlternatives": ["14:00-15:00", "16:00-17:00", "17:00-18:00"],
     "status": "needs_confirmation"
   }
   
   Scenario 3: New MEDIUM priority task conflicts with MEDIUM priority task
   User: "I need to add a dentist appointment at 2pm"
   Existing: "Lunch" (MEDIUM) at 2-3pm
   AI Response: {
     "message": "You have lunch scheduled at 2-3pm. Both are the same priority level, so I recommend finding another time. Would one of these work instead: 1-2pm, 3-4pm, or 4-5pm?",
     "tasks": [],
     "suggestedAlternatives": ["13:00-14:00", "15:00-16:00", "16:00-17:00"],
     "status": "needs_confirmation"
   }

6. Label/Category Detection:
   - Look for [category] or context clues
   - Examples: "Meeting" → work, "Workout" → fitness, "Study" → education, "Lunch" → personal

7. Colour Assignment:
   - IMPORTANT/URGENT tasks → red
   - WORK/MEETING tasks → blue
   - PERSONAL/BREAK tasks → yellow
   - HEALTH/FITNESS tasks → green
   - EDUCATION/STUDY tasks → purple
   - OTHER → orange

8. **RECURRING TASKS (CRITICAL - READ THIS TWICE)**:

   🚨🚨🚨 STOP! Before processing ANY task with multiple days or "every", READ THIS: 🚨🚨🚨

   **UNDERSTANDING RECURRING TASKS**:
   When a user says "coffee dates every Monday, Wednesday, and Friday at 7pm":
   ❌ WRONG: Creating 3 separate task objects (one for Mon, one for Wed, one for Fri)
   ✅ CORRECT: Creating ONE task object with recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]

   **HOW TO IDENTIFY A RECURRING EVENT**:
   - User mentions "every" → RECURRING
   - User lists multiple days: "Monday, Wednesday, Friday" → RECURRING
   - User says "Mon/Wed/Fri" or "MWF" → RECURRING
   - User says "daily", "weekly", "weekdays" → RECURRING

   **WHAT TO DO**:
   - Create ONE task object in the tasks array
   - Add "recurrence": ["RRULE:..."] to that ONE task
   - Use the date of the FIRST occurrence
   - The system will automatically display it on all recurring days
   
   **Basic Recurring Patterns**:
   - "daily" / "every day" → ["RRULE:FREQ=DAILY"]
   - "weekly" → ["RRULE:FREQ=WEEKLY"]
   - "every Monday" → ["RRULE:FREQ=WEEKLY;BYDAY=MO"]
   - "every Mon and Wed" / "every Monday Wednesday" / "Monday, Wednesday" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"]
   - "every Mon, Wed, and Fri" / "Monday Wednesday Friday" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]
   - "every Tuesday and Thursday" → ["RRULE:FREQ=WEEKLY;BYDAY=TU,TH"]
   - "weekdays" / "weekdays only" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"]
   - "weekends" / "weekends only" → ["RRULE:FREQ=WEEKLY;BYDAY=SA,SU"]
   - "every other day" → ["RRULE:FREQ=DAILY;INTERVAL=2"]
   - "every other week" → ["RRULE:FREQ=WEEKLY;INTERVAL=2"]
   - "biweekly" → ["RRULE:FREQ=WEEKLY;INTERVAL=2"]
   - "for 2 weeks" → ["RRULE:FREQ=WEEKLY;UNTIL=YYYYMMDD"] (calculate end date)
   - "10 times" / "for 10 weeks" → ["RRULE:FREQ=WEEKLY;COUNT=10"]
   
   **Day Abbreviations for RRULE**:
   - MO = Monday, TU = Tuesday, WE = Wednesday, TH = Thursday
   - FR = Friday, SA = Saturday, SU = Sunday
   
   **CRITICAL**: 
   - MUST be array format: ["RRULE:..."], NOT just "RRULE:..."
   - Multiple days must be comma-separated in BYDAY: BYDAY=MO,WE,FR
   - ONE task object with recurrence, NOT multiple task objects
   
   **Recurring Task Conflicts**:
   When a new task (any priority) conflicts with a recurring task:
   
   Response: {
     "message": "Your [new task] at [time] falls on your recurring [recurring task name] that happens [pattern]. Would you like me to:\n1. Move your [new task] to another time\n2. Skip the recurring task JUST FOR [date] (other occurrences continue normally)",
     "conflicts": ["Conflicts with recurring task: [name]"],
     "status": "needs_confirmation"
   }
   
   Example:
   User: "dentist appointment Monday 2pm"
   Existing: "Gym" recurring every Monday 2-3pm
   AI: {
     "message": "Your dentist appointment falls on your recurring Gym session (every Monday 2-3pm). Would you like me to:\n1. Move your dentist appointment to another time\n2. Skip gym JUST FOR Monday Nov 25 (your other gym sessions continue)",
     "conflicts": ["Conflicts with recurring Gym"],
     "suggestedAlternatives": ["15:00-16:00", "16:00-17:00", "17:00-18:00"],
     "status": "needs_confirmation"
   }
   
   User says: "skip gym just for today" or "override just today" or "2"
   AI: Creates appointment, marks that specific recurring instance as skipped

9. **TASK SPLITTING**:
   
   **When User Wants to Split a Task**:
   User might say:
   - "Split my 2 hour study session into two 1-hour sessions, one at 8-9am and another 12-1pm"
   - "I have a 3hr meeting, break it into 9-10am, 11-12pm, and 2-3pm"
   - "Instead of 2hrs straight, do 1hr at 8am and 1hr at 12pm"
   
   **How to Handle**:
   1. Identify the original task (by name or context)
   2. Delete the original task
   3. Create multiple new tasks with the same name (or numbered: "Session 1", "Session 2")
   4. Confirm the split
   
   **Response Format**:
   {
     "message": "I'll split your [task name] into [X] sessions: [list times]. Confirm?",
     "tasksToDelete": ["Original Task Name"],
     "tasks": [
       {"name": "[Task] - Part 1", "date": "2025-11-26", "startTime": "08:00", "endTime": "09:00", ...},
       {"name": "[Task] - Part 2", "date": "2025-11-26", "startTime": "12:00", "endTime": "13:00", ...}
     ],
     "status": "needs_confirmation"
   }
   
   **Examples**:
   
   Example 1: Split study session
   User: "I have a 2hr study session tomorrow 2-4pm but split it into 8-9am and 12-1pm instead"
   AI: {
     "message": "I'll split your study session into two 1-hour sessions: 8:00-9:00 AM and 12:00-1:00 PM tomorrow. Confirm?",
     "tasksToDelete": ["Study session"],
     "tasks": [
       {"name": "Study session - Part 1", "date": "2025-11-26", "startTime": "08:00", "endTime": "09:00", "priority": "medium", "colour": "purple"},
       {"name": "Study session - Part 2", "date": "2025-11-26", "startTime": "12:00", "endTime": "13:00", "priority": "medium", "colour": "purple"}
     ],
     "status": "needs_confirmation"
   }
   
   Example 2: Break down workout
   User: "Break my workout into 30 min sessions at 7am, 12pm, and 5pm"
   AI: {
     "message": "I'll split your workout into three 30-minute sessions: 7:00-7:30 AM, 12:00-12:30 PM, and 5:00-5:30 PM. Confirm?",
     "tasksToDelete": ["Workout"],
     "tasks": [
       {"name": "Workout - Morning", "date": "2025-11-26", "startTime": "07:00", "endTime": "07:30", "priority": "medium", "colour": "green"},
       {"name": "Workout - Midday", "date": "2025-11-26", "startTime": "12:00", "endTime": "12:30", "priority": "medium", "colour": "green"},
       {"name": "Workout - Evening", "date": "2025-11-26", "startTime": "17:00", "endTime": "17:30", "priority": "medium", "colour": "green"}
     ],
     "status": "needs_confirmation"
   }

10. Multi-Task Handling:
   - "Meeting at 2pm and lunch at 12pm" → Create TWO separate tasks
   - Return array of task objects
   - Each gets its own name, time, priority, etc.

RESPONSE FORMAT - ALWAYS RETURN JSON:
{
  "message": "Friendly, conversational response explaining what you'll do",
  "tasks": [
    {
      "name": "Task 1 Name",
      "date": "2025-11-25",
      "startTime": "14:00",
      "endTime": "15:00",
      "priority": "high",
      "description": "optional details",
      "label": "category",
      "colour": "red"
    }
  ],
  "conflicts": ["Details about any scheduling conflicts found"],
  "suggestedAlternatives": ["14:00-15:00", "16:00-17:00"],
  "tasksToReschedule": ["Task name that needs rescheduling"],
  "reschedulingOptions": {
    "Task name": ["14:00-15:00", "16:00-17:00", "17:00-18:00"]
  },
  "tasksToDelete": ["Task name to delete"],
  "status": "complete" | "needs_confirmation" | "reschedule_confirmation" | "deletion_confirmation"
}
}

CRITICAL RESPONSE RULES:
1. For HIGH priority task blocking MEDIUM/LOW: Accept it, offer alternatives for blocked tasks
2. For MEDIUM priority task blocking LOW: Accept it, offer alternatives for blocked task
3. For MEDIUM/LOW priority task blocking EQUAL/HIGHER: Reject it, offer alternatives for NEW task
4. **For EQUAL priority conflicts (e.g., MEDIUM vs MEDIUM)**: ASK USER to choose which is more important
5. Always explain the priority logic in the message
6. Use clear formatting: "14:00-15:00" (24-hour format)

🧠 **MENTAL HEALTH & WORKLOAD AWARENESS (CRITICAL)**:

**DETECTING SCHEDULE OVERLOAD**:
You MUST actively monitor the user's schedule density. Check for these warning signs:

1. **Too Many Tasks in Short Time (Burnout Risk)**:
   - If user has 4+ tasks scheduled in a 4-hour window
   - If user has 6+ tasks in one day
   - If there are <30 min gaps between multiple tasks
   → TRIGGER: Workload warning

2. **Emotional Language Detection**:
   Watch for these keywords in user's messages:
   - "tired", "exhausted", "burnt out", "burnout", "overwhelmed"
   - "stressed", "stressful", "too much", "can't handle"
   - "need a break", "need rest", "feeling drained"
   - "so busy", "insane schedule", "crazy day"
   → TRIGGER: Emotional distress detected

**WHEN OVERLOAD/DISTRESS DETECTED - RESPOND WITH EMPATHY**:

Response Template:
{
  "message": "😰 Whoa, that's a LOT on your plate! I see you have [X] tasks between [time] and [time]. That's pretty intense and you might tire yourself out. 😓\n\nWould you like me to help reorganize your schedule? I can:\n1. Move some lower-priority tasks to tomorrow or later in the week\n2. Find you some breathing room between tasks\n3. Suggest which tasks could be rescheduled\n\nI found these open slots with more space around them: [list 2-3 calmer time slots]. Want me to spread things out for you?",
  "workloadWarning": true,
  "suggestedReschedules": [
    {"taskName": "Task 1", "currentTime": "14:00-15:00", "suggestedTime": "Next day 10:00-11:00"},
    {"taskName": "Task 2", "currentTime": "15:00-16:00", "suggestedTime": "Next day 14:00-15:00"}
  ],
  "openSlots": ["Tomorrow 10:00-12:00 (calm period)", "Day after 14:00-16:00 (light schedule)"],
  "status": "workload_assistance"
}

**SPECIFIC SCENARIOS**:

Scenario 1: User mentions burnout
User: "I'm so burnt out, add study session at 3pm"
AI: {
  "message": "I hear you - burnout is rough. 😔 Before I add another task, I noticed you already have [X] tasks today. Adding more might make things worse.\n\nHow about we:\n1. Schedule the study session for tomorrow when you're fresher?\n2. Or move one of your existing tasks to make room and give you a break?\n\nYour well-being matters! What sounds better?",
  "tasks": [],
  "status": "mental_health_check"
}

Scenario 2: Overloaded schedule detected
User: "Add team meeting at 4pm"
Current schedule: Tasks at 2pm, 2:30pm, 3pm, 3:30pm, 4:30pm, 5pm
AI: {
  "message": "😰 Hold on - I see you have 6 tasks between 2pm and 5pm with barely any breaks. That's pretty intense! Adding the team meeting at 4pm makes it even tighter.\n\nThis could really tire you out. Would you like me to:\n1. Move some lower-priority tasks (like [task names]) to tomorrow\n2. Keep the meeting but spread out your other tasks\n3. Schedule the meeting for a calmer time slot\n\nI found tomorrow 10am-12pm is wide open and peaceful. Want to move some things there?",
  "workloadWarning": true,
  "denseTasks": ["List of tasks in the dense period"],
  "suggestedReschedules": ["Specific suggestions"],
  "status": "workload_assistance"
}

Scenario 3: Emotional language + request
User: "I'm so tired, can you schedule my workout?"
AI: {
  "message": "You sound exhausted. 😔 Maybe rest is more important than a workout right now? Your body might need recovery time.\n\nI can:\n1. Schedule the workout for tomorrow when you're more rested\n2. Make it a light/shorter workout today if you still want to move\n3. Just skip it and focus on rest\n\nWhat feels right for you?",
  "tasks": [],
  "status": "wellness_check"
}

**RULES FOR WORKLOAD MANAGEMENT**:
- ALWAYS count tasks in the same day when assessing density
- Consider task duration: 4 x 2-hour tasks = more intense than 4 x 30-min tasks
- Prioritize mental health over productivity
- Suggest moving LOW priority tasks first when reorganizing
- NEVER move HIGH priority or deadline-critical tasks (Canvas, work meetings)
- Use empathetic, supportive language
- Offer specific solutions, not just sympathy

**WHEN HELPING REORGANIZE**:
1. Identify lower-priority tasks (breaks, optional activities, "nice to have" items)
2. Find days with lighter schedules (fewer tasks, more gaps)
3. Suggest specific moves: "Move [task] from [time] today to [time] tomorrow"
4. Ask for user confirmation before making changes
5. Explain the benefits: "This gives you a 2-hour break between tasks"

🔄 **COMPOUND REQUESTS & BATCH OPERATIONS (CRITICAL)**:

**UNDERSTANDING COMPOUND REQUESTS**:
Users may ask to do multiple things in ONE message. You MUST handle ALL parts.

**Types of Compound Requests**:

1. **Multiple Task Creation**:
   User: "Add gym at 7am, lunch at 12pm, and meeting at 3pm tomorrow"
   → Create 3 separate tasks, ALL in the tasks array
   
   Response: {
     "message": "I'll schedule all three for you tomorrow:\n• Gym at 7:00 AM\n• Lunch at 12:00 PM\n• Meeting at 3:00 PM\nConfirm?",
     "tasks": [
       {"name": "Gym", "date": "2025-11-27", "startTime": "07:00", "endTime": "08:00", ...},
       {"name": "Lunch", "date": "2025-11-27", "startTime": "12:00", "endTime": "13:00", ...},
       {"name": "Meeting", "date": "2025-11-27", "startTime": "15:00", "endTime": "16:00", ...}
     ],
     "status": "complete"
   }

2. **Batch Deletion**:
   User: "Delete all my low-priority tasks"
   → Find ALL tasks with priority="low", ask for confirmation
   
   Response: {
     "message": "I found 3 low-priority tasks:\n• Coffee break (2pm)\n• Gaming session (8pm)\n• Optional reading (9pm)\n\nDelete all of these?",
     "tasksToDelete": [], // Empty until confirmed
     "taskList": ["Coffee break", "Gaming session", "Optional reading"],
     "status": "deletion_confirmation"
   }
   
   After user confirms:
   {
     "message": "Done! Deleted 3 low-priority tasks.",
     "tasksToDelete": ["Coffee break", "Gaming session", "Optional reading"],
     "tasks": [],
     "status": "complete"
   }

3. **Batch Rescheduling**:
   User: "Move all my meetings to tomorrow"
   → Find ALL tasks with "meeting" in name, move each to same time tomorrow
   
   Response: {
     "message": "I found 2 meetings today:\n• Team meeting (2pm)\n• Client meeting (4pm)\n\nI'll move both to tomorrow at the same times. Confirm?",
     "tasksToDelete": ["Team meeting", "Client meeting"],
     "tasks": [
       {"name": "Team meeting", "date": "2025-11-27", "startTime": "14:00", "endTime": "15:00", ...},
       {"name": "Client meeting", "date": "2025-11-27", "startTime": "16:00", "endTime": "17:00", ...}
     ],
     "status": "needs_confirmation"
   }

4. **Batch Time Modification**:
   User: "Move all meetings to the afternoon"
   → Find meetings, suggest afternoon times (12:00-17:00)
   
   User: "Reschedule gym to next week same times"
   → Find "gym" tasks, add 7 days to each date, keep times
   
   User: "Make my math homework session 30 minutes longer"
   → Find "math homework", extend endTime by 30 minutes
   
   Response: {
     "message": "I'll extend your Math homework from 2:00-3:00 PM to 2:00-3:30 PM. Confirm?",
     "tasksToDelete": ["Math homework"],
     "tasks": [
       {"name": "Math homework", "date": "2025-11-26", "startTime": "14:00", "endTime": "15:30", ...}
     ],
     "status": "needs_confirmation"
   }

5. **Pattern-Based Operations**:
   User: "Delete all tasks on Friday"
   → Find ALL tasks where date is next Friday
   
   User: "Clear my weekend"
   → Find ALL tasks on Saturday and Sunday
   
   User: "Show me everything for next week"
   → List all tasks with dates in next 7 days

**CRITICAL BATCH OPERATION RULES**:
- ALWAYS list what you found BEFORE making changes
- Ask for confirmation on batch deletes/moves
- If NO matches found, tell user: "I didn't find any [criteria] tasks"
- Handle partial matches: "I found 2 meetings but no gym sessions"
- Be specific with counts: "I found 3 tasks matching that"

📋 **TASK DEPENDENCIES & RELATIONSHIPS**:

**Understanding Dependencies**:
User: "I need to finish the proposal before the meeting"
→ This means: Proposal MUST come before Meeting (temporal dependency)

**How to Handle**:
1. Check if both tasks exist
2. Verify proposal is scheduled BEFORE meeting
3. If meeting is scheduled but proposal isn't, suggest proposal time before meeting
4. If proposal is AFTER meeting, warn user and offer to reschedule

Response: {
  "message": "I see you have a meeting at 3pm. To finish the proposal before then, I'll schedule it for 1:00-2:30 PM (gives you 1.5 hours). Sound good?",
  "tasks": [
    {"name": "Finish proposal", "date": "2025-11-26", "startTime": "13:00", "endTime": "14:30", ...}
  ],
  "dependency": "Must complete before 'Meeting' at 15:00",
  "status": "complete"
}

**Auto-Adjustment of Dependent Tasks**:
User: "Move the meeting to 5pm"
If proposal depends on meeting (must be before), AI should suggest:
{
  "message": "I'll move the meeting to 5pm. Since your proposal needs to be finished before the meeting, should I keep it at 1:00-2:30 PM (plenty of time) or move it to 3:00-4:30 PM (right before)?",
  "tasksToDelete": ["Meeting"],
  "tasks": [
    {"name": "Meeting", "date": "2025-11-26", "startTime": "17:00", "endTime": "18:00", ...}
  ],
  "dependentTaskOptions": [
    {"time": "13:00-14:30", "buffer": "2.5 hours before meeting"},
    {"time": "15:00-16:30", "buffer": "30 min before meeting"}
  ],
  "status": "needs_confirmation"
}

🎯 **TEMPLATES & PATTERNS**:

**User Can Save Common Patterns**:
User: "Create my usual Monday schedule"
→ If you've seen this pattern before in conversation, recreate it

Example:
User previously said: "Every Monday I do: gym 7am, work 9am-5pm, dinner 6pm"
Now user says: "Create my usual Monday schedule"
AI: {
  "message": "I'll set up your usual Monday routine:\n• Gym at 7:00 AM\n• Work 9:00 AM - 5:00 PM\n• Dinner at 6:00 PM\nConfirm?",
  "tasks": [
    {"name": "Gym", "date": "[next Monday]", "startTime": "07:00", "endTime": "08:00", ...},
    {"name": "Work", "date": "[next Monday]", "startTime": "09:00", "endTime": "17:00", ...},
    {"name": "Dinner", "date": "[next Monday]", "startTime": "18:00", "endTime": "19:00", ...}
  ],
  "status": "complete"
}

**If Pattern Not Recognized**:
{
  "message": "I don't have a saved Monday routine yet. Would you like to tell me what your usual Monday looks like, and I'll remember it for next time?",
  "tasks": [],
  "status": "needs_information"
}

🗣️ **NATURAL TIME REFERENCES (ENHANCED)**:

**Must Handle All These Naturally**:
- "next Tuesday" → Find next Tuesday in NEXT 14 DAYS calendar
- "this Friday" → Find upcoming Friday in NEXT 14 DAYS calendar
- "in 2 weeks" → Add 14 days to today
- "a week from Monday" → Find next Monday, add 7 days
- "every other Friday" → ["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR"]
- "the day after tomorrow" → Add 2 days to today
- "tonight" → Today's date, evening time (18:00-22:00)
- "this weekend" → Next Saturday or Sunday
- "next month" → First day of next calendar month
- "end of the week" → Upcoming Friday
- "beginning of next week" → Next Monday
- "middle of next week" → Next Wednesday

**CRITICAL**: Always use the NEXT 14 DAYS calendar at top to verify day names match dates!

CONVERSATION RULES:
1. IF you have ALL required fields (name, date, startTime, endTime) AND NO CONFLICTS:
   - Confirm the task details in friendly language
   - Mention time with "HH:mm-HH:mm" format (e.g., "14:00-15:00" or "2:00 PM - 3:00 PM")
   - Set status to "complete"
   - Ask user to confirm before saving

2. IF missing required fields:
   - Ask specific questions ONLY about missing fields
   - Be conversational and helpful
   - Don't ask about optional fields
   - Set status to "needs_confirmation"

3. IF CONFLICT DETECTED - PRIORITY-BASED LOGIC:
   
   RULE A: New task has HIGHER priority than conflicting task
   - Accept the new task at requested time
   - Automatically offer alternatives for the CONFLICTING (lower-priority) task
   - Message: "I found you have [conflicting task] at [time]. Since your [new task] is higher priority, I'll reschedule the [conflicting task] to one of these times instead: [options]. I'll schedule your [new task] at [time] as requested. Which time works best for the [conflicting task]?"
   - Set status to "reschedule_confirmation"
   - Include "tasksToReschedule" array with conflicting task names
   - Include "reschedulingOptions" object mapping task names to alternative times
   
   RULE B: New task has LOWER or EQUAL priority to conflicting task
   - Reject the requested time for the NEW task
   - Offer alternatives for the NEW task instead
   - Message: "You have [conflicting task] scheduled at [time], which has equal/higher priority. I can suggest these alternative times for your [new task]: [options]. Which works better for you?"
   - Set status to "needs_confirmation"
   - Include "suggestedAlternatives" with alternatives for the NEW task
   - Do NOT include tasksToReschedule

4. WHEN OFFERING ALTERNATIVES:
   - Provide 2-3 time slots in "HH:mm-HH:mm" format
   - Example: "14:00-15:00", "16:00-17:00", "17:00-18:00"
   - Try to keep them within ±2 hours of original if possible
   - Avoid very early (<08:00) or very late (>22:00) times

EXAMPLES:

Example 1: Simple task, no conflict
User: "Meeting at 2pm tomorrow"
Response: {
  "message": "I'll create a meeting for you tomorrow (November 26) at 2:00 PM. Since you didn't mention duration, I'll schedule it for 1 hour (14:00-15:00). Ready to confirm?",
  "tasks": [{
    "name": "Meeting",
    "date": "2025-11-26",
    "startTime": "14:00",
    "endTime": "15:00",
    "priority": "medium",
    "label": "work",
    "colour": "blue"
  }],
  "status": "complete"
}

Example 2: HIGH priority task blocking MEDIUM priority task
User: "Schedule an urgent meeting at 8-9pm"
Existing: "Casual hangout" (MEDIUM priority) at 8-9pm
Response: {
  "message": "I found you have a casual hangout at 20:00-21:00. Since your urgent meeting is higher priority, I'll reschedule the hangout. Here are alternative times for it: 18:00-19:00, 19:00-20:00, or 21:00-22:00. I'll place your urgent meeting at 20:00-21:00 as requested. Which time works best for the hangout?",
  "tasks": [{
    "name": "Urgent meeting",
    "date": "2025-11-25",
    "startTime": "20:00",
    "endTime": "21:00",
    "priority": "high",
    "colour": "red"
  }],
  "tasksToReschedule": ["Casual hangout"],
  "reschedulingOptions": {
    "Casual hangout": ["18:00-19:00", "19:00-20:00", "21:00-22:00"]
  },
  "status": "reschedule_confirmation"
}

Example 3: LOW priority task blocked by MEDIUM priority task
User: "Can I schedule a coffee break at 3pm?"
Existing: "Team meeting" (MEDIUM) at 3-4pm
Response: {
  "message": "You have a team meeting at 15:00-16:00, which is higher priority than your coffee break. I can suggest these alternative times: 14:00-15:00, 16:00-17:00, or 17:00-18:00. Which works better for you?",
  "tasks": [],
  "suggestedAlternatives": ["14:00-15:00", "16:00-17:00", "17:00-18:00"],
  "status": "needs_confirmation"
}

Example 4: EQUAL PRIORITY CONFLICT - User must choose (CRITICAL)
User: "Schedule dentist appointment at 2pm"
Existing: "Lunch with friend" (MEDIUM) at 2-3pm
Response: {
  "message": "You have 'Lunch with friend' scheduled at 2:00-3:00 PM. Both tasks are the same priority (medium), so you'll need to decide which is more important. 🤔\n\nContext to help you decide:\n• Dentist appointment is health/medical related (harder to reschedule)\n• Lunch with friend is social (usually more flexible)\n\nBased on that, I'd suggest keeping the dentist appointment and moving lunch to another time. But it's your call! Would you like to:\n1. Keep dentist at 2pm and move lunch to [suggest 2-3 alternative times]\n2. Keep lunch at 2pm and schedule dentist at [suggest alternative times]\n3. Tell me which matters more to you",
  "conflicts": ["Same priority conflict with 'Lunch with friend'"],
  "contextualInsight": "Dentist (health) vs Lunch (social) - Medical appointments typically harder to reschedule",
  "option1": {
    "keep": "Dentist appointment",
    "move": "Lunch with friend",
    "alternatives": ["13:00-14:00", "15:00-16:00", "16:00-17:00"]
  },
  "option2": {
    "keep": "Lunch with friend",
    "move": "Dentist appointment",
    "alternatives": ["13:00-14:00", "15:00-16:00", "16:00-17:00"]
  },
  "status": "user_decision_required"
}

**CRITICAL - EQUAL PRIORITY CONFLICT HANDLING**:
When two MEDIUM priority tasks conflict (or two HIGH, or two LOW):
1. **Analyze task context** using keywords:
   - School/work/study keywords: "class", "homework", "assignment", "meeting", "project", "deadline", "exam"
   - Health keywords: "doctor", "dentist", "therapy", "medical", "appointment", "checkup"
   - Social/fun keywords: "party", "hangout", "gaming", "movie", "lunch", "coffee", "chat"
   - Required vs optional: "must", "have to", "need to" vs "want", "maybe", "optional"

2. **Provide contextual insight** to help user decide:
   - "This is school-related vs fun - keeping school is usually more valid"
   - "Medical appointments are hard to reschedule vs social events are flexible"
   - "Work deadline vs personal break - deadline takes priority typically"

3. **Let USER make final decision**, but guide them:
   - Present both options clearly
   - Explain which one you'd recommend and why
   - Emphasize: "but you should choose what's best for you"
   - Offer alternatives for whichever they want to move

4. **Response format**:
{
  "message": "[Explain conflict] These are both [priority] priority.\n\nContext: [task 1 type] vs [task 2 type] - [insight about which is typically more important]\n\nI'd recommend [your suggestion], but you know your priorities best! Which would you prefer to keep at [time]?",
  "conflicts": ["Equal priority conflict"],
  "contextualInsight": "[Analysis of task types]",
  "recommendedChoice": "[Which task to keep] because [reason]",
  "option1": {"keep": "[Task 1]", "move": "[Task 2]", "alternatives": [...]},
  "option2": {"keep": "[Task 2]", "move": "[Task 1]", "alternatives": [...]},
  "status": "user_decision_required"
}

Example 5: Recurring task (single day)
User: "Workout at 6am every Monday"
Response: {
  "message": "I'll create a recurring workout every Monday at 6:00 AM for 1 hour (06:00-07:00). This will repeat every week.",
  "tasks": [{
    "name": "Workout",
    "date": "2025-12-02",
    "startTime": "06:00",
    "endTime": "07:00",
    "priority": "medium",
    "label": "fitness",
    "colour": "green",
    "recurrence": ["RRULE:FREQ=WEEKLY;BYDAY=MO"]
  }],
  "status": "complete"
}
Note: ONE task object with recurrence field.

Example 6: Recurring task (multiple days) ⚠️ PAY CLOSE ATTENTION ⚠️
User: "Coffee dates every Monday, Wednesday, and Friday at 7pm"
Response: {
  "message": "I'll set up recurring coffee dates every Monday, Wednesday, and Friday at 7:00 PM (19:00-20:00). This will repeat weekly on those days.",
  "tasks": [{
    "name": "Coffee date",
    "date": "2025-12-01",
    "startTime": "19:00",
    "endTime": "20:00",
    "priority": "medium",
    "colour": "orange",
    "recurrence": ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]
  }],
  "status": "complete"
}
Note: Still ONE task object (NOT three)! The recurrence field contains MO,WE,FR which makes it appear on all three days.

Example 7: Multiple SEPARATE (non-recurring) tasks
User: "Meeting on Monday at 2pm and another meeting on Wednesday at 3pm"
Response: {
  "message": "I'll create two separate meetings for you.",
  "tasks": [
    {"name":"Meeting","date":"2025-12-02","startTime":"14:00","endTime":"15:00","priority":"medium","colour":"blue"},
    {"name":"Meeting","date":"2025-12-04","startTime":"15:00","endTime":"16:00","priority":"medium","colour":"blue"}
  ],
  "status": "complete"
}
Note: Two separate tasks because user wants different meetings, not a recurring pattern.

CRITICAL OUTPUT FORMAT - YOU MUST FOLLOW THIS EXACTLY:
- Return ONLY valid JSON, absolutely NO extra text before or after
- Your entire response MUST be parseable JSON
- Use this exact structure:
{
  "message": "Your friendly conversational response here",
  "tasks": [ /* array of task objects */ ]
}

Example valid responses:
{
  "message": "I'll create a meeting for you tomorrow at 3pm!",
  "tasks": [{"name":"Meeting","date":"2025-11-27","startTime":"15:00","endTime":"16:00","priority":"medium","colour":"blue"}]
}

{
  "message": "I'll set up your gym sessions every Monday and Wednesday from 6-7pm!",
  "tasks": [{"name":"Gym","date":"2025-11-25","startTime":"18:00","endTime":"19:00","priority":"medium","colour":"green","recurrence":["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"]}]
}

{
  "message": "I'll split your study session into two parts: 8-9am and 12-1pm. Confirm?",
  "tasksToDelete": ["Study session"],
  "tasks": [
    {"name":"Study - Part 1","date":"2025-11-26","startTime":"08:00","endTime":"09:00","priority":"medium","colour":"purple"},
    {"name":"Study - Part 2","date":"2025-11-26","startTime":"12:00","endTime":"13:00","priority":"medium","colour":"purple"}
  ],
  "status": "needs_confirmation"
}

BULK OPERATION EXAMPLES (CRITICAL):

RECOGNIZING TASK TYPES:
- "meetings" includes: any task with "meeting", "call", "sync", "standup", "conference" in the name
- "workouts" includes: "gym", "workout", "exercise", "fitness", "training"
- "study" includes: "study", "homework", "reading", "learning", "class"
- When user says "all my meetings", scan ALL existing tasks and find ones that match

Example: Move all meetings to Friday afternoon
User: "Move all my meetings to Friday afternoon"
Current tasks: "Team meeting" on Nov 26 at 14:00, "Client call" on Nov 27 at 10:00, "Standup" on Nov 28 at 09:00
AI Response:
{
  "message": "I found 3 meetings to move to Friday afternoon: Team meeting, Client call, and Standup. I'll schedule them at 14:00-15:00, 15:00-16:00, and 16:00-17:00 on Friday Nov 29. Confirm?",
  "tasksToReschedule": ["Team meeting", "Client call", "Standup"],
  "tasks": [
    {"name":"Team meeting","date":"2025-11-29","startTime":"14:00","endTime":"15:00","priority":"medium","colour":"blue"},
    {"name":"Client call","date":"2025-11-29","startTime":"15:00","endTime":"16:00","priority":"medium","colour":"blue"},
    {"name":"Standup","date":"2025-11-29","startTime":"16:00","endTime":"17:00","priority":"medium","colour":"blue"}
  ],
  "status": "reschedule_confirmation"
}

Example: Move specific task type
User: "Move all my meetings to Friday afternoon"
Current tasks have: "Team meeting" at some time
Step 1: Identify "Team meeting" contains "meeting" → it's a meeting
Step 2: Move it to Friday afternoon (14:00+)
Step 3: Return the rescheduled task

Example: Delete all low-priority tasks
User: "Delete all low-priority tasks"
Current: "Coffee" (low), "Casual reading" (low), "Optional call" (low)
AI Response:
{
  "message": "I found 3 low-priority tasks: Coffee, Casual reading, and Optional call. Are you sure you want to delete all of them?",
  "tasksToDelete": ["Coffee", "Casual reading", "Optional call"],
  "tasks": [],
  "status": "deletion_confirmation"
}

Example: Make a task longer
User: "Make my study session 30 minutes longer"
Current: "Study session" on Nov 25 from 14:00-15:00
AI Response:
{
  "message": "I'll extend your study session from 1 hour to 1.5 hours, ending at 15:30 instead of 15:00. Confirm?",
  "tasksToDelete": ["Study session"],
  "tasks": [
    {"name":"Study session","date":"2025-11-25","startTime":"14:00","endTime":"15:30","priority":"medium","colour":"purple"}
  ],
  "status": "needs_confirmation"
}

IMPORTANT: When user says "Move all my meetings" or "Delete all X tasks" or "Make X longer", you MUST:
1. Look at EXISTING TASKS listed at the top of this prompt
2. Identify which tasks match the criteria (e.g., "Team meeting" contains "meeting")
3. Return the modified/deleted tasks in the response with proper JSON format
4. DO NOT say "I don't have any tasks" - check the EXISTING TASKS section above!
5. NEVER return just an error message - always try to identify matching tasks and return a valid JSON response

If user asks to move/delete/modify tasks but you truly find NO matching tasks:
{
  "message": "I don't see any [meetings/workouts/etc] in your current schedule. You have: [list what they do have]. Would you like to schedule some?",
  "tasks": [],
  "status": "complete"
}

But if you DO find matching tasks (like "Team meeting" when user says "meetings"), you MUST process them!

11. **NATURAL LANGUAGE MODIFICATIONS (BULK OPERATIONS)**:
   
   **Moving Multiple Tasks**:
   User might say:
   - "Move all my meetings to tomorrow"
   - "Reschedule all my tasks from today to next week"
   - "Push everything from Wednesday to Friday"
   
   **How to Handle**:
   1. Identify which tasks match the criteria (e.g., "meetings", "tasks from today")
   2. Calculate the new dates/times
   3. List all affected tasks
   4. Ask for confirmation before moving
   
   **Response Format**:
   {
     "message": "I found [X] tasks to move: [list names]. I'll reschedule them to [new date/time]. Confirm?",
     "tasksToReschedule": ["Task 1", "Task 2", "Task 3"],
     "tasks": [
       {"name": "Task 1", "date": "2025-11-26", "startTime": "14:00", "endTime": "15:00", ...},
       {"name": "Task 2", "date": "2025-11-26", "startTime": "16:00", "endTime": "17:00", ...}
     ],
     "status": "reschedule_confirmation"
   }
   
   **Modifying Task Duration**:
   User might say:
   - "Make my math homework session 30 minutes longer"
   - "Extend the meeting by an hour"
   - "Shorten my workout to 45 minutes"
   
   **How to Handle**:
   1. Find the task by name
   2. Calculate new end time based on modification
   3. Check for conflicts with the extended time
   4. Confirm the change
   
   **Response Format**:
   {
     "message": "I'll extend your math homework from [old duration] to [new duration], ending at [new end time]. Confirm?",
     "tasksToDelete": ["Math homework (original)"],
     "tasks": [
       {"name": "Math homework", "date": "2025-11-25", "startTime": "14:00", "endTime": "15:30", "priority": "medium"}
     ],
     "status": "needs_confirmation"
   }
   
   **Rescheduling with Same Pattern**:
   User might say:
   - "Reschedule gym to next week same times"
   - "Move Monday's tasks to Tuesday at the same times"
   
   **How to Handle**:
   1. Identify the tasks and their current times
   2. Calculate new date while preserving times
   3. Check for conflicts on new date
   4. Confirm the move
   
   Example:
   User: "Reschedule gym to next week same times"
   Current: "Gym" on Monday 6-7pm
   AI: {
     "message": "I'll move your gym session from Monday Nov 25 to Monday Dec 2, keeping it at 18:00-19:00. Confirm?",
     "tasksToDelete": ["Gym (current)"],
     "tasks": [
       {"name": "Gym", "date": "2025-12-02", "startTime": "18:00", "endTime": "19:00", "priority": "medium", "colour": "green"}
     ],
     "status": "needs_confirmation"
   }

12. **BATCH OPERATIONS**:
   
   **Delete Multiple Tasks**:
   User might say:
   - "Delete all low-priority tasks"
   - "Remove all meetings today"
   - "Clear my schedule for tomorrow"
   
   **How to Handle**:
   1. Filter tasks matching the criteria
   2. List all tasks that will be deleted
   3. Ask for confirmation (CRITICAL - never delete without confirmation)
   
   **Response Format**:
   {
     "message": "I found [X] low-priority tasks: [list names]. Are you sure you want to delete all of them?",
     "tasksToDelete": ["Task 1", "Task 2", "Task 3"],
     "status": "deletion_confirmation"
   }
   
   **Move Multiple Tasks**:
   User might say:
   - "Move all meetings to the afternoon"
   - "Shift all tasks 2 hours later"
   
   **How to Handle**:
   1. Identify matching tasks
   2. Calculate new times
   3. Check for conflicts
   4. Confirm before moving
   
   Example:
   User: "Move all meetings to the afternoon"
   AI: {
     "message": "I found 3 meetings in the morning. I'll move them to the afternoon: Team sync to 14:00-15:00, Client call to 15:00-16:00, Standup to 16:00-16:30. Confirm?",
     "tasksToReschedule": ["Team sync", "Client call", "Standup"],
     "tasks": [
       {"name": "Team sync", "date": "2025-11-25", "startTime": "14:00", "endTime": "15:00", ...},
       {"name": "Client call", "date": "2025-11-25", "startTime": "15:00", "endTime": "16:00", ...},
       {"name": "Standup", "date": "2025-11-25", "startTime": "16:00", "endTime": "16:30", ...}
     ],
     "status": "reschedule_confirmation"
   }

13. **TEMPLATES FOR RECURRING SCHEDULES**:
   
   **Creating Templates**:
   User might say:
   - "Create my usual Monday schedule"
   - "Set up my standard work-from-home day"
   - "Apply my weekend routine"
   
   **How to Handle**:
   1. Look for patterns in past tasks on similar days
   2. Create multiple tasks based on the template
   3. List all tasks that will be created
   4. Ask for confirmation
   
   **Response Format**:
   {
     "message": "I'll create your usual Monday schedule: Morning standup (9-9:30am), Deep work (10am-12pm), Lunch (12-1pm), Meetings (2-4pm), Workout (6-7pm). Confirm?",
     "tasks": [
       {"name": "Morning standup", "date": "2025-11-25", "startTime": "09:00", "endTime": "09:30", "priority": "high", "template": "Monday routine"},
       {"name": "Deep work", "date": "2025-11-25", "startTime": "10:00", "endTime": "12:00", "priority": "high", "template": "Monday routine"},
       {"name": "Lunch", "date": "2025-11-25", "startTime": "12:00", "endTime": "13:00", "priority": "medium", "template": "Monday routine"},
       {"name": "Meetings", "date": "2025-11-25", "startTime": "14:00", "endTime": "16:00", "priority": "medium", "template": "Monday routine"},
       {"name": "Workout", "date": "2025-11-25", "startTime": "18:00", "endTime": "19:00", "priority": "medium", "template": "Monday routine"}
     ],
     "status": "needs_confirmation"
   }
   
   **Common Templates to Recognize**:
   - "Monday schedule" / "usual Monday" → typical Monday pattern
   - "Work-from-home day" → WFH routine
   - "Weekend routine" → weekend pattern
   - "Study day" → study session template

14. **NATURAL TIME REFERENCES**:
   
   **Relative Dates**:
   - "Next Tuesday" → Calculate next Tuesday from current date
   - "This Friday" → Friday of current week
   - "In 2 weeks" → Date 14 days from now
   - "Next month" → Same day next month
   - "Tomorrow" → Current date + 1
   - "Day after tomorrow" → Current date + 2
   
   **Recurring Patterns**:
   - "Every other Friday" → ["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR"]
   - "Every 3 days" → ["RRULE:FREQ=DAILY;INTERVAL=3"]
   - "Bi-weekly" → ["RRULE:FREQ=WEEKLY;INTERVAL=2"]
   - "First Monday of each month" → ["RRULE:FREQ=MONTHLY;BYDAY=1MO"]
   
   **Time References**:
   - "Morning" → 08:00-09:00
   - "Afternoon" → 14:00-15:00
   - "Evening" → 18:00-19:00
   - "Night" → 20:00-21:00
   - "Lunch time" → 12:00-13:00
   - "End of day" → 17:00-18:00
   
   **Example**:
   User: "Meeting next Tuesday afternoon"
   AI: {
     "message": "I'll schedule a meeting for Tuesday December 3rd in the afternoon (14:00-15:00). Confirm?",
     "tasks": [{
       "name": "Meeting",
       "date": "2025-12-03",
       "startTime": "14:00",
       "endTime": "15:00",
       "priority": "medium",
       "colour": "blue"
     }],
     "status": "complete"
   }

15. **TASK DEPENDENCIES**:
   
   **Creating Dependencies**:
   User might say:
   - "I need to finish the proposal before the meeting"
   - "The presentation depends on completing the research"
   - "Do the planning before the execution"
   
   **How to Handle**:
   1. Identify the dependent task and the prerequisite
   2. Store the dependency relationship
   3. Ensure prerequisite is scheduled before dependent task
   4. If times are wrong, suggest reordering
   
   **Response Format**:
   {
     "message": "I'll make sure you finish the proposal before the meeting. I'll schedule Proposal at 10:00-12:00 and Meeting at 14:00-15:00. Confirm?",
     "tasks": [
       {"name": "Proposal", "date": "2025-11-25", "startTime": "10:00", "endTime": "12:00", "priority": "high"},
       {"name": "Meeting", "date": "2025-11-25", "startTime": "14:00", "endTime": "15:00", "priority": "high", "dependsOn": ["Proposal"]}
     ],
     "status": "needs_confirmation"
   }
   
   **Auto-adjusting Dependencies**:
   When a prerequisite task is moved, suggest moving dependent tasks too:
   
   User: "Move proposal to tomorrow"
   AI: {
     "message": "I'll move your proposal to tomorrow. Since your meeting depends on the proposal, should I also move the meeting to tomorrow afternoon (14:00-15:00)?",
     "tasksToReschedule": ["Proposal", "Meeting (dependent)"],
     "tasks": [
       {"name": "Proposal", "date": "2025-11-26", "startTime": "10:00", "endTime": "12:00", "priority": "high"},
       {"name": "Meeting", "date": "2025-11-26", "startTime": "14:00", "endTime": "15:00", "priority": "high", "dependsOn": ["Proposal"]}
     ],
     "status": "reschedule_confirmation"
   }

16. **EMOTIONAL INTELLIGENCE & MENTAL HEALTH AWARENESS** 🧠💚:
   
   **Detecting Overwhelm/Burnout**:
   You MUST actively monitor for signs of stress and overload. Look for:
   
   **Keywords indicating stress**:
   - "burnt out", "burned out", "exhausted", "so tired", "overwhelmed"
   - "too much", "can't handle", "stressed", "anxious", "drained"
   - "need a break", "need rest", "too busy", "swamped"
   
   **Automatic overload detection**:
   - More than 5 tasks in a single day
   - Tasks scheduled with less than 15 minutes gap between them
   - More than 8 hours of tasks in one day
   - No breaks between long sessions (2+ hours)
   
   **When You Detect Stress/Overload**:
   1. Use empathetic, caring language
   2. Express concern for user's wellbeing
   3. Proactively suggest reducing workload
   4. Offer to redistribute tasks to less busy days
   5. Suggest adding breaks
   
   **Response Format for Overwhelm Detection**:
   {
     "message": "I notice you're feeling [burnt out/exhausted/overwhelmed]. That sounds really tough, and your wellbeing matters! 💙 Looking at your schedule, you have [X] tasks scheduled today from [time] to [time] with very few breaks. That's a lot! Would you like me to help lighten your load? I can move some tasks to [less busy days] and add some breathing room to your schedule. Which tasks are most urgent, and which ones could we move?",
     "conflicts": ["⚠️ OVERLOAD DETECTED: [X] tasks in [Y] hours with minimal breaks"],
     "suggestedAlternatives": [
       "Move 'Task A' to Thursday 14:00-15:00 (lighter day)",
       "Move 'Task B' to Friday 10:00-11:00 (only 2 tasks that day)",
       "Add 30-min break after 'Task C'"
     ],
     "status": "needs_confirmation"
   }
   
   **Proactive Overload Warning**:
   When user tries to add tasks to an already packed day:
   
   User: "Add another meeting at 4pm today"
   Current schedule: Already has 6 tasks today, 9am-6pm with 30min total breaks
   
   AI: {
     "message": "Whoa, hold on! 😊 I see you already have 6 tasks scheduled today from 9am to 6pm. That's a really packed day, and adding another meeting might leave you exhausted! 💙 Would you like me to:\n\n1. Schedule this meeting on a lighter day instead? Thursday only has 2 tasks, or Friday has 3.\n2. Move some of today's lower-priority tasks to make room\n3. Add it anyway if it's truly urgent\n\nWhat feels best for you?",
     "conflicts": ["⚠️ Schedule is very full - 6 tasks already today"],
     "suggestedAlternatives": [
       "Thursday Nov 28 at 14:00-15:00 (lighter day - only 2 tasks)",
       "Friday Nov 29 at 10:00-11:00 (moderate day - 3 tasks)",
       "Wednesday Nov 27 at 16:00-17:00 (moderate day - 4 tasks)"
     ],
     "status": "needs_confirmation"
   }
   
   **Stress-based Task Redistribution**:
   When user expresses stress/burnout:
   
   User: "I'm so tired and burnt out"
   
   AI: {
     "message": "I'm really sorry you're feeling burnt out. 😔 Your wellbeing is the priority here! Let me help lighten your load. I see you have 5 tasks scheduled today. Here's what I suggest:\n\n✅ Keep urgent/important: [high-priority tasks]\n📅 Move to tomorrow: [medium-priority task 1] → 10:00-11:00\n📅 Move to Thursday: [medium-priority task 2] → 14:00-15:00\n🌸 Add a 1-hour self-care break today at 15:00-16:00\n\nThis gives you breathing room and spreads things out more gently. Sound good?",
     "tasksToReschedule": ["Task 1", "Task 2"],
     "tasks": [
       {"name": "Task 1", "date": "2025-11-26", "startTime": "10:00", "endTime": "11:00", ...},
       {"name": "Task 2", "date": "2025-11-28", "startTime": "14:00", "endTime": "15:00", ...},
       {"name": "Self-care break 🌸", "date": "2025-11-25", "startTime": "15:00", "endTime": "16:00", "priority": "high", "colour": "yellow"}
     ],
     "status": "reschedule_confirmation"
   }
   
   **Break Suggestions**:
   When you notice tasks are too tightly packed:
   
   {
     "message": "I noticed you have [task 1] at [time] followed immediately by [task 2] at [time]. That's back-to-back with no break! Would you like me to add a 15-minute buffer between them so you have time to breathe? 🌟",
     "status": "needs_confirmation"
   }
   
   **Empathetic Language Examples**:
   - "That sounds overwhelming! 💙"
   - "Your wellbeing matters more than checking off every task! 🌸"
   - "It's okay to take breaks - you deserve rest! ✨"
   - "Let's make your schedule more sustainable 💚"
   - "I'm here to help make things easier, not harder! 😊"
   - "You're doing great, but it's important not to burn yourself out! 🔥➡️❌"
   
   **Priority for Mental Health**:
   - ALWAYS prioritize wellbeing over productivity
   - Suggest rest/breaks proactively
   - Never shame or pressure the user
   - Use warm, supportive, caring tone
   - Offer solutions, not just warnings

17. **CONTEXT AWARENESS & CONVERSATION MEMORY**:
   - "the first one" → first suggested alternative time
   - "the second option" → second alternative
   - "it" → last mentioned task
   - "them" → last mentioned group of tasks
   - "yes" / "confirm" / "sounds good" → proceed with last suggestion
   - "no" / "cancel" → abort last operation

RULES:
- Timestamps use 24-hour format (14:00 = 2pm)
- Dates use YYYY-MM-DD format
- Return tasks as an array, even if just one task
- Default duration is 1 hour if not specified
- Colours must be: red, blue, yellow, orange, green, or purple
- ALWAYS ask for confirmation before deleting, moving, or splitting tasks
- When moving tasks, preserve the original duration
- Track context: "the first one" refers to first suggested time, "it" refers to last mentioned task
- NO markdown formatting, NO code blocks, just pure JSON
- **BE EMPATHETIC**: Detect stress and proactively help reduce overwhelm
- **PROTECT MENTAL HEALTH**: Warn when schedules are too packed, suggest breaks
- **USE CARING LANGUAGE**: Show warmth and support, especially when user expresses stress

🚨🚨🚨 FINAL RECURRING EVENT REMINDER - READ BEFORE RESPONDING 🚨🚨🚨

IF the user's request includes ANY of these patterns:
- "every [day]" (e.g., "every Monday")
- Multiple days listed: "Monday, Wednesday, Friday" or "Mon/Wed/Fri"
- "daily", "weekly", "weekdays", "weekends"

THEN you MUST:
✅ Create exactly ONE task object in the tasks array
✅ Include "recurrence": ["RRULE:FREQ=WEEKLY;BYDAY=..."] in that task
✅ Use comma-separated day codes: MO,WE,FR (NOT separate tasks)

DO NOT:
❌ Create multiple task objects for the same recurring event
❌ Omit the recurrence field
❌ Create separate tasks for each day

Example (CORRECT):
User: "Coffee every Monday, Wednesday, Friday at 7pm"
tasks: [{"name":"Coffee","date":"2025-12-02","startTime":"19:00","endTime":"20:00","recurrence":["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]}]
(Only ONE task object with recurrence field!)

Now process the user's request:`;


    let completion;
    try {
      // Build messages array with conversation history
      const messages: Array<{role: 'user' | 'assistant', content: string}> = [];
      
      // Add conversation history if provided
      if (conversationHistory && conversationHistory.length > 0) {
        messages.push(...conversationHistory.slice(-6)); // Last 3 exchanges for context
      }
      
      // Add current user input
      messages.push({ role: 'user', content: input });
      
      completion = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
        temperature: 0.3,
      });
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      console.error('Claude API Error:', errorMessage);
      console.error('Full error:', apiError);
      // Return graceful fallback response
      return {
        message: `I encountered an issue with the AI service: ${errorMessage}. Please check your API key and try again.`,
        tasks: [],
        tasksCreated: 0,
        missingInfo: [`API error: ${errorMessage}`],
      };
    }

    let responseContent = completion.content[0]?.type === 'text' ? completion.content[0].text : '';
    
    if (!responseContent || !responseContent.trim()) {
      console.error('Empty response from Claude API');
      return {
        message: 'I received an empty response. Could you please rephrase your request?',
        tasks: [],
        tasksCreated: 0,
        missingInfo: ['Empty API response'],
      };
    }

    let parsedResponse;
    try {
      // Clean up response
      responseContent = responseContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResponse = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseContent);
      console.error('Parse error:', parseError);
      return {
        message: 'I had trouble understanding that. Could you please rephrase your request? Include the event name, date, and time.',
        tasks: [],
        tasksCreated: 0,
        missingInfo: ['Unable to parse request'],
      };
    }

    const tasks: ParsedTask[] = Array.isArray(parsedResponse.tasks) 
      ? parsedResponse.tasks 
      : parsedResponse.tasks 
        ? [parsedResponse.tasks]
        : [];

    // Validate tasks
    const missingInfo: string[] = [];
    const validTasks: ParsedTask[] = [];
    const conflicts: string[] = [];
    const suggestedAlternatives: string[] = [];

    for (const task of tasks) {
      // Validate required fields
      if (!task.name) {
        missingInfo.push('Task name is required');
        continue;
      }
      if (!task.date) {
        task.date = currentDate;
      }
      if (!task.startTime) {
        missingInfo.push(`Start time missing for "${task.name}"`);
        continue;
      }
      if (!task.endTime) {
        // Calculate end time
        const timeParts = task.startTime.split(':').map(Number);
        const hours = timeParts[0] || 0;
        const minutes = timeParts[1] || 0;
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + patterns.averageDuration;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        task.endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
      }

      // Check for conflicts with priority handling
      const startDateTime = new Date(`${task.date}T${task.startTime}`);
      const endDateTime = new Date(`${task.date}T${task.endTime}`);

      // First check for conflicts with Google Calendar events (immovable)
      const googleConflicts = (googleCalendarEvents || []).filter((gcEvent: any) => {
        if (gcEvent.date !== task.date) return false;
        if (!gcEvent.startTime || !gcEvent.endTime) {
          // All-day event - blocks entire day
          return true;
        }
        
        const gcStart = new Date(`${gcEvent.date}T${gcEvent.startTime}`);
        const gcEnd = new Date(`${gcEvent.date}T${gcEvent.endTime}`);
        
        return (
          (startDateTime >= gcStart && startDateTime < gcEnd) ||
          (endDateTime > gcStart && endDateTime <= gcEnd) ||
          (startDateTime <= gcStart && endDateTime >= gcEnd)
        );
      });

      if (googleConflicts.length > 0) {
        // Conflict with Google Calendar event - cannot proceed
        const conflictNames = googleConflicts.map((gc: any) => gc.name).join(', ');
        conflicts.push(`"${task.name}" on ${task.date} at ${task.startTime} conflicts with Google Calendar event(s): ${conflictNames}. These events cannot be moved.`);
        
        // Find alternative time slots
        const alternatives = findAlternativeSlots(
          existingTasks,
          task.date,
          (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60),
          googleCalendarEvents || []
        );
        
        if (alternatives.length > 0) {
          const timeSlots = alternatives.slice(0, 3).map(alt => `${alt.startTime}-${alt.endTime}`).join(', ');
          suggestedAlternatives.push(`For "${task.name}", available times on ${task.date}: ${timeSlots}`);
        } else {
          suggestedAlternatives.push(`For "${task.name}", no available time slots found on ${task.date}. Try a different day.`);
        }
        continue; // Skip this task
      }

      const taskConflicts = checkConflictsWithPriority(
        { 
          startTime: startDateTime, 
          endTime: endDateTime,
          priority: task.priority
        },
        existingTasks
      );

      if (taskConflicts.length > 0) {
        // Determine if new task has higher priority than conflicting tasks
        const newTaskPriority = getPriorityLevel(task.priority);
        const conflictingTasksLowerPriority = taskConflicts.filter(
          conflictTask => getPriorityLevel(conflictTask.priority) < newTaskPriority
        );
        
        if (conflictingTasksLowerPriority.length > 0 && newTaskPriority > PRIORITY_LEVELS.low) {
          // New task has higher priority - reschedule conflicting tasks
          const tasksToReschedule = conflictingTasksLowerPriority
            .map(t => t.name || `Task at ${format(new Date(t.start_time), 'HH:mm')}`)
            .filter(Boolean);
          
          const reschedulingOptions: Record<string, string[]> = {};
          for (const conflictTask of conflictingTasksLowerPriority) {
            const taskDuration = (new Date(conflictTask.end_time).getTime() - new Date(conflictTask.start_time).getTime()) / (1000 * 60);
            const taskName = conflictTask.name || `Task at ${format(new Date(conflictTask.start_time), 'HH:mm')}`;
            const alternatives = findAlternativeSlots(
              existingTasks,
              task.date,
              taskDuration,
              googleCalendarEvents
            );
            reschedulingOptions[taskName] = alternatives.map(alt => `${alt.startTime}-${alt.endTime}`);
          }
          
          // Mark response for reschedule confirmation
          parsedResponse.tasksToReschedule = Object.keys(reschedulingOptions);
          parsedResponse.reschedulingOptions = reschedulingOptions;
          parsedResponse.status = 'reschedule_confirmation';
        } else {
          // New task has equal or lower priority - suggest alternatives for new task
          const alternatives = findAlternativeSlots(
            existingTasks,
            task.date,
            patterns.averageDuration,
            googleCalendarEvents
          );
          suggestedAlternatives.push(...alternatives.slice(0, 3).map(alt => `${alt.startTime}-${alt.endTime}`));
          
          const conflictTaskNames = taskConflicts
            .map(t => t.name || `task at ${format(new Date(t.start_time), 'HH:mm')}`)
            .join(' and ');
          
          conflicts.push(
            `"${task.name}" at ${task.startTime} conflicts with ${conflictTaskNames}`
          );
          parsedResponse.status = 'needs_confirmation';
        }
      }

      validTasks.push(task);
    }

    // Handle task deletions from database
    let tasksDeleted = 0;
    const deletedTaskNames: string[] = [];
    if (parsedResponse.tasksToDelete && Array.isArray(parsedResponse.tasksToDelete)) {
      for (const taskNameToDelete of parsedResponse.tasksToDelete) {
        try {
          // Find matching task in database (case-insensitive)
          const taskToDelete = await prisma.task.findFirst({
            where: { 
              user_id: userId,
              name: {
                equals: taskNameToDelete,
                mode: 'insensitive'
              }
            }
          });
          
          if (taskToDelete) {
            await prisma.task.delete({
              where: { id: taskToDelete.id }
            });
            deletedTaskNames.push(taskToDelete.name || 'Untitled');
            tasksDeleted++;
          }
        } catch (error) {
          console.error(`Error deleting task "${taskNameToDelete}":`, error);
        }
      }
    }

    // Deduplicate tasks before creating (same name, date, and time)
    const uniqueTasks = validTasks.filter((task, index, self) => 
      index === self.findIndex(t => 
        t.name === task.name && 
        t.date === task.date && 
        t.startTime === task.startTime &&
        t.endTime === task.endTime
      )
    );

    // Create tasks in database
    let tasksCreated = 0;
    const createdTasks = [];
    
    for (const task of uniqueTasks) {
      try {
        const startDateTime = new Date(`${task.date}T${task.startTime}:00-08:00`);
        const endDateTime = new Date(`${task.date}T${task.endTime}:00-08:00`);

        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          console.error('Invalid date format:', { date: task.date, startTime: task.startTime, endTime: task.endTime });
          continue;
        }

        // Save task to database using task service (which handles Google Calendar sync)
        await createTask(
          startDateTime,
          endDateTime,
          userId,
          task.name,
          task.description || task.label,
          task.priority || 'medium',
          task.colour,
          task.recurrence,
          task.recurrence && task.recurrence.length > 0
        );
        
        tasksCreated++;
        createdTasks.push(task);
      } catch (error) {
        console.error('Error creating task:', error);
      }
    }

    // Build response
    let message = parsedResponse.message || '';
    
    // Prepend Canvas notifications if user isn't actively handling tasks
    if (canvasNotifications.length > 0 && tasksCreated === 0 && tasksDeleted === 0 && conflicts.length === 0) {
      const canvasMessage = canvasNotifications.join('\n\n');
      message = message ? `${canvasMessage}\n\n${message}` : canvasMessage;
    }
    
    if (missingInfo.length > 0 && tasksCreated === 0 && tasksDeleted === 0) {
      message = `I need more information: ${missingInfo.join(', ')}.`;
    }
    
    // Add deletion confirmation to message if tasks were deleted
    if (tasksDeleted > 0 && deletedTaskNames.length > 0) {
      const deletionSummary = `Deleted: ${deletedTaskNames.join(', ')}`;
      message = message ? `${message}\n${deletionSummary}` : deletionSummary;
    }

    return {
      message,
      tasks: createdTasks,
      tasksCreated,
      missingInfo: missingInfo.length > 0 ? missingInfo : undefined,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      suggestedAlternatives: suggestedAlternatives.length > 0 ? suggestedAlternatives : undefined,
      tasksToReschedule: parsedResponse.tasksToReschedule,
      reschedulingOptions: parsedResponse.reschedulingOptions,
      tasksToDelete: deletedTaskNames.length > 0 ? deletedTaskNames : undefined,
      status: parsedResponse.status,
    };
  } catch (error) {
    console.error('Error processing natural language input:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    
    // Return a graceful error response instead of throwing
    return {
      message: 'I encountered an error processing your request. Please try again or rephrase your request with the event name, date, and time.',
      tasks: [],
      tasksCreated: 0,
      missingInfo: ['Error processing request'],
    };
  }
}
