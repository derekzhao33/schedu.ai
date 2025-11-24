import { createContext, useContext, useState } from "react";

const ScheduleContext = createContext();

export function ScheduleProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);


  const addTask = (task) => {
    if (!task || !task.name) {
      throw new Error("Task must have a name");
    }
    setTasks((prev) => [...prev, task]);
  };

  const updateTask = (index, updatedTask) => {
    if (index < 0 || index >= tasks.length) {
      throw new Error("Invalid task index");
    }
    setTasks((prev) => prev.map((task, i) => (i === index ? updatedTask : task)));
  };

  const deleteTask = (index) => {
    if (index < 0 || index >= tasks.length) {
      throw new Error("Invalid task index");
    }
    setTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const completeTask = (index) => {
    if (index < 0 || index >= tasks.length) {
      throw new Error("Invalid task index");
    }
    // Mark task as completed with strikethrough
    setTasks((prev) => prev.map((task, i) =>
      i === index ? { ...task, completed: true } : task
    ));
    // Fade out and remove after animation
    setTimeout(() => {
      setTasks((prev) => prev.filter((_, i) => i !== index));
    }, 1500); // Give time for strikethrough animation
  };

  const addEvent = (event) => {
    if (!event || !event.name) {
      throw new Error("Event must have a name");
    }
    setEvents((prev) => [...prev, event]);
  };

  const updateEvent = (index, updatedEvent) => {
    if (index < 0 || index >= events.length) {
      throw new Error("Invalid event index");
    }
    setEvents((prev) => prev.map((event, i) => (i === index ? updatedEvent : event)));
  };

  const deleteEvent = (index) => {
    if (index < 0 || index >= events.length) {
      throw new Error("Invalid event index");
    }
    setEvents((prev) => prev.filter((_, i) => i !== index));
  };

  const syncGoogleCalendarEvents = (googleEvents) => {
    setGoogleCalendarEvents(googleEvents);
  };

  // Merge local events and Google Calendar events
  const getAllEvents = () => {
    return [...events, ...googleCalendarEvents];
  };

  return (
    <ScheduleContext.Provider
      value={{
        tasks,
        setTasks,
        events,
        setEvents,
        googleCalendarEvents,
        addTask,
        updateTask,
        deleteTask,
        completeTask,
        addEvent,
        updateEvent,
        deleteEvent,
        syncGoogleCalendarEvents,
        getAllEvents
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error("useSchedule must be used within a ScheduleProvider");
  }
  return context;
}
