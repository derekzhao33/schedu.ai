import React, { useState } from "react";
import { useSchedule } from "../context/ScheduleContext";
import { useModal } from "../context/ModalContext";
import { useThemeSettings } from "../context/ThemeContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { motion } from "framer-motion";
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isSameWeek, isSameMonth, parseISO, setHours, setMinutes, getHours, getMinutes } from "date-fns";
import { CalendarIcon, MicIcon } from "lucide-react";
import AddTaskModal from "../components/AddTaskModal";
import TaskDetailsModal from "../components/TaskDetailsModal";
import Sidebar from "../components/Sidebar";

const PRIMARY_BG = "#F7F8FC";
const PRIMARY_DARK = "#355C7D";
const PRIMARY_LIGHT = "#FFFFFF";
const BORDER_COLOR = "#E8E0EB";
const TIME_START = 0; // midnight
const TIME_END = 24; // 24 hours
const TIME_INTERVAL = 1; // 1 hour

const VIEW_OPTIONS = ["Day", "Week", "Month"];

const PASTEL_COLORS = {
  red: "#FFB3BA",
  blue: "#BAE1FF",
  yellow: "#FFFFBA",
  orange: "#FFDFBA",
  green: "#BAFFC9",
  purple: "#E0BBE4",
};

// Basic event style calculation for vertical positioning
function getEventStyle(event) {
  if (!event.startTime || !event.endTime) return {};
  const startHour = parseInt(event.startTime.split(":")[0], 10);
  const startMin = parseInt(event.startTime.split(":")[1], 10);
  const endHour = parseInt(event.endTime.split(":")[0], 10);
  const endMin = parseInt(event.endTime.split(":")[1], 10);
  const top = (startHour * 60 + startMin) * (40 / 60); // 40px per hour slot
  const height = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) * (40 / 60);
  // Ensure height is at least 24px but not more than the slot minus 2px padding
  const maxHeight = Math.max(height - 2, 22);
  return {
    top: top + 1, // 1px from top border
    height: Math.min(height - 2, maxHeight), // Leave 1px from bottom
  };
}

// Task style calculation for vertical positioning
function getTaskStyle(task) {
  if (!task.startTime || !task.endTime) return {};
  const startHour = parseInt(task.startTime.split(":")[0], 10);
  const startMin = parseInt(task.startTime.split(":")[1], 10);
  const endHour = parseInt(task.endTime.split(":")[0], 10);
  const endMin = parseInt(task.endTime.split(":")[1], 10);
  const top = (startHour * 60 + startMin) * (40 / 60); // 40px per hour slot
  const height = ((endHour * 60 + endMin) - (startHour * 60 + startMin)) * (40 / 60);
  const maxHeight = Math.max(height - 2, 22);
  return {
    top: top + 1,
    height: Math.min(height - 2, maxHeight),
  };
}

function getTimeline(events, date) {
  // Filter events for the day and sort by start time
  return events
    .filter(e => isSameDay(parseISO(e.date), date))
    .sort((a, b) => (a.startTime || "00:00").localeCompare(b.startTime || "00:00"));
}

function getTasksForDay(tasks, date) {
  return tasks
    .filter(t => t.date && isSameDay(parseISO(t.date), date))
    .sort((a, b) => (a.startTime || "00:00").localeCompare(b.startTime || "00:00"));
}

function getWeekEvents(events, date) {
  return events.filter(e => isSameWeek(parseISO(e.date), date, { weekStartsOn: 0 }));
}

function getMonthEvents(events, date) {
  return events.filter(e => isSameMonth(parseISO(e.date), date));
}

// Check if tasks overlap at a specific time
function getTasksAtPosition(tasks, top) {
  return tasks.filter(task => {
    const style = getTaskStyle(task);
    return style.top <= top && (style.top + style.height) > top;
  });
}

