const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const rag = require('./rag');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8000;
const PRODUCTION = process.env.NODE_ENV === 'production';

// Serve built frontend in production
if (PRODUCTION) {
  const frontendDist = path.join(__dirname, 'frontend', 'dist');
  app.use(express.static(frontendDist));
  // SPA fallback: serve index.html for any non-API route
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── Load questions ──────────────────────────────────────────────
let questions = [];
function loadQuestionBanks() {
  const { detectTopic } = require('./rag');
  const banks = [
    { file: 'questions-wset1.json', level: 'L1' },
    { file: 'questions-wset2.json', level: 'L2' },
    { file: 'questions-wset2-exam.json', level: 'L2' },
    { file: 'questions-wset3.json', level: 'L3' },
  ];

  let totalLoaded = 0;
  let totalTagged = 0;
  for (const { file, level } of banks) {
    try {
      const qs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'processed', file), 'utf-8'));
      qs.forEach(q => {
        // Ensure level and difficulty are set
        if (!q.level) q.level = level;
        if (!q.difficulty) q.difficulty = level;
        // Auto-tag questions without a topic
        if (!q.topic || q.topic === 'general') {
          q.topic = detectTopic(q.text);
          if (q.topic !== 'general') totalTagged++;
        }
      });
      questions.push(...qs);
      totalLoaded += qs.length;
      console.log(`  Loaded ${qs.length} questions from ${file}`);
    } catch (e) {
      console.log(`  Skipping ${file}: ${e.message}`);
    }
  }
  console.log(`Loaded ${totalLoaded} questions total (${totalTagged} auto-tagged)`);
}
loadQuestionBanks();

// ── In-memory stores ────────────────────────────────────────────
const users = new Map();
const userAnswers = new Map(); // userId -> [{questionId, selectedIndex, isCorrect, timestamp}]
const examSessions = new Map(); // sessionId -> {userId, questions, answers, startedAt, timeLimitMin, finished}
const reviewState = new Map(); // userId -> Map(questionId -> {interval, repetitions, easeFactor, nextReviewAt, lastAnswerAt})
const chatFeedback = []; // [{ threadId, messageIndex, userId, rating, note, timestamp }]
const appFeedback = []; // [{ id, userId, type, message, page, timestamp }]
const tutorAnalytics = {
  totalMessages: 0,
  totalThreads: 0,
  topicCounts: new Map(),       // topic -> count of queries
  dailyUsers: new Map(),        // date -> Set of userIds
  dailyMessages: new Map(),     // date -> count of messages
  knowledgeGaps: [],            // [{ query, topic, timestamp }]
  variantCounts: new Map(),     // variant -> count of messages
  variantFeedback: new Map(),   // variant -> { helpful, unhelpful }
  levelCounts: new Map(),       // level (L1/L2/L3) -> count of queries
};

// ── Helpers ──────────────────────────────────────────────────────

function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const userId = token.replace('tok-', '');
  return [...users.values()].find(u => u.id === userId) || null;
}

function requireUser(req, res) {
  const user = getUser(req);
  if (!user) { res.status(401).json({ detail: 'Invalid token' }); return null; }
  return user;
}

function updateReviewState(userId, questionId, isCorrect) {
  if (!reviewState.has(userId)) reviewState.set(userId, new Map());
  const userSR = reviewState.get(userId);
  const prev = userSR.get(questionId);

  let interval, repetitions, easeFactor;
  if (isCorrect) {
    if (!prev) {
      repetitions = 1;
      interval = 1;
      easeFactor = 2.5;
    } else {
      repetitions = prev.repetitions + 1;
      easeFactor = prev.easeFactor;
      if (repetitions === 1) {
        interval = 1;
      } else if (repetitions === 2) {
        interval = 6;
      } else {
        interval = Math.round(prev.interval * easeFactor);
      }
    }
  } else {
    repetitions = 0;
    interval = 1;
    easeFactor = prev ? Math.max(1.3, prev.easeFactor - 0.2) : 2.5;
  }

  const now = new Date();
  const nextReviewAt = new Date(now.getTime() + interval * 86400000).toISOString();

  userSR.set(questionId, {
    interval,
    repetitions,
    easeFactor,
    nextReviewAt,
    lastAnswerAt: now.toISOString(),
  });
}

// ── Auth endpoints ──────────────────────────────────────────────

