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

  return (
    <div className="overflow-x-auto mt-4 flex-1 px-4">
      <div className="flex flex-row w-full h-full max-w-[1600px] mx-auto">
        {/* Time column */}
        <div className="flex flex-col pr-2" style={{width: 70, marginRight: 12, height: '100%', marginTop: 23}}>
          {hours.map(h => (
            <div key={h} className="flex items-center justify-end text-sm text-slate-500 font-medium" style={{height: 40, minHeight: 40, paddingRight: 8}}>
              {format(setHours(new Date(), h), "h a")}
            </div>
          ))}
        </div>
        {/* Days columns */}
        <div className="flex-1 grid grid-cols-7 gap-3 h-full">
          {days.map((day, dayIdx) => {
            const dayEvents = getTimeline(allEvents, day);
            const dayTasks = getTasksForDay(tasks, day);
            return (
              <div key={dayIdx} className="relative border-l flex flex-col h-full rounded-3xl" style={{minWidth: 120, flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', backdropFilter: 'blur(10px) saturate(150%)', animation: 'liquify-week 5s ease-in-out infinite'}}>
                {/* Day header */}
                <div className="sticky top-0 z-10 rounded-t-3xl p-2 text-center font-bold border-b flex items-center justify-center" style={{height: 40, color: '#374151', background: '#f3f4f6', borderBottomColor: '#e5e7eb', textShadow: 'none'}}>{format(day, "EEE d")}</div>
                {/* Timeline slots */}
                <div className="relative h-full flex flex-col">
                  {hours.map(h => (
                    <div key={h} className="border-b" style={{height: 40, minHeight: 40}}></div>
                  ))}
                  {/* Events */}
                  {dayEvents.map((event, i) => {
                    const style = getEventStyle(event);
                    const isGoogleEvent = event.source === 'google-calendar';
                    return (
                      <div
                        key={i}
                        className="absolute left-2 right-2 rounded-xl p-2 flex flex-col justify-center border"
                        style={{
                          ...style,
                          minHeight: 24,
                          zIndex: 2,
                          overflow: 'visible',
                          background: isGoogleEvent ? '#fff5f5' : '#fff',
                          borderColor: isGoogleEvent ? '#fc8181' : '#adb5bd'
                        }}
                      >
                        <div className={`font-semibold text-xs whitespace-normal break-words ${isGoogleEvent ? 'text-red-600' : 'text-slate-700'}`}>
                          {isGoogleEvent && '=Å '}{event.name}
                        </div>
                      </div>
                    );
                  })}
                  {/* Tasks */}
                  {dayTasks.map((task, i) => {
                    const style = getTaskStyle(task);
                    const taskColor = PASTEL_COLORS[task.color] || PASTEL_COLORS.blue;
                    return (
                      <div
                        key={`task-${i}`}
                        className="absolute left-2 right-2 rounded-lg p-1.5 cursor-pointer transition-all hover:scale-105"
                        style={{
                          ...style,
                          minHeight: 20,
                          zIndex: 3,
                          backgroundColor: taskColor,
                          border: `1px solid #adb5bd`,
                          overflow: 'hidden'
                        }}
                        onClick={() => openTaskDetailsModal(task, tasks.indexOf(task))}
                      >
                        <div className="font-semibold text-slate-800 text-xs truncate">{task.name}</div>
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
