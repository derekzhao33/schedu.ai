# Priority-Based Task Scheduling Implementation Guide

## What Was Added

Your Claude AI assistant in schedu.ai has been trained with a complete priority-based task scheduling system. Here's what was implemented:

### 1. **Priority Hierarchy**
```
LOW (1) < MEDIUM (2) < HIGH (3)
```

### 2. **Core Decision Logic**

**When a new task conflicts with existing tasks:**

```
IF new_task.priority > conflicting_task.priority:
  ✅ Accept new task at requested time
  📋 Offer alternatives for conflicting task
  📤 Return status: "reschedule_confirmation"
  
ELSE:
  ❌ Reject new task at that time
  📋 Offer alternatives for NEW task
  📤 Return status: "needs_confirmation"
```

### 3. **New Functions Added**

#### `getPriorityLevel(priority?: string): number`
Converts priority string to numeric level for comparison

#### `checkConflictsWithPriority(newTask, existingTasks): ConflictingTask[]`
Detects conflicts while preserving priority information

#### `findAlternativeSlots(existingTasks, date, duration, excludeTime): Slot[]`
Intelligently finds 2-3 available time slots for a displaced task

### 4. **Updated Response Interface**

```typescript
interface AIResponse {
  message: string;
  tasks: ParsedTask[];
  tasksCreated: number;
  missingInfo?: string[];
  conflicts?: string[];
  suggestedAlternatives?: string[];
  
  // NEW FIELDS:
  tasksToReschedule?: string[];           // Tasks being moved
  reschedulingOptions?: Record<string, string[]>;  // Alternatives for each task
  status?: 'complete' | 'needs_confirmation' | 'reschedule_confirmation';  // NEW STATUS
}
```

### 5. **System Prompt Enhanced**

The Claude system prompt now includes:
- Priority detection keywords
- Priority comparison logic
- Rescheduling rules and examples
- Alternative time slot finding instructions
- New response format with reschedule fields

---

## How to Test It

### Test Case 1: High Priority Overrides Medium Priority ✅

```
You: "Schedule an urgent meeting at 8-9pm"
Existing: "Casual hangout" at 8-9pm (not marked urgent)

Expected Result:
- New task: "Urgent meeting" at 20:00-21:00 → SCHEDULED ✅
- Old task: "Casual hangout" → OFFERED ALTERNATIVES
- Status: "reschedule_confirmation"
- tasksToReschedule: ["Casual hangout"]
- reschedulingOptions: {"Casual hangout": ["18:00-19:00", "19:00-20:00", "21:00-22:00"]}
```

### Test Case 2: Low Priority Task Blocked ❌

```
You: "Can I add a coffee break at 3pm?"
Existing: "Team meeting" at 3-4pm

Expected Result:
- New task: "Coffee break" → NOT SCHEDULED ❌
- Status: "needs_confirmation"
- suggestedAlternatives: ["14:00-15:00", "16:00-17:00", "17:00-18:00"]
- Message explains: "Your team meeting is higher priority..."
```

### Test Case 3: Equal Priority Conflict ⚖️

```
You: "Add dentist at 2pm"
Existing: "Lunch" at 2-3pm (same priority level)

Expected Result:
- New task: "Dentist" → NOT SCHEDULED ❌
- Status: "needs_confirmation"
- suggestedAlternatives: ["13:00-14:00", "15:00-16:00", "16:00-17:00"]
- Message explains: "Both are same priority, pick another time..."
```

### Test Case 4: Simple No Conflict

```
You: "Meeting at 2pm tomorrow"
Existing: (nothing at that time)

Expected Result:
- New task: "Meeting" → SCHEDULED ✅
- Status: "complete"
- Message: "I'll schedule your meeting for tomorrow at 14:00-15:00"
```

---

## Code Changes Made

### File: `backend/src/services/assistant/assistant.service.ts`

#### 1. Added Priority Constants
```typescript
const PRIORITY_LEVELS = {
  'low': 1,
  'medium': 2,
  'high': 3,
};
```

