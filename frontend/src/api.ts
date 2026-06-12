import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;

// ── Admin API ──────────────────────────────────────────────

function adminHeaders(): Record<string, string> {
  return { 'x-admin-secret': localStorage.getItem('admin_secret') || '' };
}

export interface ReportedQuestion {
  question_id: number;
  question_text: string;
  topic: string;
  level: string;
  note: string;
  reported_by: string;
  reported_at: string;
}

export interface AdminReportsResponse {
  reports: ReportedQuestion[];
  total: number;
}

export async function fetchAdminReports(): Promise<AdminReportsResponse> {
  const { data } = await api.get('/admin/reports', { headers: adminHeaders() });
  return data;
}

export async function resolveReport(questionId: number): Promise<void> {
  await api.post(`/admin/reports/${questionId}/resolve`, null, { headers: adminHeaders() });
}

export async function adminUpdateQuestion(id: number, updates: Partial<Question & { correct_index: number; explanation: string }>): Promise<Question> {
  const { data } = await api.put(`/admin/questions/${id}`, updates, { headers: adminHeaders() });
  return data.question;
}

export async function adminExportQuestions(format: 'json' | 'csv' = 'json'): Promise<Blob> {
  const resp = await fetch(`${api.defaults.baseURL}/admin/questions/export?format=${format}`, {
    headers: { ...adminHeaders() },
  });
  return resp.blob();
}

export async function adminImportQuestions(newQuestions: Partial<Question & { correct_index: number }>[]): Promise<{ imported: number; skipped: number; total: number }> {
  const { data } = await api.post('/admin/questions/import', { questions: newQuestions }, { headers: adminHeaders() });
  return data;
}

// ── MCQ API ──────────────────────────────────────────────

export interface Question {
  id: number;
  text: string;
  options: string[];
  topic: string;
  difficulty: string;
  level: string;
  image_url?: string;
}

export interface QuestionListResponse {
  items: Question[];
  total: number;
  page: number;
  pages: number;
}

export interface AnswerResponse {
  is_correct: boolean;
  correct_index: number;
  explanation: string;
  correct_answer_text: string;
}

export interface ProgressOverview {
  total_questions: number;
  questions_answered: number;
  total_answers: number;
  correct_count: number;
  incorrect_count: number;
  score_pct: number;
  weak_areas: string[];
}

export interface TopicProgress {
  topic: string;
  total_questions: number;
  questions_answered: number;
  correct_count: number;
  incorrect_count: number;
  score_pct: number;
  mastery: string;
}

export interface TopicsResponse {
  topics: TopicProgress[];
  weak_areas: string[];
}

export interface ReviewStats {
  due: number;
  new: number;
}

export async function fetchQuestions(params?: {
  topic?: string;
  difficulty?: string;
  level?: string;
  page?: number;
  limit?: number;
}): Promise<QuestionListResponse> {
  const { data } = await api.get('/questions', { params });
  return data;
}

export async function fetchQuestion(id: number): Promise<Question> {
  const { data } = await api.get(`/questions/${id}`);
  return data;
}

export async function submitAnswer(
  id: number,
  selectedIndex: number,
  mode: 'study' | 'exam' = 'study',
): Promise<AnswerResponse> {
  const { data } = await api.post(`/questions/${id}/answer`, {
    selected_index: selectedIndex,
    mode,
  });
  return data;
}

export async function fetchProgress(): Promise<ProgressOverview> {
  const { data } = await api.get('/progress/overview');
  return data;
}

export async function fetchTopics(): Promise<TopicsResponse> {
  const { data } = await api.get('/progress/topics');
  return data;
}

export async function fetchReviewQuestions(limit?: number): Promise<{
  questions: Question[];
  stats: ReviewStats;
}> {
  const { data } = await api.get('/questions/review', { params: { limit } });
  return data;
}

// ── Syllabus API ───────────────────────────────────────────

export interface SyllabusSubsection {
  id: string;
  title: string;
  question_count: number;
  questions_answered: number;
  score_pct: number;
  mastery: string;
}

export interface SyllabusSection {
  id: string;
  title: string;
  subsections: SyllabusSubsection[];
}

export interface SyllabusResponse {
  sections: SyllabusSection[];
}

export interface TopicDetail {
  topic: string;
  title: string;
  question_count: number;
  questions_answered: number;
  score_pct: number;
  mastery: string;
  key_facts: string[];
}

export async function fetchSyllabus(): Promise<SyllabusResponse> {
  const { data } = await api.get('/syllabus');
  return data;
}

