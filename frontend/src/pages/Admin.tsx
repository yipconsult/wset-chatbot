import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  fetchQuestions, fetchAdminReports, resolveReport,
  adminUpdateQuestion, adminExportQuestions, adminImportQuestions,
  fetchAdminAnalytics, fetchAdminChatFeedback, fetchRagStatus,
  fetchAppFeedback, dismissAppFeedback,
  type Question, type ReportedQuestion, type AdminAnalytics, type ChatFeedback, type RagStatus, type AppFeedback,
} from '../api';

type Tab = 'questions' | 'reports' | 'import-export' | 'analytics' | 'feedback';

export default function Admin() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('admin_secret'));
  const [secretInput, setSecretInput] = useState('');
  const [secretError, setSecretError] = useState('');

  const handleLogin = () => {
    // Simple local auth — store the secret for API calls
    localStorage.setItem('admin_secret', secretInput);
    setAuthed(true);
    setSecretError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_secret');
    setAuthed(false);
    setSecretInput('');
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="font-['Playfair_Display'] text-2xl font-bold text-[#722F37] text-center mb-2">
            Admin Access
          </h1>
          <p className="text-[#6B6B6B] text-center mb-6 text-sm">
            Enter the admin secret to continue.
          </p>
          {secretError && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">
              {secretError}
            </div>
          )}
          <div className="space-y-3">
            <input
              type="password"
              value={secretInput}
              onChange={e => setSecretInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Admin secret"
              className="w-full px-3 py-2.5 border border-[#E5E0DA] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
            />
            <button
              onClick={handleLogin}
              className="w-full py-3 bg-[#722F37] text-white rounded-lg text-sm font-medium hover:bg-[#8B4550] transition-colors cursor-pointer"
            >
              Unlock
            </button>
          </div>
          <div className="text-center mt-4">
            <Link to="/" className="text-sm text-[#6B6B6B] hover:underline">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="bg-white border-b border-[#E5E0DA]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-['Playfair_Display'] text-xl font-bold text-[#722F37]">
              Admin Panel
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Admin</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/" className="text-[#6B6B6B] hover:text-[#722F37] transition-colors">
              Dashboard
            </Link>
            <button onClick={handleLogout} className="text-[#C13838] hover:underline cursor-pointer">
              Lock
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <AdminTabs onLogout={handleLogout} />
      </main>
    </div>
  );
}