// Parse natural language input to extract task details
function parseTaskInput(input) {
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

export default function Calender() {
  const { events, tasks, addTask } = useSchedule();
  const { openAddTaskModal, openTaskDetailsModal } = useModal();
  const { theme } = useThemeSettings();
  const [view, setView] = useState("Day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [input, setInput] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Calendar navigation
  const handlePrev = () => {
    if (view === "Day") setSelectedDate(subDays(selectedDate, 1));
    else if (view === "Week") setSelectedDate(subDays(selectedDate, 7));
    else if (view === "Month") setSelectedDate(subDays(selectedDate, 30));
  };
  const handleNext = () => {
    if (view === "Day") setSelectedDate(addDays(selectedDate, 1));
    else if (view === "Week") setSelectedDate(addDays(selectedDate, 7));
    else if (view === "Month") setSelectedDate(addDays(selectedDate, 30));
  };

  // Handle quick task creation from input
  const handleQuickAdd = () => {
    if (!input.trim()) return;

    const parsedTask = parseTaskInput(input);
    addTask(parsedTask);

    setShowSuccess(true);
    setInput("");
    setTimeout(() => {
      setShowSuccess(false);
    }, 2000);
  };

  // Handle Enter key in input
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleQuickAdd();
    }
  };

  // Timeline for day view
  const timeline = getTimeline(events, selectedDate);
  const todaysTasks = getTasksForDay(tasks, selectedDate);

  // Helper: parse "HH:mm" to Date object on selectedDate
  const renderWeekGrid = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const hours = Array.from({ length: TIME_END - TIME_START }, (_, i) => TIME_START + i);
    return (
      <div className="overflow-x-auto mt-4 flex-1" style={{minHeight: 0, maxHeight: 'calc(100vh - 220px)'}}>
        <div className="flex flex-row w-full h-full" style={{minHeight: 'calc(100vh - 220px)', maxHeight: 'calc(100vh - 220px)'}}>
          {/* Time column */}
          <div className="flex flex-col pr-2" style={{width: 56, marginRight: 8, height: '100%', marginTop: 23}}>
            {hours.map(h => (
              <div key={h} className="flex items-center justify-end text-xs text-gray-500" style={{height: 40, minHeight: 40, paddingRight: 4}}>
                {format(setHours(new Date(), h), "h a")}
              </div>
            ))}
          </div>
          {/* Days columns */}
          <div className="flex-1 grid grid-cols-7 gap-2 h-full" style={{height: '100%'}}>
            {days.map((day, dayIdx) => {
              const dayEvents = getTimeline(events, day);
              const dayTasks = getTasksForDay(tasks, day);
              return (
                <div key={dayIdx} className="relative border-l flex flex-col h-full" style={{minWidth: 120, background: PRIMARY_LIGHT, borderRadius: 16, borderColor: BORDER_COLOR, boxShadow: '0 2px 8px rgba(24,29,39,0.03)', flex: 1}}>
                  {/* Day header */}
                  <div className="sticky top-0 z-10 bg-[#F6F8FF] rounded-t-2xl p-2 text-center font-bold border-b flex items-center justify-center" style={{ color: PRIMARY_DARK, borderColor: BORDER_COLOR, height: 40 }}>{format(day, "EEE d")}</div>
                  {/* Timeline slots */}
                  <div className="relative h-full flex flex-col" style={{height: '100%'}}>
                    {hours.map(h => (
                      <div key={h} className="border-b" style={{height: 40, minHeight: 40, borderColor: BORDER_COLOR, borderBottomWidth: 1, borderStyle: 'solid'}}></div>
                    ))}
                    {/* Events */}
                    {dayEvents.map((event, i) => {
                      const style = getEventStyle(event);
                      return (
                        <div
                          key={i}
                          className="absolute left-2 right-2 bg-white rounded-xl p-2 flex flex-col justify-center border border-indigo-100"
                          style={{ ...style, minHeight: 24, zIndex: 2, boxShadow: 'none', overflow: 'visible' }}
                        >
                          <div className="font-semibold text-indigo-900 text-xs whitespace-normal break-words">{event.name}</div>
                        </div>
                      );
                    })}
                    {/* Tasks */}
                    {dayTasks.map((task, i) => {
                      const style = getTaskStyle(task);
                      const taskColor = PASTEL_COLORS[task.color] || PASTEL_COLORS.blue;
                      return (
                        <div
                          key={`task-${i}`}
                          className="absolute left-2 right-2 rounded-lg p-1.5 cursor-pointer transition-all hover:scale-105"
                          style={{
                            ...style,
                            minHeight: 20,
                            zIndex: 3,
                            backgroundColor: taskColor,
                            border: `1px solid ${taskColor}`,
                            overflow: 'hidden'
                          }}
                          onClick={() => openTaskDetailsModal(task, tasks.indexOf(task))}
                        >
                          <div className="font-semibold text-gray-800 text-xs truncate">{task.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };
// Duplicate block removed and function properly closed above

  const renderMonthGrid = () => {
    const start = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 });
    const days = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    // 6 rows for full month, 7 columns for days
    return (
      <div className="flex-1 overflow-y-auto pb-40">
        <div className="grid grid-cols-7 gap-2 mt-4 min-h-[calc(100vh-220px)]" style={{alignItems: 'stretch'}}>
          {days.map((d, i) => {
            const dayTasks = getTasksForDay(tasks, d);
            const dayEvents = getTimeline(events, d);
            return (
              <div
                key={i}
                className={`rounded-2xl p-4 cursor-pointer transition shadow flex flex-col justify-start ${isSameDay(d, selectedDate) ? "ring-2 ring-indigo-400" : ""}`}
                style={{ background: PRIMARY_LIGHT, color: PRIMARY_DARK, opacity: isSameMonth(d, selectedDate) ? 1 : 0.5, minHeight: 120, border: `1px solid ${BORDER_COLOR}` }}
                onClick={() => setSelectedDate(d)}
              >
                <div className="font-bold mb-2">{format(d, "d")}</div>
                <div className="space-y-1 flex-1">
                  {dayEvents.slice(0, 1).map((e, j) => (
                    <div key={j} className="text-xs bg-white rounded px-2 py-1 text-gray-700 truncate border border-indigo-100">
                      {e.name}
                    </div>
                  ))}
                  {dayTasks.slice(0, 2).map((task, j) => {
                    const taskColor = PASTEL_COLORS[task.color] || PASTEL_COLORS.blue;
                    return (
                      <div
                        key={`task-${j}`}
                        className="text-xs rounded px-2 py-1 text-gray-800 truncate cursor-pointer hover:scale-105 transition-all"
                        style={{ backgroundColor: taskColor, border: `1px solid ${taskColor}` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openTaskDetailsModal(task, tasks.indexOf(task));
                        }}
                      >
                        {task.name}
                      </div>
                    );
                  })}
                  {(dayTasks.length + dayEvents.length > 3) && (
                    <div className="text-xs text-gray-500 italic">
                      +{dayTasks.length + dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex min-h-screen ${theme === 'dark' ? 'dark' : ''}`} style={{ background: PRIMARY_BG }}>
      <Sidebar />
      <div className="flex-1 flex flex-col" style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
        {/* Header and View Switcher */}
        <div className="flex flex-col md:flex-row justify-between items-center p-6 pb-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handlePrev} style={{ color: PRIMARY_DARK }}>
            &lt;
          </Button>
          <div className="text-2xl font-bold" style={{ color: PRIMARY_DARK }}>
            {view === "Day" && format(selectedDate, "EEEE, MMM d, yyyy")}
            {view === "Week" && `Week of ${format(startOfWeek(selectedDate), "MMM d")}`}
            {view === "Month" && format(selectedDate, "MMMM yyyy")}
          </div>
          <Button variant="ghost" onClick={handleNext} style={{ color: PRIMARY_DARK }}>
            &gt;
          </Button>
          <Button
            onClick={openAddTaskModal}
            style={{
              background: PRIMARY_DARK,
              color: PRIMARY_BG,
              borderRadius: 16,
              fontWeight: 600,
              paddingLeft: 20,
              paddingRight: 20,
            }}
          >
            + Add Task
          </Button>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          {VIEW_OPTIONS.map(opt => (
            <Button
              key={opt}
              variant={view === opt ? "default" : "outline"}
              style={{
                background: view === opt ? PRIMARY_DARK : PRIMARY_BG,
                color: view === opt ? PRIMARY_BG : PRIMARY_DARK,
                borderRadius: 16,
                fontWeight: 600
              }}
              onClick={() => setView(opt)}
            >
              {opt}
            </Button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <motion.div
        className="px-6 flex-1 flex flex-col min-h-0"
        style={{overflow: 'hidden'}}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {view === "Day" && (
          <div className="rounded-3xl shadow-xl p-6 mt-4 flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'transparent', minHeight: 0 }}>
            <div className="text-xl font-bold mb-4" style={{ color: PRIMARY_DARK }}>Timeline</div>
            <div className="flex-1 min-h-0 flex flex-col h-full" style={{ position: 'relative', minHeight: 0, height: 'calc(100vh - 220px)' }}>
              <div className="flex-1 min-h-0 flex flex-col h-full" style={{height: '100%'}}>
                <div className="flex flex-1 h-full min-h-0 overflow-y-auto" style={{height: '100%'}}>
                  {/* Time labels outside white area */}
                  <div className="flex flex-col pr-2 flex-shrink-0" style={{width: 56, marginRight: 8, marginTop: -16}}>
                    {Array.from({ length: TIME_END - TIME_START }, (_, i) => TIME_START + i).map(h => (
                      <div key={h} className="flex items-center justify-end text-xs text-gray-500" style={{height: 40, minHeight: 40, paddingRight: 4}}>
                        {format(setHours(new Date(), h), "h a")}
                      </div>
                    ))}
                  </div>
                  {/* Timeline slots and events inside white area */}
                  <div className="relative flex-1 min-h-0 flex flex-col rounded-2xl shadow-xl border" style={{ background: PRIMARY_LIGHT, border: `1px solid ${BORDER_COLOR}`, height: 960 }}>
                    {/* Time slots */}
                    <div className="flex-1 flex flex-col justify-between" style={{height: 960}}>
                      {Array.from({ length: TIME_END - TIME_START }, (_, i) => (
                        <div key={i} className="border-b" style={{height: 40, minHeight: 40, borderColor: BORDER_COLOR, borderBottomWidth: 1, borderStyle: 'solid'}}></div>
                      ))}
                    </div>
                    {/* Events */}
                    {timeline.map((event, i) => {
                      const style = getEventStyle(event);
                      return (
                        <div
                          key={i}
                          className="absolute left-2 right-2 bg-white rounded-xl p-4 flex flex-row items-center gap-2 border border-indigo-100"
                          style={{ ...style, minHeight: 24, zIndex: 2, boxShadow: 'none', overflow: 'visible' }}
                        >
                          <div className="font-semibold text-indigo-900 whitespace-nowrap">{event.name}</div>
                          <div className="text-xs text-gray-600 whitespace-normal break-words flex-1">{event.description}</div>
                        </div>
                      );
                    })}
                    {/* Tasks */}
                    {todaysTasks.map((task, i) => {
                      const style = getTaskStyle(task);
                      const taskColor = PASTEL_COLORS[task.color] || PASTEL_COLORS.blue;
                      return (
                        <div
                          key={`task-${i}`}
                          className="absolute left-2 right-2 rounded-xl p-3 flex flex-row items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md"
                          style={{
                            ...style,
                            minHeight: 24,
                            zIndex: 3,
                            backgroundColor: taskColor,
                            border: `2px solid ${taskColor}`,
                            overflow: 'visible'
                          }}
                          onClick={() => openTaskDetailsModal(task, i)}
                        >
                          <div className="font-semibold text-gray-800 whitespace-nowrap">{task.name}</div>
                          {task.label && (
                            <span className="text-xs bg-white/50 text-gray-700 rounded px-2 py-0.5">
                              {task.label}
                            </span>
                          )}
                          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded ${
                            task.priority === 'high' ? 'bg-red-200 text-red-800' :
                            task.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                            'bg-green-200 text-green-800'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {view === "Week" && renderWeekGrid()}
        {view === "Month" && renderMonthGrid()}
      </motion.div>

      {/* Input Bar */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center items-center p-6" style={{ background: PRIMARY_BG, borderTopLeftRadius: 32, borderTopRightRadius: 32, boxShadow: '0 -2px 16px rgba(24,29,39,0.08)' }}>
        <div className="flex items-center w-full max-w-2xl bg-white rounded-2xl shadow-lg px-4 py-3 gap-3 relative">
          {showSuccess && (
            <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
              <span className="text-2xl">✓</span>
              <span className="font-semibold">Task created successfully!</span>
            </div>
          )}
          <Input
            className="flex-1 text-lg border-0 focus:ring-0 focus:outline-none bg-transparent"
            placeholder="Type task details (e.g. 'Meeting from 2pm to 4pm urgent' or 'Workout at 6am [fitness]')"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            style={{ color: PRIMARY_DARK }}
          />
          <Button variant="ghost" style={{ color: PRIMARY_DARK, borderRadius: 16 }}>
            <MicIcon size={24} />
          </Button>
          <Button
            onClick={handleQuickAdd}
            disabled={!input.trim()}
            style={{
              background: input.trim() ? PRIMARY_DARK : '#9CA3AF',
              color: PRIMARY_BG,
              borderRadius: 16,
              fontWeight: 600,
              cursor: input.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Add
          </Button>
        </div>
      </div>

        {/* Modals */}
        <AddTaskModal />
        <TaskDetailsModal />
      </div>
    </div>
  );
}
