const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'processed');

// ── Known noise page markers ───────────────────────────────────────

const NOISE_MARKERS = [
  'All rights reserved. No part of this publication',
  'PHOTOGRAPHIC CREDITS',
  'CREDITS',
  'DIAGRAMS AND ILLUSTRATIONS',
  'Designed by',
  'Editing and proofreading by',
  'Production services by',
  'Printed and bound',
  'A CIP catalogue record',
  'Acknowledgements',
  'Acknowledgemgnts',
  'COVER PICTURE',
  'MAP',
  'LABELS',
  'DIAGRAMS AND ILLUSTRATIONS',
  'Frnted and bound',
  'Copyright',
  '© Wine & Spirit',
  'MAPS',
  'PRINTED AND BOUND',
  'PHOTOGRAPHIC CRLOITS',
];

const TOC_MARKERS = [
  'Contents',
  'Introduction',
  'Foreword',
];

// ── OCR word corrections ───────────────────────────────────────────

const WORD_FIXES = [
  // Very common OCR character swaps
  [/\bwithen\b/gi, 'when'],
  [/\bwiten\b/gi, 'when'],
  [/\bfrem\b/gi, 'from'],
  [/\bwath\b/gi, 'with'],
  [/\bwino\b/gi, 'wine'],
  [/\bwinos\b/gi, 'wines'],
  [/\bthoy\b/gi, 'they'],
  [/\bthoir\b/gi, 'their'],
  [/\bthit\b/gi, 'that'],
  [/\bthay\b/gi, 'they'],
  [/\bthom\b/gi, 'them'],
  [/\bthoro\b/gi, 'there'],
  [/\bthore\b/gi, 'there'],
  [/\bthare\b/gi, 'there'],
  [/\bthoso\b/gi, 'those'],
  [/\bwich\b/gi, 'which'],
  [/\bwhith\b/gi, 'which'],
  [/\bwhoro\b/gi, 'where'],
  [/\bmado\b/gi, 'made'],
  [/\bhavo\b/gi, 'have'],
  [/\bsomo\b/gi, 'some'],
  [/\bcalour\b/gi, 'colour'],
  [/\bcolaur\b/gi, 'colour'],
  [/\bcoloured\b/gi, 'coloured'],
  [/\bwold\b/gi, 'world'],
  [/\bmodwm\b/gi, 'medium'],
  [/\bmedum\b/gi, 'medium'],
  [/\bmedwm\b/gi, 'medium'],
  [/\bvancties\b/gi, 'varieties'],
  [/\bvanety\b/gi, 'variety'],
  [/\bvanctal\b/gi, 'varietal'],
  [/\bdescrihe\b/gi, 'describe'],
  [/\bdescribod\b/gi, 'described'],
  [/\bdescnbed\b/gi, 'described'],
  [/\bdesciibe\b/gi, 'describe'],
  [/\bdescrbe\b/gi, 'describe'],
  [/\bdescrize\b/gi, 'describe'],
  [/\bfavour\b/gi, 'flavour'],
  [/\bflavours\b/gi, 'flavours'],
  [/\bflavoured\b/gi, 'flavoured'],
  [/\bswectness\b/gi, 'sweetness'],
  [/\bapnght\b/gi, 'upright'],
  [/\bimpossizle\b/gi, 'impossible'],
  [/\bpossble\b/gi, 'possible'],
  [/\bintensery\b/gi, 'intensely'],
  [/\bpigmented\b/gi, 'pigmented'],
  [/\bglasso\b/gi, 'glasses'],
  [/\bglas\b/gi, 'glass'],
  [/\bbocause\b/gi, 'because'],
  [/\bbocome\b/gi, 'become'],
  [/\blahis\b/gi, 'this'],
  [/\blhat\b/gi, 'that'],
  [/\bQive\b/g, 'give'],
  [/\bsech\b/gi, 'such'],
  [/\boxolore\b/gi, 'explore'],
  [/\bqualty\b/gi, 'quality'],
  [/\bquantty\b/gi, 'quantity'],
  [/\bcharactenstics\b/gi, 'characteristics'],
  [/\bclimato\b/gi, 'climate'],
  [/\btemperature\b/gi, 'temperature'],
  [/\bdifferent\b/gi, 'different'],
  [/\bdifferences\b/gi, 'differences'],
  [/\bexampe\b/gi, 'example'],
  [/\bexampies\b/gi, 'examples'],
  [/\bimportant\b/gi, 'important'],
  [/\bbetween\b/gi, 'between'],
  [/\bhowover\b/gi, 'however'],
  [/\btherefore\b/gi, 'therefore'],
  [/\bbeforo\b/gi, 'before'],
  [/\bdurng\b/gi, 'during'],
  [/\bthrough\b/gi, 'through'],
  [/\bthmughout\b/gi, 'throughout'],
  [/\bunderstandmg\b/gi, 'understanding'],
  [/\bfermoeniation\b/gi, 'fermentation'],
  [/\bmalalaclic\b/gi, 'malolactic'],
  [/\baroma\b/gi, 'aroma'],
  [/\baromas\b/gi, 'aromas'],
  [/\bbowol\b/gi, 'bowl'],
  [/\bbarrel\b/gi, 'barrel'],
  [/\bstainless\b/gi, 'stainless'],
  [/\bscowth\b/gi, 'south'],
  [/\bnarth\b/gi, 'north'],
  [/\bwost\b/gi, 'west'],
  [/\bregions\b/gi, 'regions'],
  [/\bcountres\b/gi, 'countries'],
  [/\bstyies\b/gi, 'styles'],
  [/\bqust\b/gi, 'just'],
  [/\bwoll\b/gi, 'well'],
  [/\bgcod\b/gi, 'good'],
  [/\bhighor\b/gi, 'higher'],
  [/\blowor\b/gi, 'lower'],
  [/\bswirling\b/gi, 'swirling'],
  [/\bswul\b/gi, 'swirl'],
  [/\bdescrihe\b/gi, 'describe'],
  [/\btannin\b/gi, 'tannin'],
  [/\btannins\b/gi, 'tannins'],
  [/\bacidity\b/gi, 'acidity'],
  [/\balcohol\b/gi, 'alcohol'],
  [/\bliguid\b/gi, 'liquid'],
  [/\bcarbon\b/gi, 'carbon'],
  [/\bdioxide\b/gi, 'dioxide'],
  [/\bcarDon\b/g, 'carbon'],
  [/\bycast\b/gi, 'yeast'],
  [/\bproduct\b/gi, 'produce'],
  [/\bproduced\b/gi, 'produced'],
  [/\bprocess\b/gi, 'process'],
  [/\bresult\b/gi, 'result'],
  [/\bdovelop\b/gi, 'develop'],
  [/\bdoveloped\b/gi, 'developed'],
  [/\bdovelopment\b/gi, 'development'],
  [/\bChardonnay\b/g, 'Chardonnay'],
  [/\bSauvignon\b/g, 'Sauvignon'],
  [/\bCaberret\b/g, 'Cabernet'],
  [/\bCabornet\b/g, 'Cabernet'],
  [/\bPinet\b(?=\s*Noir)/g, 'Pinot'],
  [/\bPinet\b(?=\s*Gris)/g, 'Pinot'],
  [/\bPinet\b(?=\s*Grigio)/g, 'Pinot'],
  [/\bMeriat\b/g, 'Merlot'],
  [/\bSyaah\b/g, 'Syrah'],
  [/\bShivaz\b/g, 'Shiraz'],
  [/\bTempranillo\b/g, 'Tempranillo'],
  [/\bNebbiolo\b/g, 'Nebbiolo'],
  [/\bSangiovese\b/g, 'Sangiovese'],
  [/\bBordeaux\b/g, 'Bordeaux'],
  [/\bBurgundy\b/g, 'Burgundy'],
  [/\bChampagne\b/g, 'Champagne'],
  [/\bAlsace\b/g, 'Alsace'],
  [/\bBourgogne\b/g, 'Bourgogne'],
  [/\bappellation\b/gi, 'appellation'],
  [/\bContrdlée\b/g, 'Contrôlée'],
  [/\bwold\b/gi, 'world'],
  [/\bcontribute\b/gi, 'contribute'],
  [/\btooindividuat\b/gi, 'to individual'],
  [/\bEr\b/gi, 'or'],
  [/\bEr\b/gi, 'or'],
];

