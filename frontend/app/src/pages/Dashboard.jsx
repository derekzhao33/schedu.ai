import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useModal } from '../context/ModalContext';
import AddTaskModal from '../components/AddTaskModal';
import TaskDetailsModal from '../components/TaskDetailsModal';

export default function DashboardPreview() {
  const { openAddTaskModal } = useModal();

  // Mock data for preview
  const mockTasks = [
    { name: 'Complete project proposal', description: 'Finalize slides and submit', date: '2025-11-23', priority: 'high' },
    { name: 'Team meeting preparation', description: 'Prepare agenda and notes', date: '2025-11-24', priority: 'medium' },
    { name: 'Code review', description: 'Review pull requests', date: '2025-11-25', priority: 'medium' },
    { name: 'Client presentation', description: 'Present Q4 results', date: '2025-11-26', priority: 'high' },
    { name: 'Update documentation', description: 'API documentation updates', date: '2025-11-28', priority: 'low' },
  ];

  const today = '2025-11-22';
  const todaysTasks = mockTasks.filter(t => t.date === today);
  const upcomingDeadlines = mockTasks.slice(0, 5);
  const weekTasks = mockTasks.filter(t => t.date >= today && t.date <= '2025-11-29');
  const monthTasks = mockTasks;

  const NavLink = ({ to, children }) => (
    <div className="text-gray-300 hover:text-white transition cursor-pointer">
      {children}
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#E0E7FF' }}>
      {/* Sidebar */}
      <aside className="w-64 p-6 shadow-xl rounded-r-3xl hidden md:block" style={{ backgroundColor: '#181D27' }}>
        <h2 className="text-xl font-bold mb-6 text-white">FlowScheduler</h2>
        <ul className="space-y-4">
          <li><NavLink to="/">Dashboard</NavLink></li>
          <li><NavLink to="/calendar">Calendar</NavLink></li>
          <li><NavLink to="/tasks">Tasks</NavLink></li>
          <li><NavLink to="/assistant">Assistant</NavLink></li>
          <li><NavLink to="/stats">Stats</NavLink></li>
        </ul>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold" style={{ color: '#181D27' }}>Dashboard</h1>
          <button
            className="px-4 py-2 text-white rounded-xl shadow hover:opacity-90 transition"
            style={{ backgroundColor: '#181D27' }}
            onClick={openAddTaskModal}
          >
            + Add Task
          </button>
        </div>

        {/* Stats Cards */}
        <motion.section 
          className="grid grid-cols-1 sm:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="p-6 rounded-3xl shadow-lg hover:scale-105 transition cursor-pointer"
            style={{ backgroundColor: '#181D27' }}
          >
            <h2 className="font-semibold text-gray-300">Today</h2>
            <p className="text-4xl font-bold mt-2 text-white">{todaysTasks.length}</p>
            <p className="text-sm text-gray-400">Tasks Remaining</p>
          </div>
          <div
            className="p-6 rounded-3xl shadow-lg hover:scale-105 transition cursor-pointer"
            style={{ backgroundColor: '#181D27' }}
          >
            <h2 className="font-semibold text-gray-300">This Week</h2>
            <p className="text-4xl font-bold mt-2 text-white">{weekTasks.length}</p>
            <p className="text-sm text-gray-400">Total Tasks</p>
          </div>
          <div
            className="p-6 rounded-3xl shadow-lg hover:scale-105 transition cursor-pointer"
            style={{ backgroundColor: '#181D27' }}
          >
            <h2 className="font-semibold text-gray-300">This Month</h2>
            <p className="text-4xl font-bold mt-2 text-white">{monthTasks.length}</p>
            <p className="text-sm text-gray-400">Planned Tasks</p>
          </div>
        </motion.section>

        {/* Upcoming Deadlines */}
        <section
          className="p-8 rounded-3xl shadow-xl cursor-pointer hover:scale-105 transition"
          style={{ backgroundColor: '#181D27' }}
        >
          <h2 className="text-2xl font-bold mb-4 text-white">Upcoming Deadlines</h2>
          <div className="space-y-3">
            {upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((task, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl flex justify-between items-center"
                  style={{ backgroundColor: '#E0E7FF' }}
                >
                  <div>
                    <p className="font-semibold" style={{ color: '#181D27' }}>
                      {task.name || 'Untitled Task'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {task.description || 'No description'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium" style={{ color: '#181D27' }}>
                      {new Date(task.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    {task.priority && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        task.priority === 'high' ? 'bg-red-100 text-red-700' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">No upcoming deadlines</p>
              </div>
            )}
          </div>
        </section>


      </main>

      {/* Modals */}
      <AddTaskModal />
      <TaskDetailsModal />
    </div>
  );
}