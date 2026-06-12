import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { startExam, submitExamAnswer, finishExam, type ExamSession, type ExamResult } from '../api';

type ExamState = 'config' | 'running' | 'finished';

export default function Exam() {
  const [state, setState] = useState<ExamState>('config');
  const [questionCount, setQuestionCount] = useState(25);
  const [timeMinutes, setTimeMinutes] = useState(30);
  const [examLevel, setExamLevel] = useState('');
  const [session, setSession] = useState<ExamSession | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => clearTimer, []);

  // ── Start Exam ──────────────────────────────────────────

  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      const s = await startExam({ question_count: questionCount, time_limit_minutes: timeMinutes, level: examLevel || undefined });
      setSession(s);
      setAnswers({});
      setCurrentIdx(0);
      setTimeLeft(s.time_limit_minutes * 60);
      setState('running');

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearTimer(); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setError('Failed to start exam. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  // ── Auto-finish when time runs out ──────────────────────

  useEffect(() => {
    if (state === 'running' && timeLeft === 0) {
      handleFinish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // ── Answer question ─────────────────────────────────────

  const handleSelect = async (questionId: number, selectedIndex: number) => {
    if (!session) return;
    setAnswers(prev => ({ ...prev, [questionId]: selectedIndex }));
    try {
      await submitExamAnswer(session.session_id, questionId, selectedIndex);
    } catch { /* silently fail */ }
  };

  // ── Navigation ──────────────────────────────────────────

  const goNext = () => {
    if (session && currentIdx < session.questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  // ── Finish ──────────────────────────────────────────────

  const handleFinish = async () => {
    if (!session) return;
    clearTimer();
    setLoading(true);
    try {
      const r = await finishExam(session.session_id);
      setResult(r);
      setState('finished');
    } catch {
      setError('Failed to submit exam.');
    } finally {
      setLoading(false);
    }
  };

  // ── Format time ─────────────────────────────────────────

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Config Screen ───────────────────────────────────────

  if (state === 'config') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="font-['Playfair_Display'] text-2xl font-bold text-[#722F37] text-center mb-2">
            Exam Mode
          </h1>
          <p className="text-[#6B6B6B] text-center mb-8 text-sm">
            Timed session. No hints until you finish.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl border border-[#E5E0DA] p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                Number of Questions
              </label>
              <select
                value={questionCount}
                onChange={e => setQuestionCount(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-[#E5E0DA] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
              >
                <option value={10}>10 questions</option>
                <option value={25}>25 questions</option>
                <option value={50}>50 questions</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                Time Limit
              </label>
              <select
                value={timeMinutes}
                onChange={e => setTimeMinutes(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-[#E5E0DA] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                WSET Level
              </label>
              <select
                value={examLevel}
                onChange={e => setExamLevel(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E0DA] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
              >
                <option value="">All Levels</option>
                <option value="L1">Level 1</option>
                <option value="L2">Level 2</option>
                <option value="L3">Level 3</option>
              </select>
            </div>

            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-3 bg-[#722F37] text-white rounded-lg text-sm font-medium hover:bg-[#8B4550] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? 'Preparing...' : 'Start Exam'}
            </button>
          </div>

          <div className="text-center mt-6 space-x-4">
            <Link to="/practice" className="text-sm text-[#722F37] hover:underline">
              Study Mode
            </Link>
            <Link to="/" className="text-sm text-[#6B6B6B] hover:underline">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Running Screen ──────────────────────────────────────

  if (state === 'running' && session) {
    const q = session.questions[currentIdx];
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        {/* Timer bar */}
        <header className="bg-white border-b border-[#E5E0DA] sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[#6B6B6B]">
              {currentIdx + 1} / {session.questions.length}
            </span>
            <span className={`font-mono font-bold text-lg ${timeLeft < 60 ? 'text-[#C13838]' : 'text-[#1A1A1A]'}`}>
              {formatTime(timeLeft)}
            </span>
            <span className="text-sm text-[#6B6B6B]">
              {answeredCount} answered
            </span>
          </div>
          <div className="h-0.5 bg-[#E5E0DA]">
            <div
              className="h-full bg-[#722F37] transition-all duration-300"
              style={{ width: `${((currentIdx + 1) / session.questions.length) * 100}%` }}
            />
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          {/* Question */}
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E0DA] p-6">
            <h2 className="text-lg font-medium text-[#1A1A1A] mb-6 leading-relaxed">
              {q.text}
            </h2>

            {q.image_url && (
              <div className="mb-6">
                <img
                  src={q.image_url}
                  alt="Question diagram"
                  className="max-w-full max-h-80 rounded-lg border border-[#E5E0DA] object-contain"
                  loading="lazy"
                />
              </div>
            )}

            <div className="space-y-3 mb-6">
              {q.options.map((option, index) => {
                const isSelected = answers[q.id] === index;
                return (
                  <button
                    key={index}
                    onClick={() => handleSelect(q.id, index)}
                    className={`w-full text-left px-4 py-3.5 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#722F37] bg-[#722F37]/10'
                        : 'border-[#E5E0DA] hover:border-[#C8A951]'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-current text-xs font-medium mr-3">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <button
                onClick={goPrev}
                disabled={currentIdx === 0}
                className="px-4 py-2 text-sm text-[#6B6B6B] hover:text-[#722F37] disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
              >
                ← Previous
              </button>

              <span className="text-xs text-[#C8A951] bg-[#C8A951]/10 px-2 py-1 rounded">
                Answer hidden until exam ends
              </span>

              {currentIdx < session.questions.length - 1 ? (
                <button
                  onClick={goNext}
                  className="px-6 py-2 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#8B4550] transition-colors cursor-pointer"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={loading}
                  className="px-6 py-2 bg-[#C8A951] text-white text-sm rounded-lg hover:bg-[#b89a41] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {loading ? 'Submitting...' : 'Finish Exam'}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Results Screen ──────────────────────────────────────

  if (state === 'finished' && result) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        <header className="bg-white border-b border-[#E5E0DA]">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="font-['Playfair_Display'] text-xl font-bold text-[#722F37]">
              Exam Results
            </h1>
            <Link to="/" className="text-sm text-[#6B6B6B] hover:text-[#722F37] transition-colors">
              Dashboard
            </Link>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          {/* Score card */}
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E0DA] p-8 text-center mb-8">
            <div className={`text-5xl font-bold mb-3 ${result.score_pct >= 55 ? 'text-[#2D6A4F]' : 'text-[#C13838]'}`}>
              {result.score_pct}%
            </div>
            <p className="text-[#6B6B6B] mb-4">
              {result.correct} correct / {result.answered} answered
              {result.skipped > 0 && ` (${result.skipped} skipped)`}
            </p>

            <div className="flex justify-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#2D6A4F]">{result.correct}</p>
                <p className="text-[#6B6B6B]">Correct</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#C13838]">{result.incorrect}</p>
                <p className="text-[#6B6B6B]">Incorrect</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#C8A951]">{result.skipped}</p>
                <p className="text-[#6B6B6B]">Skipped</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-center">
              <Link
                to="/exam"
                className="px-6 py-2 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#8B4550] transition-colors"
              >
                New Exam
              </Link>
              <Link
                to="/"
                className="px-6 py-2 border border-[#E5E0DA] text-[#1A1A1A] text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>

          {/* Per-question review */}
          <h2 className="font-['Playfair_Display'] text-xl font-bold text-[#1A1A1A] mb-4">
            Question Review
          </h2>

          <div className="space-y-4">
            {result.results.map((r, i) => (
              <div
                key={r.question_id}
                className={`bg-white rounded-xl border p-5 ${
                  r.is_correct
                    ? 'border-[#2D6A4F]/30'
                    : r.answered
                      ? 'border-[#C13838]/30'
                      : 'border-[#C8A951]/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 mt-0.5 ${
                      r.is_correct
                        ? 'bg-[#2D6A4F] text-white'
                        : r.answered
                          ? 'bg-[#C13838] text-white'
                          : 'bg-[#C8A951] text-white'
                    }`}
                  >
                    {r.is_correct ? '✓' : r.answered ? '✗' : '—'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1A1A1A]">
                      {i + 1}. {r.question_text}
                    </p>
                    {r.image_url && (
                      <img
                        src={r.image_url}
                        alt="Question diagram"
                        className="max-w-full max-h-32 rounded border border-[#E5E0DA] object-contain mt-2 mb-2"
                        loading="lazy"
                      />
                    )}
                    {!r.answered && (
                      <p className="text-xs text-[#C8A951] mt-1">Skipped</p>
                    )}
                    {r.answered && !r.is_correct && (
                      <p className="text-xs text-[#C13838] mt-1">
                        You chose: {r.options[r.selected_index]}
                      </p>
                    )}
                    <p className="text-xs text-[#2D6A4F] mt-1">
                      Correct: {r.correct_answer}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return null;
}
