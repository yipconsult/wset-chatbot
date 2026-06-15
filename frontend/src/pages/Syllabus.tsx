import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchSyllabus, type SyllabusSection } from '../api';

const MASTERY_COLORS: Record<string, string> = {
  beginner: '#C13838',
  developing: '#C8A951',
  proficient: '#2D6A4F',
  mastered: '#722F37',
};

export default function Syllabus() {
  const [sections, setSections] = useState<SyllabusSection[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchSyllabus()
      .then(r => { setSections(r.sections); })
      .catch(() => setError('Failed to load syllabus.'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
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
      <header className="bg-white border-b border-[#E5E0DA]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="Wine Secret" className="h-8" />
          </Link>
          <Link to="/" className="text-sm text-[#6B6B6B] hover:text-[#722F37] transition-colors">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="font-['Playfair_Display'] text-2xl font-bold text-[#1A1A1A] mb-2">
          WSET Level 2 Syllabus
        </h2>
        <p className="text-[#6B6B6B] text-sm mb-8">
          Browse topics and tap to practise. Track your mastery across the curriculum.
        </p>

        {error && <p className="text-[#C13838] text-sm mb-4">{error}</p>}

        <div className="space-y-2">
          {sections.map(section => (
            <div key={section.id} className="bg-white rounded-xl border border-[#E5E0DA] overflow-hidden">
              <button
                onClick={() => toggle(section.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer text-left"
              >
                <span className="font-medium text-[#1A1A1A]">{section.title}</span>
                <span className="text-[#6B6B6B] text-sm">
                  {expanded.has(section.id) ? '▾' : '▸'}
                </span>
              </button>

              {expanded.has(section.id) && (
                <div className="border-t border-[#E5E0DA] divide-y divide-[#E5E0DA]/50">
                  {section.subsections.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => navigate(`/topic/${sub.id}`)}
                      className="w-full px-5 py-3 flex items-center justify-between hover:bg-[#FAFAF8] transition-colors cursor-pointer text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#1A1A1A] capitalize">{sub.title}</p>
                        <p className="text-xs text-[#6B6B6B]">
                          {sub.question_count} questions
                          {sub.questions_answered > 0 && ` · ${sub.questions_answered} answered`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {sub.questions_answered > 0 && (
                          <div className="w-16">
                            <div className="h-1.5 bg-[#E5E0DA] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${sub.score_pct}%`,
                                  backgroundColor: MASTERY_COLORS[sub.mastery],
                                }}
                              />
                            </div>
                          </div>
                        )}
                        <span
                          className="text-xs font-medium min-w-[4.5rem] text-right"
                          style={{ color: MASTERY_COLORS[sub.mastery] }}
                        >
                          {sub.questions_answered > 0 ? `${sub.score_pct}%` : 'New'}
                        </span>
                        <span className="text-[#6B6B6B] text-sm">→</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
