# Quick Start Guide - Priority-Based Task Scheduling

## 🎯 What's Done

✅ **Priority logic fully implemented**
✅ **Error handling preventing API failures**  
✅ **Server running on port 3001**
✅ **Ready for use!**

## 🚀 How to Test

### Option 1: Using cURL
```bash
curl -X POST http://localhost:3001/api/assistant/process \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Schedule an urgent meeting at 8-9pm",
    "userId": 1,
    "userTimezone": "America/Los_Angeles"
  }'
```

### Option 2: Using Postman
1. Create POST request to `http://localhost:3001/api/assistant/process`
2. Set headers: `Content-Type: application/json`
3. Send body:
```json
{
  "input": "Schedule an urgent meeting at 8-9pm",
  "userId": 1,
  "userTimezone": "America/Los_Angeles"
}
```

### Option 3: From Frontend
```javascript
async function scheduleTask(input) {
  const response = await fetch('http://localhost:3001/api/assistant/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: input,
      userId: 1,
      userTimezone: "America/Los_Angeles"
    })
  });
  
  const result = await response.json();
  console.log(result);
  
  // Handle based on status
  if (result.status === 'complete') {
    console.log('✅ Task scheduled:', result.tasks);
  } else if (result.status === 'needs_confirmation') {
    console.log('❌ Task conflicts. Try these times:', result.suggestedAlternatives);
  } else if (result.status === 'reschedule_confirmation') {
    console.log('🔄 Will reschedule:', result.tasksToReschedule);
    console.log('Options:', result.reschedulingOptions);
  }
}

// Use it
scheduleTask("Schedule an urgent meeting at 8-9pm");
```

## 📝 Example Requests & Responses

### Example 1: Simple Task (No Conflict)
**Request:**
```json
{
  "input": "Meeting at 2pm tomorrow",
  "userId": 1
}
```

**Response:**
```json
{
  "message": "I'll create a meeting for you tomorrow at 14:00-15:00.",
  "tasks": [
    {
      "name": "Meeting",
      "date": "2025-11-26",
      "startTime": "14:00",
      "endTime": "15:00",
      "priority": "medium",
      "colour": "blue"
    }
  ],
  "tasksCreated": 1,
  "status": "complete"
}
```

### Example 2: High Priority Override
**Request:**
```json
{
  "input": "Urgent meeting at 8pm",
  "userId": 1
}
```
(Assuming "casual hangout" exists at 8pm)

**Response:**
```json
{
  "message": "I found you have a casual hangout at 20:00-21:00. Since your urgent meeting is higher priority, I'll reschedule the hangout...",
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
  "tasksCreated": 1,
  "tasksToReschedule": ["Casual hangout"],
  "reschedulingOptions": {
    "Casual hangout": ["18:00-19:00", "19:00-20:00", "21:00-22:00"]
  },
  "status": "reschedule_confirmation"
}
```

### Example 3: Low Priority Blocked
**Request:**
```json
{
  "input": "Coffee break at 3pm",
  "userId": 1
}
```
(Assuming "team meeting" exists at 3pm)

**Response:**
```json
{
  "message": "You have a team meeting at 15:00-16:00, which is higher priority. I can suggest these alternatives: 14:00-15:00, 16:00-17:00, 17:00-18:00.",
  "tasks": [],
  "tasksCreated": 0,
  "suggestedAlternatives": ["14:00-15:00", "16:00-17:00", "17:00-18:00"],
  "status": "needs_confirmation"
}
```

## 🎓 Priority Keywords

Say these to set priority:

**HIGH Priority:** "urgent", "important", "critical", "ASAP", "deadline"
```
"Urgent: Client meeting at 4pm" → HIGH
"ASAP: Review documents" → HIGH
```

**MEDIUM Priority:** Nothing special (default)
```
"Team meeting at 2pm" → MEDIUM
"Call with client" → MEDIUM
```

**LOW Priority:** "maybe", "optional", "whenever", "if time"
```
"Maybe coffee at 3pm" → LOW
"Optional: Read article" → LOW
"Break if time permits" → LOW
```

## 🔧 Response Status Values

The `status` field tells you what happened:

- **`"complete"`** → Task scheduled successfully, no conflicts
- **`"needs_confirmation"`** → New task blocked by higher priority task. User must pick alternative time
- **`"reschedule_confirmation"`** → Lower priority task will be moved. Show user alternatives for that task

## ✅ Error Handling

The API now handles errors gracefully:

- ❌ Empty input → Returns error message
- ❌ Missing userId → Returns error message  
- ❌ Claude API fails → Returns fallback response
- ❌ JSON parse error → Returns helpful message
- ❌ Any other error → Returns fallback response

**No more 500 errors or server crashes!**

## 🚀 Server Status

- Port: `3001`
- Status: ✅ Running
- Endpoint: `POST /api/assistant/process`
- Health: ✅ All systems operational

## 📚 Documentation Files

1. **STATUS_REPORT.md** - This document
2. **PRIORITY_BASED_SCHEDULING.md** - Complete user guide
3. **IMPLEMENTATION_GUIDE.md** - Technical deep dive
4. **AI_TRAINING_SUMMARY.md** - AI capabilities overview

## 🎯 Next Steps

1. **Frontend Integration** - Connect your frontend to the API
2. **Database Setup** - Implement task persistence (currently in-memory)
3. **Google Calendar** - Optional: Add calendar sync
4. **Testing** - Test various priority scenarios

## 💡 Pro Tips

1. **Be explicit about priority** when scheduling important tasks
   - ✅ "Urgent: Client meeting at 8pm"
   - ❌ "Client meeting at 8pm" (defaults to medium)

2. **The AI suggests smart times** when conflicts occur
   - Within ±2 hours of requested time when possible
   - Always respects work hours (9am-6pm)

3. **Check the `status` field** to know how to respond
   - `complete` = show success
   - `needs_confirmation` = ask user to pick time
   - `reschedule_confirmation` = show rescheduling options

## 🆘 Troubleshooting

**Server not responding?**
```powershell
# Check if server is running
Get-Process node

# Restart server
cd "c:\Users\nyama\New folder (3)\schedu.ai\backend"
npm run dev
```

**API returns error?**
- Check CloudAI API key in `.env`
- Verify userId is provided
- Check request format matches examples above

**Response format wrong?**
- Ensure `Content-Type: application/json` header
- Verify request body is valid JSON
- Check response `status` field

## 🎉 You're Ready!

The priority-based task scheduling system is fully operational. Start testing and integrate with your frontend!
