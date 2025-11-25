import React, { useState, useEffect } from "react";
import { useSchedule } from "../../context/ScheduleContext";
import { useModal } from "../../context/ModalContext";
import { useThemeSettings } from "../../context/ThemeContext";
import { useGoogleCalendar } from "../../hooks/useGoogleCalendar";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { motion } from "framer-motion";
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isSameWeek, isSameMonth, parseISO, setHours, setMinutes, getHours, getMinutes } from "date-fns";
import { CalendarIcon, MicIcon, CheckCircle2, RefreshCw } from "lucide-react";
import AddTaskModal from "../../components/AddTaskModal";
import TaskDetailsModal from "../../components/TaskDetailsModal";
import Sidebar, { useSidebar } from "../../components/Sidebar";
import { 
  PRIMARY_BG, PRIMARY_DARK, PRIMARY_LIGHT, BORDER_COLOR, 
  TIME_START, TIME_END, TIME_INTERVAL, VIEW_OPTIONS, 
  PASTEL_COLORS, CALENDAR_STYLES 
} from "./constants";
import {
  getEventStyle, getTaskStyle, getTimeline, getTasksForDay,
  getWeekEvents, getMonthEvents, getTasksAtPosition, parseTaskInput
} from "./utils";

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = CALENDAR_STYLES;
  document.head.appendChild(styleSheet);
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
  const [isProcessing, setIsProcessing] = useState(false);
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [aiResponse, setAiResponse] = useState(null);

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
              <div key={h} className="flex items-center justify-end text-xs text-slate-500" style={{height: 40, minHeight: 40, paddingRight: 4}}>
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
                <div key={dayIdx} className="relative border-l flex flex-col h-full rounded-3xl" style={{minWidth: 120, flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', backdropFilter: 'blur(10px) saturate(150%)', animation: 'liquify-week 5s ease-in-out infinite'}}>
                  {/* Day header */}
                  <div className="sticky top-0 z-10 rounded-t-3xl p-2 text-center font-bold border-b flex items-center justify-center" style={{height: 40, color: '#374151', background: '#f3f4f6', borderBottomColor: '#e5e7eb', textShadow: 'none'}}>{format(day, "EEE d")}</div>
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
                            background: isGoogleEvent ? '#fff5f5' : '#fff',
                            borderColor: isGoogleEvent ? '#fc8181' : '#adb5bd'
                          }}
                        >
                          <div className={`font-semibold text-xs whitespace-normal break-words ${isGoogleEvent ? 'text-red-600' : 'text-slate-700'}`}>
                            {isGoogleEvent && '📅 '}{event.name}
                          </div>
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
                            border: `1px solid #adb5bd`,
                            overflow: 'hidden'
                          }}
                          onClick={() => openTaskDetailsModal(task, tasks.indexOf(task))}
                        >
                          <div className="font-semibold text-slate-800 text-xs truncate">{task.name}</div>
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
                  background: isCurrentMonth ? '#f8f9fa' : '#e9ecef',
                  border: isToday ? '2px solid #6c757d' : '1px solid #dee2e6',
                  opacity: isCurrentMonth ? 1 : 0.5,
                  minHeight: 120,
                  boxShadow: isToday ? '0 4px 12px rgba(108, 117, 125, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.3s ease',
                  cursor: 'default',
                  animation: isCurrentMonth ? 'liquify-week 6s ease-in-out infinite' : 'none',
                  animationDelay: `${i * 0.1}s`
                }}
                onMouseEnter={(e) => {
                  if (isCurrentMonth && !isToday) {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                    e.currentTarget.style.background = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isCurrentMonth && !isToday) {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.background = '#f8f9fa';
                  }
                }}
              >
                <div className="font-bold mb-2" style={{
                  color: isToday ? '#3B82F6' : '#495057',
                  textShadow: isToday ? '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.4)' : 'none'
                }}>{format(d, "d")}</div>
                <div className="space-y-1 flex-1">
                  {dayEvents.slice(0, 1).map((e, j) => {
                    const isGoogleEvent = e.source === 'google-calendar';
                    return (
                      <div
                        key={j}
                        className="text-xs rounded px-2 py-1 truncate border"
                        style={{
                          background: isGoogleEvent ? '#fff5f5' : '#fff',
                          color: isGoogleEvent ? '#dc2626' : '#495057',
                          borderColor: isGoogleEvent ? '#fc8181' : '#adb5bd'
                        }}
                      >
                        {isGoogleEvent && '📅 '}{e.name}
                      </div>
                    );
                  })}
                  {dayTasks.slice(0, 2).map((task, j) => {
                    const taskColor = PASTEL_COLORS[task.color] || PASTEL_COLORS.blue;
                    return (
                      <div
                        key={`task-${j}`}
                        className="text-xs rounded px-2 py-1 text-slate-800 truncate cursor-pointer hover:scale-105 transition-all"
                        style={{ backgroundColor: taskColor, border: '1px solid #adb5bd' }}
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
                    <div className="text-xs text-slate-500 italic">
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
        <div className="flex justify-between items-center p-6 pb-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handlePrev} style={{ color: '#495057', fontSize: '1.25rem', cursor: 'pointer', padding: '4px 8px' }}>
              &lt;
            </Button>
            <div className="text-xl font-semibold" style={{ color: '#1f2937', minWidth: '200px' }}>
              {view === "Day" && format(selectedDate, "MMMM yyyy")}
              {view === "Week" && format(selectedDate, "MMMM yyyy")}
              {view === "Month" && format(selectedDate, "MMMM yyyy")}
            </div>
            <Button variant="ghost" onClick={handleNext} style={{ color: '#495057', fontSize: '1.25rem', cursor: 'pointer', padding: '4px 8px' }}>
              &gt;
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-0 bg-white rounded-lg border border-slate-200" style={{ padding: '2px' }}>
              {VIEW_OPTIONS.map((opt, idx) => {
                const isSelected = view === opt;
                return (
                  <Button
                    key={opt}
                    style={{
                      background: isSelected ? '#3B82F6' : 'transparent',
                      color: isSelected ? '#fff' : '#6b7280',
                      borderRadius: '6px',
                      fontWeight: 500,
                      border: 'none',
                      padding: '6px 16px',
                      fontSize: '14px',
                      boxShadow: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setView(opt)}
                  >
                    {opt}
                  </Button>
                );
              })}
            </div>

            <Button
              onClick={openAddTaskModal}
              className="font-medium border"
              style={{
                background: 'white',
                color: '#374151',
                borderColor: '#d1d5db',
                cursor: 'pointer',
                padding: '6px 16px',
                fontSize: '14px',
                borderRadius: '8px'
              }}
            >
              + Add Task
            </Button>

            {isAuthenticated ? (
              <Button
                onClick={handleSyncGoogleCalendar}
                disabled={googleLoading}
                className="font-medium border flex items-center gap-2"
                style={{
                  background: 'white',
                  color: '#374151',
                  borderColor: '#d1d5db',
                  cursor: googleLoading ? 'wait' : 'pointer',
                  padding: '6px 16px',
                  fontSize: '14px',
                  borderRadius: '8px'
                }}
              >
                <RefreshCw className={`h-4 w-4 ${googleLoading ? 'animate-spin' : ''}`} />
                Sync Google Calendar
              </Button>
            ) : (
              <Button
                onClick={connectGoogleCalendar}
                disabled={googleLoading}
                className="font-medium border flex items-center gap-2"
                style={{
                  background: 'white',
                  color: '#374151',
                  borderColor: '#d1d5db',
                  cursor: 'pointer',
                  padding: '6px 16px',
                  fontSize: '14px',
                  borderRadius: '8px'
                }}
              >
                <CalendarIcon className="h-4 w-4" />
                Connect Google Calendar
              </Button>
            )}
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
            <div className="text-xl font-bold mb-4" style={{ color: '#374151' }}>Timeline</div>
            <div className="flex-1 min-h-0 flex flex-col h-full" style={{ position: 'relative', minHeight: 0, height: 'calc(100vh - 220px)' }}>
              <div className="flex-1 min-h-0 flex flex-col h-full" style={{height: '100%'}}>
                <div className="flex flex-1 h-full min-h-0 overflow-y-auto" style={{height: '100%'}}>
                  {/* Time labels outside white area */}
                  <div className="flex flex-col pr-2 flex-shrink-0" style={{width: 60, marginRight: 12, marginTop: -16}}>
                    {Array.from({ length: TIME_END - TIME_START }, (_, i) => TIME_START + i).map(h => (
                      <div key={h} className="flex items-center justify-end text-xs text-slate-500" style={{height: 80, minHeight: 80, paddingRight: 8}}>
                        {format(setHours(new Date(), h), "h a")}
                      </div>
                    ))}
                  </div>
                  {/* Timeline slots and events inside white area */}
                  <div className="relative flex-1 min-h-0 flex flex-col rounded-2xl shadow-xl border" style={{ background: PRIMARY_LIGHT, border: `1px solid ${BORDER_COLOR}`, minHeight: 'calc(100vh - 240px)', animation: 'liquify-day 4s ease-in-out infinite' }}>
                    {/* Time slots */}
                    <div className="flex-1 flex flex-col justify-between">
                      {Array.from({ length: TIME_END - TIME_START }, (_, i) => (
                        <div key={i} className="border-b" style={{height: 80, minHeight: 80, borderColor: BORDER_COLOR, borderBottomWidth: 1, borderStyle: 'solid'}}></div>
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
                            borderColor: isGoogleEvent ? '#fc8181' : '#adb5bd',
                            background: isGoogleEvent ? '#fff5f5' : '#fff'
                          }}
                        >
                          {isGoogleEvent && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Google</span>
                          )}
                          <div className="font-semibold text-slate-800 whitespace-nowrap">{event.name}</div>
                          <div className="text-xs text-slate-600 whitespace-normal break-words flex-1">{event.description}</div>
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
                          <div className={`font-semibold text-slate-800 whitespace-nowrap ${task.completed ? 'line-through' : ''}`} style={{ textDecorationThickness: '2px' }}>{task.name}</div>
                          {task.label && (
                            <span className={`text-xs bg-white/50 text-slate-700 rounded px-2 py-0.5 ${task.completed ? 'line-through' : ''}`}>
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
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.95), rgba(255,255,255,0.95)), linear-gradient(90deg, #6c757d, #495057, #6c757d)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            margin: '0 auto',
            position: 'relative',
            animation: 'liquify 3s ease-in-out infinite',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 0 60px rgba(0, 0, 0, 0.05)',
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
          <Button variant="ghost" style={{ color: '#6c757d', borderRadius: 16, cursor: 'pointer' }}>
            <MicIcon size={24} />
          </Button>
          <Button
            onClick={handleQuickAdd}
            disabled={!input.trim()}
            style={{
              background: input.trim() ? '#6c757d' : '#adb5bd',
              color: '#fff',
              borderRadius: 16,
              fontWeight: 600,
              boxShadow: input.trim() ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none',
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