app.post('/api/auth/register', (req, res) => {
  const { email, password, wset_level } = req.body;
  if (users.has(email)) {
    return res.status(409).json({ detail: 'A user with this email already exists' });
  }
  const user = {
    id: 'user-' + Date.now(),
    email,
    password_hash: 'hashed-' + password,
    wset_level: wset_level || 'L2',
    created_at: new Date().toISOString(),
  };
  users.set(email, user);
  userAnswers.set(user.id, []);
  return res.status(201).json({
    access_token: 'tok-' + user.id,
    refresh_token: 'ref-' + user.id,
    token_type: 'bearer',
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);
  if (!user) {
    return res.status(401).json({ detail: 'Invalid email or password' });
  }
  return res.json({
    access_token: 'tok-' + user.id,
    refresh_token: 'ref-' + user.id,
    token_type: 'bearer',
  });
});

app.get('/api/auth/me', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  return res.json({
    id: user.id,
    email: user.email,
    wset_level: user.wset_level,
    created_at: user.created_at,
  });
});

// ── MCQ endpoints ───────────────────────────────────────────────

// GET /api/questions — list with optional topic/difficulty/level filter, pagination
app.get('/api/questions', (req, res) => {
  let result = [...questions];
  const { topic, difficulty, level, page, limit } = req.query;

  if (topic) {
    result = result.filter(q => (q.topic || '').toLowerCase().includes(topic.toLowerCase()));
  }
  if (difficulty) {
    result = result.filter(q => q.difficulty === difficulty);
  }
  if (level) {
    result = result.filter(q => q.level === level);
  }

  const total = result.length;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 25;
  const offset = (pageNum - 1) * limitNum;

  res.json({
    items: result.slice(offset, offset + limitNum).map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      topic: q.topic || 'general',
      difficulty: q.difficulty || 'L2',
      level: q.level || 'L2',
      image_url: q.image_url || undefined,
    })),
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
  });
});

// GET /api/questions/review — spaced repetition review queue (before :id to avoid route conflict)
app.get('/api/questions/review', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const limit = parseInt(req.query.limit) || 25;
  const userSR = reviewState.get(user.id) || new Map();
  const answered = userAnswers.get(user.id) || [];
  const answeredIds = new Set(answered.map(a => a.questionId));
  const now = new Date().toISOString();

  // Tier 1: Questions overdue for review (nextReviewAt <= now)
  const due = [];
  const later = [];
  userSR.forEach((sr, qId) => {
    const q = questions.find(q => q.id === qId);
    if (!q) return;
    if (sr.nextReviewAt <= now) due.push(q);
    else later.push(q);
  });

  // Tier 2: Questions answered incorrectly at least once, not due yet
  const wrongNotDue = [];
  const wrongIds = new Set(
    answered.filter(a => !a.isCorrect).map(a => a.questionId)
  );
  later.forEach(q => {
    if (wrongIds.has(q.id)) wrongNotDue.push(q);
  });

  // Tier 3: Unanswered questions
  const unseen = questions.filter(q => !answeredIds.has(q.id));

  // Build result: due first, then wrong, then new. Deduplicate & limit.
  const seen = new Set();
  const result = [];
  const add = (qs) => {
    for (const q of qs) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      result.push(q);
      if (result.length >= limit) return;
    }
  };
  add(due);
  add(wrongNotDue);
  add(unseen);

  res.json({
    questions: result.slice(0, limit).map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      topic: q.topic || 'general',
      difficulty: q.difficulty || 'L2',
      level: q.level || 'L2',
      image_url: q.image_url || undefined,
    })),
    stats: {
      due: due.length,
      new: unseen.length,
    },
  });
});

// GET /api/questions/:id
app.get('/api/questions/:id', (req, res) => {
  const q = questions.find(q => q.id === parseInt(req.params.id));
  if (!q) return res.status(404).json({ detail: 'Question not found' });
  res.json({
    id: q.id,
    text: q.text,
    options: q.options,
    topic: q.topic || 'general',
    difficulty: q.difficulty || 'L2',
    level: q.level || 'L2',
    image_url: q.image_url || undefined,
  });
});

// POST /api/questions/:id/answer
app.post('/api/questions/:id/answer', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const q = questions.find(q => q.id === parseInt(req.params.id));
  if (!q) return res.status(404).json({ detail: 'Question not found' });

  const { selected_index } = req.body;
  const isCorrect = selected_index === q.correct_index;

  // Store answer
  const record = {
    questionId: q.id,
    selectedIndex: selected_index,
    isCorrect,
    timestamp: new Date().toISOString(),
    mode: req.body.mode || 'study',
  };
  if (!userAnswers.has(user.id)) userAnswers.set(user.id, []);
  userAnswers.get(user.id).push(record);
  updateReviewState(user.id, q.id, isCorrect);

  res.json({
    is_correct: isCorrect,
    correct_index: q.correct_index,
    explanation: q.explanation || `${q.options[q.correct_index]} is the correct answer.`,
    correct_answer_text: q.options[q.correct_index],
  });
});

