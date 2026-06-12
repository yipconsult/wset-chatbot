const fs = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────
const LLM_API_KEY = process.env.LLM_API_KEY || 'sk-691bc9993b0c48ed8d840cee41e7d8d5';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
const LLM_MODEL = 'deepseek-chat';

// ── Embedding config ──────────────────────────────────────────────
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;
const EMBEDDING_BATCH_SIZE = 32;
const VECTOR_WEIGHT = 0.6;
const KEYWORD_WEIGHT = 0.4;
const CACHE_FILE = path.join(__dirname, 'data', 'processed', 'embedding-cache.json');

let chunkEmbeddings = [];
let embeddingsReady = false;
let embeddingPipeline = null;

// ── Load and chunk knowledge base ────────────────────────────────

let chunks = [];

function simpleChunk(text, maxLen = 800) {
  const result = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';
  for (const para of paragraphs) {
    const cleaned = para.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!cleaned) continue;
    if (current.length + cleaned.length > maxLen && current.length > 100) {
      result.push(current.trim());
      current = cleaned;
    } else {
      current = current ? current + '\n\n' + cleaned : cleaned;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

// ── WSET2 Notes table restructurer ────────────────────────────────

// Known grape names from the WSET2 Notes summary table
const GRAPE_NAMES = [
  'Pinot Noir', 'Zinfandel', 'Primitivo', 'Riesling', 'Chenin blanc', 'Chenin Blanc',
  'Sémillon', 'semillon', 'Furmint', 'Chardonnay', 'Sauvignon blanc', 'Sauvignon Blanc',
  'Pinot grigio', 'Pinot Grigio', 'Pinot gris', 'Pinot Gris', 'Gewurztraminer',
  'Viognier', 'Albariño', 'Albarino', 'Cabernet sauvignon', 'Cabernet Sauvignon',
  'Merlot', 'Syrah', 'Shiraz', 'Gamay', 'Grenache', 'Garnacha', 'Tempranillo',
  'Carmenère', 'Carmenere', 'Malbec', 'Pinotage', 'Cortese', 'Garganega',
  'Verdicchio', 'Fiano', 'Nebbiolo', 'Barbera', 'Corvina', 'Sangiovese',
  'Montepulciano', 'Trebbiano', 'Glera',
];

const COLUMN_LABELS = [
  'Climate', 'Acidity', 'Tannins', 'Sweetness', 'Body',
  'Flavour', 'Oak', 'Characteristics', 'Aging',
];

function isAllCaps(s) { return /^[A-Z]{2,}$/.test(s); }
function isGrapeName(s) {
  return GRAPE_NAMES.some(g => s.toLowerCase() === g.toLowerCase());
}
function isContinuationLine(s) {
  // Lines that continue a previous cell value
  if (!s) return false;
  const firstChar = s.charAt(0);
  // Starts with lowercase letter
  if (firstChar >= 'a' && firstChar <= 'z') return true;
  // Parenthetical fragments
  if (firstChar === '(' || firstChar === ')') return true;
  // Short fragment that's clearly not a new cell (starts with comma, slash, etc.)
  if (/^[,;:./]/.test(s)) return true;
  // Very short one-word line is likely a continuation
  if (s.split(' ').length === 1 && s.length < 12 && firstChar !== firstChar.toUpperCase()) return true;
  return false;
}

function isGrapeStart(s) {
  // Check if a line starts a grape entry (including multi-name grapes like "Zinfandel /")
  if (isGrapeName(s)) return true;
  // Handle cases like "Zinfandel /" where next line has "Primitivo"
  if (isGrapeName(s.replace(/\s*\/\s*$/, '').trim())) return true;
  return false;
}

function getGrapeName(s) {
  // Return the canonical grape name from a line, handling "Name / Alias" format
  if (isGrapeName(s)) return s;
  const base = s.replace(/\s*\/\s*$/, '').trim();
  if (isGrapeName(base)) return base;
  return s;
}

function splitConcatenatedWords(text) {
  // Fix word concatenation artifacts from PDF extraction:
  // "GrapeCountryRegionCharacteristics" → "Grape Country Region Characteristics"
  // "AustraliaSoutheastern" → "Australia Southeastern"
  // "Valleylight" → "Valley light"
  // Also handle all-caps runs: "HIGHDRY" → "HIGH DRY", "MODERATEHIGH" → "MODERATE HIGH"

  // Known all-caps structural values (used for splitting merged ALL-CAPS runs)
  const capsTokens = ['COOL', 'MODERATE', 'WARM', 'HIGH', 'LOW', 'MEDIUM',
    'DRY', 'OFF-DRY', 'SWEET', 'LIGHT', 'FULL'];

  let result = text
    // Split lowercase→Uppercase transitions: "Valleylight" → "Valley light"
    .replace(/([a-z])([A-Z])/g, '$1 $2');

  // Split concatenated ALL-CAPS runs by known tokens
  result = result.replace(/[A-Z-]{4,}/g, (match) => {
    // Only process if it looks concatenated (no spaces, all caps or caps+hyphens)
    if (!/^[A-Z-]+$/.test(match)) return match;
    let parts = match;
    // Try splitting by known tokens
    for (const token of capsTokens.sort((a, b) => b.length - a.length)) {
      const regex = new RegExp(token.replace(/-/g, '\\-'), 'g');
      let idx = 0;
      parts = parts.replace(regex, (m, offset) => {
        const prefix = offset > idx ? ' ' : '';
        idx = offset + m.length;
        return prefix + m;
      });
    }
    return parts.trim().replace(/\s+/g, ' ');
  });

  return result.replace(/\s{2,}/g, ' ').trim();
}

function restructureWset2Notes(rawText) {
  // Only process the grape characteristics summary table (first section, pages 1-3).
  // The "Grapes and regions" section (pages 5+) has a different format and is left as-is.

  // First, clean page headers from the entire text
  let fullText = rawText
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}\s*[AP]MWSET 2 cheat sheet by @luksow/g, '')
    .replace(/Page \d+ of \d+https?:\/\/wset\.luksow\.com\/?\??\S*/g, '');

  // Fix concatenated words throughout the entire text
  fullText = splitConcatenatedWords(fullText);

  // Find the grape varieties summary table
  const tableStart = fullText.indexOf('Grape varieties\n');
  if (tableStart < 0) return fullText;

  // Find where the "Grapes and regions" section starts (end of summary table)
  const regionsIdx = fullText.indexOf('Grapes and regions');
  const tableEnd = regionsIdx > tableStart ? regionsIdx : fullText.length;

  const before = fullText.substring(0, tableStart);
  const tableText = fullText.substring(tableStart, tableEnd);
  const after = fullText.substring(tableEnd);

  // Split into lines and process
  const lines = tableText.split('\n');
  let resultLines = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i].trim();
    if (!line) { i++; continue; }

    // Skip the section header and column header line
    if (line === 'Grape varieties') { i++; continue; }
    if (/^GrapeClimate/.test(line)) { i++; continue; }

    // Check if this line starts a grape entry
    if (isGrapeStart(line)) {
      let grapeName = getGrapeName(line);
      const entryLines = [];
      i++;

      // If the current line ended with "/", the next line is an alias
      if (line.endsWith('/') && i < lines.length && isGrapeName(lines[i].trim())) {
        grapeName = grapeName + ' / ' + lines[i].trim();
        i++;
      }

      // Collect lines until next grape or end of table section
      while (i < lines.length) {
        const nl = lines[i].trim();
        if (!nl) { i++; continue; }
        if (isGrapeStart(nl)) break;
        // Stop at non-table content (long prose lines or section headers)
        if (nl.length > 60 && !/^[A-Z\s]+$/.test(nl) && nl.split(' ').length > 5) break;
        entryLines.push(nl);
        i++;
      }

      // Join continuation lines
      const joined = [];
      for (const el of entryLines) {
        if (joined.length > 0 && isContinuationLine(el)) {
          joined[joined.length - 1] += ' ' + el;
        } else {
          joined.push(el);
        }
      }

      const prose = grapeLinesToProse(grapeName, joined);
      resultLines.push(prose);
    } else {
      // Non-grape line in table section — skip or pass through
      i++;
    }
  }

  // Reassemble: before section + restructured table + after section
  const restructured = resultLines.join('\n\n');
  return (before + '\n' + restructured + '\n' + after).replace(/\n{3,}/g, '\n\n').trim();
}

