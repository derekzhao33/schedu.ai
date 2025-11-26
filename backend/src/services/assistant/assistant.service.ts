import Anthropic from '@anthropic-ai/sdk';
import config from '../../config/config.js';
import prisma from '../../shared/prisma.js';
import { format, addDays, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

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
}

// In-memory task storage for current session
const taskStorage: Map<number, DbTask[]> = new Map();

// Get user's existing tasks for pattern analysis
async function getUserTasks(userId: number): Promise<DbTask[]> {
  // Return in-memory tasks for this user
  return taskStorage.get(userId) || [];
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
  excludeTime?: { start: string; end: string }
): Array<{ startTime: string; endTime: string }> {
  const alternatives: Array<{ startTime: string; endTime: string }> = [];
  const workStart = 9 * 60; // 9 AM
  const workEnd = 18 * 60; // 6 PM
  
  // Filter and sort tasks for this day
  const dayTasks = existingTasks
    .filter(task => {
      const taskDate = format(new Date(task.start_time), 'yyyy-MM-dd');
      return taskDate === targetDate;
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  
  // Find gaps between tasks
  let currentTime = workStart;
  
  for (const task of dayTasks) {
    const taskStart = new Date(task.start_time);
    const taskMinutes = taskStart.getHours() * 60 + taskStart.getMinutes();
    
    // Check if there's a gap
    if (currentTime + duration <= taskMinutes) {
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
    
    const taskEnd = new Date(task.end_time);
    currentTime = Math.max(currentTime, taskEnd.getHours() * 60 + taskEnd.getMinutes());
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
  conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>
): Promise<AIResponse> {
  try {
    // Get user's existing tasks for context and pattern analysis
    const existingTasks = await getUserTasks(userId);
    const patterns = analyzeTaskPatterns(existingTasks);

    // Create context in user's timezone
    const nowUserTz = toZonedTime(new Date(), userTimezone);
    const currentDate = formatInTimeZone(nowUserTz, userTimezone, 'yyyy-MM-dd');
    const currentTime = formatInTimeZone(nowUserTz, userTimezone, 'HH:mm');
    const dayOfWeek = formatInTimeZone(nowUserTz, userTimezone, 'EEEE');

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

    // Comprehensive system prompt for Claude
    const systemPrompt = `You are an expert task scheduling AI assistant. Your job is to extract task information from natural language and help users schedule events intelligently.

CURRENT CONTEXT:
- Timezone: ${userTimezone}
- Today's date: ${currentDate} (${dayOfWeek})
- Current time: ${currentTime}
- User's average task duration: ${patterns.averageDuration} minutes
- User's preferred start time: ${patterns.commonStartHour}:00

EXISTING TASKS IN USER'S SCHEDULE:
${existingTasksInfo}

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

4. Date Logic:
   - No date mentioned → use today (${currentDate})
   - "tomorrow" → ${formatInTimeZone(addDays(nowUserTz, 1), userTimezone, 'yyyy-MM-dd')}
   - "next Monday" → calculate to upcoming Monday
   - "in 3 days" → add 3 days to today
   - Specific date like "Dec 25" → parse to YYYY-MM-DD

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

8. **RECURRING TASKS (CRITICAL)**:
   
   **Basic Recurring Patterns**:
   - "daily" / "every day" → ["RRULE:FREQ=DAILY"]
   - "weekly" → ["RRULE:FREQ=WEEKLY"]
   - "every Monday" → ["RRULE:FREQ=WEEKLY;BYDAY=MO"]
   - "every Mon and Wed" / "every Monday Wednesday" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"]
   - "every Tuesday and Thursday" → ["RRULE:FREQ=WEEKLY;BYDAY=TU,TH"]
   - "weekdays" / "weekdays only" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"]
   - "weekends" / "weekends only" → ["RRULE:FREQ=WEEKLY;BYDAY=SA,SU"]
   - "for 2 weeks" → Add UNTIL date 14 days from start
   - "10 times" → ["RRULE:FREQ=WEEKLY;COUNT=10"]
   
   **Day Abbreviations for RRULE**:
   - MO = Monday, TU = Tuesday, WE = Wednesday, TH = Thursday
   - FR = Friday, SA = Saturday, SU = Sunday
   
   **MUST be array format**: ["RRULE:..."], NOT just "RRULE:..."
   
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
4. Always explain the priority logic in the message
5. Use clear formatting: "14:00-15:00" (24-hour format)

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

Example 4: Recurring task
User: "Workout at 6am every Monday"
Response: {
  "message": "I'll create a recurring workout every Monday at 6:00 AM for 1 hour (06:00-07:00). This will repeat every week.",
  "tasks": [{
    "name": "Workout",
    "date": "2025-11-25",
    "startTime": "06:00",
    "endTime": "07:00",
    "priority": "medium",
    "label": "fitness",
    "colour": "green",
    "recurrence": ["RRULE:FREQ=WEEKLY;BYDAY=MO"]
  }],
  "status": "complete"
}

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

RULES:
- Timestamps use 24-hour format (14:00 = 2pm)
- Dates use YYYY-MM-DD format
- Return tasks as an array, even if just one task
- Default duration is 1 hour if not specified
- Colours must be: red, blue, yellow, orange, green, or purple
- Recurring tasks MUST include "recurrence" field as array: ["RRULE:..."]
- ALWAYS ask for confirmation before deleting, moving, or splitting tasks
- When moving tasks, preserve the original duration
- Track context: "the first one" refers to first suggested time, "it" refers to last mentioned task
- NO markdown formatting, NO code blocks, just pure JSON`;


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
              { start: task.startTime, end: task.endTime }
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
            patterns.averageDuration
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

    // Handle task deletions
    let tasksDeleted = 0;
    const deletedTaskNames: string[] = [];
    if (parsedResponse.tasksToDelete && Array.isArray(parsedResponse.tasksToDelete)) {
      const userTasks = taskStorage.get(userId) || [];
      
      for (const taskNameToDelete of parsedResponse.tasksToDelete) {
        // Find matching task (case-insensitive)
        const taskIndex = userTasks.findIndex(t => 
          t.name?.toLowerCase() === taskNameToDelete.toLowerCase()
        );
        
        if (taskIndex !== -1) {
          const [deletedTask] = userTasks.splice(taskIndex, 1);
          if (deletedTask) {
            deletedTaskNames.push(deletedTask.name || 'Untitled');
            tasksDeleted++;
            console.log(`Task deleted: ${deletedTask.name} at ${format(new Date(deletedTask.start_time), 'yyyy-MM-dd HH:mm')}`);
          }
        } else {
          console.log(`Task not found for deletion: ${taskNameToDelete}`);
        }
      }
      
      // Update storage
      if (tasksDeleted > 0) {
        taskStorage.set(userId, userTasks);
      }
    }

    // Create tasks in database (always create valid tasks)
    let tasksCreated = 0;
    const createdTasks = [];
    for (const task of validTasks) {
      try {
        const startDateTime = new Date(`${task.date}T${task.startTime}`);
        const endDateTime = new Date(`${task.date}T${task.endTime}`);

        // Validate dates
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          console.error('Invalid date format:', { date: task.date, startTime: task.startTime, endTime: task.endTime });
          continue;
        }

        // Save task to in-memory storage
        const dbTask: DbTask = {
          id: Date.now() + tasksCreated,
          start_time: startDateTime,
          end_time: endDateTime,
          user_id: userId,
          name: task.name,
          priority: task.priority as 'low' | 'medium' | 'high',
          recurrence: task.recurrence,
          isRecurring: !!(task.recurrence && task.recurrence.length > 0)
        };
        
        if (!taskStorage.has(userId)) {
          taskStorage.set(userId, []);
        }
        taskStorage.get(userId)!.push(dbTask);
        
        tasksCreated++;
        createdTasks.push(task);
        const recurInfo = task.recurrence ? ` (Recurring: ${task.recurrence.join(', ')})` : '';
        console.log(`Task created: ${task.name} at ${task.date} ${task.startTime}-${task.endTime} (priority: ${task.priority})${recurInfo}`);
      } catch (error) {
        console.error('Error creating task:', error);
      }
    }

    // Build response
    let message = parsedResponse.message || '';
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
