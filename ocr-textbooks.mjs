import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';
import Tesseract from 'tesseract.js';
import pdfjsLib from 'pdfjs-dist';

const SCALE = 2.5;
const MIN_TEXT_LENGTH = 100; // Skip pages with very little text (likely images only)

function preprocessPage(ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    // Contrast stretch: push toward black or white
    const val = gray > 140 ? 255 : gray < 60 ? 0 : gray;
    pixels[i] = val;
    pixels[i + 1] = val;
    pixels[i + 2] = val;
  }
  ctx.putImageData(imgData, 0, 0);
}

async function processPDF(pdfPath, outputPath, label) {
  console.log(`\n=== Processing ${label} ===`);
  console.log(`  Input: ${pdfPath}`);

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const totalPages = doc.numPages;
  console.log(`  Pages: ${totalPages}`);

  const outStream = fs.createWriteStream(outputPath);
  let totalChars = 0;
  let pagesWithText = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: SCALE });

      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      await page.render({ canvasContext: ctx, viewport }).promise;
      preprocessPage(ctx, viewport.width, viewport.height);

      const imgBuf = canvas.toBuffer('image/png');

      const { data: { text } } = await Tesseract.recognize(imgBuf, 'eng');

      const cleaned = text.trim();
      if (cleaned.length >= MIN_TEXT_LENGTH) {
        outStream.write(`\n--- Page ${pageNum} ---\n`);
        outStream.write(cleaned + '\n');
        totalChars += cleaned.length;
        pagesWithText++;
      }

      // Progress indicator
      if (pageNum % 10 === 0 || pageNum === totalPages) {
        process.stdout.write(`\r  Page ${pageNum}/${totalPages} | ${pagesWithText} text pages | ${totalChars.toLocaleString()} chars`);
      }
    } catch (e) {
      console.error(`\n  Error on page ${pageNum}: ${e.message}`);
    }
  }

  outStream.end();
  console.log(`\n  Done: ${pagesWithText}/${totalPages} pages with text, ${totalChars.toLocaleString()} total chars`);
  return { pagesWithText, totalChars };
}

async function main() {
  const dataDir = path.join('data', 'raw', 'booklets');
  const outDir = path.join('data', 'processed');

  const tasks = [
    { file: 'WSET2.pdf', out: 'WSET2-ocr.txt', label: 'WSET2 Textbook' },
    { file: 'WSET3.pdf', out: 'WSET3-ocr.txt', label: 'WSET3 Textbook' },
    { file: 'WSET1.pdf', out: 'WSET1-ocr.txt', label: 'WSET1 Textbook' },
  ];

  console.log('WSET Textbook OCR Processor');
  console.log('===========================');

  const results = [];
  for (const task of tasks) {
    const pdfPath = path.join(dataDir, task.file);
    if (!fs.existsSync(pdfPath)) {
      console.log(`\nSkipping ${task.label} — file not found: ${pdfPath}`);
      continue;
    }
    const result = await processPDF(pdfPath, path.join(outDir, task.out), task.label);
    results.push({ ...task, ...result });
  }

  console.log('\n=== Summary ===');
  for (const r of results) {
    console.log(`  ${r.label}: ${r.pagesWithText} text pages, ${r.totalChars.toLocaleString()} chars`);
  }
  const total = results.reduce((s, r) => s + r.totalChars, 0);
  console.log(`  Total: ${total.toLocaleString()} chars`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
