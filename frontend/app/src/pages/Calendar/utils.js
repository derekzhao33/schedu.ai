import { format, isSameDay, isSameWeek, isSameMonth, parseISO } from "date-fns";
import { PASTEL_COLORS } from "./constants";

// Basic event style calculation for vertical positioning
export function getEventStyle(event) {
  if (!event.startTime || !event.endTime) return {};
  const startHour = parseInt(event.startTime.split(":")[0], 10);
  const startMin = parseInt(event.startTime.split(":")[1], 10);
  const endHour = parseInt(event.endTime.split(":")[0], 10);
  const endMin = parseInt(event.endTime.split(":")[1], 10);
  const top = (startHour * 60 + startMin) * (60 / 60); // 60px per hour slot in day view
  const height = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) * (60 / 60);
  // Ensure height is at least 30px but not more than the slot minus 2px padding
  const maxHeight = Math.max(height - 2, 30);
  return {
    top: top + 1, // 1px from top border
    height: Math.min(height - 2, maxHeight), // Leave 1px from bottom
  };
}

// Task style calculation for vertical positioning
export function getTaskStyle(task) {
  if (!task.startTime || !task.endTime) return {};
  const startHour = parseInt(task.startTime.split(":")[0], 10);
  const startMin = parseInt(task.startTime.split(":")[1], 10);
  const endHour = parseInt(task.endTime.split(":")[0], 10);
  const endMin = parseInt(task.endTime.split(":")[1], 10);
  const top = (startHour * 60 + startMin) * (60 / 60); // 60px per hour slot in day view
  const height = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) * (60 / 60);
  const maxHeight = Math.max(height - 2, 30);
  return {
    top: top + 1,
    height: Math.min(height - 2, maxHeight),
  };
}

export function getTimeline(events, date) {
  // Filter events for the day and sort by start time
  return events
    .filter(e => isSameDay(parseISO(e.date), date))
    .sort((a, b) => (a.startTime || "00:00").localeCompare(b.startTime || "00:00"));
}

export function getTasksForDay(tasks, date) {
  return tasks
    .filter(t => t.date && isSameDay(parseISO(t.date), date))
    .sort((a, b) => (a.startTime || "00:00").localeCompare(b.startTime || "00:00"));
}

export function getWeekEvents(events, date) {
  return events.filter(e => isSameWeek(parseISO(e.date), date, { weekStartsOn: 0 }));
}

export function getMonthEvents(events, date) {
  return events.filter(e => isSameMonth(parseISO(e.date), date));
}

// Check if tasks overlap at a specific time
export function getTasksAtPosition(tasks, top) {
  return tasks.filter(task => {
    const style = getTaskStyle(task);
    return style.top <= top && (style.top + style.height) > top;
  });
}

// Parse natural language input to extract task details
export function parseTaskInput(input) {
  const task = {
    name: "",
    label: "",
    startTime: "",
    endTime: "",
    priority: "medium",
    color: Object.keys(PASTEL_COLORS)[Math.floor(Math.random() * 6)],
    date: format(new Date(), "yyyy-MM-dd"),
  };

  // Extract time patterns like "at 2pm", "from 2pm to 4pm", "2-4pm", "14:00-16:00"
  const timePatterns = [
    /(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*([ap]m)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)?/i,
    /at\s+(\d{1,2})(?::(\d{2}))?\s*([ap]m)?/i,
  ];

  let timeMatch = null;
  for (const pattern of timePatterns) {
    timeMatch = input.match(pattern);
    if (timeMatch) break;
  }

  if (timeMatch) {
    if (timeMatch[4]) {
      // Range pattern (from X to Y)
      let startHour = parseInt(timeMatch[1]);
      const startMin = timeMatch[2] || "00";
      let endHour = parseInt(timeMatch[4]);
      const endMin = timeMatch[5] || "00";

      // Handle AM/PM
      if (timeMatch[3]?.toLowerCase() === 'pm' && startHour < 12) startHour += 12;
      if (timeMatch[3]?.toLowerCase() === 'am' && startHour === 12) startHour = 0;
      if (timeMatch[6]?.toLowerCase() === 'pm' && endHour < 12) endHour += 12;
      if (timeMatch[6]?.toLowerCase() === 'am' && endHour === 12) endHour = 0;

      task.startTime = `${String(startHour).padStart(2, '0')}:${startMin}`;
      task.endTime = `${String(endHour).padStart(2, '0')}:${endMin}`;
    } else {
      // Single time pattern (at X)
      let hour = parseInt(timeMatch[1]);
      const min = timeMatch[2] || "00";

      if (timeMatch[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
      if (timeMatch[3]?.toLowerCase() === 'am' && hour === 12) hour = 0;

      task.startTime = `${String(hour).padStart(2, '0')}:${min}`;
      task.endTime = `${String(hour + 1).padStart(2, '0')}:${min}`;
    }

    // Remove time from task name
    input = input.replace(timeMatch[0], '').trim();
  }

  // Extract priority keywords
  const priorityPatterns = [
    { regex: /\b(urgent|high priority|important|critical)\b/i, priority: 'high' },
    { regex: /\b(medium priority|normal)\b/i, priority: 'medium' },
    { regex: /\b(low priority|minor|later)\b/i, priority: 'low' },
  ];

  for (const { regex, priority } of priorityPatterns) {
    if (regex.test(input)) {
      task.priority = priority;
      input = input.replace(regex, '').trim();
      break;
    }
  }

  // Extract label/type if present
  const labelMatch = input.match(/\[([^\]]+)\]/);
  if (labelMatch) {
    task.label = labelMatch[1];
    input = input.replace(labelMatch[0], '').trim();
  }

  // What's left is the task name
  task.name = input.trim() || "New Task";

  return task;
}
