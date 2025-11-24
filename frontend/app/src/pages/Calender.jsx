import React, { useState, useEffect } from "react";
import { useSchedule } from "../context/ScheduleContext";
import { useModal } from "../context/ModalContext";
import { useThemeSettings } from "../context/ThemeContext";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { motion } from "framer-motion";
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isSameWeek, isSameMonth, parseISO, setHours, setMinutes, getHours, getMinutes } from "date-fns";
import { CalendarIcon, MicIcon, CheckCircle2, RefreshCw } from "lucide-react";
import AddTaskModal from "../components/AddTaskModal";
import TaskDetailsModal from "../components/TaskDetailsModal";
import Sidebar, { useSidebar } from "../components/Sidebar";

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

// Add CSS animation keyframes
const styles = `
  @keyframes liquify {
    0%, 100% {
      border-radius: 50px;
      box-shadow: 0 8px 32px rgba(236, 72, 153, 0.25), 0 0 60px rgba(168, 85, 247, 0.15), inset 0 2px 10px rgba(255,255,255,0.8);
    }
    25% {
      border-radius: 45px 55px 50px 48px;
      box-shadow: 0 10px 35px rgba(168, 85, 247, 0.3), 0 0 70px rgba(236, 72, 153, 0.2), inset 0 2px 12px rgba(255,255,255,0.9);
    }
    50% {
      border-radius: 52px 48px 53px 47px;
      box-shadow: 0 12px 38px rgba(59, 130, 246, 0.25), 0 0 65px rgba(16, 185, 129, 0.18), inset 0 3px 15px rgba(255,255,255,0.85);
    }
    75% {
      border-radius: 48px 52px 46px 54px;
      box-shadow: 0 9px 30px rgba(16, 185, 129, 0.22), 0 0 68px rgba(59, 130, 246, 0.2), inset 0 2px 11px rgba(255,255,255,0.9);
    }
  }

  @keyframes liquify-day {
    0%, 100% {
      border-radius: 24px;
      box-shadow: 0 8px 24px rgba(236, 72, 153, 0.2), 0 0 40px rgba(168, 85, 247, 0.1), inset 0 1px 8px rgba(255,255,255,0.6);
    }
    25% {
      border-radius: 20px 28px 24px 22px;
      box-shadow: 0 10px 28px rgba(168, 85, 247, 0.25), 0 0 50px rgba(236, 72, 153, 0.15), inset 0 1px 10px rgba(255,255,255,0.7);
    }
    50% {
      border-radius: 26px 22px 25px 21px;
      box-shadow: 0 12px 32px rgba(59, 130, 246, 0.2), 0 0 45px rgba(16, 185, 129, 0.12), inset 0 2px 12px rgba(255,255,255,0.65);
    }
    75% {
      border-radius: 22px 26px 20px 28px;
      box-shadow: 0 9px 26px rgba(16, 185, 129, 0.18), 0 0 48px rgba(59, 130, 246, 0.15), inset 0 1px 9px rgba(255,255,255,0.7);
    }
  }

  @keyframes liquify-week {
    0%, 100% {
      border-radius: 32px;
    }
    25% {
      border-radius: 28px 36px 32px 30px;
    }
    50% {
      border-radius: 34px 30px 33px 29px;
    }
    75% {
      border-radius: 30px 34px 28px 36px;
    }
  }

`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

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
  const { events, tasks, addTask, completeTask, syncGoogleCalendarEvents, getAllEvents } = useSchedule();
  const { openAddTaskModal, openTaskDetailsModal } = useModal();
  const { theme } = useThemeSettings();
  const { isCollapsed } = useSidebar();
  const {
    isAuthenticated,
    isLoading: googleLoading,
    error: googleError,
    checkAuthStatus,
    connectGoogleCalendar,
    fetchGoogleCalendarEvents,
    disconnectGoogleCalendar
  } = useGoogleCalendar();
  const [view, setView] = useState("Day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [input, setInput] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // Check Google Calendar auth status on mount
  useEffect(() => {
    checkAuthStatus();

    // Check if we just returned from Google OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_auth') === 'success') {
      setSyncMessage('Successfully connected to Google Calendar!');
      setTimeout(() => setSyncMessage(''), 3000);
      handleSyncGoogleCalendar();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (urlParams.get('google_auth') === 'error') {
      setSyncMessage('Failed to connect to Google Calendar');
      setTimeout(() => setSyncMessage(''), 3000);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Sync Google Calendar events
  const handleSyncGoogleCalendar = async () => {
    try {
      setSyncMessage('Syncing with Google Calendar...');

      // Fetch events for current month
      const startDate = startOfMonth(selectedDate);
      const endDate = endOfMonth(selectedDate);

      const googleEvents = await fetchGoogleCalendarEvents(startDate, endDate);
      syncGoogleCalendarEvents(googleEvents);

      setSyncMessage(`Synced ${googleEvents.length} events from Google Calendar!`);
      setTimeout(() => setSyncMessage(''), 3000);
    } catch (error) {
      console.error('Failed to sync:', error);
      setSyncMessage('Failed to sync with Google Calendar');
      setTimeout(() => setSyncMessage(''), 3000);
    }
  };

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

  // Handle AI-powered task creation
  const handleQuickAdd = async () => {
    if (!input.trim()) return;

    setIsProcessing(true);
    setShowAiPanel(true);
    setAiResponse(null);

    try {
      const response = await fetch('http://localhost:3000/api/assistant/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: input.trim(),
          userId: 1, // TODO: Replace with actual user ID from auth context
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request');
      }

      setAiResponse(data);
      
      // Add created tasks to local state
      if (data.tasks && data.tasks.length > 0) {
        data.tasks.forEach(task => {
          // Convert backend task format to frontend format
          const frontendTask = {
            name: task.name,
            description: task.description || '',
            date: task.date,
            startTime: task.startTime,
            endTime: task.endTime,
            priority: task.priority || 'medium',
            color: task.color || Object.keys(PASTEL_COLORS)[Math.floor(Math.random() * 6)],
            label: task.label || '',
          };
          addTask(frontendTask);
        });
      }
      
      setInput("");

      // Auto-hide AI panel after 5 seconds if successful
      if (data.tasksCreated > 0) {
        setTimeout(() => {
          setShowAiPanel(false);
        }, 5000);
      }
    } catch (error) {
      console.error('Error processing AI request:', error);
      setAiResponse({
        message: error.message || 'Failed to process your request. Please try again.',
        tasksCreated: 0,
        tasks: [],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Enter key in input
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !isProcessing) {
      handleQuickAdd();
    }
  };

  // Timeline for day view - use merged events
  const allEvents = getAllEvents();
  const timeline = getTimeline(allEvents, selectedDate);
  const todaysTasks = getTasksForDay(tasks, selectedDate);

  // Helper: parse "HH:mm" to Date object on selectedDate
  const renderWeekGrid = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const hours = Array.from({ length: TIME_END - TIME_START }, (_, i) => TIME_START + i);
    return (
      <div className="overflow-x-auto mt-4 flex-1">
        <div className="flex flex-row w-full h-full">
          {/* Time column */}
          <div className="flex flex-col pr-2" style={{width: 56, marginRight: 8, height: '100%', marginTop: 23}}>
            {hours.map(h => (
              <div key={h} className="flex items-center justify-end text-xs text-gray-500" style={{height: 40, minHeight: 40, paddingRight: 4}}>
                {format(setHours(new Date(), h), "h a")}
              </div>
            ))}
          </div>
          {/* Days columns */}
          <div className="flex-1 grid grid-cols-7 gap-2 h-full">
            {days.map((day, dayIdx) => {
              const dayEvents = getTimeline(allEvents, day);
              const dayTasks = getTasksForDay(tasks, day);
              return (
                <div key={dayIdx} className="relative border-l flex flex-col h-full rounded-3xl" style={{minWidth: 120, flex: 1, background: '#f3f4f6', border: '1px solid #e5e7eb', boxShadow: '0 0 30px rgba(168, 85, 247, 0.15), inset 0 0 20px rgba(255,255,255,0.3)', backdropFilter: 'blur(10px) saturate(150%)', animation: 'liquify-week 5s ease-in-out infinite'}}>
                  {/* Day header */}
                  <div className="sticky top-0 z-10 rounded-t-3xl p-2 text-center font-bold border-b flex items-center justify-center" style={{height: 40, color: '#A855F7', background: 'rgba(200,180,240,0.05)', borderBottomColor: '#e5e7eb', textShadow: '0 0 20px rgba(168, 85, 247, 0.6), 0 0 40px rgba(168, 85, 247, 0.3)'}}>{format(day, "EEE d")}</div>
                  {/* Timeline slots */}
                  <div className="relative h-full flex flex-col">
                    {hours.map(h => (
                      <div key={h} className="border-b" style={{height: 40, minHeight: 40}}></div>
                    ))}
                    {/* Events */}
                    {dayEvents.map((event, i) => {
                      const style = getEventStyle(event);
                      const isGoogleEvent = event.source === 'google-calendar';
                      return (
                        <div
                          key={i}
                          className="absolute left-2 right-2 rounded-xl p-2 flex flex-col justify-center border"
                          style={{
                            ...style,
                            minHeight: 24,
                            zIndex: 2,
                            overflow: 'visible',
                            background: isGoogleEvent ? '#fef2f2' : '#fff',
                            borderColor: isGoogleEvent ? '#fca5a5' : 'rgba(236, 72, 153, 0.4)'
                          }}
                        >
                          <div className={`font-semibold text-xs whitespace-normal break-words ${isGoogleEvent ? 'text-red-600' : 'text-pink-600'}`}>
                            {isGoogleEvent && '📅 '}{event.name}
                          </div>
                        </div>
                      );
                    })}
                    {/* Tasks */}
                    {dayTasks.map((task, i) => {
                      const style = getTaskStyle(task);
                      const taskColor = dayIdx % 3 === 0 ? '#F9A8D4' : dayIdx % 3 === 1 ? '#C4B5FD' : '#93C5FD';
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
                          <div className="font-semibold text-black text-xs truncate">{task.name}</div>
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

  const renderMonthGrid = () => {
    const start = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 });
    const days = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    const today = new Date();
    // 6 rows for full month, 7 columns for days
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 gap-2 mt-4 min-h-[calc(100vh-220px)]" style={{alignItems: 'stretch'}}>
          {days.map((d, i) => {
            const dayTasks = getTasksForDay(tasks, d);
            const dayEvents = getTimeline(allEvents, d);
            const isCurrentMonth = isSameMonth(d, selectedDate);
            const isToday = isSameDay(d, today);
            return (
              <div
                key={i}
                className="rounded-3xl p-4 transition-all flex flex-col justify-start"
                style={{
                  background: isCurrentMonth ? '#f3f4f6' : '#f9fafb',
                  border: isToday ? '2px solid #EF4444' : '1px solid #e5e7eb',
                  opacity: isCurrentMonth ? 1 : 0.5,
                  minHeight: 120,
                  boxShadow: isToday ? '0 0 20px rgba(239, 68, 68, 0.4), 0 0 40px rgba(239, 68, 68, 0.2)' : 'none',
                  transition: 'all 0.3s ease',
                  cursor: 'default',
                  animation: isCurrentMonth ? 'liquify-week 6s ease-in-out infinite' : 'none',
                  animationDelay: `${i * 0.1}s`
                }}
                onMouseEnter={(e) => {
                  if (isCurrentMonth && !isToday) {
                    e.currentTarget.style.boxShadow = '0 0 25px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.background = '#f0f9ff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isCurrentMonth && !isToday) {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.background = '#f3f4f6';
                  }
                }}
              >
                <div className="font-bold mb-2" style={{ color: isToday ? '#EF4444' : '#3B82F6', textShadow: isToday ? '0 0 15px rgba(239, 68, 68, 0.5), 0 0 30px rgba(239, 68, 68, 0.25)' : '0 0 15px rgba(59, 130, 246, 0.5), 0 0 30px rgba(59, 130, 246, 0.25)' }}>{format(d, "d")}</div>
                <div className="space-y-1 flex-1">
                  {dayEvents.slice(0, 1).map((e, j) => {
                    const isGoogleEvent = e.source === 'google-calendar';
                    return (
                      <div
                        key={j}
                        className="text-xs rounded px-2 py-1 truncate border"
                        style={{
                          background: isGoogleEvent ? '#fef2f2' : '#fff',
                          color: isGoogleEvent ? '#dc2626' : '#db2777',
                          borderColor: isGoogleEvent ? '#fca5a5' : 'rgba(236, 72, 153, 0.4)'
                        }}
                      >
                        {isGoogleEvent && '📅 '}{e.name}
                      </div>
                    );
                  })}
                  {dayTasks.slice(0, 2).map((task, j) => {
                    return (
                      <div
                        key={`task-${j}`}
                        className="text-xs rounded px-2 py-1 text-black truncate cursor-pointer hover:scale-105 transition-all"
                        style={{ backgroundColor: '#e5d4f3', border: '1px solid #d4b8e8' }}
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
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`} style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
        {/* Header and View Switcher */}
        <div className="flex flex-col md:flex-row justify-between items-center p-6 pb-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handlePrev} style={{ color: view === 'Week' ? '#A855F7' : view === 'Month' ? '#3B82F6' : '#EC4899', fontSize: '1.5rem', cursor: 'pointer' }}>
            &lt;
          </Button>
          <div className="text-2xl font-bold" style={{ color: '#EC4899' }}>
            {view === "Day" && format(selectedDate, "EEEE, MMM d, yyyy")}
            {view === "Week" && <span style={{textShadow: '0 0 20px rgba(168, 85, 247, 0.6), 0 0 40px rgba(168, 85, 247, 0.3)', color: '#A855F7'}}>{`Week of ${format(startOfWeek(selectedDate), "MMM d")}`}</span>}
            {view === "Month" && <span style={{textShadow: '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.3)', color: '#3B82F6'}}>{format(selectedDate, "MMMM yyyy")}</span>}
          </div>
          <Button variant="ghost" onClick={handleNext} style={{ color: view === 'Week' ? '#A855F7' : view === 'Month' ? '#3B82F6' : '#EC4899', fontSize: '1.5rem', cursor: 'pointer' }}>
            &gt;
          </Button>
          <Button
            onClick={openAddTaskModal}
            className="px-6 py-3 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition backdrop-blur-md border"
            style={{
              background: 'rgba(156, 163, 175, 0.15)',
              color: '#6B7280',
              borderColor: 'rgba(156, 163, 175, 0.3)',
              cursor: 'pointer'
            }}
          >
            + Add Task
          </Button>
          {isAuthenticated ? (
            <Button
              onClick={handleSyncGoogleCalendar}
              disabled={googleLoading}
              className="px-6 py-3 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition backdrop-blur-md border flex items-center gap-2"
              style={{
                background: 'rgba(234, 67, 53, 0.15)',
                color: '#EA4335',
                borderColor: 'rgba(234, 67, 53, 0.3)',
                cursor: googleLoading ? 'wait' : 'pointer'
              }}
            >
              <RefreshCw className={`h-4 w-4 ${googleLoading ? 'animate-spin' : ''}`} />
              Sync Google Calendar
            </Button>
          ) : (
            <Button
              onClick={connectGoogleCalendar}
              disabled={googleLoading}
              className="px-6 py-3 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition backdrop-blur-md border flex items-center gap-2"
              style={{
                background: 'rgba(234, 67, 53, 0.15)',
                color: '#EA4335',
                borderColor: 'rgba(234, 67, 53, 0.3)',
                cursor: 'pointer'
              }}
            >
              <CalendarIcon className="h-4 w-4" />
              Connect Google Calendar
            </Button>
          )}
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          {VIEW_OPTIONS.map((opt, idx) => {
            const colors = ['#EC4899', '#A855F7', '#3B82F6'];
            const isSelected = view === opt;
            return (
              <Button
                key={opt}
                style={{
                  background: isSelected ? colors[idx] : 'rgba(255,255,255,0.6)',
                  color: isSelected ? '#fff' : colors[idx],
                  borderRadius: 16,
                  fontWeight: 600,
                  border: `2px solid ${colors[idx]}`,
                  boxShadow: isSelected ? `0 4px 15px ${colors[idx]}40` : 'none',
                  cursor: 'pointer'
                }}
                onClick={() => setView(opt)}
              >
                {opt}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Sync Status Message */}
      {syncMessage && (
        <div className="px-6 mt-2">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg text-center">
            {syncMessage}
          </div>
        </div>
      )}

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
            <div className="text-xl font-bold mb-4" style={{ color: '#EC4899' }}>Timeline</div>
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
                  <div className="relative flex-1 min-h-0 flex flex-col rounded-2xl shadow-xl border" style={{ background: PRIMARY_LIGHT, border: `1px solid ${BORDER_COLOR}`, height: 960, animation: 'liquify-day 4s ease-in-out infinite' }}>
                    {/* Time slots */}
                    <div className="flex-1 flex flex-col justify-between" style={{height: 960}}>
                      {Array.from({ length: TIME_END - TIME_START }, (_, i) => (
                        <div key={i} className="border-b" style={{height: 40, minHeight: 40, borderColor: BORDER_COLOR, borderBottomWidth: 1, borderStyle: 'solid'}}></div>
                      ))}
                    </div>
                    {/* Events */}
                    {timeline.map((event, i) => {
                      const style = getEventStyle(event);
                      const isGoogleEvent = event.source === 'google-calendar';
                      return (
                        <div
                          key={i}
                          className="absolute left-2 right-2 bg-white rounded-xl p-4 flex flex-row items-center gap-2 border"
                          style={{
                            ...style,
                            minHeight: 24,
                            zIndex: 2,
                            boxShadow: 'none',
                            overflow: 'visible',
                            borderColor: isGoogleEvent ? '#EA4335' : '#c7d2fe',
                            background: isGoogleEvent ? '#fef2f2' : '#fff'
                          }}
                        >
                          {isGoogleEvent && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Google</span>
                          )}
                          <div className="font-semibold text-indigo-900 whitespace-nowrap">{event.name}</div>
                          <div className="text-xs text-gray-600 whitespace-normal break-words flex-1">{event.description}</div>
                        </div>
                      );
                    })}
                    {/* Tasks */}
                    {todaysTasks.map((task, i) => {
                      const style = getTaskStyle(task);
                      const taskColor = PASTEL_COLORS[task.color] || PASTEL_COLORS.blue;
                      const taskIndex = tasks.indexOf(task);
                      return (
                        <div
                          key={`task-${i}`}
                          className="absolute left-2 right-2 rounded-xl p-3 flex flex-row items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md group"
                          style={{
                            ...style,
                            minHeight: 24,
                            zIndex: 3,
                            backgroundColor: taskColor,
                            border: `2px solid ${taskColor}`,
                            overflow: 'visible',
                            opacity: task.completed ? 0 : 1,
                            filter: task.completed ? 'blur(4px)' : 'blur(0px)',
                            transform: task.completed ? 'scale(0.95)' : 'scale(1)',
                            transition: 'opacity 1.5s ease-out, transform 1.5s ease-out, filter 1.5s ease-out'
                          }}
                          onClick={(e) => {
                            if (!task.completed) {
                              // Check if click is on the complete button area (left side)
                              const isCompleteButton = e.target.closest('button');
                              if (!isCompleteButton) {
                                openTaskDetailsModal(task, taskIndex);
                              }
                            }
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 h-auto hover:bg-white/30 transition-all opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!task.completed) {
                                completeTask(taskIndex);
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                            disabled={task.completed}
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                          <div className={`font-semibold text-gray-800 whitespace-nowrap ${task.completed ? 'line-through' : ''}`} style={{ textDecorationThickness: '2px' }}>{task.name}</div>
                          {task.label && (
                            <span className={`text-xs bg-white/50 text-gray-700 rounded px-2 py-0.5 ${task.completed ? 'line-through' : ''}`}>
                              {task.label}
                            </span>
                          )}
                          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded ${
                            task.priority === 'high' ? 'bg-red-200 text-red-800' :
                            task.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                            'bg-green-200 text-green-800'
                          } ${task.completed ? 'line-through' : ''}`}>
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

      {/* Centered Glassmorphic Input Bar */}
      <div className="w-full flex justify-center items-center py-6" style={{ position: 'relative', zIndex: 20 }}>
        <div
          className="flex items-center w-full max-w-2xl px-6 py-4 gap-3 relative"
          style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '50px',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid transparent',
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.95), rgba(255,255,255,0.95)), linear-gradient(90deg, #EC4899, #A855F7, #3B82F6, #10B981, #EC4899)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            margin: '0 auto',
            position: 'relative',
            animation: 'liquify 3s ease-in-out infinite',
            boxShadow: '0 8px 32px rgba(236, 72, 153, 0.25), 0 0 60px rgba(168, 85, 247, 0.15)',
          }}
        >
          {showSuccess && (
            <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2">
              <span className="text-sm">✓</span>
              <span className="text-sm font-medium">Task created</span>
            </div>
          )}
          <Input
            className="flex-1 text-lg border-0 focus:ring-0 focus:outline-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Type task details (e.g. 'Meeting from 2pm to 4pm urgent' or 'Workout at 6am [fitness]')"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            style={{ color: '#1a1a1a', fontWeight: 500, boxShadow: 'none' }}
          />
          <Button variant="ghost" style={{ color: '#A855F7', borderRadius: 16, cursor: 'pointer' }}>
            <MicIcon size={24} />
          </Button>
          <Button
            onClick={handleQuickAdd}
            disabled={!input.trim()}
            style={{
              background: input.trim() ? '#3B82F6' : '#9CA3AF',
              color: '#fff',
              borderRadius: 16,
              fontWeight: 600,
              boxShadow: input.trim() ? '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.3)' : 'none',
              cursor: input.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            </Button>
            <Input
              className="flex-1 text-lg border-0 focus:ring-0 focus:outline-none bg-transparent"
              placeholder="Tell me what you need to do... (e.g. 'meeting from 2-4pm', 'study for exam at 6pm for 2 hours')"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={isProcessing}
              style={{ color: '#1a1a1a', fontWeight: 500 }}
            />
            <Button variant="ghost" style={{ color: '#A855F7', borderRadius: 16 }}>
              <MicIcon size={24} />
            </Button>
            <Button
              onClick={handleQuickAdd}
              disabled={!input.trim() || isProcessing}
              style={{
                background: input.trim() && !isProcessing ? '#EC4899' : '#9CA3AF',
                color: '#fff',
                borderRadius: 16,
                fontWeight: 600,
                boxShadow: input.trim() && !isProcessing ? '0 2px 8px 0 rgba(236,72,153,0.18)' : 'none',
                cursor: input.trim() && !isProcessing ? 'pointer' : 'not-allowed'
              }}
            >
              {isProcessing ? '...' : 'Add'}
            </Button>
          </div>
        </div>
      </div>

        {/* Modals */}
        <AddTaskModal />
        <TaskDetailsModal />
      </div>
  );
}