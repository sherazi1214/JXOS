// ============================================================================
// AI client — thin wrapper around the Anthropic Messages API used by the
// AI Assistant (Module 21). SERVER-SIDE ONLY: never import this from a
// client component, since it needs ANTHROPIC_API_KEY.
//
// The assistant is intentionally READ-ONLY: /api/ai builds a context block
// from data the caller already has permission to see (via rbac.ts) and
// passes it in the system prompt. This module has no tool-calling/function
// path back into the database, so there is no way for a model response to
// mutate financial or payroll data — that guarantee lives in the fact that
// askAssistant() only ever returns text.
// ============================================================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askAssistant(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to your environment to enable the AI Assistant.'
    );
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data.content ?? [])
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('\n')
    .trim();

  return text || 'I was not able to generate a response for that question.';
}