// ── English word plausibility ────────────────────────────────────────

// Check if a single "word" looks like plausible English
function looksLikeEnglishWord(word) {
  if (word.length <= 1) return true; // single chars are fine (I, a, etc.)
  if (/^\d+$/.test(word)) return true; // numbers are fine

  // Must have at least one vowel (y counts as a vowel in many English words)
  if (!/[aeiouy]/i.test(word)) return false;

  // No 5+ consecutive consonants (English doesn't do this)
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(word)) return false;

  // For longer words, check consonant-to-vowel ratio
  if (word.length >= 4) {
    const vowels = (word.match(/[aeiouy]/gi) || []).length;
    const consonants = (word.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length;
    // More than 4 consonants per vowel is extremely unlikely in English
    if (consonants > vowels * 4) return false;
    // Word must be at least 25% vowels
    if (vowels / word.length < 0.2) return false;
  }

  return true;
}

// Check what fraction of words in a line look like real English
function englishWordRatio(line) {
  const words = line.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) return 1; // too short to judge

  let plausible = 0;
  for (const word of words) {
    if (looksLikeEnglishWord(word)) plausible++;
  }
  return plausible / words.length;
}

// ── Known garbage patterns (recurring OCR noise) ─────────────────────

const GARBAGE_PATTERNS = [
  /TEEPE\s+LT\s+or\s+UEC\s+TR\s+PRUE/i,
  /BE\s+EE\s+ET\s+EE\s+HE/i,
  /CURIE\s+EER\s+TY/i,
  /EH\s+ETH\s+US\s+TH\s+ERE/i,
  /ET\s+I\s+LE\s+ET\s+EL\s+TLE/i,
  /E1\s+SHINS\s+CIOUS/i,
  /GCHSHEENRYTEER/i,
  /PEELESALT/i,
  /RPI\s+SR\s+TL\s+EA\s+RCT/i,
  /SCS\s+RPI/i,
  /PRUE\s+RE\s+BT\s+SF\s+ETRE/i,
  /FENPURETTLSNRRI/i,
  /DRTEREEERE/i,
  /PRINPAERHE/i,
  /BENCHGRAFTINGTG/i,
  /ABHEADGRAFTING/i,
  /CERNE\s+TT\s+SER\s+FRE\s+BREE/i,
  /ECLEETREYDETRTYPE/i,
  /REAPTTEREHEYJIEPEETEERPTERY/i,
  /FTTINLSENFCOFIRETERFERISTREPSHELIN/i,
  /SETATHETLNSRIETERRESTUNTIEPRMERTESCA/i,
  /JEEEELLPEELRECEPRRTARTEPRTRIERECENTER/i,
  /EIUITUNTSUESSVEBLEERESTPRNSETHSHWEBEBFETHTEYTERESTRBARETRIERRLSENTHES/i,
  /TPELROCSITETANEEEANNCEENRTPPICHTETEOSPERELSPRATERTLREDSE/i,
];