export async function fetchTopicDetail(topicId: string): Promise<TopicDetail> {
  const { data } = await api.get(`/topics/${topicId}`);
  return data;
}

export async function reportQuestion(questionId: number, note?: string): Promise<void> {
  await api.post(`/questions/${questionId}/report`, { note });
}

// ── Exam API ──────────────────────────────────────────────

export interface ExamSession {
  session_id: string;
  questions: Question[];
  total: number;
  time_limit_minutes: number;
  started_at: string;
}

export interface ExamResult {
  session_id: string;
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  skipped: number;
  score_pct: number;
  time_limit_minutes: number;
  started_at: string;
  finished_at: string;
  results: {
    question_id: number;
    question_text: string;
    options: string[];
    selected_index: number;
    correct_index: number;
    is_correct: boolean;
    correct_answer: string;
    answered: boolean;
    image_url?: string;
  }[];
}

export async function startExam(config: {
  question_count?: number;
  time_limit_minutes?: number;
  level?: string;
}): Promise<ExamSession> {
  const { data } = await api.post('/exam/start', config);
  return data;
}

export async function submitExamAnswer(
  sessionId: string,
  questionId: number,
  selectedIndex: number,
): Promise<void> {
  await api.post(`/exam/${sessionId}/answer`, {
    question_id: questionId,
    selected_index: selectedIndex,
  });
}

export async function finishExam(sessionId: string): Promise<ExamResult> {
  const { data } = await api.post(`/exam/${sessionId}/finish`);
  return data;
}

// ── Chat API ──────────────────────────────────────────────

export interface ChatThread {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: string[];
  createdAt: string;
}

export interface ChatThreadDetail extends ChatThread {
  userId: string;
  messages: ChatMessage[];
}

export async function createThread(title?: string): Promise<ChatThreadDetail> {
  const { data } = await api.post('/chat/threads', { title });
  return data;
}

export async function listThreads(): Promise<ChatThread[]> {
  const { data } = await api.get('/chat/threads');
  return data;
}

export async function getThread(id: string): Promise<ChatThreadDetail> {
  const { data } = await api.get(`/chat/threads/${id}`);
  return data;
}

export async function deleteThread(id: string): Promise<void> {
  await api.delete(`/chat/threads/${id}`);
}

export interface ChatFeedback {
  threadId: string;
  messageIndex: number;
  userId: string;
  rating: 'helpful' | 'unhelpful';
  note: string;
  timestamp: string;
  messagePreview?: string;
}

export interface AdminAnalytics {
  totalThreads: number;
  totalMessages: number;
  totalFeedback: { helpful: number; unhelpful: number };
  popularTopics: { topic: string; count: number }[];
  knowledgeGaps: { query: string; topic: string; timestamp: string }[];
  dailyUsage: { date: string; messages: number; users: number }[];
  variantPerformance: Record<string, {
    name: string;
    messages: number;
    helpful: number;
    unhelpful: number;
    helpfulRate: number;
  }>;
  levelBreakdown: { level: string; count: number }[];
}

export async function submitChatFeedback(
  threadId: string,
  messageIndex: number,
  rating: 'helpful' | 'unhelpful',
  note?: string,
): Promise<void> {
  await api.post(`/chat/threads/${threadId}/messages/${messageIndex}/feedback`, { rating, note });
}

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const { data } = await api.get('/admin/analytics', { headers: adminHeaders() });
  return data;
}

export async function fetchAdminChatFeedback(): Promise<{ feedback: ChatFeedback[]; total: number }> {
  const { data } = await api.get('/admin/chat-feedback', { headers: adminHeaders() });
  return data;
}

export interface RagStatus {
  mode: 'hybrid' | 'tfidf-only';
  embeddingsReady: boolean;
  dimensions: number;
  cached: boolean;
  cachedAt?: string;
}

export async function fetchRagStatus(): Promise<RagStatus> {
  const { data } = await api.get('/admin/rag-status', { headers: adminHeaders() });
  return data;
}

export function sendMessage(
  threadId: string,
  content: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): AbortController {
  const controller = new AbortController();
  const token = localStorage.getItem('access_token');

  fetch(`${api.defaults.baseURL}/chat/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Request failed' }));
        onError(err.detail || 'Request failed');
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) { onDone(); return; }
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') { onDone(); return; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) onChunk(parsed.content);
            if (parsed.error) onError(parsed.error);
          } catch { /* skip */ }
        }
      }
      onDone();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onError(err.message);
    });

  return controller;
}
