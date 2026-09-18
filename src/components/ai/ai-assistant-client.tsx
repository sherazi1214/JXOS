'use client';

// ============================================================================
// AiAssistantClient — chat UI for Module 21. Sends the running conversation
// to POST /api/ai, which builds a read-only context block from whatever
// data this user's role can already see and returns a plain-text reply.
// No message here can mutate data — see api/ai/route.ts and lib/ai-client.ts.
// ============================================================================

import { useRef, useState, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  'How much revenue did we generate this month?',
  'Which clients owe us money?',
  'Which salesperson is performing best?',
  'What are our biggest expenses this month?',
  'Which projects are delayed?',
];

export function AiAssistantClient({ roleName }: { roleName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.slice(-10) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'The AI Assistant is temporarily unavailable.');
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setError('Network error while contacting the AI Assistant.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="icon-tile bg-brand-gradient text-white shadow-glow">
          <Sparkles size={18} />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">AI Assistant</h1>
          <p className="text-sm text-muted mt-0.5">
            Ask about revenue, clients, sales, expenses or projects — answers are based only on data
            your {roleName} role can already see. It can&apos;t change any records.
          </p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden !p-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center px-6 animate-fade-in">
              <span className="icon-tile h-14 w-14 bg-primary/15 text-primary-light ring-1 ring-inset ring-primary/25 mb-4">
                <Bot size={26} />
              </span>
              <p className="text-sm font-medium text-white">What would you like to know?</p>
              <p className="text-xs text-muted mt-1 max-w-sm">
                Ask a question about your company&apos;s live data, or try one of these:
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-white hover:border-primary/50 hover:bg-primary/10 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn('flex gap-3 animate-fade-in', m.role === 'user' && 'flex-row-reverse')}>
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  m.role === 'user' ? 'bg-brand-gradient text-white shadow-glow' : 'bg-white/10 text-white'
                )}
              >
                {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed',
                  m.role === 'user'
                    ? 'bg-primary/15 text-white ring-1 ring-inset ring-primary/25 rounded-tr-sm'
                    : 'bg-white/5 text-white ring-1 ring-inset ring-white/5 rounded-tl-sm'
                )}
              >
                {m.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-3 animate-fade-in">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                <Bot size={14} />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted animate-pulse-soft [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted animate-pulse-soft [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted animate-pulse-soft [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-danger px-5">{error}</p>}

        <form
          className="flex items-center gap-2 border-t border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
        >
          <input
            className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2.5 text-sm text-white placeholder:text-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            placeholder="Ask about revenue, clients, sales, expenses…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" disabled={!input.trim()} loading={sending}>
            <Send size={16} />
          </Button>
        </form>
      </Card>
    </div>
  );
}
