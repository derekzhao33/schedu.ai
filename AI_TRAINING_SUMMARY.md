# Claude AI Training Summary

## Overview
The Claude AI assistant in your schedu.ai application has been trained with comprehensive instructions for intelligent task scheduling and event management.

## Key Training Features

### 1. **Task Structure Recognition**
The AI extracts and creates tasks with these fields:
- **name** (required): Event/task title
- **date** (required): YYYY-MM-DD format
- **startTime** (required): HH:mm (24-hour format)
- **endTime** (required): HH:mm (24-hour format)
- **priority** (optional): low | medium | high
- **description** (optional): Additional details
- **label** (optional): Category/type
- **colour** (optional): red, blue, yellow, orange, green, purple
- **recurrence** (optional): Array of RRULE strings for recurring events

### 2. **Time Parsing Rules**

#### AM Times:
- 1am → 01:00, 2am → 02:00, 8am → 08:00, 12am (midnight) → 00:00

#### PM Times:
- 1pm → 13:00, 2pm → 14:00, 12pm (noon) → 12:00, 11pm → 23:00

#### Duration Logic:
- No duration specified → assumes 1 hour
- "from 2pm to 4pm" → parses both times
- "for 30 mins" → adds 30 minutes to start time

### 3. **Date Handling**
- No date mentioned → uses today
- "tomorrow" → next day
- "next Monday" → upcoming Monday
- "in 3 days" → adds 3 days to today
- Specific dates like "Dec 25" → parsed to YYYY-MM-DD

### 4. **Priority Detection**
- **HIGH**: "urgent", "important", "critical", "must", "deadline", "ASAP"
- **MEDIUM**: Normal mentions (default)
- **LOW**: "maybe", "whenever", "optional", "break"

### 5. **Automatic Colour Assignment**
- Important/Urgent → red
- Work/Meeting → blue
- Personal/Break → yellow
- Health/Fitness → green
- Education/Study → purple
- Other → orange

### 6. **Recurring Events**
Supports various recurrence patterns:
- "every day" → FREQ=DAILY
- "every Monday" → FREQ=WEEKLY;BYDAY=MO
- "Mon and Wed" → FREQ=WEEKLY;BYDAY=MO,WE
- "weekdays only" → FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
- "for 2 weeks" → Calculates UNTIL date (14 days from start)
- "10 times" → COUNT=10

### 7. **Intelligent Category Detection**
Automatically assigns labels based on context:
- "Meeting" → work
- "Workout" → fitness
- "Study" → education
- "Lunch" → personal
- "Exam" → education

### 8. **Conflict Detection** (Legacy - See Priority-Based Scheduling Below)
The AI:
- Analyzes existing tasks for schedule conflicts
- Identifies overlapping time slots
- Suggests alternative available times

### 9. **PRIORITY-BASED AUTOMATIC RESCHEDULING** ⭐ NEW FEATURE
The AI now intelligently handles task scheduling conflicts using priority levels:

**Priority Hierarchy**: LOW < MEDIUM < HIGH

#### How It Works:
1. **Higher Priority Always Gets Preferred Time**: When a new higher-priority task is scheduled at the same time as a lower-priority task, the AI automatically accepts the high-priority task and reschedules the lower-priority one.

2. **Smart Alternatives**: The AI automatically finds alternative time slots for the displaced lower-priority task and presents them to the user.

3. **Equal/Lower Priority Rejection**: If the new task has equal or lower priority than an existing task, the AI suggests alternative times for the NEW task instead of rescheduling.

#### Real-World Examples:

**Scenario 1: Urgent Meeting Blocks Casual Hangout** ✅
```
You: "Schedule an urgent meeting at 8-9pm"
Existing: "Casual hangout" (medium) at 8-9pm

AI Response:
"I found you have a casual hangout at 20:00-21:00. Since your urgent meeting 
is higher priority, I'll reschedule the hangout. Here are alternatives for it: 
18:00-19:00, 19:00-20:00, or 21:00-22:00. Which time works best?"

Action: ✓ Urgent meeting scheduled at 8-9pm
        ✓ User offered to reschedule hangout
```

