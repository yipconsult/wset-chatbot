import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join('data', 'processed');

// ── WSET3 Parser ──────────────────────────────────────────────────

function parseWset3() {
  const text = fs.readFileSync(path.join(DATA_DIR, 'WSET3 Exam Paper 2526.txt'), 'utf-8');
  const questions = [];

  // Split by Q<number>.
  const blocks = text.split(/\n(?=Q\d+\.\s)/);
  for (const block of blocks) {
    const qMatch = block.match(/^Q(\d+)\.\s+(.+?)(?:\n\s*A\))/s);
    if (!qMatch) continue;

    const id = parseInt(qMatch[1]);
    const questionText = qMatch[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Extract options A-D
    const options = [];
    const optRegex = /^\s*([A-D])\)\s+(.+?)(?=\n\s*[A-D]\)|\nAnswer:|\n\s*$)/gms;
    let optMatch;
    const optBlock = block.match(/((?:\s*[A-D]\).+)+)/s);
    if (optBlock) {
      const optLines = optBlock[1].split(/\n(?=\s*[A-D]\))/);
      for (const line of optLines) {
        const m = line.match(/^\s*([A-D])\)\s+(.+)/s);
        if (m) {
          let optText = m[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
          // Strip leaked Answer/Solution text from last option
          optText = optText.replace(/\s*Answer:.*$/, '').replace(/\s*Solution:.*$/, '').trim();
          options.push(optText);
        }
      }
    }

    if (options.length < 2) continue;

    // Extract answer
    const ansMatch = block.match(/Answer:\s*([A-D])\)\s*(.+?)(?:\n\s*Solution:|\n\s*$)/s);
    if (!ansMatch) continue;

    const correctLetter = ansMatch[1];
    const correctIndex = correctLetter.charCodeAt(0) - 65;

    // Extract solution/explanation
    const solMatch = block.match(/Solution:\s*(.+?)(?:\n\s*Q\d+\.|$)/s);
    const explanation = solMatch ? solMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : '';

    questions.push({
      id: 300 + id, // offset to avoid collision with WSET2 questions (1-241)
      text: questionText,
      options,
      correct_index: correctIndex,
      correct_letter: correctLetter,
      topic: 'general',
      difficulty: 'L3',
      level: 'L3',
      explanation,
    });
  }

  console.log(`  Parsed ${questions.length} WSET3 questions`);
  return questions;
}

// ── WSET1 Parser ──────────────────────────────────────────────────