function grapeLinesToProse(name, lines) {
  if (lines.length === 0) return name + '.';

  // Pass 1: classify lines by content patterns
  const structural = [];   // climate, acidity, tannins, sweetness, body values
  const flavour = [];
  const oak = [];
  const characteristics = [];
  const aging = [];

  for (const line of lines) {
    const upper = line.toUpperCase().trim();
    const lower = line.toLowerCase();

    // Short all-caps values are structural (climate, acidity, etc.)
    if (/^[A-Z\s-]+$/.test(line) && line.length < 20 && !/[a-z]/.test(line)) {
      structural.push(upper);
      continue;
    }

    // Oak-related
    if (lower.includes('oak') || lower.includes('unoaked')) {
      oak.push(line);
      continue;
    }

    // Flavour-related keywords
    if (lower.match(/\b(fruit|floral|herbal|herbaceous|citrus|berry|cherry|plum|pepper|spice|lemon|apple|pear|melon|honey|stone|tropical|grass|asparagus|mint|eucalyptus|lychee|ginger|coffee|chocolate|smoke|leather|earth|meat|tobacco|mushroom|forest|petrol|nuts|almond|caramel|dried|candy|banana|blossom)\b/)) {
      flavour.push(line);
      continue;
    }

    // Characteristics keywords
    if (lower.match(/\b(thin skin|thick skin|high sugar|ripens|blended|single varietal|aromatic|versatile|range of|harvest|susceptible|botrytis|noble rot|complex|simple|carbonic|maceration|rosé|sparkling|early drinking|can age|typically|sometimes|take.*oak|strong flavour)\b/)) {
      characteristics.push(line);
      continue;
    }

    // Short remaining lines → aging notes (typically at end of entry)
    if (line.length < 30 && !lower.match(/\b(fruit|berry|cherry|plum|lemon|apple|pear|melon|citrus)\b/)) {
      aging.push(line);
    } else {
      // Default to flavour
      flavour.push(line);
    }
  }

  // Post-classification: move trailing flavour lines that are aging notes
  // (Mushroom, Forest floor, Earth, Meat, Leather, Honey, Nuts, etc. at the end)
  const agingKeywords = /\b(mushroom|forest|earth|meat|leather|tobacco|honey\s|nuts|almond|caramel|dried fruit|petrol|ginger|game|tar|truffle)\b/i;
  while (flavour.length > 0 && agingKeywords.test(flavour[flavour.length - 1])) {
    aging.unshift(flavour.pop());
  }

  // Pass 2: parse structural values (climate, acidity, tannins, sweetness, body)
  const structuralFlat = structural.join(' ').split(/\s+/);
  const fields = {};

  for (const token of structuralFlat) {
    if (['COOL', 'MODERATE', 'WARM'].includes(token) && !fields.climate) {
      fields.climate = token.charAt(0) + token.slice(1).toLowerCase();
    } else if (['HIGH', 'LOW'].includes(token)) {
      if (!fields.acidity) fields.acidity = token.charAt(0) + token.slice(1).toLowerCase();
      else if (!fields.tannins) fields.tannins = token.charAt(0) + token.slice(1).toLowerCase();
    } else if (token === 'MEDIUM') {
      if (!fields.acidity) fields.acidity = 'medium';
      else if (!fields.tannins) fields.tannins = 'medium';
      else if (!fields.body) fields.body = 'medium';
    } else if (['DRY', 'OFF-DRY', 'SWEET'].includes(token) && !fields.sweetness) {
      fields.sweetness = token.charAt(0) + token.slice(1).toLowerCase();
    } else if (['LIGHT', 'FULL'].includes(token) && !fields.body) {
      fields.body = token.charAt(0) + token.slice(1).toLowerCase();
    }
  }

  // Build prose
  const parts = [];
  if (fields.climate) parts.push(fields.climate + ' climate');
  if (fields.acidity) parts.push(fields.acidity + ' acidity');
  if (fields.tannins) parts.push(fields.tannins + ' tannins');
  if (fields.sweetness) parts.push(fields.sweetness);
  if (fields.body) parts.push(fields.body + ' body');

  let prose = name;
  if (parts.length > 0) prose += ': ' + parts.join(', ') + '.';
  else prose += '.';

  if (flavour.length > 0) prose += ' Flavours: ' + flavour.join('; ') + '.';
  if (oak.length > 0) prose += ' Oak: ' + oak.join('; ') + '.';
  if (characteristics.length > 0) prose += ' Characteristics: ' + characteristics.join('; ') + '.';
  if (aging.length > 0) prose += ' Aging notes: ' + aging.join(', ') + '.';

  return prose;
}

