import fs from 'fs';

let text = fs.readFileSync('data/processed/WSET2 Q&A.txt', 'utf-8');

// Clean PDF footer artifacts
text = text.replace(/www\.finevintageltd\.com/gi, '');
text = text.replace(/FINE VINTAGE LTD\.?\s*/gi, '');
text = text.replace(/FINE VINTAGE LEVEL 2 PRACTICE EXAM (QUESTIONS|ANSWERS)\s*/gi, '\n---\n');
text = text.replace(/\n{3,}/g, '\n\n');

// Split into questions and answers sections
const answerMarker = '---';
const answerIdx = text.lastIndexOf(answerMarker);
const questionsText = text.substring(0, answerIdx);
const answersText = text.substring(answerIdx);

// Find chapter headers to extract topic context
function findChapterContext(rawText, targetNumber) {
  const chapters = [];
  const chapterRe = /Chapter\s+(\d+)\s*[–-]\s*(.+?)(?:\n|$)/gi;
  let m;
  while ((m = chapterRe.exec(rawText)) !== null) {
    chapters.push({ number: parseInt(m[1]), title: m[2].trim(), pos: m.index });
  }
  // Find the chapter that precedes this question
  const qPos = rawText.indexOf(`${targetNumber})`);
  let chapTitle = 'Unknown';
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (chapters[i].pos < qPos) {
      chapTitle = chapters[i].title;
      break;
    }
  }
  return chapTitle;
}

function parseQuestions(rawText) {
  const questions = [];
  // Split by question numbers: find all positions of "\d+\) "
  const starts = [];
  const qRe = /(\d+)\)\s+/g;
  let m;
  while ((m = qRe.exec(rawText)) !== null) {
    starts.push({ num: parseInt(m[1]), pos: m.index, endPos: m.index + m[0].length });
  }

  for (let i = 0; i < starts.length; i++) {
    const { num, endPos } = starts[i];
    const nextPos = i + 1 < starts.length ? starts[i + 1].pos : rawText.length;
    const block = rawText.substring(endPos, nextPos).trim();

    // Extract options: split by a), b), c), d)
    const parts = block.split(/\n\s*(?=[a-d]\))/);
    let questionText = parts[0].trim();
    // Clean trailing artifacts from question text
    questionText = questionText.replace(/\n.*$/, '').trim();

    const options = parts.slice(1, 5).map(o => {
      let opt = o.replace(/^[a-d]\)\s*/, '').trim();
      // Clean trailing artifacts from options
      opt = opt.replace(/\n.*$/, '').trim();
      // Remove trailing semicolons
      opt = opt.replace(/[;,]\\s*$/, '');
      return opt;
    }).filter(o => o.length > 0);

    if (options.length >= 2) {
      questions.push({
        number: num,
        text: questionText,
        options: options,
      });
    }
  }
  return questions;
}

function parseAnswers(rawText) {
  const answers = {};
  // Find each answer: number) on its own line, then the next line has letter) text
  const answerBlocks = rawText.split(/\n\s*(?=\d+\))/);
  for (const block of answerBlocks) {
    const headerMatch = block.match(/^(\d+)\)\s*(.+?)\n\s*([a-d])\)/);
    if (headerMatch) {
      answers[parseInt(headerMatch[1])] = headerMatch[3];
    }
  }
  return answers;
}

const questions = parseQuestions(questionsText);
const answers = parseAnswers(answersText);

// Merge
const merged = questions.filter(q => answers[q.number]).map(q => {
  const correctLetter = answers[q.number];
  return {
    id: q.number,
    text: q.text,
    options: q.options,
    correct_index: ['a', 'b', 'c', 'd'].indexOf(correctLetter),
    correct_letter: correctLetter,
    // topic: findChapterContext(questionsText, q.number),
  };
});

console.log(`Parsed ${questions.length} questions, ${Object.keys(answers).length} answers, ${merged.length} merged`);

fs.writeFileSync('data/processed/questions-wset2.json', JSON.stringify(merged, null, 2));
console.log('Written to data/processed/questions-wset2.json');

// Show first 5 samples
merged.slice(0, 5).forEach(q => {
  console.log(`\nQ${q.id}: ${q.text}`);
  q.options.forEach((o, i) => console.log(`  ${'abcd'[i]}) ${o}`));
  console.log(`  -> Answer: ${q.correct_letter} (index ${q.correct_index})`);
});