function parseWset1() {
  const text = fs.readFileSync(path.join(DATA_DIR, 'WSET1 Q&A-full.txt'), 'utf-8');

  // Clean: remove page markers, website references
  let cleaned = text.replace(/--- Page \d+ ---/g, ' ');
  cleaned = cleaned.replace(/www\.finevintageltd\.com/gi, '');
  cleaned = cleaned.replace(/FINE VINTAGE[^\n]*/gi, '');

  // Collapse all newlines and normalize whitespace
  cleaned = cleaned.replace(/\n+/g, ' ').replace(/\s+/g, ' ');

  // Split at answer key
  const answerKeyMatch = cleaned.match(/LEVEL 1 PRACTICE EXAM\s*[-–]\s*ANSWER KEY/i);
  if (!answerKeyMatch) {
    console.log('  ERROR: Could not find answer key marker');
    return [];
  }

  const questionSection = cleaned.substring(0, answerKeyMatch.index);
  const answerSection = cleaned.substring(answerKeyMatch.index);

  // ── Step 1: Parse answer section ──────────────────────────────
  // Answer format: "N.   question text   L.   answer text" (L may have space before period)
  const answerMap = new Map(); // questionNum -> { index, letter }
  const ansRegex = /(\d{1,3})\.\s+(.+?)\s+([a-d])\s*\.\s+(.+?)(?=\s+\d{1,3}\.\s+|\s+[A-Z][a-z]+\s[A-Z][a-z]|$)/g;
  let ansMatch;
  while ((ansMatch = ansRegex.exec(answerSection)) !== null) {
    const qNum = parseInt(ansMatch[1]);
    if (qNum < 1 || qNum > 100) continue;
    const letter = ansMatch[3].toLowerCase();
    if (!answerMap.has(qNum)) {
      answerMap.set(qNum, { index: letter.charCodeAt(0) - 97, letter });
    }
  }

  console.log(`  Found ${answerMap.size} answers in answer key`);

  // ── Step 2: Parse question section ────────────────────────────
  // Match: N.   question text   a.   optA   b.   optB   [c.   optC]   [d.   optD]
  // Sub-items in question text (1. Acid, 2. Sugar, etc.) are captured as part of text
  const qRegex = /(\d{1,3})\.\s+(.+?)\s+a\s*\.\s+(.+?)\s+b\s*\.\s+(.+?)(?:\s+c\s*\.\s+(.+?))?(?:\s+d\s*\.\s+(.+?))?(?=\s+\d{1,3}\.\s+|$)/g;

  const topicHeaders = [
    'What is Wine?', 'Growing Grapes', 'Making Wines', 'Types and Styles of Wine',
    'Principal Grape Varieties', 'Principle Grape Varieties', 'Examples of Wines',
    'Storage and Service of Wine', 'An Introduction to Tasting', 'Pairing Wine and Food',
  ];

  // Map: questionNum -> topic (by scanning topic positions in questionSection)
  const questionTopic = new Map();
  // Track topic headers and their character positions in the text.
  // Only match headers followed by a question number (skip TOC entries with dots).
  const topicPositions = [];
  for (const topic of topicHeaders) {
    const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    // Match topic header followed by a question number like "11." or "1."
    const re = new RegExp(escaped + '\\s+\\d+\\.\\s', 'i');
    const m = questionSection.match(re);
    if (m) {
      topicPositions.push({ topic, index: m.index });
    }
  }
  topicPositions.sort((a, b) => a.index - b.index);

  // Assign topics to questions based on position in text
  // (also assign during regex matching below)

  // Also find question positions for topic assignment
  // We'll assign topic after parsing

  let qMatch;
  const questions = [];
  const questionPositions = []; // { qNum, index }

  while ((qMatch = qRegex.exec(questionSection)) !== null) {
    const qNum = parseInt(qMatch[1]);
    if (qNum < 1 || qNum > 100) continue;

    const options = [
      qMatch[3].replace(/\s+/g, ' ').trim(),
      qMatch[4].replace(/\s+/g, ' ').trim(),
    ];
    if (qMatch[5] !== undefined) options.push(qMatch[5].replace(/\s+/g, ' ').trim());
    if (qMatch[6] !== undefined) options.push(qMatch[6].replace(/\s+/g, ' ').trim());

    if (options.length < 2) continue;

    const questionText = qMatch[2].replace(/\s+/g, ' ').trim();

    const ans = answerMap.get(qNum);
    if (!ans) {
      console.log(`  Skipping Q${qNum}: no answer found`);
      continue;
    }
    if (ans.index >= options.length) {
      console.log(`  Skipping Q${qNum}: answer index ${ans.index} out of range (${options.length} options)`);
      continue;
    }

    questionPositions.push({ qNum, index: qMatch.index });
    questions.push({
      id: 500 + qNum,
      text: questionText,
      options,
      correct_index: ans.index,
      correct_letter: ans.letter,
      topic: 'general', // will be filled in below
      difficulty: 'L1',
      level: 'L1',
      explanation: '',
    });
  }

  // Assign topics: for each question, find the preceding topic header
  for (const q of questions) {
    let bestTopic = 'general';
    for (let i = topicPositions.length - 1; i >= 0; i--) {
      // Find the question's position in original text
      const qPos = questionPositions.find(p => p.qNum === q.id - 500);
      if (qPos && topicPositions[i].index < qPos.index) {
        bestTopic = topicPositions[i].topic;
        break;
      }
    }
    q.topic = bestTopic;
  }

  console.log(`  Parsed ${questions.length} WSET1 questions`);
  return questions;
}