function loadKnowledgeBase() {
  const dataDir = path.join(__dirname, 'data', 'processed');

  // Load WSET2 Notes
  try {
    const rawNotes = fs.readFileSync(path.join(dataDir, 'WSET2 Notes.txt'), 'utf-8');
    const notes = restructureWset2Notes(rawNotes);
    const noteChunks = simpleChunk(notes, 800);
    noteChunks.forEach((c, i) => chunks.push({
      id: `notes-${i}`,
      content: c,
      source: 'WSET2 Study Notes',
      topics: detectTopics(c),
    }));
    console.log(`  Loaded ${noteChunks.length} chunks from WSET2 Notes`);
  } catch (e) { console.log('  No WSET2 Notes found'); }

  // Load WSET2 Q&A as knowledge
  try {
    const qa = JSON.parse(fs.readFileSync(path.join(dataDir, 'questions-wset2.json'), 'utf-8'));
    const qaChunks = qa.map(q => ({
      id: `qa-${q.id}`,
      content: `Q: ${q.text}\nA: ${q.options[q.correct_index]}`,
      source: 'WSET2 Practice Questions',
      topics: detectTopics(q.text + ' ' + q.options[q.correct_index]),
    }));
    chunks.push(...qaChunks);
    console.log(`  Loaded ${qaChunks.length} Q&A pairs as knowledge`);
  } catch (e) { console.log('  No questions JSON found'); }

  // Also load WSET1 and WSET3 Q&A as knowledge
  for (const { file, level } of [
    { file: 'questions-wset1.json', level: 'L1' },
    { file: 'questions-wset3.json', level: 'L3' },
  ]) {
    try {
      const qa = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8'));
      const qaChunks = qa.map(q => ({
        id: `qa-${q.id}`,
        content: `Q: ${q.text}\nA: ${q.options[q.correct_index]}` + (q.explanation ? `\nExplanation: ${q.explanation}` : ''),
        source: `WSET${level.replace('L', '')} Practice Questions`,
        level,
        topics: detectTopics(q.text + ' ' + q.options[q.correct_index]),
      }));
      chunks.push(...qaChunks);
      console.log(`  Loaded ${qaChunks.length} Q&A pairs from ${file}`);
    } catch (e) { /* skip */ }
  }

  // Load exam paper texts
  try {
    const examFiles = [
      { file: 'WSET2 Q&A.txt', level: 'L2' },
      { file: 'WSET2 Exam Paper.txt', level: 'L2' },
      { file: 'WSET3 Exam Paper 2526.txt', level: 'L3' },
    ];
    for (const { file, level } of examFiles) {
      try {
        const text = fs.readFileSync(path.join(dataDir, file), 'utf-8');
        const cleaned = text.replace(/www\.finevintageltd\.com/gi, '').replace(/FINE VINTAGE[^\n]*/gi, '');
        const examChunks = simpleChunk(cleaned, 800).slice(0, 30);
        examChunks.forEach((c, i) => chunks.push({
          id: `${file}-${i}`,
          content: c,
          source: file.replace('.txt', ''),
          level,
          topics: detectTopics(c),
        }));
      } catch (e) { /* skip */ }
    }
  } catch (e) { /* skip */ }

  // Load OCR'd textbook content
  const ocrFiles = [
    { file: 'WSET1-ocr.txt', source: 'WSET1 Textbook (OCR)', level: 'L1' },
    { file: 'WSET2-ocr.txt', source: 'WSET2 Textbook (OCR)', level: 'L2' },
    { file: 'WSET3-ocr.txt', source: 'WSET3 Textbook (OCR)', level: 'L3' },
  ];
  for (const { file, source, level } of ocrFiles) {
    try {
      const text = fs.readFileSync(path.join(dataDir, file), 'utf-8');
      const ocrChunks = simpleChunk(text, 1200);
      ocrChunks.forEach((c, i) => chunks.push({
        id: `${file}-${i}`,
        content: c,
        source,
        level,
        topics: detectTopics(c),
      }));
      console.log(`  Loaded ${ocrChunks.length} chunks from ${source}`);
    } catch (e) { /* file not available yet */ }
  }

  // Build TF-IDF index
  buildTfidfIndex();
  console.log(`  Total chunks: ${chunks.length}`);
}

