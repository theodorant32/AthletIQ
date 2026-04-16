'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const suggestedQuestions = [
    "Am I on track for my goal?",
    "Should I run hard today?",
    "What's my predicted race time?",
    "How's my training load looking?",
  ];

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:4000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();

      const assistantMessage: Message = { role: 'assistant', content: data.response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggested = (question: string) => {
    setInput(question);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-white">Coach Chat</h1>
      <p className="text-gray-400">
        Ask questions about your training. Powered by AI with your actual data.
      </p>

      {/* Chat Messages */}
      <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50 min-h-96">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Bot className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 mb-4">Start a conversation with your AI coach</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggested(q)}
                  className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 ${
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  msg.role === 'user' ? 'bg-blue-500/20' : 'bg-purple-500/20'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Bot className="w-5 h-5 text-purple-400" />
                  )}
                </div>
                <div className={`max-w-[80%] p-4 rounded-xl ${
                  msg.role === 'user'
                    ? 'bg-blue-500/10 border border-blue-500/30'
                    : 'bg-gray-800 border border-gray-700'
                }`}>
                  <p className="text-gray-200 whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Bot className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your training..."
          className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium transition flex items-center gap-2"
        >
          <Send className="w-5 h-5" />
          Send
        </button>
      </div>
    </div>
  );
}