// ── WSET2 Exam Paper Parser ────────────────────────────────────────

function parseWset2Exam() {
  const text = fs.readFileSync(path.join(DATA_DIR, 'WSET2 Exam Paper.txt'), 'utf-8');

  // Remove ad lines, headers, and trailing Notes section
  let cleaned = text
    .replace(/If you need a professional[^\n]*/gi, '')
    .replace(/Homeworkanalyzers\.com/gi, '')
    .replace(/Homeworks4u\.org/gi, '')
    .replace(/Datedhomeworks\.com/gi, '')
    .replace(/amazingclasshelp\.com/gi, '')
    .replace(/Suite 1000[^\n]*/gi, '')
    .replace(/www\.finevintageltd\.com/gi, '')
    .replace(/TESTED AND CONFIRMED A\+ ANSWERS/gi, '')
    .replace(/QUESTIONS AND ANSWERS/gi, '')
    .replace(/WSET LEVEL 2 WINES AND SPIRITS EXAMS/gi, '')
    .replace(/Exam\s*\n/gi, '');

  // Only remove trailing "Notes" section (standalone at end, not "notes" in question text)
  const notesHeaderIdx = cleaned.lastIndexOf('\nNotes ');
  if (notesHeaderIdx > 0) {
    cleaned = cleaned.substring(0, notesHeaderIdx);
  }

  // Split at answer key
  const answerKeyMatch = cleaned.match(/LEVEL 1 PRACTICE EXAM\s*[-–]\s*ANSWER KEY/i);
  if (!answerKeyMatch) {
    console.log('  ERROR: Could not find answer key');
    return [];
  }

  const questionSection = cleaned.substring(0, answerKeyMatch.index);
  const answerSection = cleaned.substring(answerKeyMatch.index);

  // ── Parse answer section ──────────────────────────────────────
  // Format: "N. X) Explanation text"
  const answerMap = new Map();
  const ansRegex = /(\d{1,3})\.\s+([a-d])\)/g;
  let ansMatch;
  while ((ansMatch = ansRegex.exec(answerSection)) !== null) {
    const qNum = parseInt(ansMatch[1]);
    const letter = ansMatch[2].toLowerCase();
    answerMap.set(qNum, { index: letter.charCodeAt(0) - 97, letter });
  }
  console.log(`  Found ${answerMap.size} answers in answer key`);

  // ── Parse question section ────────────────────────────────────
  const topicHeaders = [
    'Styles of Wine', 'What Makes Wine Different?', 'Principal Grape Varieties',
    'Other Popular Varietals and Wines', 'Other Popular Wines',
    'How Wine is Made', 'Wine Tasting', 'Storing and Serving Wine',
    'Social and Professional Responsibility', 'Food and Wine Matching',
  ];

  // Process line by line
  const lines = questionSection.split('\n');
  let currentTopic = 'general';
  let currentQNum = null;
  let currentQText = '';
  let currentOptions = [];
  const questions = [];

  const finalizeQuestion = () => {
    if (currentQNum === null) return;
    if (currentOptions.length < 2) { currentQNum = null; currentQText = ''; currentOptions = []; return; }

    const ans = answerMap.get(currentQNum);
    if (!ans) { currentQNum = null; currentQText = ''; currentOptions = []; return; }
    if (ans.index >= currentOptions.length) { currentQNum = null; currentQText = ''; currentOptions = []; return; }

    questions.push({
      id: 600 + currentQNum,
      text: currentQText.replace(/\s+/g, ' ').trim(),
      options: currentOptions.map(o => o.replace(/\s+/g, ' ').trim()),
      correct_index: ans.index,
      correct_letter: ans.letter,
      topic: currentTopic,
      difficulty: 'L2',
      level: 'L2',
      explanation: '',
    });

    currentQNum = null;
    currentQText = '';
    currentOptions = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip page numbers (standalone digits)
    if (/^\d{1,2}$/.test(line) && parseInt(line) < 30) continue;

    // Check for topic header
    const matchedTopic = topicHeaders.find(t => line.toLowerCase().includes(t.toLowerCase()));
    if (matchedTopic && line.length < 60) {
      currentTopic = matchedTopic;
      continue;
    }

    // Check for question number
    const qNumMatch = line.match(/^(\d{1,3})\.\s+(.+)/);
    if (qNumMatch) {
      const qNum = parseInt(qNumMatch[1]);
      // If already inside a question with no options yet, this is a sub-item (e.g. "1. Acid")
      // Accumulate it into the question text instead of starting a new question
      if (currentQNum !== null && currentOptions.length === 0) {
        currentQText += ' ' + qNumMatch[2].trim();
        continue;
      }
      if (qNum >= 1 && qNum <= 100) {
        // Finalize previous question
        finalizeQuestion();
        // Start new question
        currentQNum = qNum;
        currentQText = qNumMatch[2].trim();
        currentOptions = [];
        continue;
      }
    }

    // Check for option line
    const optMatch = line.match(/^([a-d])\.\s+(.+)/i);
    if (optMatch && currentQNum !== null) {
      currentOptions.push(optMatch[2].trim());
      continue;
    }

    // Accumulate other multi-line question text
    if (currentQNum !== null && currentOptions.length === 0) {
      if (!topicHeaders.some(t => line.includes(t))) {
        currentQText += ' ' + line;
      }
    }
  }

  // Finalize last question
  finalizeQuestion();

  console.log(`  Parsed ${questions.length} WSET2 Exam questions`);
  return questions;
}

