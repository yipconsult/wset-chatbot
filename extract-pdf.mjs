import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Try using the simpler 'pdf-parse' with different invocation
async function extractWithPdfParse(filePath) {
  const pdf = (await import('pdf-parse')).default;
  const buf = fs.readFileSync(filePath);
  const data = await pdf(buf);
  return data.text;
}

async function main() {
  const examDir = path.join(__dirname, 'data', 'raw', 'exam-papers');
  const outDir = path.join(__dirname, 'data', 'processed');
  const files = fs.readdirSync(examDir).filter(f => f.endsWith('.pdf'));

  for (const file of files) {
    const pdfPath = path.join(examDir, file);
    const txtPath = path.join(outDir, file.replace('.pdf', '.txt'));
    try {
      const text = await extractWithPdfParse(pdfPath);
      fs.writeFileSync(txtPath, text);
      console.log(`OK: ${file} -> ${text.length} chars`);
    } catch (e) {
      console.error(`FAIL: ${file} - ${e.message}`);
    }
  }
}

main().catch(console.error);
