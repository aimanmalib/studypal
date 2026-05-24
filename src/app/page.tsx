"use client";

import { useState, useRef, useEffect } from 'react';
import { useStore, Message } from '@/lib/store';
import { useTokenTracker } from '@/hooks/useTokenTracker';

export default function ChatPage() {
  const { messages, addMessage, updateLastMessage, isStreaming, setStreaming, clearMessages, currentTopic, setTopic } = useStore();
  const { stats, track } = useTokenTracker();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };
    addMessage(userMsg);
    setInput('');

    const assistantMsg: Message = {
      id: `msg-${Date.now()}-ai`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    addMessage(assistantMsg);
    setStreaming(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          topic: currentTopic,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              accumulated += parsed.content;
              updateLastMessage(accumulated);
            }
          } catch {}
        }
      }
    } catch (error) {
      updateLastMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Topic bar */}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm text-slate-400">Topic:</label>
        <input
          type="text"
          value={currentTopic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Machine Learning, Organic Chemistry..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-mimo-500 transition"
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <div className="text-6xl mb-4">🎓</div>
            <h2 className="text-xl font-semibold mb-2">Welcome to StudyPal</h2>
            <p className="text-sm">Ask me anything about your studies. I explain concepts, create quizzes, and help you learn.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['Explain quantum computing', 'Create a study plan for calculus', 'Help me understand photosynthesis'].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="px-3 py-1.5 bg-slate-800 rounded-full text-xs hover:bg-slate-700 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-mimo-600 text-white'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            >
              <div className="prose-mimo text-sm whitespace-pre-wrap">
                {msg.content || (isStreaming && msg.role === 'assistant' ? (
                  <span className="streaming-cursor text-slate-400">Thinking</span>
                ) : null)}
              </div>
              {msg.tokens && (
                <div className="text-xs text-slate-500 mt-1">{msg.tokens} tokens</div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Ask a question..."
          rows={1}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-mimo-500 transition"
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          className="px-6 py-3 bg-mimo-600 hover:bg-mimo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-sm transition"
        >
          {isStreaming ? '...' : 'Send'}
        </button>
        <button
          onClick={clearMessages}
          className="px-3 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm transition"
          title="Clear chat"
        >
          🗑
        </button>
      </div>

      {/* Token stats */}
      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
        <span>Tokens: {stats.totalTokens.toLocaleString()}</span>
        <span>Calls: {stats.calls}</span>
        <span>Avg/call: {stats.avgPerCall.toLocaleString()}</span>
      </div>
    </div>
  );
}