// GET /api/progress/overview
app.get('/api/progress/overview', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const answers = userAnswers.get(user.id) || [];
  const correct = answers.filter(a => a.isCorrect).length;
  const totalAnswered = answers.length;
  const uniqueQuestions = new Set(answers.map(a => a.questionId)).size;

  // Per-topic weak areas
  const topicMap = new Map(); // topic -> {correct, incorrect}
  const latestByQuestion = new Map(); // questionId -> isCorrect (latest attempt)
  answers.forEach(a => { latestByQuestion.set(a.questionId, a.isCorrect); });
  latestByQuestion.forEach((isCorrect, qId) => {
    const q = questions.find(q => q.id === qId);
    const topic = q?.topic || 'general';
    if (!topicMap.has(topic)) topicMap.set(topic, { correct: 0, incorrect: 0, count: 0 });
    const t = topicMap.get(topic);
    t.count++;
    if (isCorrect) t.correct++; else t.incorrect++;
  });
  const weakAreas = [...topicMap.entries()]
    .filter(([_, t]) => t.count >= 3)
    .map(([topic, t]) => ({ topic, score_pct: Math.round((t.correct / t.count) * 100) }))
    .filter(t => t.score_pct < 60)
    .map(t => t.topic);

  res.json({
    total_questions: questions.length,
    questions_answered: uniqueQuestions,
    total_answers: totalAnswered,
    correct_count: correct,
    incorrect_count: totalAnswered - correct,
    score_pct: totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0,
    weak_areas: weakAreas,
  });
});

// GET /api/progress/topics — per-topic breakdown
app.get('/api/progress/topics', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const answers = userAnswers.get(user.id) || [];
  const latestByQuestion = new Map();
  answers.forEach(a => { latestByQuestion.set(a.questionId, a.isCorrect); });

  // Count total questions per topic in the bank
  const topicBankCount = new Map();
  questions.forEach(q => {
    const topic = q.topic || 'general';
    topicBankCount.set(topic, (topicBankCount.get(topic) || 0) + 1);
  });

  // Aggregate per-topic from latest answers
  const topicMap = new Map(); // topic -> {correct, incorrect, count}
  latestByQuestion.forEach((isCorrect, qId) => {
    const q = questions.find(q => q.id === qId);
    const topic = q?.topic || 'general';
    if (!topicMap.has(topic)) topicMap.set(topic, { correct: 0, incorrect: 0, count: 0 });
    const t = topicMap.get(topic);
    t.count++;
    if (isCorrect) t.correct++; else t.incorrect++;
  });

  const topics = [...topicBankCount.entries()].map(([topic, total]) => {
    const stats = topicMap.get(topic) || { correct: 0, incorrect: 0, count: 0 };
    const scorePct = stats.count > 0 ? Math.round((stats.correct / stats.count) * 100) : 0;
    let mastery = 'beginner';
    if (scorePct >= 95) mastery = 'mastered';
    else if (scorePct >= 80) mastery = 'proficient';
    else if (scorePct >= 60) mastery = 'developing';
    return {
      topic,
      total_questions: total,
      questions_answered: stats.count,
      correct_count: stats.correct,
      incorrect_count: stats.incorrect,
      score_pct: scorePct,
      mastery,
    };
  }).sort((a, b) => b.total_questions - a.total_questions);

  const weakAreas = topics.filter(t => t.questions_answered >= 3 && t.score_pct < 60).map(t => t.topic);

  res.json({ topics, weak_areas: weakAreas });
});

// ── Syllabus endpoints ───────────────────────────────────────────

const SYLLABUS_TREE = [
  {
    id: 'tasting-pairing',
    title: 'Tasting & Food Pairing',
    topics: ['tasting', 'pairing', 'storage', 'service'],
  },
  {
    id: 'white-grapes',
    title: 'White Grape Varieties',
    topics: ['chardonnay', 'sauvignon blanc', 'riesling', 'pinot grigio'],
  },
  {
    id: 'black-grapes',
    title: 'Black Grape Varieties',
    topics: ['cabernet sauvignon', 'merlot', 'pinot noir', 'syrah'],
  },
  {
    id: 'france',
    title: 'France',
    topics: ['bordeaux', 'burgundy', 'champagne', 'france'],
  },
  {
    id: 'italy-spain-portugal',
    title: 'Italy, Spain & Portugal',
    topics: ['italy', 'spain', 'port', 'sherry'],
  },
  {
    id: 'other-old-world',
    title: 'Other Old World',
    topics: ['germany'],
  },
  {
    id: 'new-world',
    title: 'New World',
    topics: ['australia', 'new zealand', 'usa', 'chile', 'argentina', 'south africa'],
  },
  {
    id: 'sparkling',
    title: 'Sparkling Wines',
    topics: ['sparkling'],
  },
  {
    id: 'fortified',
    title: 'Fortified Wines',
    topics: ['fortified'],
  },
  {
    id: 'spirits',
    title: 'Spirits',
    topics: ['whisky', 'brandy', 'cognac', 'spirits'],
  },
  {
    id: 'general',
    title: 'General Wine Knowledge',
    topics: ['general'],
  },
];