// ── TF-IDF Index ─────────────────────────────────────────────────

let idfScores = new Map();   // term -> idf score
let chunkVectors = [];       // per-chunk Map of term -> tf-idf

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function buildTfidfIndex() {
  const N = chunks.length;
  const df = new Map(); // document frequency

  for (const chunk of chunks) {
    const terms = new Set(tokenize(chunk.content));
    for (const term of terms) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  // Compute IDF
  idfScores = new Map();
  for (const [term, count] of df) {
    idfScores.set(term, Math.log((N + 1) / (count + 1)) + 1);
  }

  // Compute TF-IDF vectors per chunk
  chunkVectors = chunks.map(chunk => {
    const tokens = tokenize(chunk.content);
    const tf = new Map();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }
    const vec = new Map();
    for (const [term, count] of tf) {
      const tfNorm = count / tokens.length;
      const idf = idfScores.get(term) || 0;
      vec.set(term, tfNorm * idf);
    }
    return vec;
  });
}

// ── TF-IDF Search ────────────────────────────────────────────────

function keywordSearch(query, topK = 20, targetLevel = null) {
  if (chunks.length === 0) return [];
  if (chunkVectors.length === 0) buildTfidfIndex();

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return chunks.slice(0, topK);

  const scored = chunks.map((chunk, i) => {
    const vec = chunkVectors[i];
    let score = 0;
    for (const term of queryTerms) {
      score += vec.get(term) || 0;
      if (chunk.content.toLowerCase().includes(term)) score += 0.3;
    }
    const queryTopics = detectTopics(query);
    const matchTopics = chunk.topics.filter(t => queryTopics.includes(t));
    score += matchTopics.length * 2;

    if (targetLevel && chunk.level === targetLevel) {
      score += 5;
    }

    return { chunk, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => ({ chunk: s.chunk, score: s.score }));
}

// ── Vector search ──────────────────────────────────────────────────

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    const { pipeline } = require('@xenova/transformers');
    console.log('  Loading embedding model:', EMBEDDING_MODEL, '(first run downloads ~80MB)...');
    embeddingPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL);
    console.log('  Embedding model ready.');
  }
  return embeddingPipeline;
}

