import React, { useRef, useEffect } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { motion } from "framer-motion";
import { BotIcon, SendIcon, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function AIChat({
  input,
  setInput,
  aiMessages,
  isAiTyping,
  isProcessing,
  showSuccess,
  handleQuickAdd,
  handleInputKeyDown
}) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages, isAiTyping]);

  return (
    <div className="w-[360px] border-l flex flex-col" style={{ background: '#ffffff', borderColor: '#e5e7eb' }}>
      {/* AI Chat Header */}
      <div className="p-6 pb-4.5 border-b flex items-center gap-2.5" style={{ borderColor: '#e5e7eb', background: '#f8f9fa' }}>
        <div className="flex-shrink-0 rounded-full p-2 flex items-center justify-center" style={{
          width: 36,
          height: 36,
          background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
          boxShadow: '0 2px 10px rgba(59, 130, 246, 0.3)',
        }}>
          <BotIcon className="text-white" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-800 truncate">AI Assistant</h2>
          <p className="text-xs text-slate-500 truncate">Manage your calendar</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: '#f9fafb' }}>
        {aiMessages.length === 0 && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}>
              <BotIcon className="text-white" size={24} />
            </div>
            <p className="text-slate-700 text-sm font-medium mb-1">Hi! I'm your AI assistant.</p>
            <p className="text-slate-500 text-xs">Ask me to add, remove, or move tasks!</p>
          </div>
        )}

        {aiMessages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
              <div className={`rounded-xl px-3 py-2.5 shadow-sm ${
                message.type === 'user'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                  : 'bg-white text-slate-800 border border-slate-200'
              }`}>
                <p className="text-sm leading-relaxed">{message.content}</p>

                {/* Show task details if created */}
                {message.tasksCreated > 0 && message.tasks && (
                  <div className="mt-2 pt-2 border-t border-white/20 space-y-1">
                    <p className="text-xs font-semibold opacity-90">✓ Created {message.tasksCreated} task{message.tasksCreated !== 1 ? 's' : ''}</p>
                    {message.tasks.map((task, i) => (
                      <div key={i} className="text-xs opacity-90">
                        • {task.name} ({task.startTime}-{task.endTime})
                      </div>
                    ))}
                  </div>
                )}

                {/* Show conflicts */}
                {message.conflicts && message.conflicts.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                    <p className="text-xs font-semibold text-orange-600">⚠ Conflicts:</p>
                    {message.conflicts.map((conflict, i) => (
                      <div key={i} className="text-xs">• {conflict}</div>
                    ))}
                  </div>
                )}

                {/* Show alternatives */}
                {message.suggestedAlternatives && message.suggestedAlternatives.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                    <p className="text-xs font-semibold text-blue-600">💡 Suggestions:</p>
                    {message.suggestedAlternatives.map((alt, i) => (
                      <div key={i} className="text-xs">• {alt}</div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 px-1">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </motion.div>
        ))}

        {/* Typing Indicator */}
        {isAiTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-slate-100 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Success Notification */}
      {showSuccess && (
        <div className="px-4 pb-2">
          <div className="bg-green-500 text-white px-3 py-2 rounded-lg shadow-md flex items-center gap-2 text-sm">
            <span>✓</span>
            <span className="font-medium">Task added to calendar!</span>
          </div>
        </div>
      )}

      {/* Chat Input */}
      <div className="p-4 border-t bg-white" style={{ borderColor: '#e5e7eb' }}>
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-colors">
          <Input
            className="flex-1 border-0 focus:ring-0 focus:outline-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
            placeholder="Add, remove, or move tasks..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            style={{ color: '#1e293b', fontWeight: 500, boxShadow: 'none' }}
          />
          <Button
            onClick={handleQuickAdd}
            disabled={!input.trim() || isProcessing}
            size="sm"
            className="rounded-lg flex-shrink-0"
            style={{
              background: input.trim() && !isProcessing ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : '#d1d5db',
              color: '#fff',
              cursor: input.trim() && !isProcessing ? 'pointer' : 'not-allowed',
              padding: '8px 12px',
              boxShadow: input.trim() && !isProcessing ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
            }}
          >
            {isProcessing ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <SendIcon size={16} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