const reportedQuestions = []; // [{questionId, userId, note, timestamp}]

// GET /api/syllabus — full topic tree with per-topic stats
app.get('/api/syllabus', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const answers = userAnswers.get(user.id) || [];
  const latestByQuestion = new Map();
  answers.forEach(a => { latestByQuestion.set(a.questionId, a.isCorrect); });

  // Per-topic stats from latest answers
  const topicStats = new Map();
  latestByQuestion.forEach((isCorrect, qId) => {
    const q = questions.find(q => q.id === qId);
    const topic = q?.topic || 'general';
    if (!topicStats.has(topic)) topicStats.set(topic, { correct: 0, incorrect: 0, count: 0 });
    const t = topicStats.get(topic);
    t.count++;
    if (isCorrect) t.correct++; else t.incorrect++;
  });

  // Count questions per topic in bank
  const topicBankCount = new Map();
  questions.forEach(q => {
    const topic = q.topic || 'general';
    topicBankCount.set(topic, (topicBankCount.get(topic) || 0) + 1);
  });

  const sections = SYLLABUS_TREE.map(section => {
    const subsections = section.topics.map(topic => {
      const stats = topicStats.get(topic);
      const questionCount = topicBankCount.get(topic) || 0;
      const scorePct = stats && stats.count > 0 ? Math.round((stats.correct / stats.count) * 100) : 0;
      let mastery = 'beginner';
      if (scorePct >= 95) mastery = 'mastered';
      else if (scorePct >= 80) mastery = 'proficient';
      else if (scorePct >= 60) mastery = 'developing';
      return {
        id: topic,
        title: topic.charAt(0).toUpperCase() + topic.slice(1),
        question_count: questionCount,
        questions_answered: stats ? stats.count : 0,
        score_pct: scorePct,
        mastery,
      };
    }).filter(s => s.question_count > 0);

    return { id: section.id, title: section.title, subsections };
  }).filter(s => s.subsections.length > 0);

  res.json({ sections });
});

// GET /api/topics/:id — topic detail with key facts from knowledge base
app.get('/api/topics/:id', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const topic = req.params.id;
  const topicQuestions = questions.filter(q => (q.topic || 'general') === topic);
  if (topicQuestions.length === 0) {
    return res.status(404).json({ detail: 'Topic not found' });
  }

  // Key facts from knowledge base
  const relevantChunks = await rag.searchChunks(topic, 3);
  const keyFacts = relevantChunks.map(c => c.content.substring(0, 300));

  // User stats for this topic
  const answers = userAnswers.get(user.id) || [];
  const latestByQuestion = new Map();
  answers.forEach(a => { latestByQuestion.set(a.questionId, a.isCorrect); });
  let correct = 0, count = 0;
  topicQuestions.forEach(q => {
    const isCorrect = latestByQuestion.get(q.id);
    if (isCorrect !== undefined) {
      count++;
      if (isCorrect) correct++;
    }
  });
  const scorePct = count > 0 ? Math.round((correct / count) * 100) : 0;
  let mastery = 'beginner';
  if (scorePct >= 95) mastery = 'mastered';
  else if (scorePct >= 80) mastery = 'proficient';
  else if (scorePct >= 60) mastery = 'developing';

  res.json({
    topic,
    title: topic.charAt(0).toUpperCase() + topic.slice(1),
    question_count: topicQuestions.length,
    questions_answered: count,
    score_pct: scorePct,
    mastery,
    key_facts: keyFacts,
  });
});

// ── Report endpoint ──────────────────────────────────────────────

// POST /api/questions/:id/report
app.post('/api/questions/:id/report', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const qId = parseInt(req.params.id);
  const q = questions.find(q => q.id === qId);
  if (!q) return res.status(404).json({ detail: 'Question not found' });

  reportedQuestions.push({
    questionId: qId,
    userId: user.id,
    note: req.body.note || '',
    timestamp: new Date().toISOString(),
  });
  console.log(`Reported question #${qId} by ${user.id}: ${req.body.note || '(no note)'}`);
  res.json({ reported: true });
});

