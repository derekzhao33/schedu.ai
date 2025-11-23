import React from 'react';
import { motion } from 'framer-motion';
import { useModal } from '../context/ModalContext';
import { useThemeSettings } from '../context/ThemeContext';
import AddTaskModal from '../components/AddTaskModal';
import TaskDetailsModal from '../components/TaskDetailsModal';
import Sidebar from '../components/Sidebar';

export default function DashboardPreview() {
  const { openAddTaskModal } = useModal();
  const { theme } = useThemeSettings();

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

  return (
    <div className={`flex min-h-screen bg-background ${theme === 'dark' ? 'dark' : ''}`}>
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 p-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <button
            className="px-6 py-3 bg-pink-500/20 text-pink-700 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition backdrop-blur-md border border-pink-500/30"
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
          <div className="p-6 rounded-3xl shadow hover:scale-105 transition cursor-pointer bg-white/70 backdrop-blur-sm border-l-2 border-l-pink-500 shadow-pink-500/30">
            <h2 className="font-semibold text-pink-400">Today</h2>
            <p className={`text-4xl font-bold mt-2 text-pink-600 ${todaysTasks.length > 0 ? 'drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : ''}`}>
              {todaysTasks.length}
            </p>
            <p className="text-sm text-pink-300">Tasks Remaining</p>
          </div>
          <div className="p-6 rounded-3xl shadow hover:scale-105 transition cursor-pointer bg-white/70 backdrop-blur-sm border-l-2 border-l-purple-500 shadow-purple-500/30">
            <h2 className="font-semibold text-purple-400">This Week</h2>
            <p className={`text-4xl font-bold mt-2 text-purple-600 ${weekTasks.length > 3 ? 'drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]' : weekTasks.length > 0 ? 'drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]' : ''}`}>
              {weekTasks.length}
            </p>
            <p className="text-sm text-purple-300">Total Tasks</p>
          </div>
          <div className="p-6 rounded-3xl shadow hover:scale-105 transition cursor-pointer bg-white/70 backdrop-blur-sm border-l-2 border-l-blue-500 shadow-blue-500/30">
            <h2 className="font-semibold text-blue-400">This Month</h2>
            <p className={`text-4xl font-bold mt-2 text-blue-600 ${monthTasks.length > 5 ? 'drop-shadow-[0_0_16px_rgba(59,130,246,0.7)]' : monthTasks.length > 3 ? 'drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]' : monthTasks.length > 0 ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]' : ''}`}>
              {monthTasks.length}
            </p>
            <p className="text-sm text-blue-300">Planned Tasks</p>
          </div>
        </motion.section>

        {/* Upcoming Deadlines */}
        <section className="p-8 rounded-3xl shadow-xl hover:scale-105 transition bg-pink-50/60 backdrop-blur-md border border-pink-200/40">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Upcoming Deadlines</h2>
          <div className="space-y-3">
            {upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((task, index) => {
                const borderColors = [
                  'border-l-pink-500',
                  'border-l-purple-500',
                  'border-l-blue-500',
                  'border-l-indigo-500',
                  'border-l-cyan-500'
                ];
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-xl flex justify-between items-center bg-white/60 backdrop-blur-sm border-l-4 ${borderColors[index % borderColors.length]} hover:shadow-lg transition`}
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {task.name || 'Untitled Task'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {task.description || 'No description'}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {new Date(task.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                      {task.priority && (
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold backdrop-blur-md ${
                          task.priority === 'high' ? 'bg-red-500/20 text-red-700 border border-red-500/30 shadow-lg shadow-red-500/20' :
                          task.priority === 'medium' ? 'bg-amber-500/20 text-amber-700 border border-amber-500/30 shadow-lg shadow-amber-500/20' :
                          'bg-green-500/20 text-green-700 border border-green-500/30 shadow-lg shadow-green-500/20'
                        }`}>
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No upcoming deadlines</p>
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