**Scenario 2: Coffee Break Blocked by Team Meeting** ✅
```
You: "Can I schedule a coffee break at 3pm?"
Existing: "Team meeting" (medium) at 3-4pm

AI Response:
"You have a team meeting at 15:00-16:00, which is higher priority than 
your coffee break. I can suggest these alternative times: 14:00-15:00, 
16:00-17:00, or 17:00-18:00. Which works better for you?"

Action: ✗ Coffee break NOT scheduled yet
        ✓ User offered alternatives for the coffee break
```

**Scenario 3: Two Medium Priority Tasks Conflict** ✅
```
You: "Add a dentist appointment at 2pm"
Existing: "Lunch" (medium) at 2-3pm

AI Response:
"You have lunch at 14:00-15:00. Both are equal priority, so I recommend 
finding another time. Would one of these work: 13:00-14:00, 15:00-16:00, 
or 16:00-17:00?"

Action: ✗ Dentist appointment NOT scheduled yet
        ✓ User offered to reschedule their new task instead
```

### 10. **Multi-Task Handling**
Supports compound requests:
- "Meeting at 2pm and lunch at 12pm" → Creates 2 separate tasks
- Intelligently handles conflicts between new tasks and existing events
- Can reschedule lower-priority events to accommodate important ones

### 11. **Conversation Flow**
The AI maintains natural conversation:
- **If all required info available & no conflicts**: Confirms details and asks for approval
- **If missing info**: Asks specific questions only about missing fields
- **If lower-priority task blocks new higher-priority task**: Offers to reschedule the lower-priority task
- **If higher-priority task blocks new lower-priority task**: Suggests alternatives for the new task
- Always uses friendly, conversational language in responses

## Response Format

The AI responds in this JSON structure:
```json
{
  "message": "Friendly conversational response",
  "tasks": [
    {
      "name": "Task Name",
      "date": "2025-11-25",
      "startTime": "14:00",
      "endTime": "15:00",
      "priority": "medium",
      "label": "work",
      "colour": "blue"
    }
  ],
  "conflicts": ["List of any conflicts"],
  "suggestedAlternatives": ["14:00-15:00", "16:00-17:00"],
  "tasksToReschedule": ["Task names that need rescheduling"],
  "reschedulingOptions": {
    "Task name": ["14:00-15:00", "16:00-17:00", "17:00-18:00"]
  },
  "status": "complete" | "needs_confirmation" | "reschedule_confirmation"
}
```

**Status Meanings:**
- `complete`: Task successfully scheduled with no conflicts
- `needs_confirmation`: User input needed (missing info or new task needs alternative time)
- `reschedule_confirmation`: Lower-priority task(s) will be rescheduled, awaiting confirmation

## Example Interactions

### Example 1: Simple Task (No Conflict)
**User:** "Meeting at 2pm tomorrow"
**AI Response:** "I'll create a meeting for you tomorrow (November 26) at 2:00 PM. Since you didn't mention duration, I'll schedule it for 1 hour (14:00-15:00). Ready to confirm?"

### Example 2: High Priority Task Blocking Medium Priority Task
**User:** "I need to schedule an urgent meeting at 8-9pm"
**Existing:** "Casual hangout" (MEDIUM priority) at 8-9pm
**AI Response:** "I found you have a casual hangout at 20:00-21:00. Since your urgent meeting is higher priority, I'll reschedule the hangout. Here are alternative times for it: 18:00-19:00, 19:00-20:00, or 21:00-22:00. Which time works best for the hangout?"
**Action:** ✅ Urgent meeting scheduled at 8-9pm, hangout offered rescheduling