async function getEmbedding(text) {
  const pipe = await getEmbeddingPipeline();
  const result = await pipe(text, { pooling: 'mean', normalize: true });
  return new Float32Array(result.data);
}

async function generateEmbeddings() {
  console.log('  Generating embeddings for', chunks.length, 'chunks...');
  const allEmbeddings = [];
  const pipe = await getEmbeddingPipeline();

  for (let i = 0; i < chunks.length; i++) {
    const text = chunks[i].content.substring(0, 2000); // local model has lower token limit
    const vec = await pipe(text, { pooling: 'mean', normalize: true });
    allEmbeddings.push(new Float32Array(vec.data));

    if ((i + 1) % 50 === 0 || i === chunks.length - 1) {
      const pct = Math.round((i + 1) / chunks.length * 100);
      process.stdout.write(`\r  Embeddings: ${pct}% (${i + 1}/${chunks.length})`);
    }
  }

  console.log('');
  chunkEmbeddings = allEmbeddings;
  embeddingsReady = true;

  // Save cache
  try {
    const cacheData = {
      contentHash: getContentHash(),
      embeddings: allEmbeddings.map(e => Array.from(e)),
      builtAt: new Date().toISOString(),
      dimensions: EMBEDDING_DIM,
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData), 'utf-8');
    console.log('  Embedding cache saved.');
  } catch (e) {
    console.log('  Could not save embedding cache:', e.message);
  }

  return true;
}

