const { createCanvas } = require('canvas');
const pdfjsLib = require('pdfjs-dist');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'processed');
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw', 'booklets');

pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.js');

const SCALE = 2.5;

async function ocrPdf(inputName, outputName, label) {
  const pdfPath = path.join(RAW_DIR, inputName);
  const outputPath = path.join(DATA_DIR, outputName);

  if (!fs.existsSync(pdfPath)) {
    console.log(`  ${label}: PDF not found — skipping`);
    return;
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const totalPages = pdf.numPages;

  console.log(`  ${label}: ${totalPages} pages — extracting...`);

  let allText = '';

  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: SCALE });

      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const buffer = canvas.toBuffer('image/png');

      const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
        logger: () => {}
      });

      allText += `--- Page ${i} ---\n${text}\n`;
      process.stdout.write(`\r  ${label}: page ${i}/${totalPages} (${Math.round(i/totalPages*100)}%)`);
    } catch (e) {
      console.log(`\n  ${label}: Error on page ${i}: ${e.message}`);
      allText += `--- Page ${i} ---\n[OCR ERROR]\n`;
    }
  }

  console.log('');
  fs.writeFileSync(outputPath, allText, 'utf-8');
  console.log(`  ${label}: ${allText.length.toLocaleString()} chars → ${outputName}`);
}

async function main() {
  console.log('OCR Extraction from PDFs\n');

  // Process smallest first for quick feedback
  await ocrPdf('WSET1.pdf', 'WSET1-ocr.txt', 'WSET1');
  await ocrPdf('WSET2.pdf', 'WSET2-ocr.txt', 'WSET2');
  await ocrPdf('WSET3.pdf', 'WSET3-ocr.txt', 'WSET3');

  console.log('\nDone. OCR text files written to data/processed/');
}

main().catch(e => console.error('Fatal error:', e));
