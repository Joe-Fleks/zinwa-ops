import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface ChatSession {
  id: string;
  title: string;
  page_context: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  };
}

export async function fetchSessions(): Promise<ChatSession[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat/sessions`, { headers });
  if (!res.ok) throw new Error('Failed to fetch sessions');
  const data = await res.json();
  return data.sessions || [];
}

export async function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/ai-chat/sessions/${sessionId}/messages`,
    { headers }
  );
  if (!res.ok) throw new Error('Failed to fetch messages');
  const data = await res.json();
  return data.messages || [];
}

export async function deleteSession(sessionId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/ai-chat/sessions/${sessionId}`,
    { method: 'DELETE', headers }
  );
  if (!res.ok) throw new Error('Failed to delete session');
}

export interface StreamCallbacks {
  onSessionId: (id: string) => void;
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export async function sendMessage(
  message: string,
  sessionId: string | null,
  pageContext: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const headers = await getAuthHeaders();

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      session_id: sessionId,
      page_context: pageContext,
    }),
    signal,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'AI service error' }));
    const msg = errData.error || `Error ${res.status}`;
    throw new Error(msg);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'session') {
          callbacks.onSessionId(parsed.session_id);
        } else if (parsed.type === 'chunk') {
          callbacks.onChunk(parsed.content);
        } else if (parsed.type === 'done') {
          callbacks.onDone();
        } else if (parsed.type === 'error') {
          callbacks.onError(parsed.message);
        }
      } catch (_) {}
    }
  }
}