function AdminTabs(__props: { onLogout: () => void }) {
  void (__props as unknown);
  const [tab, setTab] = useState<Tab>('questions');

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-[#E5E0DA]">
        {(['questions', 'reports', 'import-export', 'analytics', 'feedback'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer capitalize ${
              tab === t
                ? 'border-[#722F37] text-[#722F37]'
                : 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
            }`}
          >
            {t === 'import-export' ? 'Import/Export' : t}
          </button>
        ))}
      </div>

      {tab === 'questions' && <QuestionsPanel />}
      {tab === 'reports' && <ReportsPanel />}
      {tab === 'import-export' && <ImportExportPanel />}
      {tab === 'analytics' && <AnalyticsPanel />}
      {tab === 'feedback' && <FeedbackPanel />}
    </div>
  );
}

// ── Questions Panel ─────────────────────────────────────────────

function QuestionsPanel() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Question | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchQuestions({ page, limit: 30, level: levelFilter || undefined });
      setQuestions(data.items);
      setTotal(data.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, levelFilter]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const filtered = search
    ? questions.filter(q =>
        q.text.toLowerCase().includes(search.toLowerCase()) ||
        (q.topic || '').toLowerCase().includes(search.toLowerCase())
      )
    : questions;

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search question text or topic..."
          className="flex-1 px-3 py-2 border border-[#E5E0DA] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
        />
        <select
          value={levelFilter}
          onChange={e => { setLevelFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-[#E5E0DA] rounded-lg text-sm bg-white cursor-pointer"
        >
          <option value="">All Levels</option>
          <option value="L1">L1</option>
          <option value="L2">L2</option>
          <option value="L3">L3</option>
        </select>
      </div>

      {/* Question list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#722F37] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="text-sm text-[#6B6B6B] mb-3">
            Showing {filtered.length} of {total} questions
          </div>
          <div className="space-y-2">
            {filtered.map(q => (
              <div key={q.id} className="bg-white border border-[#E5E0DA] rounded-lg p-4 flex items-start gap-4">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 shrink-0 ${
                  q.level === 'L1' ? 'bg-green-100 text-green-700' :
                  q.level === 'L3' ? 'bg-[#722F37]/10 text-[#722F37]' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {q.level}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1A1A1A] leading-relaxed line-clamp-2">
                    {q.text}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-[#6B6B6B]">
                    <span>ID: {q.id}</span>
                    <span className="capitalize">Topic: {q.topic || 'general'}</span>
                    {q.difficulty && <span className="text-green-700">{q.difficulty}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setEditing(q)}
                  className="px-3 py-1.5 text-xs font-medium text-[#722F37] border border-[#722F37]/30 rounded-md hover:bg-[#722F37]/5 cursor-pointer shrink-0"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > 30 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm border border-[#E5E0DA] rounded-md disabled:opacity-30 cursor-pointer"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-[#6B6B6B]">
                Page {page} of {Math.ceil(total / 30)}
              </span>
              <button
                disabled={page >= Math.ceil(total / 30)}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm border border-[#E5E0DA] rounded-md disabled:opacity-30 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      {editing && (
        <EditModal
          question={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setQuestions(prev => prev.map(q => q.id === updated.id ? { ...q, ...updated } : q));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ── Edit Modal ──────────────────────────────────────────────────

function EditModal({ question, onClose, onSaved }: {
  question: Question;
  onClose: () => void;
  onSaved: (q: Question) => void;
}) {
  const [text, setText] = useState(question.text);
  const [options, setOptions] = useState([...question.options]);
  const [correctIndex, setCorrectIndex] = useState<number>(
    (question as Question & { correct_index?: number }).correct_index ?? 0
  );
  const [topic, setTopic] = useState(question.topic || 'general');
  const [level, setLevel] = useState(question.level || 'L2');
  const [explanation, setExplanation] = useState((question as Question & { explanation?: string }).explanation || '');
  const [imageUrl, setImageUrl] = useState(question.image_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!text.trim() || options.some(o => !o.trim())) {
      setError('Question text and all options are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await adminUpdateQuestion(question.id, {
        text: text.trim(),
        options: options.map(o => o.trim()),
        correct_index: correctIndex,
        topic,
        level,
        explanation: explanation.trim(),
        image_url: imageUrl.trim() || undefined,
      });
      onSaved({ ...question, ...updated });
    } catch {
      setError('Failed to save. Check admin access.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-10 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-lg text-[#1A1A1A]">Edit Question #{question.id}</h3>
            <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#1A1A1A] text-xl cursor-pointer">&times;</button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Question Text</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-[#E5E0DA] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                Options (mark correct answer with radio button)
              </label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    className="cursor-pointer"
                  />
                  <span className="text-xs font-medium w-5">{String.fromCharCode(65 + i)}.</span>
                  <input
                    type="text"
                    value={opt}
                    onChange={e => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    className="flex-1 px-2 py-1.5 border border-[#E5E0DA] rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => {
                        setOptions(options.filter((_, idx) => idx !== i));
                        if (correctIndex >= i) setCorrectIndex(Math.max(0, correctIndex - 1));
                      }}
                      className="text-[#C13838] text-xs hover:underline cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button
                  onClick={() => setOptions([...options, ''])}
                  className="text-sm text-[#722F37] hover:underline cursor-pointer mt-1"
                >
                  + Add option
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E0DA] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Level</label>
                <select
                  value={level}
                  onChange={e => setLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E0DA] rounded-lg text-sm bg-white cursor-pointer"
                >
                  <option value="L1">L1</option>
                  <option value="L2">L2</option>
                  <option value="L3">L3</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Explanation</label>
              <textarea
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-[#E5E0DA] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/30 resize-y"
                placeholder="Shown to users after they answer..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                Image URL <span className="text-[#6B6B6B] font-normal">(optional — for label-the-diagram questions)</span>
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E0DA] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#722F37]/30"
                placeholder="https://example.com/wine-regions-map.png"
              />
              {imageUrl && (
                <div className="mt-2">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="max-w-full max-h-40 rounded border border-[#E5E0DA] object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#8B4550] disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reports Panel ───────────────────────────────────────────────

function ReportsPanel() {
  const [reports, setReports] = useState<ReportedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminReports();
      setReports(data.reports);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const handleResolve = async (questionId: number) => {
    setResolving(questionId);
    try {
      await resolveReport(questionId);
      setReports(prev => prev.filter(r => r.question_id !== questionId));
    } catch { /* ignore */ }
    setResolving(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#722F37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-16 text-[#6B6B6B] text-sm">
        No reported questions. All clear!
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-[#6B6B6B] mb-4">{reports.length} question(s) reported</p>
      <div className="space-y-3">
        {reports.map(r => (
          <div key={`${r.question_id}-${r.reported_at}`} className="bg-white border border-[#E5E0DA] rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-[#1A1A1A]">Q#{r.question_id}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    r.level === 'L1' ? 'bg-green-100 text-green-700' :
                    r.level === 'L3' ? 'bg-[#722F37]/10 text-[#722F37]' :
                    'bg-amber-100 text-amber-700'
                  }`}>{r.level}</span>
                  <span className="text-xs text-[#6B6B6B] capitalize">{r.topic}</span>
                </div>
                <p className="text-sm text-[#4A4A4A] line-clamp-2 mb-2">{r.question_text}</p>
                {r.note && (
                  <p className="text-xs text-[#C13838] bg-red-50 px-2 py-1 rounded">
                    Report: {r.note}
                  </p>
                )}
                <p className="text-xs text-[#6B6B6B] mt-1">
                  Reported by {r.reported_by} on {new Date(r.reported_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleResolve(r.question_id)}
                disabled={resolving === r.question_id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-[#2D6A4F] rounded-md hover:bg-[#245740] disabled:opacity-50 cursor-pointer shrink-0"
              >
                {resolving === r.question_id ? '...' : 'Resolve'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Import / Export Panel ───────────────────────────────────────

function ImportExportPanel() {
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const blob = await adminExportQuestions(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wset-questions.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setImportError('Export failed. Check admin access.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError('');
    setImportResult(null);

    try {
      const text = await file.text();
      let questions;
      try {
        questions = JSON.parse(text);
      } catch {
        setImportError('Invalid JSON file.');
        setImporting(false);
        return;
      }

      if (!Array.isArray(questions)) {
        // Maybe it's an exported object with "items" or just questions
        if (Array.isArray(questions.questions)) questions = questions.questions;
        else if (Array.isArray(questions.items)) questions = questions.items;
        else {
          setImportError('Expected a JSON array of questions.');
          setImporting(false);
          return;
        }
      }

      const result = await adminImportQuestions(questions);
      setImportResult(result);
    } catch {
      setImportError('Import failed. Check admin access and file format.');
    }
    setImporting(false);
    e.target.value = '';
  };

  return (
    <div className="space-y-8">
      {/* Export */}
      <div className="bg-white border border-[#E5E0DA] rounded-xl p-6">
        <h3 className="font-medium text-[#1A1A1A] mb-2">Export Questions</h3>
        <p className="text-sm text-[#6B6B6B] mb-4">
          Download the full question bank as JSON or CSV.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => handleExport('json')}
            className="px-4 py-2 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#8B4550] cursor-pointer"
          >
            Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="px-4 py-2 border border-[#722F37] text-[#722F37] text-sm rounded-lg hover:bg-[#722F37]/5 cursor-pointer"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="bg-white border border-[#E5E0DA] rounded-xl p-6">
        <h3 className="font-medium text-[#1A1A1A] mb-2">Import Questions</h3>
        <p className="text-sm text-[#6B6B6B] mb-4">
          Upload a JSON file of questions to add to the bank. Duplicate questions (by text match) are skipped.
        </p>

        {importError && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">
            {importError}
          </div>
        )}
        {importResult && (
          <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg border border-green-200 mb-4">
            Imported {importResult.imported} questions ({importResult.skipped} skipped). Total bank: {importResult.total}.
          </div>
        )}

        <label className="inline-block px-4 py-2 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#8B4550] cursor-pointer">
          {importing ? 'Importing...' : 'Upload JSON File'}
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            disabled={importing}
          />
        </label>
      </div>
    </div>
  );
}

// ── Analytics Panel ──────────────────────────────────────────────

function AnalyticsPanel() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [feedback, setFeedback] = useState<ChatFeedback[]>([]);
  const [ragStatus, setRagStatus] = useState<RagStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, f, r] = await Promise.all([
        fetchAdminAnalytics(),
        fetchAdminChatFeedback(),
        fetchRagStatus(),
      ]);
      setAnalytics(a);
      setFeedback(f.feedback);
      setRagStatus(r);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#722F37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!analytics || analytics.totalMessages === 0) {
    return (
      <div className="text-center py-16 text-[#6B6B6B] text-sm">
        <p className="font-medium text-[#1A1A1A] mb-2">No tutor usage data yet</p>
        <p>Analytics will appear once users start chatting with the AI Tutor.</p>
      </div>
    );
  }

  const helpfulRate = analytics.totalFeedback.helpful + analytics.totalFeedback.unhelpful > 0
    ? Math.round((analytics.totalFeedback.helpful / (analytics.totalFeedback.helpful + analytics.totalFeedback.unhelpful)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* RAG Status */}
      {ragStatus && (
        <div className={`text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-2 ${
          ragStatus.mode === 'hybrid' ? 'bg-[#2D6A4F]/10 text-[#2D6A4F]' : 'bg-[#C8A951]/10 text-[#C8A951]'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            ragStatus.mode === 'hybrid' ? 'bg-[#2D6A4F]' : 'bg-[#C8A951]'
          }`} />
          RAG: {ragStatus.mode === 'hybrid' ? 'Vector Search' : 'TF-IDF Only'}
          {ragStatus.cached && <span className="opacity-60">(cached)</span>}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5E0DA] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#722F37]">{analytics.totalThreads}</p>
          <p className="text-xs text-[#6B6B6B] mt-1">Total Threads</p>
        </div>
        <div className="bg-white border border-[#E5E0DA] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#1A1A1A]">{analytics.totalMessages}</p>
          <p className="text-xs text-[#6B6B6B] mt-1">Total Messages</p>
        </div>
        <div className="bg-white border border-[#E5E0DA] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#2D6A4F]">{helpfulRate}%</p>
          <p className="text-xs text-[#6B6B6B] mt-1">Helpful Rate</p>
        </div>
        <div className="bg-white border border-[#E5E0DA] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#C8A951]">{analytics.knowledgeGaps.length}</p>
          <p className="text-xs text-[#6B6B6B] mt-1">Knowledge Gaps</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Popular Topics bar chart */}
        <div className="bg-white border border-[#E5E0DA] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[#1A1A1A] mb-4">Popular Topics</h3>
          {analytics.popularTopics.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.popularTopics.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E0DA" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6B6B6B' }} />
                <YAxis
                  type="category"
                  dataKey="topic"
                  tick={{ fontSize: 11, fill: '#1A1A1A' }}
                  width={100}
                  className="capitalize"
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E0DA' }}
                  formatter={(value) => [value, 'Queries']}
                />
                <Bar dataKey="count" fill="#722F37" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-[#6B6B6B] text-center py-12">No topic data yet</p>
          )}
        </div>

        {/* Daily Usage */}
        <div className="bg-white border border-[#E5E0DA] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[#1A1A1A] mb-4">Daily Usage (last 30 days)</h3>
          {analytics.dailyUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.dailyUsage} margin={{ top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E0DA" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#6B6B6B' }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6B6B6B' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E0DA' }}
                />
                <Bar dataKey="messages" fill="#C8A951" radius={[4, 4, 0, 0]} name="Messages" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-[#6B6B6B] text-center py-12">No usage data yet</p>
          )}
        </div>
      </div>

      {/* Variant Performance (A/B Testing) */}
      {analytics.variantPerformance && Object.keys(analytics.variantPerformance).length > 1 && (
        <div className="bg-white border border-[#E5E0DA] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[#1A1A1A] mb-4">A/B Test: Prompt Variant Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#6B6B6B] border-b border-[#E5E0DA]">
                  <th className="pb-2 font-medium">Variant</th>
                  <th className="pb-2 font-medium">Style</th>
                  <th className="pb-2 font-medium">Messages</th>
                  <th className="pb-2 font-medium">Helpful</th>
                  <th className="pb-2 font-medium">Unhelpful</th>
                  <th className="pb-2 font-medium">Helpful Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(analytics.variantPerformance).map(([id, v]) => (
                  <tr key={id} className="border-b border-[#E5E0DA]/50 last:border-0">
                    <td className="py-2 font-medium text-[#1A1A1A]">Variant {id}</td>
                    <td className="py-2 text-[#6B6B6B]">{v.name}</td>
                    <td className="py-2">{v.messages}</td>
                    <td className="py-2 text-[#2D6A4F]">{v.helpful}</td>
                    <td className="py-2 text-[#C13838]">{v.unhelpful}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#2D6A4F] rounded-full transition-all"
                            style={{ width: `${v.helpfulRate}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#6B6B6B]">{v.helpfulRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Level Breakdown */}
      {analytics.levelBreakdown && analytics.levelBreakdown.length > 0 && (
        <div className="bg-white border border-[#E5E0DA] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[#1A1A1A] mb-4">Queries by WSET Level</h3>
          <div className="flex gap-6">
            {analytics.levelBreakdown.map((l) => {
              const total = analytics.levelBreakdown.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? Math.round((l.count / total) * 100) : 0;
              return (
                <div key={l.level} className="flex-1 text-center">
                  <p className="text-2xl font-bold text-[#722F37]">{l.count}</p>
                  <p className="text-xs text-[#6B6B6B] mt-1">Level {l.level.replace('L', '')}</p>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        l.level === 'L1' ? 'bg-green-500' :
                        l.level === 'L2' ? 'bg-amber-500' :
                        'bg-[#722F37]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#6B6B6B] mt-1">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback Summary */}
      {feedback.length > 0 && (
        <div className="bg-white border border-[#E5E0DA] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[#1A1A1A] mb-4">
            Recent Feedback ({analytics.totalFeedback.helpful} helpful, {analytics.totalFeedback.unhelpful} unhelpful)
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {feedback.slice(-20).reverse().map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm border-b border-[#E5E0DA]/50 pb-2 last:border-0">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                  f.rating === 'helpful' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {f.rating}
                </span>
                <span className="text-[#6B6B6B] truncate flex-1">{f.messagePreview}</span>
                <span className="text-xs text-[#6B6B6B] shrink-0">
                  {new Date(f.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Gaps */}
      {analytics.knowledgeGaps.length > 0 && (
        <div className="bg-white border border-[#E5E0DA] rounded-xl p-5">
          <h3 className="text-sm font-medium text-[#1A1A1A] mb-4">Knowledge Gaps</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#6B6B6B] border-b border-[#E5E0DA]">
                  <th className="pb-2 font-medium">Query</th>
                  <th className="pb-2 font-medium">Topic</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {analytics.knowledgeGaps.slice(-20).reverse().map((gap, i) => (
                  <tr key={i} className="border-b border-[#E5E0DA]/50 last:border-0">
                    <td className="py-2 pr-4 text-[#1A1A1A] max-w-xs truncate">{gap.query}</td>
                    <td className="py-2 pr-4">
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 capitalize">{gap.topic}</span>
                    </td>
                    <td className="py-2 text-[#6B6B6B] text-xs">{new Date(gap.timestamp).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── App Feedback Panel ─────────────────────────────────────────────

const FEEDBACK_LABELS: Record<string, string> = {
  bug: 'Bug',
  feedback: 'Feedback',
  opinion: 'Opinion',
};

const FEEDBACK_COLORS: Record<string, string> = {
  bug: '#C13838',
  feedback: '#722F37',
  opinion: '#C8A951',
};

function FeedbackPanel() {
  const [feedback, setFeedback] = useState<AppFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAppFeedback();
      setFeedback(data.feedback);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const handleDismiss = async (id: string) => {
    setDismissing(id);
    try {
      await dismissAppFeedback(id);
      setFeedback(prev => prev.filter(f => f.id !== id));
    } catch { /* ignore */ }
    setDismissing(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#722F37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (feedback.length === 0) {
    return (
      <div className="text-center py-16 text-[#6B6B6B] text-sm">
        No app feedback yet. Users can send feedback via the floating button on any page.
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-[#6B6B6B] mb-4">{feedback.length} feedback submission(s)</p>
      <div className="space-y-3">
        {feedback.map(f => (
          <div key={f.id} className="bg-white border border-[#E5E0DA] rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: FEEDBACK_COLORS[f.type] || '#6B6B6B' }}
                  >
                    {FEEDBACK_LABELS[f.type] || f.type}
                  </span>
                  <span className="text-xs text-[#6B6B6B]">{f.userId}</span>
                  {f.page && (
                    <span className="text-xs text-[#6B6B6B] bg-[#FAFAF8] px-1.5 py-0.5 rounded">
                      {f.page}
                    </span>
                  )}
                  <span className="text-xs text-[#6B6B6B] ml-auto">
                    {new Date(f.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-[#4A4A4A] whitespace-pre-wrap">{f.message}</p>
              </div>
              <button
                onClick={() => handleDismiss(f.id)}
                disabled={dismissing === f.id}
                className="px-3 py-1.5 text-xs font-medium text-white bg-[#2D6A4F] rounded-md hover:bg-[#245740] disabled:opacity-50 cursor-pointer shrink-0"
              >
                {dismissing === f.id ? '...' : 'Dismiss'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
