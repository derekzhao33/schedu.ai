import React, { useState } from 'react';
import { LayoutDashboard, Calendar, List, Bot, BarChart3, Settings, User, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Plus, Search, Filter, Clock, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import { useSchedule } from '../context/ScheduleContext';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../components/Sidebar';
import AddTaskModal from '../components/AddTaskModal';
import TaskDetailsModal from '../components/TaskDetailsModal';
import Sidebar from '../components/Sidebar';

const slideInStyles = `
  @keyframes slideInFromRight {
    from {
      opacity: 0;
      transform: translateX(100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes slideOutToLeft {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(-100px);
    }
  }
`;

export default function Dashboard() {
  const { openAddTaskModal } = useModal();
  const { tasks } = useSchedule();
  const { user } = useAuth();
  const { isCollapsed } = useSidebar();
  const [showTodaysDeadlines, setShowTodaysDeadlines] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good night';
  };

  const handleViewToggle = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowTodaysDeadlines(!showTodaysDeadlines);
      setIsTransitioning(false);
    }, 300);
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  const todayDate = new Date(today);
  const endOfWeek = new Date(todayDate);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0];
  const endOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
  const endOfMonthStr = endOfMonth.toISOString().split('T')[0];

  // Filter tasks dynamically
  const todaysTasks = tasks.filter(t => t.date === today);
  const upcomingDeadlines = tasks
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  const weekTasks = tasks.filter(t => t.date >= today && t.date <= endOfWeekStr);
  const monthTasks = tasks.filter(t => t.date >= today && t.date <= endOfMonthStr);

  // Apply active filter to upcoming deadlines
  const getFilteredDeadlines = () => {
    if (activeFilter === 'all') return upcomingDeadlines;
    return upcomingDeadlines.filter(t => t.priority === activeFilter);
  };

  const filteredDeadlines = getFilteredDeadlines();

  // Get smart suggestion from actual tasks
  const getSmartSuggestion = () => {
    const highPriorityTodayTasks = todaysTasks.filter(t => t.priority === 'high');
    if (highPriorityTodayTasks.length > 0) {
      const firstTask = highPriorityTodayTasks[0];
      return {
        message: `You have ${highPriorityTodayTasks.length} high-priority task${highPriorityTodayTasks.length > 1 ? 's' : ''} due today. Consider tackling "${firstTask.name}" first.`,
        taskCount: highPriorityTodayTasks.length,
      };
    }
    if (todaysTasks.length > 0) {
      return {
        message: `You have ${todaysTasks.length} task${todaysTasks.length > 1 ? 's' : ''} due today. Stay on track!`,
        taskCount: todaysTasks.length,
      };
    }
    return {
      message: 'No tasks due today. Great job staying on top of things!',
      taskCount: 0,
    };
  };

  const suggestion = getSmartSuggestion();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <style>{slideInStyles}</style>
      <Sidebar />

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header with Search */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-950">{getGreeting()}, {user?.first_name || 'User'}</h1>
              <p className="text-slate-500 mt-2 text-base">You have {todaysTasks.length} tasks due today</p>
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search tasks..." 
                  className="pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64 bg-white text-slate-900 placeholder-slate-400"
                />
              </div>
              <button 
                onClick={openAddTaskModal}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm flex items-center gap-2"
              >
                <Plus size={20} />
                Add Task
              </button>
            </div>
          </div>

          {/* AI Insight Banner */}
          <div className="mb-8 bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 rounded-lg p-6 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="text-white" size={24} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-base">Smart Suggestion</p>
              <p className="text-sm text-slate-600 mt-1">{suggestion.message}</p>
            </div>
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-100/50 px-3 py-2 rounded-lg transition-colors duration-200 whitespace-nowrap">
              View Details →
            </button>
          </div>



          {/* Stats Cards with Trends */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Today Card */}
            <div className="bg-white rounded-lg p-6 border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Today</h3>
                <div className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  <TrendingDown size={14} />
                  <span>-2 from yesterday</span>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-bold text-slate-900 mb-1">{todaysTasks.length}</p>
                  <p className="text-sm text-slate-500">Tasks Remaining</p>
                </div>
                <div className="h-12 flex items-end gap-2">
                  {[3, 5, 4, 2, 1].map((height, i) => (
                    <div key={i} className="flex-1 bg-blue-100 rounded-t group-hover:bg-blue-400 transition-colors duration-300" style={{ height: `${height * 8}px` }}></div>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Completion Rate</span>
                  <span className="font-semibold text-slate-900">73%</span>
                </div>
                <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: '73%' }}></div>
                </div>
              </div>
            </div>

            {/* This Week Card */}
            <div className="bg-white rounded-lg p-6 border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">This Week</h3>
                <div className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  <TrendingUp size={14} />
                  <span>+3 from last week</span>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-bold text-slate-900 mb-1">{weekTasks.length}</p>
                  <p className="text-sm text-slate-500">Total Tasks</p>
                </div>
                <div className="h-12 flex items-end gap-2">
                  {[2, 4, 5, 6, 5].map((height, i) => (
                    <div key={i} className="flex-1 bg-blue-100 rounded-t group-hover:bg-blue-400 transition-colors duration-300" style={{ height: `${height * 8}px` }}></div>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">On Track</span>
                  <span className="font-semibold text-slate-900">4 / 5</span>
                </div>
                <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: '80%' }}></div>
                </div>
              </div>
            </div>

            {/* This Month Card */}
            <div className="bg-white rounded-lg p-6 border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">This Month</h3>
                <div className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                  <TrendingUp size={14} />
                  <span>+8 from last month</span>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-bold text-slate-900 mb-1">{monthTasks.length}</p>
                  <p className="text-sm text-slate-500">Planned Tasks</p>
                </div>
                <div className="h-12 flex items-end gap-2">
                  {[3, 3, 4, 5, 6].map((height, i) => (
                    <div key={i} className="flex-1 bg-blue-100 rounded-t group-hover:bg-blue-400 transition-colors duration-300" style={{ height: `${height * 8}px` }}></div>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Average Priority</span>
                  <span className="font-semibold text-slate-900">Medium-High</span>
                </div>
                <div className="mt-2 flex gap-1">
                  <div className="h-1.5 flex-1 bg-green-600 rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-amber-600 rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-red-600 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex gap-2">
              {['all', 'high', 'medium', 'low'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    activeFilter === filter
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)} Priority
                </button>
              ))}
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200">
              <Filter size={18} />
              More Filters
            </button>
          </div>

          {/* Deadlines Section */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {showTodaysDeadlines ? "Today's Deadlines" : "Upcoming Deadlines"}
                </h2>
                <p className="text-sm text-slate-500 mt-2">
                  {showTodaysDeadlines 
                    ? `${todaysTasks.length} tasks need your attention today` 
                    : `Next ${filteredDeadlines.length} tasks in your pipeline`}
                </p>
              </div>
              <button
                onClick={handleViewToggle}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors duration-200"
              >
                {showTodaysDeadlines ? "View Upcoming →" : "View Today's →"}
              </button>
            </div>
            
            <div className="p-6 overflow-hidden">
              <div
                style={{
                  animation: isTransitioning ? 'slideOutToLeft 0.3s ease-in-out forwards' : 'slideInFromRight 0.3s ease-in-out forwards',
                }}
              >
                {(showTodaysDeadlines ? todaysTasks : filteredDeadlines).length > 0 ? (
                  <div className="space-y-3">
                    {(showTodaysDeadlines ? todaysTasks : filteredDeadlines).map((task, index) => (
                      <div
                        key={index}
                        className="group flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <button className="w-5 h-5 rounded border-2 border-slate-300 hover:border-blue-600 transition-colors duration-200 flex items-center justify-center group-hover:border-blue-600">
                            <CheckCircle size={14} className="text-slate-300 group-hover:text-blue-600" />
                          </button>
                          <div className="w-1 h-12 bg-blue-600 rounded-full"></div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors duration-200">{task.name}</p>
                            <p className="text-sm text-slate-500 mt-0.5">{task.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-slate-400 uppercase tracking-widest">Due Date</p>
                            <p className="text-sm font-semibold text-slate-900 mt-1">
                              {new Date(task.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                          <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                            task.priority === 'high' 
                              ? 'bg-red-50 text-red-700 border border-red-200' 
                              : task.priority === 'medium' 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : 'bg-green-50 text-green-700 border border-green-200'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="mx-auto text-slate-300 mb-3" size={48} />
                    <p className="text-slate-400 font-medium">No tasks due today</p>
                    <p className="text-sm text-slate-400 mt-1">You're all caught up! Great job.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AddTaskModal />
      <TaskDetailsModal />
    </div>
  );
}