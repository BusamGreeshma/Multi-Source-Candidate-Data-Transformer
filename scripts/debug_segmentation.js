import fs from 'fs';
import pdf from 'pdf-parse';

async function main() {
  const data = fs.readFileSync('input/resume.pdf');
  const parsed = await pdf(data);
  const text = parsed.text;
  
  const headers = [
    'experience', 'work history', 'employment',
    'education', 'academic background',
    'skills', 'technologies', 'core competencies',
    'summary', 'about me', 'objective'
  ];

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const sections = {};
  let currentHeader = 'header';
  sections[currentHeader] = [];

  for (const line of lines) {
    const match = headers.find(h => new RegExp(`^(?:\\d\\.\\s*)?${h}\\b`, 'i').test(line) && line.length < 25);
    if (match) {
      currentHeader = match;
      sections[currentHeader] = [];
      console.log(`Matched Header: "${match}" for line: "${line}"`);
    } else {
      sections[currentHeader].push(line);
    }
  }

  console.log('Sections keys:', Object.keys(sections));
}

main().catch(err => console.error(err));