// ── App feedback ──────────────────────────────────────────────────

// POST /api/feedback — users submit bugs/feedback/opinions
app.post('/api/feedback', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const { type, message, page } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ detail: 'Message is required' });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  appFeedback.push({
    id,
    userId: user.id,
    type: type || 'feedback',
    message: message.trim(),
    page: page || '',
    timestamp: new Date().toISOString(),
  });
  console.log(`App feedback [${type}] from ${user.id}: ${message.substring(0, 80)}`);
  res.json({ submitted: true, id });
});

// ── Exam Mode endpoints ──────────────────────────────────────────

// POST /api/exam/start
app.post('/api/exam/start', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const { question_count = 25, time_limit_minutes = 30, level } = req.body;

  // Filter by level if specified, then shuffle
  let pool = [...questions];
  if (level) {
    pool = pool.filter(q => q.level === level);
  }
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(question_count, pool.length));

  const sessionId = 'exam-' + Date.now();
  examSessions.set(sessionId, {
    id: sessionId,
    userId: user.id,
    questions: selected.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      image_url: q.image_url || undefined,
    })),
    answers: {}, // questionId -> selectedIndex
    startedAt: new Date().toISOString(),
    timeLimitMinutes: time_limit_minutes,
    finished: false,
  });

  res.json({
    session_id: sessionId,
    questions: selected.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      image_url: q.image_url || undefined,
    })),
    total: selected.length,
    time_limit_minutes,
    started_at: examSessions.get(sessionId).startedAt,
  });
});

// POST /api/exam/:sessionId/answer
app.post('/api/exam/:sessionId/answer', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const session = examSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ detail: 'Exam session not found' });
  if (session.userId !== user.id) return res.status(403).json({ detail: 'Not your session' });
  if (session.finished) return res.status(400).json({ detail: 'Exam already finished' });

  const { question_id, selected_index } = req.body;
  session.answers[question_id] = selected_index;

  res.json({ recorded: true });
});

// POST /api/exam/:sessionId/finish
app.post('/api/exam/:sessionId/finish', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const session = examSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ detail: 'Exam session not found' });
  if (session.userId !== user.id) return res.status(403).json({ detail: 'Not your session' });
  if (session.finished) return res.status(400).json({ detail: 'Exam already finished' });

  session.finished = true;

  // Grade each question
  const results = session.questions.map(q => {
    const selectedIndex = session.answers[q.id];
    const answered = selectedIndex !== undefined;
    const fullQ = questions.find(fq => fq.id === q.id);
    const isCorrect = answered && selectedIndex === fullQ.correct_index;

    // Record in userAnswers history
    const record = {
      questionId: q.id,
      selectedIndex: selectedIndex ?? -1,
      isCorrect: isCorrect ?? false,
      timestamp: new Date().toISOString(),
      mode: 'exam',
      sessionId: session.id,
    };
    if (!userAnswers.has(user.id)) userAnswers.set(user.id, []);
    userAnswers.get(user.id).push(record);
    updateReviewState(user.id, q.id, isCorrect ?? false);

    return {
      question_id: q.id,
      question_text: q.text,
      options: q.options,
      selected_index: selectedIndex ?? -1,
      correct_index: fullQ.correct_index,
      is_correct: isCorrect,
      correct_answer: fullQ.options[fullQ.correct_index],
      answered,
      image_url: q.image_url || undefined,
    };
  });

  const correct = results.filter(r => r.is_correct).length;
  const answered = results.filter(r => r.answered).length;

  res.json({
    session_id: session.id,
    total: results.length,
    answered,
    correct,
    incorrect: answered - correct,
    skipped: results.length - answered,
    score_pct: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    time_limit_minutes: session.timeLimitMinutes,
    started_at: session.startedAt,
    finished_at: new Date().toISOString(),
    results,
  });
});

// ── Chat / AI Tutor endpoints ────────────────────────────────────

const chatThreads = new Map();

