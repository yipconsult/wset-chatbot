import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchReviewQuestions, submitAnswer, type Question, type ReviewStats } from '../api';
import McqCard from '../components/McqCard';

const PAGE_SIZE = 25;

export default function Review() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReviewStats>({ due: 0, new: 0 });
  const [error, setError] = useState('');

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchReviewQuestions(PAGE_SIZE);
      setQuestions(data.questions);
      setStats(data.stats);
      setCurrentIdx(0);
    } catch {
      setError('Failed to load review questions. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleAnswer = async (selectedIndex: number) => {
    const q = questions[currentIdx];
    return submitAnswer(q.id, selectedIndex, 'study');
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      loadQuestions(); // reload fresh set
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const question = questions[currentIdx];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <div className="w-8 h-8 border-2 border-[#722F37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="bg-white border-b border-[#E5E0DA]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="Wine Secret" className="h-8" />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[#6B6B6B]">
              Review Queue — {stats.due} due, {stats.new} new
            </span>
            <Link to="/" className="text-[#6B6B6B] hover:text-[#722F37] transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

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
            <h2 className="font-['Playfair_Display'] text-2xl font-bold text-[#1A1A1A] mb-3">
              All caught up!
            </h2>
            <p className="text-[#6B6B6B] text-sm max-w-sm mx-auto mb-6">
              No questions due for review. Keep practising in study mode to build your review queue.
            </p>
            <Link
              to="/practice"
              className="inline-block px-6 py-2 bg-[#722F37] text-white rounded-lg text-sm hover:bg-[#8B4550] transition-colors"
            >
              Study Mode
            </Link>
          </div>
        ) : (
          <McqCard
            key={question.id}
            question={question}
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
