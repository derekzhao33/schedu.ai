import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

const API_BASE_URL = 'https://schedu-ai-zocp.onrender.com/api';

const ScheduleContext = createContext();

export function ScheduleProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);

  // Fetch tasks from the database when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchTasks();
    }
  }, [isAuthenticated, user]);

  const fetchTasks = async () => {
    try {
      console.log('Fetching tasks for user:', user.id);
      const response = await fetch(`${API_BASE_URL}/tasks?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched tasks from backend:', data);
        // The API returns { tasks: [...] }, not just [...]
        const taskList = data.tasks || data;
        console.log('Task list:', taskList.length, 'tasks');
        // Transform backend format to frontend format
        const transformedTasks = taskList.map(task => transformTaskFromBackend(task));
        console.log('Transformed tasks:', transformedTasks);
        setTasks(transformedTasks);
      } else {
        console.error('Failed to fetch tasks, status:', response.status);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  // Helper function to transform backend task format to frontend format
  const transformTaskFromBackend = (backendTask) => {
    const startDate = new Date(backendTask.start_time);
    const endDate = new Date(backendTask.end_time);
    
    // Get date in local timezone, not UTC
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const localDate = `${year}-${month}-${day}`;
    
    return {
      id: backendTask.id,
      name: backendTask.name,
      label: backendTask.description,
      date: localDate, // YYYY-MM-DD in local timezone
      startTime: startDate.toTimeString().slice(0, 5), // HH:mm
      endTime: endDate.toTimeString().slice(0, 5), // HH:mm
      priority: backendTask.priority || 'medium',
      color: backendTask.color || 'blue',
      user_id: backendTask.user_id
    };
  };

  const addTask = async (task) => {
    if (!task?.name || !user) {
      throw new Error("Task must have a name and user must be logged in");
    }

    const taskDate = task.date || new Date().toISOString().split('T')[0];
    const startDateTime = new Date(`${taskDate}T${task.startTime}:00`);
    const endDateTime = new Date(`${taskDate}T${task.endTime}:00`);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      throw new Error("Invalid date or time format");
    }

    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        name: task.name,
        description: task.label || null,
        priority: task.priority || "medium",
        color: task.color || null,
        user_id: user.id
      }),
    });

    if (!response.ok) throw new Error('Failed to create task');

    const createdTask = await response.json();
    const transformedTask = transformTaskFromBackend(createdTask);
    setTasks((prev) => [...prev, transformedTask]);
    return transformedTask;
  };

  const updateTask = async (index, updatedTask) => {
    if (index < 0 || index >= tasks.length) throw new Error("Invalid task index");

    const task = tasks[index];
    if (!task.id) {
      setTasks((prev) => prev.map((t, i) => (i === index ? updatedTask : t)));
      return;
    }

    const response = await fetch(`${API_BASE_URL}/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTask),
    });

    if (!response.ok) throw new Error('Failed to update task');

    const updated = await response.json();
    setTasks((prev) => prev.map((t, i) => (i === index ? updated : t)));
  };

  const deleteTask = async (index) => {
    if (index < 0 || index >= tasks.length) throw new Error("Invalid task index");

    const task = tasks[index];
    
    // Remove from local state first for immediate UI feedback
    setTasks((prev) => prev.filter((_, i) => i !== index));

    // Then delete from backend if it has an ID
    if (task.id) {
      try {
        const response = await fetch(`${API_BASE_URL}/tasks/${task.id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          console.error('Failed to delete task from backend:', task.id);
          // Re-fetch tasks to sync with backend
          fetchTasks();
        }
      } catch (error) {
        console.error('Error deleting task:', error);
        // Re-fetch tasks to sync with backend
        fetchTasks();
      }
    }
  };

  const completeTask = async (index) => {
    if (index < 0 || index >= tasks.length) throw new Error("Invalid task index");
    
    setTasks((prev) => prev.map((task, i) =>
      i === index ? { ...task, completed: true } : task
    ));
    setTimeout(() => deleteTask(index), 1500);
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
    return [...tasks, ...events, ...googleCalendarEvents];
  };

  return (
    <ScheduleContext.Provider
      value={{
        tasks,
        setTasks,
        events,
        setEvents,
        googleCalendarEvents,
        fetchTasks,
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
