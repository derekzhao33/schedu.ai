import React from "react";
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth, addDays, isSameMonth, isSameDay } from "date-fns";
import { getTimeline, getTasksForDay } from "../utils";
import { PASTEL_COLORS } from "../constants";

export default function MonthView({
  selectedDate,
  allEvents,
  tasks,
  openTaskDetailsModal
}) {
  const start = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 });
  const days = [];
  let day = start;
  while (day <= end) {
    days.push(day);
    day = addDays(day, 1);
  }
  const today = new Date();

  return (
    <div className="flex-1 overflow-y-auto px-4">
      <div className="grid grid-cols-7 gap-4 mt-4 min-h-[calc(100vh-220px)] max-w-[1600px] mx-auto" style={{alignItems: 'stretch'}}>
        {days.map((d, i) => {
          const dayTasks = getTasksForDay(tasks, d);
          const dayEvents = getTimeline(allEvents, d);
          const isCurrentMonth = isSameMonth(d, selectedDate);
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              className="rounded-3xl p-5 transition-all flex flex-col justify-start"
              style={{
                background: isCurrentMonth ? '#f8f9fa' : '#e9ecef',
                border: isToday ? '2px solid #6c757d' : '1px solid #dee2e6',
                opacity: isCurrentMonth ? 1 : 0.5,
                minHeight: 150,
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
              <div className="font-bold mb-3 text-lg" style={{
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
                      {isGoogleEvent && '=Å '}{e.name}
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
}
