import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  listThreads,
  createThread,
  getThread,
  deleteThread,
  sendMessage,
  submitChatFeedback,
  type ChatThread,
  type ChatThreadDetail,
  type ChatMessage,
} from '../api';

export default function Chat() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThreadDetail | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });

  // ── Load threads ──────────────────────────────────────────

  const loadThreads = useCallback(async () => {
    try {
      const t = await listThreads();
      setThreads(t);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);
  useEffect(() => { scrollToBottom(); }, [activeThread?.messages, streaming]);

  // ── New thread ────────────────────────────────────────────

  const handleNewThread = async () => {
    setActiveThread(null);
    setInput('');
    setStreaming('');
    inputRef.current?.focus();
  };

  // ── Select thread ─────────────────────────────────────────

  const handleSelectThread = async (id: string) => {
    setStreaming('');
    try {
      const t = await getThread(id);
      setActiveThread(t);
    } catch { /* ignore */ }
  };

  // ── Delete thread ─────────────────────────────────────────

  const handleDeleteThread = async (id: string) => {
    try {
      await deleteThread(id);
      if (activeThread?.id === id) setActiveThread(null);
      loadThreads();
    } catch { /* ignore */ }
  };

  // ── Feedback ─────────────────────────────────────────────

  const handleFeedback = async (msgIdx: number, rating: 'helpful' | 'unhelpful') => {
    if (!activeThread) return;
    const key = `${activeThread.id}-${msgIdx}`;
    if (feedbackGiven.has(key)) return;
    setFeedbackGiven(prev => new Set(prev).add(key));
    try {
      await submitChatFeedback(activeThread.id, msgIdx, rating);
    } catch { /* silently fail */ }
  };

  // ── Send message ──────────────────────────────────────────

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    let thread = activeThread;

    // Create thread if none active
    if (!thread) {
      try {
        thread = await createThread();
        setActiveThread(thread);
        loadThreads();
      } catch {
        return;
      }
    }

    // Optimistic user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setActiveThread({ ...thread, messages: [...thread.messages, userMsg] });

    setLoading(true);
    sendMessage(
      thread.id,
      text,
      (chunk) => setStreaming(prev => prev + chunk),
      () => {
        setLoading(false);
        // Reload thread to get the saved assistant message
        if (thread) handleSelectThread(thread.id);
        setStreaming('');
        loadThreads();
      },
      (err) => {
        setLoading(false);
        setStreaming(prev => prev + '\n\n*Error: ' + err + '*');
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E0DA] shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-[#6B6B6B] hover:text-[#722F37] transition-colors cursor-pointer text-sm"
            >
              {showSidebar ? '◁ Hide' : '▷ Show'} threads
            </button>
            <Link to="/" className="font-['Playfair_Display'] text-lg font-bold text-[#722F37]">
              AI Tutor
            </Link>
          </div>
          <Link to="/" className="text-sm text-[#6B6B6B] hover:text-[#722F37] transition-colors">
            Dashboard
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <aside className="w-64 bg-white border-r border-[#E5E0DA] flex flex-col shrink-0">
            <div className="p-3">
              <button
                onClick={handleNewThread}
                className="w-full py-2 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#8B4550] transition-colors cursor-pointer"
              >
                + New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {threads.map(t => (
                <div
                  key={t.id}
                  onClick={() => handleSelectThread(t.id)}
                  className={`px-3 py-2.5 cursor-pointer border-b border-[#E5E0DA]/50 group flex items-center justify-between ${
                    activeThread?.id === t.id ? 'bg-[#722F37]/5 border-l-2 border-l-[#722F37]' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#1A1A1A] truncate">{t.title}</p>
                    <p className="text-xs text-[#6B6B6B]">{t.messageCount} messages</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteThread(t.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[#C13838] text-xs hover:underline cursor-pointer shrink-0 ml-2"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {threads.length === 0 && (
                <p className="text-xs text-[#6B6B6B] p-3">No conversations yet.</p>
              )}
            </div>
          </aside>
        )}

        {/* Chat area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {!activeThread && !streaming && (
              <div className="text-center py-16">
                <h2 className="font-['Playfair_Display'] text-2xl font-bold text-[#1A1A1A] mb-3">
                  WSET AI Tutor
                </h2>
                <p className="text-[#6B6B6B] text-sm max-w-sm mx-auto">
                  Ask any question about wine and spirits. The tutor answers using your WSET study materials.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {[
                    'What are the main grape varieties in Bordeaux?',
                    'Explain the Champagne production method',
                    'How does climate affect wine style?',
                    'What is the difference between Sherry and Port?',
                  ].map(p => (
                    <button
                      key={p}
                      onClick={() => { setInput(p); inputRef.current?.focus(); }}
                      className="px-3 py-1.5 text-xs border border-[#E5E0DA] rounded-full text-[#6B6B6B] hover:border-[#722F37] hover:text-[#722F37] transition-colors cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeThread?.messages.map((msg, i) => (
              <div key={i} className={`mb-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div
                  className={`inline-block max-w-[80%] rounded-xl px-4 py-3 text-sm text-left ${
                    msg.role === 'user'
                      ? 'bg-[#722F37] text-white'
                      : 'bg-white border border-[#E5E0DA] text-[#1A1A1A]'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none prose-headings:text-[#722F37] prose-strong:text-[#1A1A1A] prose-li:text-[#1A1A1A]">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#E5E0DA]/30">
                      <p className="text-xs text-[#C8A951]">
                        Sources: {msg.citations.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
                {msg.role === 'assistant' && (
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => handleFeedback(i, 'helpful')}
                      disabled={feedbackGiven.has(`${activeThread?.id}-${i}`)}
                      className={`text-xs px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        feedbackGiven.has(`${activeThread?.id}-${i}`)
                          ? 'text-[#6B6B6B]'
                          : 'text-[#2D6A4F] hover:bg-[#2D6A4F]/10'
                      }`}
                      title="Helpful"
                    >
                      {feedbackGiven.has(`${activeThread?.id}-${i}`) ? '✓' : '▲'} Helpful
                    </button>
                    <button
                      onClick={() => handleFeedback(i, 'unhelpful')}
                      disabled={feedbackGiven.has(`${activeThread?.id}-${i}`)}
                      className={`text-xs px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        feedbackGiven.has(`${activeThread?.id}-${i}`)
                          ? 'text-[#6B6B6B]'
                          : 'text-[#C13838] hover:bg-[#C13838]/10'
                      }`}
                      title="Not helpful"
                    >
                      {feedbackGiven.has(`${activeThread?.id}-${i}`) ? '✓' : '▼'} Not helpful
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming response */}
            {streaming && (
              <div className="mb-4">
                <div className="inline-block max-w-[80%] rounded-xl px-4 py-3 text-sm bg-white border border-[#E5E0DA]">
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{streaming}</ReactMarkdown>
                  </div>
                  {loading && (
                    <span className="inline-block w-2 h-4 bg-[#722F37] animate-pulse ml-0.5" />
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEnd} />
          </div>

          {/* Input */}
          <div className="border-t border-[#E5E0DA] bg-white px-4 py-3">
            <div className="max-w-3xl mx-auto flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about wine, spirits, tasting, regions..."
                disabled={!!streaming}
                className="flex-1 px-4 py-2.5 border border-[#E5E0DA] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 focus:border-[#722F37] disabled:bg-gray-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || !!streaming}
                className="px-6 py-2.5 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#8B4550] disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              >
                {streaming ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