app.post('/api/chat/threads', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const threadId = 'thread-' + Date.now();
  const thread = {
    id: threadId,
    userId: user.id,
    title: req.body.title || 'New chat',
    messages: [],
    promptVariant: rag.assignPromptVariant(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  chatThreads.set(threadId, thread);
  tutorAnalytics.totalThreads++;
  res.status(201).json(thread);
});

app.get('/api/chat/threads', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const threads = [...chatThreads.values()]
    .filter(t => t.userId === user.id)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(t => ({
      id: t.id,
      title: t.title,
      messageCount: t.messages.length,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  res.json(threads);
});

app.get('/api/chat/threads/:id', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const thread = chatThreads.get(req.params.id);
  if (!thread) return res.status(404).json({ detail: 'Thread not found' });
  if (thread.userId !== user.id) return res.status(403).json({ detail: 'Not your thread' });

  res.json(thread);
});

app.post('/api/chat/threads/:id/messages', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const thread = chatThreads.get(req.params.id);
  if (!thread) return res.status(404).json({ detail: 'Thread not found' });
  if (thread.userId !== user.id) return res.status(403).json({ detail: 'Not your thread' });

  const { content } = req.body;
  if (!content) return res.status(400).json({ detail: 'Message content required' });

  thread.messages.push({
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  });

  // ── Tutor analytics: track topic & usage ────────────────────
  tutorAnalytics.totalMessages++;
  const today = new Date().toISOString().slice(0, 10);
  if (!tutorAnalytics.dailyUsers.has(today)) tutorAnalytics.dailyUsers.set(today, new Set());
  tutorAnalytics.dailyUsers.get(today).add(user.id);
  tutorAnalytics.dailyMessages.set(today, (tutorAnalytics.dailyMessages.get(today) || 0) + 1);
  const queryTopics = rag.detectTopics(content);
  queryTopics.forEach(t => {
    tutorAnalytics.topicCounts.set(t, (tutorAnalytics.topicCounts.get(t) || 0) + 1);
  });
  const queryLevel = rag.detectQueryLevel(content);
  const variant = thread.promptVariant || 'A';
  tutorAnalytics.variantCounts.set(variant, (tutorAnalytics.variantCounts.get(variant) || 0) + 1);
  if (queryLevel) {
    tutorAnalytics.levelCounts.set(queryLevel, (tutorAnalytics.levelCounts.get(queryLevel) || 0) + 1);
  }
  if (!tutorAnalytics.variantFeedback.has(variant)) {
    tutorAnalytics.variantFeedback.set(variant, { helpful: 0, unhelpful: 0 });
  }

  if (thread.title === 'New chat' && thread.messages.length === 1) {
    thread.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
  }

  const relevantChunks = await rag.searchChunks(content, 5, queryLevel);
  const systemMsg = {
    role: 'system',
    content: rag.buildPrompt(content, relevantChunks, thread.promptVariant, queryLevel),
  };

  const history = thread.messages.slice(-10).map(m => ({
    role: m.role,
    content: m.content,
  }));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullResponse = '';
  const originalWrite = res.write.bind(res);
  res.write = function (chunk) {
    const str = chunk.toString();
    const match = str.match(/"content":"([^"]*)"/);
    if (match) fullResponse += match[1];
    return originalWrite(chunk);
  };

  await rag.streamChat([systemMsg, ...history], res);

  if (fullResponse) {
    thread.messages.push({
      role: 'assistant',
      content: fullResponse,
      citations: [...new Set(relevantChunks.map(c => c.source))],
      createdAt: new Date().toISOString(),
    });

    // Track knowledge gaps
    if (rag.isKnowledgeGapResponse(fullResponse)) {
      tutorAnalytics.knowledgeGaps.push({
        query: content,
        topic: queryTopics[0] || 'general',
        timestamp: new Date().toISOString(),
      });
    }
  }
  thread.updatedAt = new Date().toISOString();
});

app.delete('/api/chat/threads/:id', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const thread = chatThreads.get(req.params.id);
  if (!thread) return res.status(404).json({ detail: 'Thread not found' });
  if (thread.userId !== user.id) return res.status(403).json({ detail: 'Not your thread' });

  chatThreads.delete(req.params.id);
  res.status(204).send();
});

