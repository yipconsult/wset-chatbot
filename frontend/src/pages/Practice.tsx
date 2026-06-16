import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchQuestions, submitAnswer, fetchProgress, type Question, type ProgressOverview } from '../api';
import McqCard from '../components/McqCard';

const PAGE_SIZE = 25;

export default function Practice() {
  const [searchParams, setSearchParams] = useSearchParams();
  const topic = searchParams.get('topic') || '';
  const level = searchParams.get('level') || '';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressOverview | null>(null);
  const [error, setError] = useState('');

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: { limit: number; page: number; topic?: string; level?: string } = { limit: PAGE_SIZE, page: 1 };
      if (topic) params.topic = topic;
      if (level) params.level = level;
      const data = await fetchQuestions(params);
      setQuestions(data.items);
      setCurrentIdx(0);
    } catch {
      setError('Failed to load questions. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, [topic, level]);

  const loadProgress = useCallback(async () => {
    try {
      const p = await fetchProgress();
      setProgress(p);
    } catch {
      // silently ignore progress errors
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadQuestions();
    loadProgress();
  }, [loadQuestions, loadProgress]);

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  const handleAnswer = async (selectedIndex: number) => {
    const q = questions[currentIdx];
    const res = await submitAnswer(q.id, selectedIndex, 'study');
    loadProgress();
    return res;
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      loadQuestions(); // reload a fresh set
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <div className="w-8 h-8 border-2 border-[#722F37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E0DA]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="Wine Secret" className="h-8" />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/exam" className="text-[#C8A951] hover:text-[#b89a41] font-medium transition-colors">
              Exam Mode
            </Link>
            <select
              value={level}
              onChange={(e) => setFilter('level', e.target.value)}
              className="text-xs px-2 py-1 rounded border border-[#E5E0DA] bg-white text-[#4A4A4A] cursor-pointer"
            >
              <option value="">All Levels</option>
              <option value="L1">L1</option>
              <option value="L2">L2</option>
              <option value="L3">L3</option>
            </select>
            {progress && (
              <span className="text-[#6B6B6B]">
                Score: <strong>{progress.score_pct}%</strong> ({progress.correct_count}/{progress.total_answers})
              </span>
            )}
            <Link to="/" className="text-[#6B6B6B] hover:text-[#722F37] transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {(topic || level) && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
            <span className="text-[#6B6B6B]">Filters:</span>
            {topic && (
              <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-[#E5E0DA]">
                Topic: <strong className="capitalize">{topic}</strong>
                <button onClick={() => setFilter('topic', '')} className="text-[#C13838] ml-1 cursor-pointer">&times;</button>
              </span>
            )}
            {level && (
              <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-[#E5E0DA]">
                Level: <strong>{level}</strong>
                <button onClick={() => setFilter('level', '')} className="text-[#C13838] ml-1 cursor-pointer">&times;</button>
              </span>
            )}
            <button
              onClick={() => setSearchParams({})}
              className="text-[#722F37] text-xs hover:underline cursor-pointer ml-auto"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8">
        {error ? (
          <div className="text-center py-16">
            <p className="text-[#C13838] mb-4">{error}</p>
            <button
              onClick={loadQuestions}
              className="px-4 py-2 bg-[#722F37] text-white rounded-lg text-sm hover:bg-[#8B4550] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#6B6B6B]">No questions available yet.</p>
          </div>
        ) : (
          <McqCard
            key={questions[currentIdx].id}
            question={questions[currentIdx]}
            onAnswer={handleAnswer}
            onNext={handleNext}
            onPrev={handlePrev}
            hasNext={currentIdx < questions.length - 1}
            hasPrev={currentIdx > 0}
            currentIndex={currentIdx}
            total={questions.length}
          />
        )}
      </main>
    </div>
  );
}
