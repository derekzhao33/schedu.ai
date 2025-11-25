import React from "react";
import { format, setHours } from "date-fns";
import { Button } from "../../../components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { getEventStyle, getTaskStyle, getTimeline, getTasksForDay } from "../utils";
import { PRIMARY_LIGHT, BORDER_COLOR, TIME_START, TIME_END, PASTEL_COLORS } from "../constants";

export default function DayView({
  selectedDate,
  allEvents,
  tasks,
  completeTask,
  openTaskDetailsModal
}) {
  const timeline = getTimeline(allEvents, selectedDate);
  const todaysTasks = getTasksForDay(tasks, selectedDate);

  return (
    <div className="mt-4 flex flex-col flex-1 min-h-0 overflow-hidden px-4" style={{ background: 'transparent', minHeight: 0 }}>
      <div className="text-xl font-bold mb-4 max-w-[1600px] mx-auto w-full" style={{ color: '#374151' }}>Timeline</div>
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <div className="flex flex-row max-w-[1600px] mx-auto w-full">
          {/* Time labels outside white area */}
          <div className="flex flex-col pr-2 flex-shrink-0" style={{width: 70, marginRight: 12}}>
            {Array.from({ length: TIME_END - TIME_START }, (_, i) => TIME_START + i).map(h => (
              <div key={h} className="flex items-center justify-end text-sm text-slate-500 font-medium" style={{height: 60, minHeight: 60, paddingRight: 8}}>
                {format(setHours(new Date(), h), "h a")}
              </div>
            ))}
          </div>
          {/* Timeline slots and events inside white area */}
          <div className="relative flex-1 flex flex-col rounded-3xl shadow-xl border" style={{ background: PRIMARY_LIGHT, border: `1px solid ${BORDER_COLOR}`, minHeight: 1440, height: 1440, animation: 'liquify-day 4s ease-in-out infinite' }}>
            {/* Time slots */}
            <div className="flex flex-col" style={{height: 1440}}>
              {Array.from({ length: TIME_END - TIME_START }, (_, i) => (
                <div key={i} className="border-b" style={{height: 60, minHeight: 60, borderColor: BORDER_COLOR, borderBottomWidth: 1, borderStyle: 'solid'}}></div>
              ))}
            </div>
            {/* Events */}
            {timeline.map((event, i) => {
              const style = getEventStyle(event);
              const isGoogleEvent = event.source === 'google-calendar';
              return (
                <div
                  key={i}
                  className="absolute left-2 right-2 bg-white rounded-xl p-4 flex flex-row items-center gap-2 border"
                  style={{
                    ...style,
                    minHeight: 24,
                    zIndex: 2,
                    boxShadow: 'none',
                    overflow: 'visible',
                    borderColor: isGoogleEvent ? '#fc8181' : '#adb5bd',
                    background: isGoogleEvent ? '#fff5f5' : '#fff'
                  }}
                >
                  {isGoogleEvent && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Google</span>
                  )}
                  <div className="font-semibold text-slate-800 whitespace-nowrap">{event.name}</div>
                  <div className="text-xs text-slate-600 whitespace-normal break-words flex-1">{event.description}</div>
                </div>
              );
            })}
            {/* Tasks */}
            {todaysTasks.map((task, i) => {
              const style = getTaskStyle(task);
              const taskColor = PASTEL_COLORS[task.color] || PASTEL_COLORS.blue;
              const taskIndex = tasks.indexOf(task);
              return (
                <div
                  key={`task-${i}`}
                  className="absolute left-2 right-2 rounded-xl p-3 flex flex-row items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md group"
                  style={{
                    ...style,
                    minHeight: 24,
                    zIndex: 3,
                    backgroundColor: taskColor,
                    border: `2px solid ${taskColor}`,
                    overflow: 'visible',
                    opacity: task.completed ? 0 : 1,
                    filter: task.completed ? 'blur(4px)' : 'blur(0px)',
                    transform: task.completed ? 'scale(0.95)' : 'scale(1)',
                    transition: 'opacity 1.5s ease-out, transform 1.5s ease-out, filter 1.5s ease-out'
                  }}
                  onClick={(e) => {
                    if (!task.completed) {
                      const isCompleteButton = e.target.closest('button');
                      if (!isCompleteButton) {
                        openTaskDetailsModal(task, taskIndex);
                      }
                    }
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-auto hover:bg-white/30 transition-all opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!task.completed) {
                        completeTask(taskIndex);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                    disabled={task.completed}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                  <div className={`font-semibold text-slate-800 whitespace-nowrap ${task.completed ? 'line-through' : ''}`} style={{ textDecorationThickness: '2px' }}>{task.name}</div>
                  {task.label && (
                    <span className={`text-xs bg-white/50 text-slate-700 rounded px-2 py-0.5 ${task.completed ? 'line-through' : ''}`}>
                      {task.label}
                    </span>
                  )}
                  <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded ${
                    task.priority === 'high' ? 'bg-red-200 text-red-800' :
                    task.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-green-200 text-green-800'
                  } ${task.completed ? 'line-through' : ''}`}>
                    {task.priority}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
