'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '@/contexts/socket-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MessageCircle, Send, Trash2, Sparkles, X } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatPanelProps {
  onClose?: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const { socket, emitChatMessage, emitClearChat, connected } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleResponse = ({ message }: { message: string }) => {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: message,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    };

    const handleError = ({ message }: { message: string }) => {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${message}. Please try again.`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
    };

    socket.on('chat_response', handleResponse);
    socket.on('chat_error', handleError);

    return () => {
      socket.off('chat_response', handleResponse);
      socket.off('chat_error', handleError);
    };
  }, [socket]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    emitChatMessage(input.trim());
    setInput('');
    setIsTyping(true);
  };

  const handleClear = () => {
    setMessages([]);
    emitClearChat();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-purple-500" />
          <span className="font-semibold text-sm">AI Assistant</span>
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded-full',
            connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          )}>
            {connected ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear} title="Clear chat">
            <Trash2 className="size-3.5" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <MessageCircle className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Ask me anything about the canvas!</p>
              <p className="text-xs mt-1 text-slate-400">
                Try: "What decisions were made?", "What are the action items?", or "Who are the participants?"
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-slate-100 text-slate-800'
                )}
              >
                {msg.content}
                <div className={cn(
                  'text-[10px] mt-1 opacity-60',
                  msg.role === 'user' ? 'text-primary-foreground/70' : 'text-slate-400'
                )}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-slate-200">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the canvas..."
            className="flex-1"
            disabled={isTyping || !connected}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isTyping || !connected}
            size="icon"
            className="shrink-0"
          >
            <Send className="size-4" />
          </Button>
        </div>
        {!connected && (
          <p className="text-xs text-slate-400 mt-2 text-center">
            Connect to chat with AI assistant
          </p>
        )}
      </div>
    </div>
  );
}