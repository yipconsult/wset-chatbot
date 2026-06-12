import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
  fetchProgress,
  fetchTopics,
  fetchReviewQuestions,
  type ProgressOverview,
  type TopicProgress,
  type ReviewStats,
} from '../api';

const MASTERY_COLORS: Record<string, string> = {
  beginner: '#C13838',
  developing: '#C8A951',
  proficient: '#2D6A4F',
  mastered: '#722F37',
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ProgressOverview | null>(null);
  const [topics, setTopics] = useState<TopicProgress[]>([]);
  const [weakAreas, setWeakAreas] = useState<string[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);

  useEffect(() => {
    fetchProgress().then(setProgress).catch(() => {});
    fetchTopics().then(t => {
      setTopics(t.topics);
      setWeakAreas(t.weak_areas);
    }).catch(() => {});
    fetchReviewQuestions().then(r => setReviewStats(r.stats)).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="bg-white border-b border-[#E5E0DA]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-['Playfair_Display'] text-xl font-bold text-[#722F37]">
            WSET Chatbot
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#6B6B6B]">
              {user?.email} · Level {user?.wset_level}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-[#6B6B6B] hover:text-[#722F37] transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <h2 className="font-['Playfair_Display'] text-3xl font-bold text-[#1A1A1A] mb-3">
            Welcome to your wine studies
          </h2>
          <p className="text-[#6B6B6B] max-w-md mx-auto mb-6">
            Practise WSET multiple-choice questions with instant feedback.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/practice"
              className="inline-block px-8 py-3 bg-[#722F37] text-white rounded-lg text-sm font-medium hover:bg-[#8B4550] transition-colors"
            >
              Study Mode
            </Link>
            <Link
              to="/exam"
              className="inline-block px-8 py-3 border-2 border-[#722F37] text-[#722F37] rounded-lg text-sm font-medium hover:bg-[#722F37]/5 transition-colors"
            >
              Exam Mode
            </Link>
            <Link
              to="/chat"
              className="inline-block px-8 py-3 border-2 border-[#C8A951] text-[#C8A951] rounded-lg text-sm font-medium hover:bg-[#C8A951]/5 transition-colors"
            >
              AI Tutor
            </Link>
            <Link
              to="/syllabus"
              className="inline-block px-8 py-3 border-2 border-[#6B6B6B] text-[#6B6B6B] rounded-lg text-sm font-medium hover:border-[#722F37] hover:text-[#722F37] transition-colors"
            >
              Syllabus
            </Link>
            <Link
              to="/admin"
              className="inline-block px-8 py-3 border-2 border-[#C13838] text-[#C13838] rounded-lg text-sm font-medium hover:bg-[#C13838]/5 transition-colors"
            >
              Admin
            </Link>
            {reviewStats && reviewStats.due > 0 && (
              <Link
                to="/review"
                className="inline-block px-8 py-3 bg-[#C13838] text-white rounded-lg text-sm font-medium hover:bg-[#D45050] transition-colors"
              >
                Review Due ({reviewStats.due})
              </Link>
            )}
          </div>
        </div>

        {/* Progress stats */}
        {progress && progress.total_answers > 0 && (
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
            <div className="bg-white rounded-xl border border-[#E5E0DA] p-4 text-center">
              <p className="text-2xl font-bold text-[#722F37]">{progress.score_pct}%</p>
              <p className="text-xs text-[#6B6B6B] mt-1">Score</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E0DA] p-4 text-center">
              <p className="text-2xl font-bold text-[#1A1A1A]">{progress.questions_answered}</p>
              <p className="text-xs text-[#6B6B6B] mt-1">Questions</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E0DA] p-4 text-center">
              <p className="text-2xl font-bold text-[#1A1A1A]">{progress.total_answers}</p>
              <p className="text-xs text-[#6B6B6B] mt-1">Attempts</p>
            </div>
          </div>
        )}

        {progress && progress.total_answers > 0 && (
          <div className="max-w-lg mx-auto bg-white rounded-xl border border-[#E5E0DA] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#2D6A4F] font-medium">{progress.correct_count} correct</span>
              <span className="text-[#C13838] font-medium">{progress.incorrect_count} incorrect</span>
            </div>
            <div className="mt-2 h-2 bg-[#E5E0DA] rounded-full overflow-hidden flex">
              <div
                className="h-full bg-[#2D6A4F] transition-all duration-500"
                style={{ width: `${progress.score_pct}%` }}
              />
              <div
                className="h-full bg-[#C13838] transition-all duration-500"
                style={{ width: `${100 - progress.score_pct}%` }}
              />
            </div>
          </div>
        )}

        {progress && progress.total_answers === 0 && (
          <p className="text-center text-sm text-[#6B6B6B]">
            You haven't answered any questions yet. Start practising to see your progress.
          </p>
        )}

        {/* Weak areas alert */}
        {weakAreas.length > 0 && (
          <div className="max-w-lg mx-auto mb-6 bg-[#FFF5F5] border border-[#C13838]/20 rounded-xl p-4">
            <p className="text-sm font-medium text-[#C13838] mb-2">Focus areas</p>
            <div className="flex flex-wrap gap-2">
              {weakAreas.map(topic => (
                <Link
                  key={topic}
                  to={`/practice?topic=${topic}`}
                  className="px-3 py-1 text-xs bg-white border border-[#C13838]/30 rounded-full text-[#C13838] hover:bg-[#C13838]/5 transition-colors capitalize"
                >
                  {topic}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Topic breakdown */}
        {topics.filter(t => t.questions_answered > 0).length > 0 && (
          <div className="max-w-lg mx-auto mb-8">
            <h3 className="text-sm font-medium text-[#1A1A1A] mb-3">Topic Progress</h3>
            <div className="space-y-2">
              {topics.filter(t => t.questions_answered > 0).map(t => (
                <Link
                  key={t.topic}
                  to={`/practice?topic=${t.topic}`}
                  className="block bg-white rounded-lg border border-[#E5E0DA] p-3 hover:border-[#722F37]/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-[#1A1A1A] capitalize">{t.topic}</span>
                    <span className="text-xs font-medium" style={{ color: MASTERY_COLORS[t.mastery] }}>
                      {t.score_pct}% · {t.mastery}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#E5E0DA] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${t.score_pct}%`,
                        backgroundColor: MASTERY_COLORS[t.mastery],
                      }}
                    />
                  </div>
                  <p className="text-xs text-[#6B6B6B] mt-1">
                    {t.questions_answered}/{t.total_questions} questions
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
