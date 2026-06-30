import fs from 'fs';
import pdf from 'pdf-parse';

async function test() {
  try {
    const dataBuffer = fs.readFileSync('input/resume.pdf');
    console.log('PDF buffer size:', dataBuffer.length);
    const data = await pdf(dataBuffer);
    console.log('PDF parsed successfully!');
    console.log('Text content:');
    console.log(data.text);
  } catch (error) {
    console.error('Error parsing PDF:', error.message);
  }
}

test();
