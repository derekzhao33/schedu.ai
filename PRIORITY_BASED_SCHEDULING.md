# Priority-Based Task Scheduling Guide

## Overview

The Claude AI in schedu.ai has been trained with an intelligent priority-based scheduling system. This means the AI now automatically handles scheduling conflicts by comparing task priorities and rescheduling lower-priority tasks when necessary.

**Priority Levels**: LOW < MEDIUM < HIGH

---

## How It Works

### Core Logic: The Golden Rule
**Higher priority tasks ALWAYS get their requested time slot.**

When a new high-priority task conflicts with a medium or low-priority task, the AI automatically:
1. ✅ Accepts the high-priority task at the requested time
2. 🔄 Reschedules the lower-priority task
3. 📋 Offers 2-3 alternative times for the displaced task
4. ❓ Asks the user which alternative works best

### Priority Detection Keywords

The AI automatically detects priority levels from your language:

**HIGH Priority Keywords:**
- "urgent", "important", "critical", "must do", "deadline", "ASAP", "immediately"

**MEDIUM Priority (Default):**
- No special keywords, standard task mentions
- Example: "I have a meeting at 2pm"

**LOW Priority Keywords:**
- "maybe", "whenever", "optional", "if time permits", "break", "free time", "casual"

---

## Real-World Scenarios

### Scenario 1: Urgent Meeting Blocks Casual Plans ✅

**What You Say:**
```
"I need to schedule an urgent meeting at 8-9pm"
```

**What AI Finds:**
```
Existing: "Casual hangout" (MEDIUM priority) at 8-9pm
```

**What AI Does:**
```
1. Compares priorities: HIGH > MEDIUM
2. ✅ Accepts urgent meeting at 8-9pm
3. 🔄 Looks for alternatives for casual hangout
4. 📋 Offers: 6-7pm, 7-8pm, 9-10pm
5. ❓ Asks: "Which time works best for the hangout?"
```

**AI Response:**
```
"I found you have a casual hangout at 20:00-21:00. Since your urgent meeting 
is higher priority, I'll reschedule the hangout to one of these times instead: 
18:00-19:00, 19:00-20:00, or 21:00-22:00. Which time works best for the hangout?"
```

**Result:**
- ✅ Urgent meeting scheduled at 8-9pm
- 🔄 Hangout rescheduled (awaiting user confirmation on time)

---

### Scenario 2: Coffee Break vs Team Meeting ❌

**What You Say:**
```
"Can I schedule a coffee break at 3pm?"
```

**What AI Finds:**
```
Existing: "Team meeting" (MEDIUM priority) at 3-4pm
```

**What AI Does:**
```
1. Compares priorities: LOW < MEDIUM
2. ❌ Rejects coffee break at 3pm (lower priority)
3. 🔄 Looks for alternatives for coffee break
4. 📋 Offers: 2-3pm, 4-5pm, 5-6pm
5. ❓ Asks: "Which alternative works for you?"
```

**AI Response:**
```
"You have a team meeting at 15:00-16:00, which is higher priority than 
your coffee break. I can suggest these alternative times instead: 
14:00-15:00, 16:00-17:00, or 17:00-18:00. Which works better for you?"
```

**Result:**
- ❌ Coffee break NOT scheduled yet (needs user to choose alternative)
- 📋 User selects from offered times

---

### Scenario 3: Two Meetings of Equal Priority ⚖️

**What You Say:**
```
"Add a dentist appointment at 2pm"
```

**What AI Finds:**
```
Existing: "Lunch" (MEDIUM priority) at 2-3pm
```

**What AI Does:**
```
1. Compares priorities: MEDIUM = MEDIUM
2. ❌ Rejects dentist at 2pm (equal priority)
3. 🔄 Looks for alternatives for dentist appointment
4. 📋 Offers: 1-2pm, 3-4pm, 4-5pm
5. ❓ Asks: "Which time works for the dentist?"
```

**AI Response:**
```
"You have lunch at 14:00-15:00. Both are equal priority, so I recommend 
finding another time for the dentist. Would one of these work: 13:00-14:00, 
15:00-16:00, or 16:00-17:00?"
```

**Result:**
- ❌ Dentist appointment NOT scheduled yet (needs user to choose alternative)
- 📋 User selects from offered times

---

## Decision Matrix

Use this table to understand how the AI will respond:

| New Task | Conflicts With | AI Action | Result |
|---|---|---|---|
| HIGH priority | MEDIUM priority | Accept new, reschedule conflicting | ✅ New task scheduled, old task offered alternatives |
| HIGH priority | LOW priority | Accept new, reschedule conflicting | ✅ New task scheduled, old task offered alternatives |
| MEDIUM priority | LOW priority | Accept new, reschedule conflicting | ✅ New task scheduled, old task offered alternatives |
| MEDIUM priority | MEDIUM priority | Reject new, offer alternatives | ❌ New task NOT scheduled, alternatives offered |
| MEDIUM priority | HIGH priority | Reject new, offer alternatives | ❌ New task NOT scheduled, alternatives offered |
| LOW priority | Any priority | Reject new, offer alternatives | ❌ New task NOT scheduled, alternatives offered |

---

## The 3 Response Types

### 1. `status: "complete"`
**Meaning:** Task successfully scheduled with no conflicts
**Example:**
```
"I'll schedule your meeting tomorrow at 2pm (14:00-15:00). Ready to confirm?"
```

