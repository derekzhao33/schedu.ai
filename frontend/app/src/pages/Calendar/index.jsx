import React, { useState, useEffect, useRef } from "react";
import { useSchedule } from "../../context/ScheduleContext";
import { useModal } from "../../context/ModalContext";
import { useThemeSettings } from "../../context/ThemeContext";
import { useGoogleCalendar } from "../../hooks/useGoogleCalendar";
import { Button } from "../../components/ui/button";
import { motion } from "framer-motion";
import { format, addDays, subDays, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, RefreshCw } from "lucide-react";
import AddTaskModal from "../../components/AddTaskModal";
import TaskDetailsModal from "../../components/TaskDetailsModal";
import Sidebar, { useSidebar } from "../../components/Sidebar";
import DayView from "./components/DayView";
import WeekView from "./components/WeekView";
import MonthView from "./components/MonthView";
import AIChat from "./components/AIChat";
import { PRIMARY_BG, VIEW_OPTIONS, CALENDAR_STYLES } from "./constants";

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = CALENDAR_STYLES;
  document.head.appendChild(styleSheet);
}

export default function Calendar() {
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
  const [aiMessages, setAiMessages] = useState([]);
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Check Google Calendar auth status on mount
  useEffect(() => {
    checkAuthStatus();

    // Check if we just returned from Google OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_auth') === 'success') {
      setSyncMessage('Successfully connected to Google Calendar!');
      setTimeout(() => setSyncMessage(''), 3000);
      handleSyncGoogleCalendar();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (urlParams.get('google_auth') === 'error') {
      setSyncMessage('Failed to connect to Google Calendar');
      setTimeout(() => setSyncMessage(''), 3000);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Sync Google Calendar events
  const handleSyncGoogleCalendar = async () => {
    try {
      setSyncMessage('Syncing with Google Calendar...');
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

  // Handle AI chat message
  const handleQuickAdd = async () => {
    if (!input.trim()) return;

    const userInput = input;
    setInput("");

    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      type: "user",
      content: userInput,
      timestamp: new Date().toISOString(),
    };
    setAiMessages((prev) => [...prev, userMessage]);

    setIsProcessing(true);
    setIsAiTyping(true);

    try {
      const response = await fetch('http://localhost:3001/api/assistant/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: userInput,
          userId: 1,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request');
      }

      // Add AI response to chat
      const aiMessage = {
        id: Date.now() + 1,
        type: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
        tasks: data.tasks || [],
        conflicts: data.conflicts,
        suggestedAlternatives: data.suggestedAlternatives,
        tasksCreated: data.tasksCreated || 0,
      };
      setAiMessages((prev) => [...prev, aiMessage]);

      // Add created tasks to calendar
      if (data.tasks && data.tasks.length > 0) {
        data.tasks.forEach(task => {
          const frontendTask = {
            name: task.name,
            description: task.description || '',
            date: task.date,
            startTime: task.startTime,
            endTime: task.endTime,
            priority: task.priority || 'medium',
            color: task.colour || 'blue',
            label: task.label || '',
          };
          addTask(frontendTask);
        });

        // Show success notification
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error processing AI request:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: "assistant",
        content: error.message || 'Failed to process your request. Please try again.',
        timestamp: new Date().toISOString(),
        tasksCreated: 0,
      };
      setAiMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      setIsAiTyping(false);
    }
  };

  // Handle Enter key in input
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !isProcessing) {
      handleQuickAdd();
    }
  };

  const allEvents = getAllEvents();

  return (
    <div className={`flex min-h-screen ${theme === 'dark' ? 'dark' : ''}`} style={{ background: PRIMARY_BG }}>
      <Sidebar />
      <div className={`flex transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`} style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden', width: '100%' }}>

        {/* Left Side: Calendar */}
        <div className="flex-1 flex flex-col" style={{ maxWidth: 'calc(100% - 360px)' }}>
          {/* Header and View Switcher */}
          <div className="flex justify-between items-center p-6 pb-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={handlePrev} style={{ color: '#495057', fontSize: '1.25rem', cursor: 'pointer', padding: '4px 8px' }}>
                &lt;
              </Button>
              <div className="text-xl font-semibold" style={{ color: '#1f2937', minWidth: '200px' }}>
                {format(selectedDate, "MMMM yyyy")}
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
              <DayView
                selectedDate={selectedDate}
                allEvents={allEvents}
                tasks={tasks}
                completeTask={completeTask}
                openTaskDetailsModal={openTaskDetailsModal}
              />
            )}
            {view === "Week" && (
              <WeekView
                selectedDate={selectedDate}
                allEvents={allEvents}
                tasks={tasks}
                openTaskDetailsModal={openTaskDetailsModal}
              />
            )}
            {view === "Month" && (
              <MonthView
                selectedDate={selectedDate}
                allEvents={allEvents}
                tasks={tasks}
                openTaskDetailsModal={openTaskDetailsModal}
              />
            )}
          </motion.div>

          {/* Modals */}
          <AddTaskModal />
          <TaskDetailsModal />
        </div>

        {/* Right Side: AI Chat Panel */}
        <AIChat
          input={input}
          setInput={setInput}
          aiMessages={aiMessages}
          isAiTyping={isAiTyping}
          isProcessing={isProcessing}
          showSuccess={showSuccess}
          handleQuickAdd={handleQuickAdd}
          handleInputKeyDown={handleInputKeyDown}
        />
      </div>
    </div>
  );
}
