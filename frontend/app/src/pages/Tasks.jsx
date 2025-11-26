import React from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useModal } from '../context/ModalContext';
import { useThemeSettings } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import AddTaskModal from '../components/AddTaskModal';
import TaskDetailsModal from '../components/TaskDetailsModal';
import Sidebar, { useSidebar } from '../components/Sidebar';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';

const PRIMARY_BG = "#F7F8FC";
const PRIMARY_DARK = "#355C7D";
const PRIMARY_LIGHT = "#FFFFFF";

const PASTEL_COLORS = {
  red: "#FFB3BA",
  blue: "#BAE1FF",
  yellow: "#FFFFBA",
  orange: "#FFDFBA",
  green: "#BAFFC9",
  purple: "#E0BBE4",
};

export default function Tasks() {
  const { tasks } = useSchedule();
  const { openAddTaskModal, openTaskDetailsModal } = useModal();
  const { theme } = useThemeSettings();
  const { isCollapsed } = useSidebar();

  return (
    <div className={`flex min-h-screen ${theme === 'dark' ? 'dark' : ''}`} style={{ background: PRIMARY_BG }}>
      <Sidebar />
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center p-6">
        <h1 className="text-3xl font-bold" style={{ color: PRIMARY_DARK }}>
          Tasks
        </h1>
        <Button
          onClick={openAddTaskModal}
          style={{
            background: PRIMARY_DARK,
            color: PRIMARY_BG,
            borderRadius: 16,
            fontWeight: 600,
          }}
        >
          + Add Task
        </Button>
      </div>

      {/* Tasks List */}
      <motion.div
        className="px-6 flex-1"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="grid gap-4 pb-8">
          {tasks.length === 0 ? (
            <div
              className="text-center py-12 rounded-3xl"
              style={{ background: PRIMARY_LIGHT }}
            >
              <p className="text-gray-400 text-lg">No tasks yet. Create your first task!</p>
            </div>
          ) : (
            tasks.map((task, index) => {
              const taskColor = PASTEL_COLORS[task.color] || PASTEL_COLORS.blue;
              return (
                <div
                  key={index}
                  className="p-6 rounded-3xl shadow-lg cursor-pointer hover:scale-[1.01] transition-all duration-700 ease-out"
                  style={{
                    backgroundColor: taskColor,
                    border: `2px solid ${taskColor}`,
                    opacity: task.completed ? 0 : 1,
                    transform: task.completed ? 'scale(0.95)' : 'scale(1)',
                    transition: 'opacity 1s ease-out, transform 1s ease-out'
                  }}
                  onClick={() => !task.completed && openTaskDetailsModal(task, index)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold text-gray-800 mb-2 ${task.completed ? 'line-through' : ''}`} style={{ textDecorationThickness: '2px' }}>
                        {task.name}
                      </h3>
                      {task.label && (
                        <span className="inline-block text-sm bg-white/50 text-gray-700 rounded px-3 py-1 mb-2">
                          {task.label}
                        </span>
                      )}
                      <div className="flex gap-4 mt-2 text-sm text-gray-700">
                        {task.startTime && task.endTime && (
                          <div>
                            <span className="font-medium">Time:</span> {task.startTime} - {task.endTime}
                          </div>
                        )}
                        {task.date && (
                          <div>
                            <span className="font-medium">Date:</span>{' '}
                            {format(parseISO(task.date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`text-sm font-medium px-3 py-1 rounded-full ${
                          task.priority === 'high'
                            ? 'bg-red-200 text-red-800'
                            : task.priority === 'medium'
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'bg-green-200 text-green-800'
                        }`}
                      >
                        {task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>

        {/* Modals */}
        <AddTaskModal />
        <TaskDetailsModal />
      </div>
    </div>
  );
}