### Example 3: Low Priority Task Blocked by Higher Priority
**User:** "Can I schedule a coffee break at 3pm?"
**Existing:** "Team meeting" (MEDIUM priority) at 3-4pm
**AI Response:** "You have a team meeting at 15:00-16:00, which is higher priority than your coffee break. I can suggest these alternative times: 14:00-15:00, 16:00-17:00, or 17:00-18:00. Which works better for you?"
**Action:** ❌ Coffee break NOT scheduled yet, alternatives offered

### Example 4: Equal Priority Tasks Conflicting
**User:** "I need to add a dentist appointment at 2pm"
**Existing:** "Lunch" (MEDIUM priority) at 2-3pm
**AI Response:** "You have lunch at 14:00-15:00. Both are equal priority, so I recommend finding another time. Would one of these work: 13:00-14:00, 15:00-16:00, or 16:00-17:00?"
**Action:** ❌ Dentist appointment NOT scheduled yet, alternatives offered

### Example 5: Recurring Event
**User:** "Workout at 6am every Monday"
**AI Response:** "I'll create a recurring workout every Monday at 6:00 AM for 1 hour (06:00-07:00). This will repeat every week."
**Action:** ✅ Workout scheduled as recurring event

## Using the AI

The AI is accessible from:
1. **Calendar Page**: Type task details in the input bar at the bottom (e.g., "Meeting from 2pm to 4pm urgent")
2. **Assistant Page**: Full conversational chat interface in the left sidebar

## Current Date Context
- Today: November 25, 2025
- User Timezone: PST (Pacific Standard Time)
- Work Hours: 9am - 6pm (default for suggestions)

## Features in Development
- ✅ Natural language parsing
- ✅ Conflict detection and resolution
- ✅ Recurring event support
- ✅ Multi-task handling
- ✅ Colour coding by priority/category
- ✅ **PRIORITY-BASED AUTOMATIC RESCHEDULING** (NEW!)
- ⏳ Integration with Google Calendar API (in progress)
- ⏳ Voice input support

## Priority-Based Scheduling Deep Dive

### The Golden Rule
**Higher priority tasks always get their requested time slot.**
Lower priority tasks that conflict are automatically rescheduled with alternatives offered.

### Decision Matrix

| New Task Priority | Conflicting Task Priority | Action |
|---|---|---|
| HIGH | MEDIUM / LOW | ✅ Accept new task, reschedule conflicting task(s) |
| MEDIUM | LOW | ✅ Accept new task, reschedule conflicting task |
| MEDIUM | MEDIUM | ❌ Suggest alternatives for new task |
| LOW | MEDIUM / HIGH | ❌ Suggest alternatives for new task |
| LOW | LOW | ❌ Suggest alternatives for new task |

### How the AI Handles Rescheduling

1. **Identifies Conflict**: Detects overlapping times between new and existing tasks
2. **Compares Priorities**: Evaluates priority levels using: LOW (1) < MEDIUM (2) < HIGH (3)
3. **Makes Decision**: Determines which task gets the time slot based on priority
4. **Finds Alternatives**: Automatically searches for 2-3 available time slots
5. **Presents Options**: Shows user alternatives with formatted times (e.g., "14:00-15:00")
6. **Awaits Confirmation**: Waits for user to confirm rescheduling choice

### Example Workflow

```
User Input: "Schedule an urgent meeting at 8-9pm"
↓
AI finds: "Casual hangout" (medium priority) at 8-9pm
↓
AI compares: HIGH priority > MEDIUM priority
↓
AI action:
  ✓ Accept urgent meeting at 8-9pm
  ✓ Find alternatives for casual hangout: 6-7pm, 7-8pm, 9-10pm
  ✓ Ask user: "Which time works for the hangout?"
↓
Response with:
  - tasksToReschedule: ["Casual hangout"]
  - reschedulingOptions: {"Casual hangout": ["18:00-19:00", "19:00-20:00", "21:00-22:00"]}
  - status: "reschedule_confirmation"
```