// ── Main ──────────────────────────────────────────────────────────

function main() {
  console.log('Phase 6b: Question Bank Expansion');
  console.log('=================================\n');

  // Parse WSET1
  console.log('Parsing WSET1 Q&A...');
  const wset1Questions = parseWset1();
  fs.writeFileSync(
    path.join(DATA_DIR, 'questions-wset1.json'),
    JSON.stringify(wset1Questions, null, 2)
  );
  console.log(`  Written ${wset1Questions.length} questions to questions-wset1.json\n`);

  // Parse WSET2 Exam Paper (additional L2 questions)
  console.log('Parsing WSET2 Exam Paper...');
  const wset2ExamQuestions = parseWset2Exam();
  fs.writeFileSync(
    path.join(DATA_DIR, 'questions-wset2-exam.json'),
    JSON.stringify(wset2ExamQuestions, null, 2)
  );
  console.log(`  Written ${wset2ExamQuestions.length} questions to questions-wset2-exam.json\n`);

  // Parse WSET3
  console.log('Parsing WSET3 Exam Paper...');
  const wset3Questions = parseWset3();
  fs.writeFileSync(
    path.join(DATA_DIR, 'questions-wset3.json'),
    JSON.stringify(wset3Questions, null, 2)
  );
  console.log(`  Written ${wset3Questions.length} questions to questions-wset3.json\n`);

  // Summary
  const wset2Questions = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'questions-wset2.json'), 'utf-8'));
  console.log('=== Summary ===');
  console.log(`  WSET1 (L1): ${wset1Questions.length} questions`);
  console.log(`  WSET2 Q&A (L2): ${wset2Questions.length} questions`);
  console.log(`  WSET2 Exam (L2): ${wset2ExamQuestions.length} questions`);
  console.log(`  WSET3 (L3): ${wset3Questions.length} questions`);
  console.log(`  Total: ${wset1Questions.length + wset2Questions.length + wset2ExamQuestions.length + wset3Questions.length} questions`);

  // Topic distribution
  const allTopics = new Map();
  [...wset1Questions, ...wset2Questions, ...wset2ExamQuestions, ...wset3Questions].forEach(q => {
    const t = q.topic || 'general';
    allTopics.set(t, (allTopics.get(t) || 0) + 1);
  });
  console.log('\n  Topics:');
  [...allTopics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([t, c]) => {
    console.log(`    ${t}: ${c}`);
  });
}

main();