### 2. `status: "needs_confirmation"`
**Meaning:** User needs to select an alternative time for their NEW task
**When:** New task has equal or lower priority than existing task(s)
**Example:**
```
"Your coffee break conflicts with a higher-priority meeting. 
Here are alternatives: 2-3pm, 4-5pm, or 5-6pm. Which works?"
```

### 3. `status: "reschedule_confirmation"`
**Meaning:** Conflicting task(s) will be rescheduled, user selects when
**When:** New task has higher priority than existing task(s)
**Example:**
```
"Your urgent meeting will be scheduled at 8-9pm. 
Your casual hangout will be rescheduled. Alternatives: 6-7pm, 7-8pm, 9-10pm. 
Which time works for the hangout?"
```

---

## Pro Tips for Using Priority-Based Scheduling

### 1. **Use Priority Keywords**
Be explicit about priority in your requests:
- ✅ Good: "I need to urgently schedule a meeting at 8pm"
- ❌ Less Clear: "Can you schedule a meeting at 8pm?"

### 2. **Understand Your Defaults**
- If you don't specify priority → defaults to MEDIUM
- This means low-priority tasks will always give way to medium or high tasks

### 3. **Stack Multiple High-Priority Tasks**
If you have multiple urgent things at the same time:
- Create them one at a time
- The AI will reschedule previous ones for you
- Builds a natural ordering of importance

### 4. **Mark Non-Essential Tasks as LOW Priority**
```
✅ "Maybe a coffee break if time permits at 3pm" (LOW)
✅ "Optional: Read that article at 5pm" (LOW)
❌ "Coffee at 3pm" (defaults to MEDIUM)
```

### 5. **Review Suggested Alternatives**
When the AI offers alternatives, it smartly suggests times:
- Close to your original request time
- Within work hours (9am-6pm)
- With buffer time between events

---

## Advanced Features

### Multiple Conflicting Tasks
If your new high-priority task conflicts with MULTIPLE lower-priority tasks:

```
You: "Schedule an urgent client call at 2-4pm"

Existing:
- 2-3pm: Team sync (MEDIUM)
- 3-4pm: Lunch (LOW)

AI Action:
✅ Accept client call at 2-4pm
🔄 Reschedule both conflicting tasks
📋 Offer alternatives for each
```

### Recurring Events with Priority
Priority-based scheduling also works with recurring events:

```
You: "Important daily standup at 9am every weekday (high priority)"

This will automatically reschedule any LOW priority tasks at 9am on weekdays
```

---

## API Response Format

When the AI responds with priority-based rescheduling:

```json
{
  "message": "I found you have a casual hangout at 20:00-21:00...",
  "tasks": [
    {
      "name": "Urgent meeting",
      "date": "2025-11-25",
      "startTime": "20:00",
      "endTime": "21:00",
      "priority": "high",
      "colour": "red"
    }
  ],
  "tasksToReschedule": ["Casual hangout"],
  "reschedulingOptions": {
    "Casual hangout": ["18:00-19:00", "19:00-20:00", "21:00-22:00"]
  },
  "status": "reschedule_confirmation"
}
```

**Key Fields:**
- `tasksToReschedule`: List of task names being moved
- `reschedulingOptions`: Map of tasks to their available time slots
- `status`: "reschedule_confirmation" indicates user must confirm changes

---

## Common Questions

### Q: Will my meetings get canceled?
**A:** No! Low-priority tasks are only *offered* reschedule alternatives. The user must confirm the new time before any change is made.

### Q: What if I don't want my task rescheduled?
**A:** You can reject the reschedule and the AI will offer the high-priority task an alternative time instead.

### Q: How does the AI know my task priority?
**A:** It looks for keywords like "urgent", "important", etc. If none found, assumes MEDIUM. You can always be explicit: "Low priority: maybe a coffee break"

### Q: What about tasks with the same priority?
**A:** If a new task has the same priority as an existing one, the existing one wins and the new task is offered alternatives.

### Q: Can I override the AI's decision?
**A:** Yes! If you disagree with the AI's suggestions, you can always provide new times or ask it to reschedule differently.

---

## Best Practices

✅ **DO:**
- Use clear priority language ("urgent", "important", "casual", "optional")
- Review suggested alternatives from the AI
- Create high-priority tasks during your peak hours
- Group similar-priority tasks together

❌ **DON'T:**
- Mark everything as high priority (loses differentiation)
- Ignore suggested alternatives (they're carefully chosen)
- Schedule conflicting high-priority tasks without planning
- Overload your calendar with back-to-back urgent tasks

---

## Examples of Priority Usage

### High Priority
```
"Urgent: Client emergency meeting at 4pm"
"ASAP: Project deadline review at 10am"
"Critical: Doctor appointment at 2pm"
"Must complete: Financial review by 3pm"
```

### Medium Priority
```
"Team standup at 9am"
"Lunch with colleague at 12pm"
"1-on-1 with manager at 3pm"
"Project work time at 2pm"
```

### Low Priority
```
"Maybe grab coffee at 3pm if time"
"Optional: Personal reading at 5pm"
"Whenever: Update LinkedIn profile"
"Break: Take a walk in the park"
```

---

## Summary

The priority-based scheduling system makes schedu.ai smarter by:
1. **Understanding importance** through natural language
2. **Making intelligent decisions** about scheduling conflicts
3. **Protecting high-priority time** by moving lower-priority tasks
4. **Offering alternatives** for displaced tasks
5. **Respecting your input** before making any changes

This ensures your most important tasks always get scheduled when you need them, while still finding spots for lower-priority items.