function getContentHash() {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5');
  for (const c of chunks) {
    hash.update(c.content);
  }
  return hash.digest('hex');
}

function loadEmbeddingCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return false;
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    const currentHash = getContentHash();
    if (cache.contentHash !== currentHash) {
      console.log('  Embedding cache stale (content changed), will regenerate.');
      return false;
    }
    if (!cache.embeddings || cache.embeddings.length !== chunks.length) {
      console.log('  Embedding cache size mismatch, will regenerate.');
      return false;
    }
    chunkEmbeddings = cache.embeddings.map(e => new Float32Array(e));
    embeddingsReady = true;
    console.log(`  Loaded ${chunkEmbeddings.length} embeddings from cache (built ${cache.builtAt}).`);
    return true;
  } catch (e) {
    console.log('  Could not load embedding cache:', e.message);
    return false;
  }
}

async function initializeEmbeddings() {
  if (loadEmbeddingCache()) return true;
  const ok = await generateEmbeddings();
  if (!ok) {
    console.log('  Falling back to TF-IDF only search.');
  }
  return ok;
}

async function vectorSearch(query, topK = 20) {
  if (!embeddingsReady || chunkEmbeddings.length === 0) return [];

  try {
    const queryVec = await getEmbedding(query);
    const scored = chunkEmbeddings.map((vec, i) => ({
      chunk: chunks[i],
      score: cosineSimilarity(queryVec, vec),
    }));
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch (e) {
    console.log('  Vector search failed, using keyword only:', e.message);
    return [];
  }
}

// ── Hybrid search ──────────────────────────────────────────────────

async function searchChunks(query, topK = 5, targetLevel = null) {
  if (chunks.length === 0) return [];

  // Run keyword and vector search in parallel
  const [keywordResults, vectorResults] = await Promise.all([
    Promise.resolve(keywordSearch(query, 20, targetLevel)),
    vectorSearch(query, 20),
  ]);

  // Merge scores
  const scoreMap = new Map();

  // Keyword scores (normalized to 0-1)
  const maxKwScore = keywordResults.length > 0 ? Math.max(...keywordResults.map(r => r.score)) : 1;
  for (const r of keywordResults) {
    const chunkId = chunks.indexOf(r.chunk);
    const normalizedKw = maxKwScore > 0 ? r.score / maxKwScore : 0;
    scoreMap.set(chunkId, { chunk: r.chunk, score: normalizedKw * KEYWORD_WEIGHT });
  }

  // Vector scores (already 0-1 from cosine similarity)
  for (const r of vectorResults) {
    const chunkId = chunks.indexOf(r.chunk);
    const existing = scoreMap.get(chunkId);
    const vecContrib = r.score * VECTOR_WEIGHT;
    if (existing) {
      existing.score += vecContrib;
    } else {
      scoreMap.set(chunkId, { chunk: r.chunk, score: vecContrib });
    }
  }

  // Add topic match bonus to merged results
  const queryTopics = detectTopics(query);
  for (const [, entry] of scoreMap) {
    const matchTopics = entry.chunk.topics.filter(t => queryTopics.includes(t));
    entry.score += matchTopics.length * 2;
    if (targetLevel && entry.chunk.level === targetLevel) {
      entry.score += 5;
    }
  }

  // Sort by combined score, return top-K chunks only
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(e => e.chunk);
}

// ── Topic detection ──────────────────────────────────────────────

const ALL_TOPICS = [
  // French regions
  'france', 'bordeaux', 'burgundy', 'champagne', 'alsace', 'loire', 'rhone',
  'beaujolais', 'provence', 'languedoc', 'chablis', 'cote', 'medoc',
  // Other old world
  'italy', 'spain', 'germany', 'portugal', 'piedmont', 'tuscany', 'veneto',
  'rioja', 'rías baixas', 'mosel', 'rheingau', 'pfalz',
  // New world
  'australia', 'new zealand', 'usa', 'chile', 'argentina', 'south africa',
  'california', 'oregon', 'washington', 'mendoza', 'barossa', 'marlborough',
  // Grape varieties - white
  'chardonnay', 'sauvignon blanc', 'riesling', 'pinot grigio', 'pinot gris',
  'gewurztraminer', 'viognier', 'chenin blanc', 'semillon',
  // Grape varieties - black
  'pinot noir', 'cabernet sauvignon', 'merlot', 'syrah', 'shiraz',
  'sangiovese', 'nebbiolo', 'tempranillo', 'malbec', 'grenache',
  // Wine styles
  'sparkling', 'rosé', 'sweet', 'dessert', 'fortified', 'sherry', 'port',
  'ice wine', 'late harvest',
  // Production & viticulture
  'tasting', 'pairing', 'storage', 'service', 'viticulture', 'vinification',
  'fermentation', 'malolactic', 'lees', 'oak', 'tannin', 'acid', 'acidity',
  'body', 'alcohol', 'sugar', 'yeast', 'barrel', 'stainless steel',
  // Spirits
  'whisky', 'brandy', 'cognac', 'spirits', 'vodka', 'gin', 'rum',
];

function detectTopics(text) {
  const t = text.toLowerCase();
  const found = [];
  for (const topic of ALL_TOPICS) {
    if (t.includes(topic)) {
      found.push(topic);
    }
  }
  return found.length > 0 ? found : ['general'];
}

// Backwards compat: single-topic version still used by server.js question auto-tagging
function detectTopic(text) {
  const t = text.toLowerCase();
  for (const topic of ALL_TOPICS) {
    if (t.includes(topic)) return topic;
  }
  return 'general';
}

// ── Prompt variants (A/B testing) ─────────────────────────────────

const PROMPT_VARIANTS = {
  A: {
    id: 'A',
    name: 'Balanced',
    template: `You are a WSET (Wine & Spirit Education Trust) tutor. You help candidates prepare for WSET Level 1, 2, and 3 exams.

Rules:
- Answer using ONLY the provided reference material below. If the material doesn't contain enough information to answer confidently, say "I don't have enough WSET material to answer that confidently — try asking about [suggest a related topic from the provided material]."
- For every factual claim, cite the source inline in parentheses — e.g. (WSET2 Study Notes) or (WSET2 Practice Questions).
- Be concise but thorough. Wine students need accurate, exam-relevant information.
- When relevant, note which WSET level the information applies to (e.g., "For Level 2, the key point is... At Level 3, you would also need to know...").
- Use bullet points for lists and comparisons.
- Define technical terms when you first use them.
- If the question is ambiguous, ask for clarification rather than guessing.
{level_instruction}
Reference material:
{context}`,
  },
  B: {
    id: 'B',
    name: 'Exam-Focused',
    template: `You are a WSET exam coach. Your goal is to help students pass their WSET exams efficiently.

Rules:
- Answer using ONLY the provided reference material. If the material is insufficient, say "Not covered in the provided WSET material — focus your study on [related topic]."
- Inline-cite every factual claim: (WSET2 Study Notes), (WSET2 Practice Questions), etc.
- Keep answers short and exam-focused. Lead with the most testable facts.
- Flag common exam pitfalls: "Exam tip: students often confuse X with Y because..."
- Use bullet points. Each bullet should be a memorizable, testable fact.
- If a question maps to a specific exam question, mention that pattern.
{level_instruction}
Reference material:
{context}`,
  },
  C: {
    id: 'C',
    name: 'Detailed Study',
    template: `You are a WSET wine educator who teaches students to truly understand wine, not just pass exams.

Rules:
- Answer using ONLY the provided reference material. If the material is insufficient, say "I don't have enough WSET material on that — try asking about [related topic] or check your textbook chapter on [relevant chapter]."
- Inline-cite every factual claim: (WSET2 Study Notes), (WSET2 Practice Questions), (WSET2 Textbook), etc.
- Be thorough. Explain the "why" behind facts, not just the "what."
- Connect related topics to build a richer understanding: "This relates to X because..."
- Include a "Study tip" at the end of each answer suggesting what to review next.
- Differentiate by WSET level: what changes from L2 to L3 on this topic.
{level_instruction}
Reference material:
{context}`,
  },
};

function assignPromptVariant() {
  const variants = Object.keys(PROMPT_VARIANTS);
  return variants[Math.floor(Math.random() * variants.length)];
}

function getPromptTemplate(variant) {
  return PROMPT_VARIANTS[variant]?.template || PROMPT_VARIANTS.A.template;
}

// ── WSET Level detection & chunk tagging ───────────────────────────

function chunkLevel(source) {
  if (/WSET1|wset1|L1|Level 1/i.test(source)) return 'L1';
  if (/WSET3|wset3|L3|Level 3|Exam Paper 2526/i.test(source)) return 'L3';
  return 'L2'; // default: study notes, practice Q&A, exam papers are all L2
}

function detectQueryLevel(text) {
  const t = text.toLowerCase();
  if (/\b(level 3|l3|wset 3|wset3|advanced|level three)\b/.test(t)) return 'L3';
  if (/\b(level 1|l1|wset 1|wset1|beginner|level one|foundation)\b/.test(t)) return 'L1';
  if (/\b(level 2|l2|wset 2|wset2|intermediate|level two)\b/.test(t)) return 'L2';
  return null; // no specific level requested
}

// ── Build prompt ─────────────────────────────────────────────────

function buildPrompt(userQuery, relevantChunks, variant, queryLevel) {
  const context = relevantChunks.map(c =>
    `[${c.source}${c.level ? ' · ' + c.level : ''}] ${c.content}`
  ).join('\n\n---\n\n');

  const template = getPromptTemplate(variant || 'A');

  let levelInstruction = '';
  if (queryLevel) {
    levelInstruction = `\n- The student is studying for WSET ${queryLevel.replace('L', 'Level ')}. Tailor your answer to that level's syllabus depth.`;
  } else {
    levelInstruction = '\n- The student has not specified a WSET level. When a topic differs across levels, briefly note the distinction.';
  }

  return template
    .replace('{context}', context)
    .replace('{level_instruction}', levelInstruction);
}

// ── Call DeepSeek API ────────────────────────────────────────────

async function streamChat(messages, res) {
  const apiMessages = [
    { role: 'system', content: messages[0].content },
    ...messages.slice(1),
  ];

  try {
    const response = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: apiMessages,
        stream: true,
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('DeepSeek API error:', response.status, err);
      res.write(`data: ${JSON.stringify({ error: 'LLM API error: ' + response.status })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
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
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch (e) {
          // skip malformed chunks
        }
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    console.error('Stream error:', e.message);
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
}

// ── Knowledge gap detection ──────────────────────────────────────

function isKnowledgeGapResponse(text) {
  const patterns = [
    /don'?t have enough WSET material/i,
    /don'?t have enough information/i,
    /cannot answer (that|this) (confidently|based)/i,
    /not covered in (the|my|our) (reference|WSET|study) material/i,
    /I (don'?t|cannot|can'?t) (have|find) (enough|sufficient|the|any) (information|material|data)/i,
  ];
  return patterns.some(p => p.test(text));
}

// ── Initialize ───────────────────────────────────────────────────

loadKnowledgeBase();

async function initRag() {
  buildTfidfIndex();
  await initializeEmbeddings();
}

module.exports = {
  initRag,
  searchChunks, buildPrompt, streamChat,
  detectTopic, detectTopics, detectQueryLevel,
  PROMPT_VARIANTS, assignPromptVariant, getPromptTemplate,
  isKnowledgeGapResponse,
  embeddingsReady: () => embeddingsReady,
  EMBEDDING_DIM,
};