// POST /api/chat/threads/:id/messages/:messageIndex/feedback
app.post('/api/chat/threads/:id/messages/:messageIndex/feedback', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const thread = chatThreads.get(req.params.id);
  if (!thread) return res.status(404).json({ detail: 'Thread not found' });
  if (thread.userId !== user.id) return res.status(403).json({ detail: 'Not your thread' });

  const msgIdx = parseInt(req.params.messageIndex);
  if (isNaN(msgIdx) || msgIdx < 0 || msgIdx >= thread.messages.length) {
    return res.status(400).json({ detail: 'Invalid message index' });
  }
  if (thread.messages[msgIdx].role !== 'assistant') {
    return res.status(400).json({ detail: 'Can only rate assistant messages' });
  }

  const { rating, note } = req.body;
  if (!rating || !['helpful', 'unhelpful'].includes(rating)) {
    return res.status(400).json({ detail: 'Rating must be "helpful" or "unhelpful"' });
  }

  chatFeedback.push({
    threadId: req.params.id,
    messageIndex: msgIdx,
    userId: user.id,
    rating,
    note: note || '',
    timestamp: new Date().toISOString(),
  });

  // Track variant feedback for A/B testing
  const variant = thread.promptVariant || 'A';
  if (!tutorAnalytics.variantFeedback.has(variant)) {
    tutorAnalytics.variantFeedback.set(variant, { helpful: 0, unhelpful: 0 });
  }
  const vf = tutorAnalytics.variantFeedback.get(variant);
  if (rating === 'helpful') vf.helpful++;
  else vf.unhelpful++;

  res.status(201).json({ detail: 'Feedback recorded' });
});

// GET /api/admin/analytics — tutor usage stats
app.get('/api/admin/analytics', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const popularTopics = [...tutorAnalytics.topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([topic, count]) => ({ topic, count }));

  const dailyUsage = [...tutorAnalytics.dailyMessages.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, messages]) => ({
      date,
      messages,
      users: tutorAnalytics.dailyUsers.get(date)?.size || 0,
    }));

  const totalFeedback = { helpful: 0, unhelpful: 0 };
  chatFeedback.forEach(f => {
    totalFeedback[f.rating === 'helpful' ? 'helpful' : 'unhelpful']++;
  });

  // Variant performance
  const variantPerformance = {};
  for (const [variant, count] of tutorAnalytics.variantCounts) {
    const fb = tutorAnalytics.variantFeedback.get(variant) || { helpful: 0, unhelpful: 0 };
    const total = fb.helpful + fb.unhelpful;
    variantPerformance[variant] = {
      name: (rag.PROMPT_VARIANTS[variant] || {}).name || variant,
      messages: count,
      helpful: fb.helpful,
      unhelpful: fb.unhelpful,
      helpfulRate: total > 0 ? Math.round((fb.helpful / total) * 100) : 0,
    };
  }

  // Level breakdown
  const levelBreakdown = [...tutorAnalytics.levelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([level, count]) => ({ level, count }));

  res.json({
    totalThreads: tutorAnalytics.totalThreads,
    totalMessages: tutorAnalytics.totalMessages,
    totalFeedback,
    popularTopics,
    knowledgeGaps: tutorAnalytics.knowledgeGaps.slice(-50),
    dailyUsage,
    variantPerformance,
    levelBreakdown,
  });
});

// GET /api/admin/chat-feedback — all chat feedback
app.get('/api/admin/chat-feedback', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const feedback = chatFeedback.map(f => {
    const thread = chatThreads.get(f.threadId);
    const msgContent = thread?.messages[f.messageIndex]?.content?.substring(0, 100) || '(deleted)';
    return {
      ...f,
      messagePreview: msgContent,
    };
  });

  res.json({ feedback, total: feedback.length });
});

// GET /api/admin/rag-status — embedding/vector search status
app.get('/api/admin/rag-status', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const ready = rag.embeddingsReady();
  const status = {
    mode: ready ? 'hybrid' : 'tfidf-only',
    embeddingsReady: ready,
    dimensions: rag.EMBEDDING_DIM || 2048,
  };

  // Try to read cache info
  try {
    const fs = require('fs');
    const path = require('path');
    const cacheFile = path.join(__dirname, 'data', 'processed', 'embedding-cache.json');
    if (fs.existsSync(cacheFile)) {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      status.cachedAt = cache.builtAt;
      status.cached = true;
    } else {
      status.cached = false;
    }
  } catch { status.cached = false; }

  res.json(status);
});

// GET /health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Admin endpoints ─────────────────────────────────────────────

const ADMIN_SECRET = process.env.ADMIN_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'wset-admin');

function requireAdmin(req, res) {
  const secret = req.headers['x-admin-secret'];
  if (secret !== ADMIN_SECRET) {
    res.status(403).json({ detail: 'Admin access required' });
    return false;
  }
  return true;
}

// GET /api/admin/reports — list all reported questions
app.get('/api/admin/reports', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const reports = reportedQuestions.map(r => {
    const q = questions.find(q => q.id === r.questionId);
    return {
      question_id: r.questionId,
      question_text: q ? q.text.substring(0, 120) : '(deleted)',
      topic: q?.topic || 'unknown',
      level: q?.level || 'unknown',
      note: r.note,
      reported_by: r.userId,
      reported_at: r.timestamp,
    };
  });

  res.json({ reports, total: reports.length });
});

