import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { submitAppFeedback } from '../api';

const TYPES = [
  { value: 'bug', label: 'Bug', color: '#C13838' },
  { value: 'feedback', label: 'Feedback', color: '#722F37' },
  { value: 'opinion', label: 'Opinion', color: '#C8A951' },
] as const;

export default function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('feedback');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await submitAppFeedback({ type, message: message.trim(), page: location.pathname });
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setMessage('');
        setType('feedback');
      }, 2000);
    } catch {
      setError('Failed to send. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-[#722F37] text-white rounded-full shadow-lg hover:bg-[#8B4550] transition-colors flex items-center justify-center cursor-pointer"
        title="Send feedback"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl border border-[#E5E0DA] w-full max-w-md p-6">
            {done ? (
              <div className="text-center py-8">
                <p className="text-[#2D6A4F] text-lg font-medium">Thanks for your feedback!</p>
                <p className="text-[#6B6B6B] text-sm mt-1">We'll look into it.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-medium text-[#1A1A1A]">Send Feedback</h3>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-[#6B6B6B] hover:text-[#1A1A1A] cursor-pointer text-lg leading-none"
                  >
                    &times;
                  </button>
                </div>

                {/* Type selector */}
                <div className="flex gap-2 mb-4">
                  {TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                        type === t.value
                          ? 'text-white border-transparent'
                          : 'text-[#6B6B6B] border-[#E5E0DA] hover:border-[#C8A951]'
                      }`}
                      style={type === t.value ? { backgroundColor: t.color } : {}}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Message */}
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe the bug, share your feedback, or tell us what you think..."
                  className="w-full h-32 px-3 py-2.5 border border-[#E5E0DA] rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
                  autoFocus
                />

                {error && <p className="text-[#C13838] text-xs mt-2">{error}</p>}

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || submitting}
                    className="px-5 py-2 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#8B4550] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {submitting ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
