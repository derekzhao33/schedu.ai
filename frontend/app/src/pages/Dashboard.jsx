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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#355C7D] to-[#725A7A] bg-clip-text text-transparent">Dashboard</h1>
          <button
            className="px-6 py-3 bg-gradient-to-r from-[#FF7582] to-[#C56C86] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition"
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
          <div className="p-6 rounded-3xl shadow-lg hover:scale-105 transition cursor-pointer bg-gradient-to-br from-[#FF9CA5] to-[#FF7582]">
            <h2 className="font-semibold text-white/90">Today</h2>
            <p className="text-4xl font-bold mt-2 text-white">{todaysTasks.length}</p>
            <p className="text-sm text-white/80">Tasks Remaining</p>
          </div>
          <div className="p-6 rounded-3xl shadow-lg hover:scale-105 transition cursor-pointer bg-gradient-to-br from-[#725A7A] to-[#C56C86]">
            <h2 className="font-semibold text-white/90">This Week</h2>
            <p className="text-4xl font-bold mt-2 text-white">{weekTasks.length}</p>
            <p className="text-sm text-white/80">Total Tasks</p>
          </div>
          <div className="p-6 rounded-3xl shadow-lg hover:scale-105 transition cursor-pointer bg-gradient-to-br from-[#355C7D] to-[#6D8FA8]">
            <h2 className="font-semibold text-white/90">This Month</h2>
            <p className="text-4xl font-bold mt-2 text-white">{monthTasks.length}</p>
            <p className="text-sm text-white/80">Planned Tasks</p>
          </div>
        </motion.section>

        {/* Upcoming Deadlines */}
        <section className="p-8 rounded-3xl shadow-xl cursor-pointer hover:scale-105 transition bg-gradient-to-br from-[#C56C86]/10 to-[#FF9CA5]/10 border-2 border-[#C56C86]/20">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Upcoming Deadlines</h2>
          <div className="space-y-3">
            {upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((task, index) => {
                const colors = [
                  'bg-gradient-to-r from-[#FF7582] to-[#FF9CA5]',
                  'bg-gradient-to-r from-[#725A7A] to-[#C56C86]',
                  'bg-gradient-to-r from-[#355C7D] to-[#6D8FA8]',
                  'bg-gradient-to-r from-[#C56C86] to-[#FF7582]',
                  'bg-gradient-to-r from-[#6D8FA8] to-[#725A7A]'
                ];
                const borderColors = [
                  'border-l-[#FF7582]',
                  'border-l-[#725A7A]',
                  'border-l-[#355C7D]',
                  'border-l-[#C56C86]',
                  'border-l-[#6D8FA8]'
                ];
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-xl flex justify-between items-center bg-card border-l-4 ${borderColors[index % borderColors.length]} hover:shadow-lg transition`}
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
                        <span className={`text-xs px-3 py-1 rounded-full text-white font-semibold ${
                          task.priority === 'high' ? 'bg-[#EF4444]' :
                          task.priority === 'medium' ? 'bg-[#F59E0B]' :
                          'bg-[#10B981]'
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