#### 2. Added Helper Functions
- `getPriorityLevel()` - Convert priority to numeric value
- `checkConflictsWithPriority()` - Detect conflicts with priority info
- `findAlternativeSlots()` - Find available time slots

#### 3. Updated Conflict Checking Logic (lines 690-745)
Replaced simple conflict detection with priority-aware logic that:
- Compares priority levels
- Decides whether to reschedule or reject new task
- Finds appropriate alternatives
- Sets correct response status

#### 4. Enhanced System Prompt
Added comprehensive instructions to Claude:
- Priority detection rules
- Rescheduling decision matrix
- Example scenarios
- Response format with new fields

#### 5. Updated Response Building (lines 780-788)
Now includes:
- `tasksToReschedule` field
- `reschedulingOptions` field
- `status` field with three possible values

---

## Priority Detection Keywords

The AI automatically detects priority from language:

### HIGH Priority ⭐
- "urgent", "important", "critical"
- "must", "ASAP", "immediately"
- "deadline", "emergency"

### MEDIUM Priority 📋 (Default)
- No special keywords
- Regular task mentions
- Standard meetings, work items

### LOW Priority 📌
- "maybe", "whenever", "optional"
- "if time permits", "casual"
- "break", "free time"

---

## Frontend Integration Notes

Your frontend should handle the new response fields:

```typescript
// When status is "reschedule_confirmation":
if (response.status === 'reschedule_confirmation') {
  // Show which tasks are being rescheduled
  console.log('Tasks to reschedule:', response.tasksToReschedule);
  
  // Show options for each displaced task
  for (const [taskName, alternatives] of Object.entries(response.reschedulingOptions)) {
    console.log(`${taskName}: ${alternatives.join(', ')}`);
  }
  
  // Let user select new times for displaced tasks
  // Or let them reject and the new task gets alternative times instead
}

// When status is "needs_confirmation":
if (response.status === 'needs_confirmation') {
  // Show suggested alternatives for the NEW task
  console.log('Alternatives for your task:', response.suggestedAlternatives);
  
  // Let user pick one of the alternatives
}

// When status is "complete":
if (response.status === 'complete') {
  // Task successfully scheduled, show confirmation
  console.log('Task scheduled!', response.tasks);
}
```

---

## Database Consideration

When you implement full database storage, make sure the `Task` model includes:

```prisma
model Task {
    // ... existing fields ...
    priority String?  // 'low', 'medium', or 'high'
    // This is needed for future rescheduling when retrieving existing tasks
}
```

The current code stores tasks with priority, but database operations are marked as TODO.

---

## Limitations & Future Work

### Current Limitations:
1. ✓ Works with Claude AI responses
2. ✓ Handles single time slot conflicts
3. ⏳ Database integration not yet implemented (TODO in code)
4. ⏳ Google Calendar sync not yet integrated
5. ⏳ Recurring event priority handling (basic framework in place)

### Future Enhancements:
- [ ] Implement actual database task rescheduling
- [ ] Google Calendar API integration for reading existing events
- [ ] Recurring event priority inheritance
- [ ] Smart time slot suggestions based on user patterns
- [ ] Conflict avoidance mode (prevents all conflicts)

---

## Testing Checklist

- [ ] Test HIGH priority blocking MEDIUM/LOW ✅
- [ ] Test MEDIUM priority blocking LOW ✅
- [ ] Test equal priority rejection ✅
- [ ] Test no conflict scenario ✅
- [ ] Test multiple conflicting tasks ✅
- [ ] Test recurring events with priority
- [ ] Test time zone handling
- [ ] Test edge cases (midnight, end of day)

---

## Summary

Your AI assistant now intelligently handles task scheduling by:

1. **Understanding Priority** via natural language keywords
2. **Comparing Priorities** when conflicts occur  
3. **Making Smart Decisions** about which task gets the slot
4. **Finding Alternatives** for displaced tasks
5. **Presenting Options** clearly to the user

This ensures high-priority work always gets scheduled while lower-priority items gracefully reschedule!
