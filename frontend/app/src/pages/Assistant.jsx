import React, { useState, useRef, useEffect } from "react";
import { useThemeSettings } from "../context/ThemeContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { MicIcon, SendIcon, BotIcon, UserIcon, MessageSquare, Trash2 } from "lucide-react";
import Sidebar, { useSidebar } from "../components/Sidebar";

const PRIMARY_BG = "#F7F8FC";

// Add CSS animation keyframes
const styles = `
  @keyframes liquify {
    0%, 100% {
      border-radius: 50px;
      box-shadow: 0 8px 32px rgba(236, 72, 153, 0.25), 0 0 60px rgba(168, 85, 247, 0.15), inset 0 2px 10px rgba(255,255,255,0.8);
    }
    25% {
      border-radius: 45px 55px 50px 48px;
      box-shadow: 0 10px 35px rgba(168, 85, 247, 0.3), 0 0 70px rgba(236, 72, 153, 0.2), inset 0 2px 12px rgba(255,255,255,0.9);
    }
    50% {
      border-radius: 52px 48px 53px 47px;
      box-shadow: 0 12px 38px rgba(59, 130, 246, 0.25), 0 0 65px rgba(16, 185, 129, 0.18), inset 0 3px 15px rgba(255,255,255,0.85);
    }
    75% {
      border-radius: 48px 52px 46px 54px;
      box-shadow: 0 9px 30px rgba(16, 185, 129, 0.22), 0 0 68px rgba(59, 130, 246, 0.2), inset 0 2px 11px rgba(255,255,255,0.9);
    }
  }

  @keyframes pulse-glow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(168, 85, 247, 0.4), 0 0 40px rgba(168, 85, 247, 0.2);
    }
    50% {
      box-shadow: 0 0 30px rgba(236, 72, 153, 0.5), 0 0 60px rgba(236, 72, 153, 0.3);
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

// Placeholder responses for AI
const getPlaceholderResponse = (userMessage) => {
  const responses = [
    "I understand you'd like help with that. I'm here to assist you with scheduling, task management, and productivity tips!",
    "That's a great question! I can help you organize your day, create tasks, and manage your calendar more effectively.",
    "I'm processing your request. In the future, I'll be able to provide personalized assistance based on your schedule and preferences.",
    "Thanks for sharing! I'm designed to help you stay organized and productive. Feel free to ask me anything about your tasks or schedule.",
    "I'm still learning, but I'm here to help! You can ask me about creating tasks, checking your schedule, or getting productivity advice.",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
};

export default function Assistant() {
  const { theme } = useThemeSettings();
  const { isCollapsed } = useSidebar();
  const [input, setInput] = useState("");
  
  // Load conversations from localStorage
  const loadConversations = () => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('assistantConversations');
        return saved ? JSON.parse(saved) : [];
      } catch (error) {
        console.warn('Failed to load conversations:', error);
        return [];
      }
    }
    return [];
  };

  const loadCurrentConversationId = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('currentConversationId') || null;
    }
    return null;
  };

  const [conversations, setConversations] = useState(loadConversations());
  const [currentConversationId, setCurrentConversationId] = useState(loadCurrentConversationId());
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Track if we're creating a new conversation to prevent clearing messages
  const isCreatingNewConversation = useRef(false);

  // Initialize messages on mount and when conversation changes
  useEffect(() => {
    // Don't reset messages if we're creating a new conversation
    if (isCreatingNewConversation.current) {
      isCreatingNewConversation.current = false;
      return;
    }

    if (!currentConversationId) {
      setMessages([]);
    } else {
      // Load from localStorage directly to avoid circular dependency
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('assistantConversations');
          const allConversations = saved ? JSON.parse(saved) : [];
          const conversation = allConversations.find(c => c.id === currentConversationId);
          if (conversation && conversation.messages) {
            setMessages(conversation.messages);
          } else {
            // Don't clear messages - let them stay as they are for new conversations
          }
        } catch (error) {
          console.warn('Failed to load conversation:', error);
        }
      }
    }
  }, [currentConversationId]);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('assistantConversations', JSON.stringify(conversations));
      } catch (error) {
        console.warn('Failed to save conversations:', error);
      }
    }
  }, [conversations]);

  // Save current conversation ID
  useEffect(() => {
    if (typeof window !== 'undefined' && currentConversationId) {
      localStorage.setItem('currentConversationId', currentConversationId);
    }
  }, [currentConversationId]);

  // Save current conversation messages whenever they change
  useEffect(() => {
    if (currentConversationId) {
      // Update localStorage directly and then sync state
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('assistantConversations');
          const allConversations = saved ? JSON.parse(saved) : [];
          const existingIndex = allConversations.findIndex(c => c.id === currentConversationId);
          
          if (existingIndex >= 0) {
            // Check if messages actually changed to avoid unnecessary updates
            const existingMessages = allConversations[existingIndex].messages;
            if (JSON.stringify(existingMessages) !== JSON.stringify(messages)) {
              // Update existing conversation
              const userMessage = messages.find(m => m.type === 'user');
              // Update title only if there's a user message and title wasn't set yet
              let title = allConversations[existingIndex].title;
              if (userMessage && (!title || title === 'New Conversation')) {
                title = userMessage.content.length > 30 ? userMessage.content.slice(0, 30) + '...' : userMessage.content;
              }
              
              allConversations[existingIndex] = {
                ...allConversations[existingIndex],
                title,
                messages,
              };
              
              localStorage.setItem('assistantConversations', JSON.stringify(allConversations));
              setConversations(allConversations);
            }
          } else if (messages.length > 0) {
            // Create new conversation only if there are messages
            const userMessage = messages.find(m => m.type === 'user');
            const title = userMessage ? (userMessage.content.length > 30 ? userMessage.content.slice(0, 30) + '...' : userMessage.content) : 'New Conversation';
            
            allConversations.push({
              id: currentConversationId,
              title,
              messages,
              lastUpdated: new Date().toISOString(),
            });
            
            localStorage.setItem('assistantConversations', JSON.stringify(allConversations));
            setConversations(allConversations);
          }
        } catch (error) {
          console.warn('Failed to save conversation:', error);
        }
      }
    }
  }, [messages, currentConversationId]);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Start a new conversation
  const startNewConversation = () => {
    const newId = Date.now().toString();
    
    // Create conversation immediately with placeholder title
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('assistantConversations');
        const allConversations = saved ? JSON.parse(saved) : [];
        
        allConversations.push({
          id: newId,
          title: 'New Conversation',
          messages: [],
          lastUpdated: new Date().toISOString(),
        });
        
        localStorage.setItem('assistantConversations', JSON.stringify(allConversations));
        setConversations(allConversations);
      } catch (error) {
        console.warn('Failed to create conversation:', error);
      }
    }
    
    setCurrentConversationId(newId);
    setMessages([]);
  };

  // Load a conversation
  const loadConversation = (conversationId) => {
    setCurrentConversationId(conversationId);
  };

  // Delete a conversation
  const deleteConversation = (conversationId, e) => {
    e.stopPropagation();
    
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('assistantConversations');
        const allConversations = saved ? JSON.parse(saved) : [];
        const filtered = allConversations.filter(c => c.id !== conversationId);
        localStorage.setItem('assistantConversations', JSON.stringify(filtered));
        setConversations(filtered);
        
        // If deleting current conversation, clear it without creating a new one
        if (currentConversationId === conversationId) {
          localStorage.removeItem('currentConversationId');
          setCurrentConversationId(null);
          setMessages([]);
        }
      } catch (error) {
        console.warn('Failed to delete conversation:', error);
      }
    }
  };

  // Handle sending message
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userInput = input;
    setInput("");

    // Create a new conversation if none exists and set it immediately
    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = Date.now().toString();
      isCreatingNewConversation.current = true;
      setCurrentConversationId(conversationId);
    }

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: "user",
      content: userInput,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // Get user ID from localStorage (default to 1 for now)
      const userId = parseInt(localStorage.getItem('userId') || '1');
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Call the backend API
      const response = await fetch('http://localhost:3000/api/assistant/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: userInput,
          userId,
          userTimezone,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      const assistantMessage = {
        id: Date.now() + 1,
        type: "assistant",
        content: data.message || getPlaceholderResponse(userInput),
        timestamp: new Date().toISOString(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling assistant API:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        type: "assistant",
        content: `Failed to fetch response from the assistant. Please make sure the backend server is running on port 3000. Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle Enter key in input
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`flex min-h-screen ${theme === 'dark' ? 'dark' : ''}`} style={{ background: PRIMARY_BG }}>
      <Sidebar />
      <div className={`flex transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`} style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden', width: '100%' }}>
        {/* Conversation History Sidebar */}
        <div className="w-64 border-r flex flex-col p-4 overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.7)', borderColor: '#E8E0EB' }}>
          <Button
            onClick={startNewConversation}
            className="w-full mb-4 px-4 py-3 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition"
            style={{
              background: 'linear-gradient(135deg, #EC4899, #A855F7)',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            + New Chat
          </Button>
          
          <div className="text-sm font-semibold text-gray-600 mb-2 px-2">Previous Conversations</div>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {conversations.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4">No previous conversations</div>
            ) : (
              conversations.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)).map(conv => (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className="group relative p-3 rounded-lg cursor-pointer transition-all hover:shadow-md"
                  style={{
                    background: currentConversationId === conv.id ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255, 255, 255, 0.5)',
                    border: currentConversationId === conv.id ? '1.5px solid #A855F7' : '1px solid #E8E0EB',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare size={16} className="mt-0.5 flex-shrink-0" style={{ color: '#A855F7' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{conv.title}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(conv.lastUpdated).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
                      onClick={(e) => deleteConversation(conv.id, e)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Container */}
          <motion.div
            className="flex-1 flex flex-col p-6 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto mb-6 space-y-4 px-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-start gap-3 ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div
                    className="flex-shrink-0 rounded-full p-2 flex items-center justify-center"
                    style={{
                      width: 40,
                      height: 40,
                      background: message.type === 'user' 
                        ? 'linear-gradient(135deg, #EC4899, #A855F7)' 
                        : 'linear-gradient(135deg, #3B82F6, #10B981)',
                      boxShadow: message.type === 'user'
                        ? '0 4px 15px rgba(236, 72, 153, 0.4)'
                        : '0 4px 15px rgba(59, 130, 246, 0.4)',
                    }}
                  >
                    {message.type === 'user' ? (
                      <UserIcon className="text-white" size={20} />
                    ) : (
                      <BotIcon className="text-white" size={20} />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className="max-w-2xl rounded-3xl px-6 py-4 shadow-lg"
                    style={{
                      background: message.type === 'user'
                        ? PRIMARY_BG
                        : 'rgba(255, 255, 255, 0.95)',
                      border: message.type === 'user'
                        ? '1.5px solid rgba(236, 72, 153, 0.5)'
                        : '1.5px solid rgba(59, 130, 246, 0.3)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <p className="text-gray-800 leading-relaxed">{message.content}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing Indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                <div
                  className="flex-shrink-0 rounded-full p-2 flex items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    background: 'linear-gradient(135deg, #3B82F6, #10B981)',
                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                    animation: 'pulse-glow 2s ease-in-out infinite',
                  }}
                >
                  <BotIcon className="text-white" size={20} />
                </div>
                <div
                  className="rounded-3xl px-6 py-4 shadow-lg"
                  style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '1.5px solid rgba(59, 130, 246, 0.3)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="w-full flex justify-center items-center pb-4">
            <div
              className="flex items-center w-full max-w-4xl px-6 py-4 gap-3"
              style={{
                background: 'rgba(255,255,255,0.95)',
                borderRadius: '50px',
                backdropFilter: 'blur(12px)',
                border: '1.5px solid transparent',
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.95), rgba(255,255,255,0.95)), linear-gradient(90deg, #EC4899, #A855F7, #3B82F6, #10B981, #EC4899)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
                animation: 'liquify 3s ease-in-out infinite',
                boxShadow: '0 8px 32px rgba(236, 72, 153, 0.25), 0 0 60px rgba(168, 85, 247, 0.15)',
              }}
            >
              <Input
                className="flex-1 text-lg border-0 focus:ring-0 focus:outline-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder="Ask me anything about your schedule, tasks, or productivity..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                style={{ color: '#1a1a1a', fontWeight: 500, boxShadow: 'none' }}
              />
              <Button variant="ghost" style={{ color: '#A855F7', borderRadius: 16, cursor: 'pointer' }}>
                <MicIcon size={24} />
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim()}
                style={{
                  background: input.trim() ? '#3B82F6' : '#9CA3AF',
                  color: '#fff',
                  borderRadius: 16,
                  fontWeight: 600,
                  boxShadow: input.trim() ? '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.3)' : 'none',
                  cursor: input.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                <SendIcon size={20} />
              </Button>
            </div>
          </div>
        </motion.div>
        </div>
      </div>
    </div>
  );
}
