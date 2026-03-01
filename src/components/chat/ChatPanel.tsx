import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, Send, Plus, Trash2, Loader2, ChevronLeft, AlertCircle, Bot, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchSessions,
  fetchMessages,
  deleteSession,
  sendMessage,
  type ChatSession,
  type ChatMessage,
} from '../../lib/chatService';
import ChatMessageBubble from './ChatMessageBubble';

type View = 'chat' | 'history';

export default function EmbeddedChatPanel() {
  const { user } = useAuth();
  const location = useLocation();

  const [view, setView] = useState<View>('chat');

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamText, scrollToBottom]);

  useEffect(() => {
    if (view === 'history') {
      loadSessions();
    }
  }, [view]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await fetchSessions();
      setSessions(data);
    } catch {
      setError('Failed to load conversations');
    } finally {
      setLoadingSessions(false);
    }
  };

  const openSession = async (sessionId: string) => {
    try {
      const msgs = await fetchMessages(sessionId);
      setMessages(msgs);
      setActiveSessionId(sessionId);
      setView('chat');
      setStreamText('');
      setError(null);
    } catch {
      setError('Failed to load conversation');
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setStreamText('');
    setError(null);
    setView('chat');
    setInput('');
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        startNewChat();
      }
    } catch {
      setError('Failed to delete conversation');
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setError(null);
    setInput('');
    setStreaming(true);
    setStreamText('');

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await sendMessage(
        text,
        activeSessionId,
        location.pathname,
        {
          onSessionId: (id) => {
            setActiveSessionId(id);
          },
          onChunk: (chunk) => {
            setStreamText(prev => prev + chunk);
          },
          onDone: () => {
            setStreamText(prev => {
              if (prev) {
                const assistantMsg: ChatMessage = {
                  id: `resp-${Date.now()}`,
                  role: 'assistant',
                  content: prev,
                  metadata: {},
                  created_at: new Date().toISOString(),
                };
                setMessages(m => [...m, assistantMsg]);
              }
              return '';
            });
            setStreaming(false);
          },
          onError: (msg) => {
            setError(msg);
            setStreaming(false);
            setStreamText('');
          },
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to send message');
      }
      setStreaming(false);
      setStreamText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
    if (streamText) {
      const assistantMsg: ChatMessage = {
        id: `resp-${Date.now()}`,
        role: 'assistant',
        content: streamText + '\n\n*(Stopped)*',
        metadata: {},
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamText('');
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-100 bg-blue-50">
        <div className="flex items-center gap-2">
          {view === 'history' && (
            <button
              onClick={() => setView('chat')}
              className="p-1 rounded hover:bg-blue-100 text-blue-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <Bot className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-gray-800">ZINWA AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView(view === 'history' ? 'chat' : 'history')}
            className="px-2.5 py-1 rounded hover:bg-blue-100 text-blue-700 transition-colors text-xs font-medium"
            title="Conversation history"
          >
            {view === 'history' ? 'Chat' : 'History'}
          </button>
          <button
            onClick={startNewChat}
            className="p-1.5 rounded hover:bg-blue-100 text-blue-700 transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'history' ? (
        <div className="flex-1 overflow-y-auto">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No conversations yet</p>
              <button
                onClick={startNewChat}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Start a new chat
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => openSession(session.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors group ${
                    activeSessionId === session.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {session.title || 'Untitled chat'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(session.updated_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                  <Bot className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-700">
                  How can I help you today?
                </p>
                <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
                  Ask me about production data, chemical stock levels, maintenance status, water losses, or any operational question.
                </p>
                <div className="mt-4 grid gap-2 w-full max-w-[300px]">
                  {[
                    'Which stations had the most downtime?',
                    'Are any chemicals running low?',
                    'Summarize this month\'s production',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-blue-700" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <ChatMessageBubble content={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {streaming && streamText && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-blue-700" />
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-gray-100 text-gray-800 text-sm leading-relaxed">
                  <ChatMessageBubble content={streamText} />
                  <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5 rounded-sm" />
                </div>
              </div>
            )}

            {streaming && !streamText && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-blue-700" />
                </div>
                <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-gray-100">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-200 px-3 py-2.5 bg-gray-50/50">
            {streaming && (
              <button
                onClick={handleStop}
                className="w-full mb-2 text-xs text-gray-500 hover:text-gray-700 py-1 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Stop generating
              </button>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your water operations..."
                rows={1}
                disabled={streaming}
                className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 bg-white max-h-[80px]"
                style={{ minHeight: '36px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || streaming}
                className="p-2 rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
