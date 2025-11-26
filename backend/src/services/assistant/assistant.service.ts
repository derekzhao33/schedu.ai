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
  tasksToReschedule?: string[]; // New: Tasks that need rescheduling
  reschedulingOptions?: Record<string, string[]>; // New: Alternatives for rescheduled tasks
  status?: 'complete' | 'needs_confirmation' | 'reschedule_confirmation'; // New: Reschedule status
}

interface DbTask {
  id: number;
  start_time: Date;
  end_time: Date;
  user_id: number;
  name?: string;
  priority?: 'low' | 'medium' | 'high';
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
  userTimezone: string = 'America/Los_Angeles'
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

    // Comprehensive system prompt for Claude
    const systemPrompt = `You are an expert task scheduling AI assistant. Your job is to extract task information from natural language and help users schedule events intelligently.

CURRENT CONTEXT:
- Timezone: ${userTimezone}
- Today's date: ${currentDate} (${dayOfWeek})
- Current time: ${currentTime}
- User's average task duration: ${patterns.averageDuration} minutes
- User's preferred start time: ${patterns.commonStartHour}:00

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

6. **CRITICAL - PRIORITY-BASED SCHEDULING**:
   Priority hierarchy: LOW < MEDIUM < HIGH
   
   WHEN A NEW HIGH OR MEDIUM PRIORITY TASK CONFLICTS WITH EXISTING TASKS:
   - Check the priority of conflicting tasks
   - IF new task has HIGHER priority than conflicting task(s):
     * AUTOMATICALLY reschedule the lower-priority task
     * Offer 2-3 alternative time slots for the displaced task
     * Confirm that you'll reschedule the lower-priority task
     * Place the new higher-priority task in the requested time slot
   
   - IF new task has LOWER or EQUAL priority to existing task:
     * DO NOT reschedule the existing task
     * Suggest alternative times for the NEW task instead
     * Ask user to choose a different time slot
   
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

8. Recurring Events (CRITICAL):
   - "every day" / "daily" → ["RRULE:FREQ=DAILY"]
   - "every Monday" → ["RRULE:FREQ=WEEKLY;BYDAY=MO"]
   - "every Mon and Wed" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"]
   - "weekdays only" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"]
   - "for 2 weeks" → Add UNTIL date 14 days from start
   - "10 times" → ["RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10"]
   - MUST be array format: ["RRULE:..."], NOT just "RRULE:..."

9. Multi-Task Handling:
   - "Meeting at 2pm and lunch at 12pm" → Create TWO separate tasks
   - Return array of task objects
   - Each gets its own name, time, priority, etc.

7. Colour Assignment:
   - IMPORTANT/URGENT tasks → red
   - WORK/MEETING tasks → blue
   - PERSONAL/BREAK tasks → yellow
   - HEALTH/FITNESS tasks → green
   - EDUCATION/STUDY tasks → purple
   - OTHER → orange

8. Recurring Events (CRITICAL):
   - "every day" / "daily" → ["RRULE:FREQ=DAILY"]
   - "every Monday" → ["RRULE:FREQ=WEEKLY;BYDAY=MO"]
   - "every Mon and Wed" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"]
   - "weekdays only" → ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"]
   - "for 2 weeks" → Add UNTIL date 14 days from start
   - "10 times" → ["RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10"]
   - MUST be array format: ["RRULE:..."], NOT just "RRULE:..."

9. Multi-Task Handling:
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
  "status": "complete" | "needs_confirmation" | "reschedule_confirmation"
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

RULES:
- Timestamps use 24-hour format (14:00 = 2pm)
- Dates use YYYY-MM-DD format
- Return tasks as an array, even if just one task
- Default duration is 1 hour if not specified
- Colours must be: red, blue, yellow, orange, green, or purple
- NO markdown formatting, NO code blocks, just pure JSON`;

    let completion;
    try {
      completion = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          { role: 'user', content: input },
        ],
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
          priority: task.priority as 'low' | 'medium' | 'high'
        };
        
        if (!taskStorage.has(userId)) {
          taskStorage.set(userId, []);
        }
        taskStorage.get(userId)!.push(dbTask);
        
        tasksCreated++;
        createdTasks.push(task);
        console.log(`Task created: ${task.name} at ${task.date} ${task.startTime}-${task.endTime} (priority: ${task.priority})`);
      } catch (error) {
        console.error('Error creating task:', error);
      }
    }

    // Build response
    let message = parsedResponse.message || '';
    if (missingInfo.length > 0 && tasksCreated === 0) {
      message = `I need more information: ${missingInfo.join(', ')}.`;
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