// POST /api/admin/reports/:questionId/resolve — clear reports for a question
app.post('/api/admin/reports/:questionId/resolve', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const qId = parseInt(req.params.questionId);
  const idx = reportedQuestions.findIndex(r => r.questionId === qId);
  if (idx < 0) return res.status(404).json({ detail: 'No reports for this question' });

  // Remove all reports for this question
  for (let i = reportedQuestions.length - 1; i >= 0; i--) {
    if (reportedQuestions[i].questionId === qId) reportedQuestions.splice(i, 1);
  }
  res.json({ resolved: true });
});

// GET /api/admin/app-feedback — list all app feedback
app.get('/api/admin/app-feedback', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const list = [...appFeedback].reverse(); // newest first
  res.json({ feedback: list, total: list.length });
});

// DELETE /api/admin/app-feedback/:id — dismiss a feedback entry
app.delete('/api/admin/app-feedback/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const idx = appFeedback.findIndex(f => f.id === req.params.id);
  if (idx < 0) return res.status(404).json({ detail: 'Feedback not found' });

  appFeedback.splice(idx, 1);
  res.json({ dismissed: true });
});

// PUT /api/admin/questions/:id — edit a question
app.put('/api/admin/questions/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const q = questions.find(q => q.id === parseInt(req.params.id));
  if (!q) return res.status(404).json({ detail: 'Question not found' });

  const { text, options, correct_index, topic, difficulty, level, explanation, image_url } = req.body;
  if (text !== undefined) q.text = text;
  if (options !== undefined) q.options = options;
  if (correct_index !== undefined) q.correct_index = correct_index;
  if (topic !== undefined) q.topic = topic;
  if (difficulty !== undefined) q.difficulty = difficulty;
  if (level !== undefined) q.level = level;
  if (explanation !== undefined) q.explanation = explanation;
  if (image_url !== undefined) q.image_url = image_url;

  res.json({ updated: true, question: q });
});

// GET /api/admin/questions/export — download all questions
app.get('/api/admin/questions/export', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const format = req.query.format || 'json';
  if (format === 'csv') {
    const header = 'id,text,options,correct_index,topic,difficulty,level,explanation,image_url\n';
    const rows = questions.map(q => {
      const opts = JSON.stringify(q.options).replace(/"/g, '""');
      const text = q.text.replace(/"/g, '""');
      const expl = (q.explanation || '').replace(/"/g, '""');
      const img = (q.image_url || '').replace(/"/g, '""');
      return `${q.id},"${text}","${opts}",${q.correct_index},${q.topic},${q.difficulty},${q.level},"${expl}","${img}"`;
    }).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=wset-questions.csv');
    res.send(header + rows);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=wset-questions.json');
    res.json(questions);
  }
});

// POST /api/admin/questions/import — bulk import questions from JSON
app.post('/api/admin/questions/import', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { questions: newQuestions } = req.body;
  if (!Array.isArray(newQuestions) || newQuestions.length === 0) {
    return res.status(400).json({ detail: 'Expected { questions: [...] } array' });
  }

  let imported = 0;
  let skipped = 0;
  const maxId = questions.reduce((max, q) => Math.max(max, q.id), 0);

  for (const q of newQuestions) {
    if (!q.text || !Array.isArray(q.options) || q.correct_index === undefined) {
      skipped++;
      continue;
    }
    // Check for duplicate by text
    const dup = questions.find(existing =>
      existing.text.replace(/\s+/g, ' ').toLowerCase() === q.text.replace(/\s+/g, ' ').toLowerCase()
    );
    if (dup) {
      skipped++;
      continue;
    }
    questions.push({
      id: q.id || (maxId + imported + 1),
      text: q.text,
      options: q.options,
      correct_index: q.correct_index,
      correct_letter: q.correct_letter || String.fromCharCode(97 + q.correct_index),
      topic: q.topic || 'general',
      difficulty: q.difficulty || 'L2',
      level: q.level || 'L2',
      explanation: q.explanation || '',
      image_url: q.image_url || undefined,
    });
    imported++;
  }

  res.json({ imported, skipped, total: questions.length });
});

// ── Start ───────────────────────────────────────────────────────

// Start server immediately so Render's port scan doesn't time out.
// Embeddings load in the background — search falls back to TF-IDF until ready.
app.listen(PORT, () => {
  console.log(`WSET API running at http://localhost:${PORT}`);
  console.log(`  ${questions.length} questions loaded`);
  // Generate embeddings in background after port is open
  rag.initRag().then(() => {
    console.log('RAG embeddings ready — hybrid search enabled');
  });
});
