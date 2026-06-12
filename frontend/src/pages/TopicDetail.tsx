import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchTopicDetail, type TopicDetail as TopicDetailType } from '../api';
import ReactMarkdown from 'react-markdown';

const MASTERY_COLORS: Record<string, string> = {
  beginner: '#C13838',
  developing: '#C8A951',
  proficient: '#2D6A4F',
  mastered: '#722F37',
};

export default function TopicDetail() {
  const { topicId } = useParams<{ topicId: string }>();
  const [topic, setTopic] = useState<TopicDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!topicId) return;
    fetchTopicDetail(topicId)
      .then(setTopic)
      .catch(() => setError('Failed to load topic details.'))
      .finally(() => setLoading(false));
  }, [topicId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <div className="w-8 h-8 border-2 border-[#722F37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAF8] gap-4">
        <p className="text-[#C13838] text-sm">{error || 'Topic not found.'}</p>
        <Link to="/syllabus" className="text-sm text-[#722F37] hover:underline">
          Back to Syllabus
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="bg-white border-b border-[#E5E0DA]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/syllabus" className="text-[#6B6B6B] hover:text-[#722F37] transition-colors text-sm">
              ← Syllabus
            </Link>
            <h1 className="font-['Playfair_Display'] text-xl font-bold text-[#722F37] capitalize">
              {topic.title}
            </h1>
          </div>
          <Link to="/" className="text-sm text-[#6B6B6B] hover:text-[#722F37] transition-colors">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Stats card */}
        <div className="bg-white rounded-xl border border-[#E5E0DA] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-[#6B6B6B]">
                {topic.question_count} questions · {topic.questions_answered} answered
              </p>
            </div>
            <span
              className="text-sm font-medium px-3 py-1 rounded-full capitalize"
              style={{
                color: MASTERY_COLORS[topic.mastery],
                backgroundColor: MASTERY_COLORS[topic.mastery] + '15',
              }}
            >
              {topic.mastery}
            </span>
          </div>

          {topic.questions_answered > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-[#6B6B6B] mb-1">
                <span>Progress</span>
                <span>{topic.score_pct}%</span>
              </div>
              <div className="h-2 bg-[#E5E0DA] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${topic.score_pct}%`,
                    backgroundColor: MASTERY_COLORS[topic.mastery],
                  }}
                />
              </div>
            </div>
          )}

          <Link
            to={`/practice?topic=${topic.topic}`}
            className="inline-block px-6 py-2.5 bg-[#722F37] text-white rounded-lg text-sm font-medium hover:bg-[#8B4550] transition-colors"
          >
            Practise This Topic
          </Link>
        </div>

        {/* Key Facts */}
        {topic.key_facts.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E5E0DA] p-6">
            <h2 className="font-medium text-[#1A1A1A] mb-4">Key Facts</h2>
            <div className="space-y-4">
              {topic.key_facts.map((fact, i) => (
                <div key={i} className="prose prose-sm max-w-none text-[#1A1A1A]">
                  <ReactMarkdown>{fact}</ReactMarkdown>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#6B6B6B] mt-4">
              Sourced from WSET study materials
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
