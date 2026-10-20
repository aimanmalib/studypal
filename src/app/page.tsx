"use client";

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { GraduationCap, LoaderCircle, SendHorizontal, Trash2 } from 'lucide-react';
import { useStore, Message } from '@/lib/store';
import { useStudyApi } from '@/hooks/useStudyApi';
import { useTokenTracker } from '@/hooks/useTokenTracker';
import { ErrorNotice, KeyNotice, useErrorHandler } from '@/components/Notices';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n';

const SUGGESTIONS: MessageKey[] = ['chat.suggestion1', 'chat.suggestion2', 'chat.suggestion3'];

export default function ChatPage() {
  const { messages, addMessage, updateLastMessage, isStreaming, setStreaming, clearMessages, currentTopic, setTopic } =
    useStore();
  const { t, formatNumber } = useI18n();
  const api = useStudyApi();
  const { stats, track } = useTokenTracker();
  const handleError = useErrorHandler();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messages.length > 0) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
      await api.postStream(
        '/api/chat',
        { messages: history.map((m) => ({ role: m.role, content: m.content })), topic: currentTopic },
        (event) => {
          if (event.content) {
            accumulated += event.content;
            updateLastMessage(accumulated);
          }
          if (event.usage) track(event.usage);
        },
      );
      if (!accumulated) {
        updateLastMessage('', { message: t('chat.emptyAnswer'), needsSettings: false });
      }
    } catch (err) {
      updateLastMessage(accumulated, handleError(err));
    } finally {
      setStreaming(false);
    }
  };

  const pickSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] min-h-[26rem] max-w-3xl flex-col md:h-[calc(100dvh-7.5rem)]">
      <KeyNotice />

      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="topic" className="shrink-0 text-sm font-medium text-muted">
          {t('common.topic')}
        </label>
        <input
          id="topic"
          type="text"
          value={currentTopic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t('chat.topicPlaceholder')}
          maxLength={200}
          className="field min-w-0 flex-1 px-3 text-base sm:text-sm"
        />
      </div>

      <div className="-mx-1 mb-4 flex-1 space-y-4 overflow-y-auto px-1" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col items-center px-2 py-4 text-center sm:py-14">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-fg sm:h-16 sm:w-16">
              <GraduationCap className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
            </span>
            <h1 className="mb-2 text-xl font-bold tracking-tight sm:text-2xl">{t('chat.welcomeTitle')}</h1>
            <p className="max-w-md text-sm text-muted">{t('chat.welcomeBody')}</p>
            <p className="mt-6 mb-3 text-xs font-medium tracking-wide text-muted uppercase sm:mt-8">{t('chat.suggestionsLabel')}</p>
            <div className="flex w-full flex-col flex-wrap justify-center gap-2 sm:w-auto sm:flex-row">
              {SUGGESTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickSuggestion(t(key))}
                  className="min-h-11 rounded-xl border border-line bg-surface px-4 py-2 text-left text-sm text-fg shadow-[var(--shadow-card)] transition hover:border-accent-line hover:bg-surface-2 sm:rounded-full sm:py-0 sm:text-center"
                >
                  {t(key)}
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
          const mine = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${
                  mine ? 'rounded-br-md bg-accent text-on-accent' : 'rounded-bl-md border border-line bg-surface shadow-[var(--shadow-card)]'
                }`}
              >
                <span className="sr-only">{mine ? t('chat.you') : t('chat.assistant')}: </span>
                {mine ? (
                  <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                ) : msg.content ? (
                  <div className="prose-study text-sm">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : isStreaming && isLast ? (
                  <span className="streaming-cursor text-sm text-muted">{t('chat.thinking')}</span>
                ) : null}
                {msg.error && msg.content && <p className="mt-2 text-xs text-danger-fg">{msg.error.message}</p>}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={t('chat.inputPlaceholder')}
          aria-label={t('chat.inputLabel')}
          rows={1}
          className="field max-h-40 min-w-0 flex-1 resize-none px-4 py-3 text-base sm:text-sm"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          aria-label={isStreaming ? t('chat.sending') : undefined}
          className="btn-primary h-12 shrink-0 px-4 text-sm sm:px-5"
        >
          {isStreaming ? (
            <LoaderCircle className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <>
              <SendHorizontal className="h-4 w-4" aria-hidden="true" />
              <span>{t('chat.send')}</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={clearMessages}
          disabled={isStreaming || messages.length === 0}
          className="icon-btn h-12 w-12 border border-line bg-surface"
          aria-label={t('chat.clear')}
          title={t('chat.clear')}
        >
          <Trash2 className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>{t('chat.tokens', { n: formatNumber(stats.totalTokens) })}</span>
        <span>{t('chat.calls', { n: formatNumber(stats.calls) })}</span>
        <span>{t('chat.avg', { n: formatNumber(stats.avgPerCall) })}</span>
        <span className="ml-auto hidden md:inline">{t('chat.inputHint')}</span>
      </div>
    </div>
  );
}
