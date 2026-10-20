"use client";

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore, Message } from '@/lib/store';
import { postStream } from '@/lib/client/request';
import { useTokenTracker } from '@/hooks/useTokenTracker';
import { ErrorNotice, KeyNotice, useErrorHandler } from '@/components/Notices';
import { TrashIcon } from '@/components/icons';

const SUGGESTIONS = ['Explain quantum computing simply', 'Make a 4-week study plan for calculus', 'Help me understand photosynthesis'];

export default function ChatPage() {
  const { messages, addMessage, updateLastMessage, isStreaming, setStreaming, clearMessages, currentTopic, setTopic } =
    useStore();
  const settings = useStore((s) => s.settings);
  const { stats, track } = useTokenTracker();
  const handleError = useErrorHandler();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = { id: `msg-${Date.now()}`, role: 'user', content: input.trim(), timestamp: Date.now() };
    // Failed turns are shown but not sent back to the model.
    const history = [...messages.filter((m) => !m.error && m.content), userMsg];
    addMessage(userMsg);
    setInput('');
    addMessage({ id: `msg-${Date.now()}-ai`, role: 'assistant', content: '', timestamp: Date.now() });
    setStreaming(true);

    let accumulated = '';
    try {
      await postStream(
        '/api/chat',
        { messages: history.map((m) => ({ role: m.role, content: m.content })), topic: currentTopic },
        settings,
        (event) => {
          if (event.content) {
            accumulated += event.content;
            updateLastMessage(accumulated);
          }
          if (event.usage) track(event.usage);
        },
      );
      if (!accumulated) {
        updateLastMessage('', { message: 'The model sent an empty answer. Please try again.', needsSettings: false });
      }
    } catch (err) {
      updateLastMessage(accumulated, handleError(err));
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-9.5rem)] min-h-[26rem] max-w-3xl flex-col md:h-[calc(100dvh-7rem)]">
      <KeyNotice />

      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="topic" className="shrink-0 text-sm text-slate-400">
          Topic
        </label>
        <input
          id="topic"
          type="text"
          value={currentTopic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Machine learning, organic chemistry"
          maxLength={200}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-base transition focus:border-brand-500 focus:outline-none sm:text-sm"
        />
      </div>

      <div className="mb-4 flex-1 space-y-4 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 && (
          <div className="py-12 text-center text-slate-400 sm:py-20">
            <div className="mb-4 text-5xl" aria-hidden="true">
              🎓
            </div>
            <h1 className="mb-2 text-xl font-semibold text-slate-100">Welcome to StudyPal</h1>
            <p className="text-sm">Ask anything about your studies. I explain concepts step by step and check your understanding.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setInput(q)}
                  className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;
          if (msg.role === 'assistant' && msg.error && !msg.content) {
            return <ErrorNotice key={msg.id} error={msg.error} className="max-w-[90%]" />;
          }
          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${
                  msg.role === 'user' ? 'bg-brand-600 text-white' : 'border border-slate-700 bg-slate-800'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                ) : msg.content ? (
                  <div className="prose-study text-sm">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : isStreaming && isLast ? (
                  <span className="streaming-cursor text-sm text-slate-400">Thinking</span>
                ) : null}
                {msg.error && msg.content && <p className="mt-2 text-xs text-red-300">{msg.error.message}</p>}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask a question…"
          aria-label="Your question"
          rows={1}
          className="min-w-0 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base transition focus:border-brand-500 focus:outline-none sm:text-sm"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="shrink-0 rounded-xl bg-brand-600 px-5 py-3 text-sm font-medium transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStreaming ? '…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={clearMessages}
          disabled={isStreaming || messages.length === 0}
          className="shrink-0 rounded-xl bg-slate-800 px-3 py-3 text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
          aria-label="Clear chat"
          title="Clear chat"
        >
          <TrashIcon />
        </button>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Tokens: {stats.totalTokens.toLocaleString()}</span>
        <span>Calls: {stats.calls}</span>
        <span>Avg/call: {stats.avgPerCall.toLocaleString()}</span>
      </div>
    </div>
  );
}
