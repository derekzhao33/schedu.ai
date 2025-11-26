import React from "react";
import { format, startOfWeek, addDays, setHours } from "date-fns";
import { getEventStyle, getTaskStyle, getTimeline, getTasksForDay } from "../utils";
import { TIME_START, TIME_END, PASTEL_COLORS } from "../constants";

export default function WeekView({
  selectedDate,
  allEvents,
  tasks,
  openTaskDetailsModal
}) {
  const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const hours = Array.from({ length: TIME_END - TIME_START }, (_, i) => TIME_START + i);
  const SLOT_HEIGHT = 50; // Height in pixels for each hour slot

  return (
    <div className="overflow-x-auto mt-3 flex-1 px-3">
      <div className="flex flex-row w-full h-full mx-auto">
        {/* Time column */}
        <div className="flex flex-col flex-shrink-0" style={{width: 60, marginRight: 8}}>
          <div style={{height: SLOT_HEIGHT, minHeight: SLOT_HEIGHT}} />
          {hours.map(h => (
            <div key={h} className="flex items-center justify-end text-xs text-slate-500 font-medium" style={{height: SLOT_HEIGHT, minHeight: SLOT_HEIGHT, paddingRight: 6, lineHeight: 1}}>
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
              <div key={dayIdx} className="relative flex flex-col h-full rounded-xl" style={{minWidth: 100, flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', animation: 'liquify-week 5s ease-in-out infinite'}}>
                {/* Day header */}
                <div className="sticky top-0 z-10 rounded-t-xl p-2 text-center font-semibold border-b flex items-center justify-center" style={{height: SLOT_HEIGHT, color: '#374151', background: '#f3f4f6', borderBottomColor: '#e5e7eb', fontSize: '12px'}}>{format(day, "EEE d")}</div>
                {/* Timeline slots */}
                <div className="relative h-full flex flex-col">
                  {hours.map(h => (
                    <div key={h} className="border-b" style={{height: SLOT_HEIGHT, minHeight: SLOT_HEIGHT, borderColor: '#e5e7eb'}}></div>
                  ))}
                  {/* Events */}
                  {dayEvents.map((event, i) => {
                    const style = getEventStyle(event, SLOT_HEIGHT);
                    const isGoogleEvent = event.source === 'google-calendar';
                    return (
                      <div
                        key={i}
                        className="absolute left-1 right-1 rounded-lg p-1.5 flex flex-col justify-center border"
                        style={{
                          ...style,
                          minHeight: 20,
                          zIndex: 2,
                          overflow: 'hidden',
                          background: isGoogleEvent ? '#fff5f5' : '#fff',
                          borderColor: isGoogleEvent ? '#fc8181' : '#adb5bd',
                          fontSize: '10px'
                        }}
                      >
                        <div className={`font-semibold whitespace-normal break-words ${isGoogleEvent ? 'text-red-600' : 'text-slate-700'}`}>
                          {isGoogleEvent && '📅 '}{event.name}
                        </div>
                      </div>
                    );
                  })}
                  {/* Tasks */}
                  {dayTasks.map((task, i) => {
                    const style = getTaskStyle(task, SLOT_HEIGHT);
                    const taskColor = PASTEL_COLORS[task.color] || PASTEL_COLORS.blue;
                    return (
                      <div
                        key={`task-${i}`}
                        className="absolute left-1 right-1 rounded-lg p-1 cursor-pointer transition-all hover:scale-105"
                        style={{
                          ...style,
                          minHeight: 18,
                          zIndex: 3,
                          backgroundColor: taskColor,
                          border: `1px solid ${PASTEL_COLORS[task.color] || PASTEL_COLORS.blue}`,
                          overflow: 'hidden',
                          fontSize: '9px'
                        }}
                        onClick={() => openTaskDetailsModal(task, tasks.indexOf(task))}
                      >
                        <div className="font-semibold text-slate-800 truncate">{task.name}</div>
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
}