function isKnownGarbage(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  for (const pat of GARBAGE_PATTERNS) {
    if (pat.test(trimmed)) return true;
  }
  return false;
}

// ── Line quality scoring ────────────────────────────────────────────

function lineQuality(line) {
  const trimmed = line.trim();
  if (!trimmed) return 0;

  const alpha = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const numeric = (trimmed.match(/[0-9]/g) || []).length;
  const special = (trimmed.match(/[^a-zA-Z0-9\s.,;:'"()\-–—]/g) || []).length;
  const total = trimmed.length;

  // Pure garbage check
  if (alpha === 0 && total > 3) return 0;
  if (special > alpha * 0.4) return 0;
  if (alpha < 3 && total > 10) return 0;

  // Check English word plausibility — if >50% of words don't look like English, garbage
  const words = trimmed.split(/\s+/);
  if (words.length >= 3) {
    const engRatio = englishWordRatio(trimmed);
    if (engRatio < 0.45) return 0;
  }

  // Quality score: higher is better
  const wordCount = words.length;
  // Real text has words of reasonable length
  const avgWordLen = alpha / Math.max(wordCount, 1);
  if (avgWordLen < 1.5 && wordCount > 3) return 0;
  if (avgWordLen > 15) return 0;

  return alpha / Math.max(total, 1);
}

// ── Main cleaning function ──────────────────────────────────────────

function cleanOcrText(rawText) {
  // Split into pages
  const pageSplitter = /\n?--- Page \d+ ---\n?/;
  const pages = rawText.split(pageSplitter);
  const cleanedPages = [];

  for (let i = 0; i < pages.length; i++) {
    let pageText = pages[i];
    if (!pageText.trim()) continue;

    const lowerPage = pageText.toLowerCase();

    // ── Skip known noise pages ──
    const noiseMatches = NOISE_MARKERS.filter(m => lowerPage.includes(m.toLowerCase()));
    if (noiseMatches.length >= 2) continue;

    // TOC detection: pages with many lines ending in numbers
    const lines = pageText.split('\n');
    const tocLines = lines.filter(l => /^\s*.+\s+\d{1,3}\s*$/.test(l.trim()));
    if (tocLines.length > 5 && lines.length < 50) continue;

    // ── Line-level cleaning ──
    const cleanLines = [];
    let consecGarbage = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        cleanLines.push('');
        continue;
      }

      // Skip lines that look like page headers/footers
      if (/^(WSET|Wine & Spirit|wsetglobal)/i.test(trimmed) && trimmed.length < 40) continue;

      // Skip page number lines
      if (/^\s*\d{1,3}\s*$/.test(trimmed)) continue;

      // Known garbage patterns
      if (isKnownGarbage(trimmed)) {
        continue;
      }

      // Quality filter
      const quality = lineQuality(trimmed);
      if (quality < 0.25) {
        consecGarbage++;
        if (consecGarbage > 4) continue; // skip but don't reset
        continue;
      }
      consecGarbage = 0;

      // Clean stray pipe characters and layout artifacts
      let cleaned = trimmed
        .replace(/^\|\s*/, '')
        .replace(/\s*\|$/, '')
        .replace(/^\|\s*/, '')
        .replace(/\s*\|$/, '');

      // Remove lines that are just special characters
      if (/^[\|\s\-_=~^\.·•\+]+$/.test(cleaned)) continue;

      // Remove lines with very high special character ratio
      const alpha = (cleaned.match(/[a-zA-Z]/g) || []).length;
      if (alpha < 3 && cleaned.length > 20) continue;

      cleanLines.push(cleaned);
    }

    // Skip pages with too few quality lines
    const qualityLines = cleanLines.filter(l => l.trim().length > 0);
    if (qualityLines.length < 4) continue;

    pageText = cleanLines.join('\n');

    // ── Apply OCR corrections ──
    for (const [pattern, replacement] of WORD_FIXES) {
      pageText = pageText.replace(pattern, replacement);
    }

    // Fix merged words (lowercase→Uppercase without space)
    pageText = pageText.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Fix hyphenated line breaks
    pageText = pageText.replace(/(\w+)-\n(\w+)/g, '$1$2');

    // Join lines within paragraphs (lowercase continues on next line)
    pageText = pageText.replace(/([a-z,])\n([a-z])/g, '$1 $2');

    // Normalize whitespace
    pageText = pageText.replace(/[ \t]{2,}/g, ' ');
    pageText = pageText.replace(/\n{3,}/g, '\n\n');

    if (pageText.trim()) {
      cleanedPages.push(pageText.trim());
    }
  }

  return cleanedPages.join('\n\n');
}

// ── Run ─────────────────────────────────────────────────────────────

const files = [
  { input: 'WSET1-ocr.txt', label: 'WSET1' },
  { input: 'WSET2-ocr.txt', label: 'WSET2' },
  { input: 'WSET3-ocr.txt', label: 'WSET3' },
];

for (const { input, label } of files) {
  const inputPath = path.join(DATA_DIR, input);
  if (!fs.existsSync(inputPath)) {
    console.log(`  ${label}: not found — skipping`);
    continue;
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const cleaned = cleanOcrText(raw);

  // Overwrite the original file with cleaned version
  fs.writeFileSync(inputPath, cleaned, 'utf-8');

  const reduction = Math.round((1 - cleaned.length / raw.length) * 100);
  console.log(`  ${label}: ${raw.length.toLocaleString()} → ${cleaned.length.toLocaleString()} chars (${reduction}% cleaned)`);
}

console.log('\nDone. Original OCR files overwritten with cleaned versions.');
