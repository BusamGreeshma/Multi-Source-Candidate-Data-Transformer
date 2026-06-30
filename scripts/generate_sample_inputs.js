import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const INPUT_DIR = path.resolve('input');

// Ensure input directory exists
if (!fs.existsSync(INPUT_DIR)) {
  fs.mkdirSync(INPUT_DIR, { recursive: true });
}

// 1. Generate candidate.csv
const csvContent = `name,email,phone,current_company,title
"John Doe","john.doe@example.com","+1 (555) 019-2834","TechCorp","Senior Software Engineer"
`;
fs.writeFileSync(path.join(INPUT_DIR, 'candidate.csv'), csvContent, 'utf-8');
console.log('Generated: input/candidate.csv');

// 2. Generate ats_candidate.json (semi-structured ATS source)
const atsContent = {
  candidate: {
    fullName: "John Doe",
    contactEmail: "john.doe.ats@example.com",
    cellPhone: "5550192834",
    currentEmployer: "TechCorp",
    jobTitle: "Lead Systems Architect",
    workHistory: [
      {
        employer: "TechCorp",
        role: "Lead Systems Architect",
        since: "2021-06",
        until: "Present",
        description: "Leading high-level architecture designs."
      }
    ]
  }
};
fs.writeFileSync(path.join(INPUT_DIR, 'ats_candidate.json'), JSON.stringify(atsContent, null, 2), 'utf-8');
console.log('Generated: input/ats_candidate.json');

// 2. Generate config.json
const configContent = {
  fields: [
    { path: "full_name", type: "string", required: true },
    { path: "primary_email", from: "emails[0]", type: "string", required: true },
    { path: "alternative_email", from: "emails[1]", type: "string", required: false },
    { path: "phone", from: "phones[0]", type: "string", normalize: "E164" },
    { path: "skills", from: "skills[].name", type: "string[]", normalize: "canonical" },
    { path: "years_experience", type: "number" }
  ],
  include_confidence: true,
  include_provenance: true,
  on_missing: "null"
};
fs.writeFileSync(path.join(INPUT_DIR, 'config.json'), JSON.stringify(configContent, null, 2), 'utf-8');
console.log('Generated: input/config.json');

// 3. Generate resume.pdf using pdfkit
function generatePDF() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, compress: false });
    const pdfStream = fs.createWriteStream(path.join(INPUT_DIR, 'resume.pdf'));
    doc.pipe(pdfStream);

    // Header / Name
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#2c3e50').text('John Doe', { align: 'center' });
    doc.fontSize(12).font('Helvetica-Oblique').fillColor('#7f8c8d').text('Passionate Frontend Developer & Tech Enthusiast', { align: 'center' });
    doc.moveDown(0.5);
    
    // Contact
    doc.fontSize(10).font('Helvetica').fillColor('#34495e').text('john.doe.alternative@gmail.com  |  555-019-2834  |  San Francisco, California, US', { align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#2980b9').text('linkedin.com/in/johndoe  |  github.com/johndoe  |  myportfolio.dev', { align: 'center' });
    doc.moveDown(1.5);

    // Summary
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c3e50').text('Summary');
    doc.strokeColor('#bdc3c7').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#34495e').text(
      'Passionate engineer with over 5 years of experience building modern web applications using React, Node.js, and TypeScript. Experienced in designing RESTful APIs and optimizing frontend performance.',
      { align: 'justify' }
    );
    doc.moveDown(1.5);

    // Experience
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c3e50').text('Experience');
    doc.strokeColor('#bdc3c7').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Job 1
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c3e50').text('TechCorp - Software Engineer');
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#7f8c8d').text('2021-06 - Present');
    doc.fontSize(10).font('Helvetica').fillColor('#34495e').text(
      '- Developed high-performance React dashboard applications, increasing rendering speed by 40%.\n- Integrated AWS microservices with Node.js backend systems.\n- Maintained source control workflows with Git and coordinated releases.',
      { indent: 10 }
    );
    doc.moveDown(1);

    // Job 2
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c3e50').text('WebApps LLC - Junior Developer');
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#7f8c8d').text('2019-01 - 2021-05');
    doc.fontSize(10).font('Helvetica').fillColor('#34495e').text(
      '- Assisted in building full-stack web applications using JavaScript, HTML5, and CSS3.\n- Wrote automated tests and resolved bugs in database queries.\n- Participated in agile standups and sprint planning.',
      { indent: 10 }
    );
    doc.moveDown(1.5);

    // Education
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c3e50').text('Education');
    doc.strokeColor('#bdc3c7').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#2c3e50').text('Stanford University');
    doc.fontSize(10).font('Helvetica').fillColor('#34495e').text('B.S. in Computer Science');
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#7f8c8d').text('Graduated: 2018');
    doc.moveDown(1.5);

    // Skills
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#2c3e50').text('Skills');
    doc.strokeColor('#bdc3c7').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor('#34495e').text(
      'JavaScript, TypeScript, React, Node.js, Python, SQL, Git, AWS, HTML, CSS, Docker',
      { align: 'justify' }
    );

    doc.end();

    pdfStream.on('finish', () => {
      console.log('Generated: input/resume.pdf');
      resolve();
    });

    pdfStream.on('error', (err) => {
      reject(err);
    });
  });
}

async function run() {
  await generatePDF();
}

run();

