import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const OUTPUT_PATH = path.resolve('BusamGreeshma_greeshmabusam@gmail.com_Eightfold.pdf');

function generateDesignPDF() {
  const doc = new PDFDocument({
    margin: 36, // 0.5 inch margins to ensure it fits perfectly on exactly one page
    size: 'LETTER'
  });

  const pdfStream = fs.createWriteStream(OUTPUT_PATH);
  doc.pipe(pdfStream);

  // Styling Palette
  const primaryColor = '#0f172a'; // Slate 900
  const secondaryColor = '#0284c7'; // Sky 600
  const textColor = '#334155'; // Slate 700
  const mutedText = '#64748b'; // Slate 500
  const borderLight = '#e2e8f0';

  // Title Block
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(16).text('MULTI-SOURCE CANDIDATE DATA TRANSFORMER', { align: 'center' });
  doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(10).text('Technical Design & Architecture Document  |  Step 1 Abstract', { align: 'center' });
  doc.moveDown(0.3);

  // Metadata Header Block
  const startY = doc.y;
  doc.strokeColor(borderLight).lineWidth(1).moveTo(36, startY).lineTo(576, startY).stroke();
  doc.moveDown(0.3);
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text('Author: ', 40, doc.y, { continued: true }).font('Helvetica').fillColor(textColor).text('Busam Greeshma (greeshmabusam@gmail.com)       ', { continued: true })
     .font('Helvetica-Bold').fillColor(primaryColor).text('Target Role: ', { continued: true }).font('Helvetica').fillColor(textColor).text('Engineering Intern (Jul-Dec 2026)      ', { continued: true })
     .font('Helvetica-Bold').fillColor(primaryColor).text('Language: ', { continued: true }).font('Helvetica').fillColor(textColor).text('Node.js (ES Modules)', { align: 'right' });
  doc.moveDown(0.3);
  doc.strokeColor(borderLight).lineWidth(1).moveTo(36, doc.y).lineTo(576, doc.y).stroke();
  doc.moveDown(0.5);

  // Columns Layout Coordinates
  const colWidth = 260;
  const leftColX = 36;
  const rightColX = 316;

  // ---------------- LEFT COLUMN ----------------
  let currentY = doc.y;

  // 1. Pipeline Architecture
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('1. PIPELINE & INGESTION FLOW', leftColX, currentY);
  doc.moveDown(0.2);
  doc.fillColor(textColor).font('Helvetica').fontSize(8.5);
  doc.text('The transformer executes as a deterministic, multi-stage batch processing pipeline:', { width: colWidth });
  doc.moveDown(0.2);
  
  const pipelineSteps = [
    { name: 'Extract', desc: 'Parses structured CSVs, semi-structured ATS records, and unstructured PDF resumes.' },
    { name: 'Normalize', desc: 'Sanitizes data formats: lowercases emails; normalizes phones to E.164; maps dates to YYYY-MM; cleans skills.' },
    { name: 'Merge', desc: 'Groups candidates across files using email/phone hashes. Resolves property conflicts using source trust weights.' },
    { name: 'Validate', desc: 'Checks outputs against schema rules (types, ISO country codes, and E.164 phone formats).' },
    { name: 'Project', desc: 'Applies dynamic mappings from config.json to select fields, remap keys, and handle missing value rules.' }
  ];

  pipelineSteps.forEach(step => {
    doc.fillColor(secondaryColor).font('Helvetica-Bold').text(`• ${step.name}: `, { continued: true, width: colWidth })
       .font('Helvetica').fillColor(textColor).text(step.desc);
    doc.moveDown(0.15);
  });
  doc.moveDown(0.4);

  // 2. High-Fidelity PDF Parsing
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('2. PDF HYPERLINK & SECTION EXTRACTION');
  doc.moveDown(0.2);
  doc.fillColor(textColor).font('Helvetica').fontSize(8.5);
  doc.text('To address unstructured resumes, the extraction engine employs customized text and binary parsers:', { width: colWidth });
  doc.moveDown(0.2);

  const pdfFeatures = [
    { name: 'Section Segmentation', desc: 'Categorizes text blocks (Experience, Projects, Education, Skills) using regular expressions and fallbacks.' },
    { name: 'Annotation Link Parser', desc: 'Scans the PDF binary stream to extract embedded hyperlinks (LinkedIn, HackerRank, LeetCode, certificates) directly.' },
    { name: 'Project Link Mapping', desc: 'Scores repository URLs against project titles using a token-matching algorithm, pairing repos to projects with zero false-positives.' }
  ];

  pdfFeatures.forEach(feat => {
    doc.fillColor(secondaryColor).font('Helvetica-Bold').text(`• ${feat.name}: `, { continued: true, width: colWidth })
       .font('Helvetica').fillColor(textColor).text(feat.desc);
    doc.moveDown(0.15);
  });
  doc.moveDown(0.4);

  // 3. Schema Compliance
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('3. SCHEMAS & RELATION-TABLE SHAPING');
  doc.moveDown(0.2);
  doc.fillColor(textColor).font('Helvetica').fontSize(8.5);
  doc.text('Outputs strictly align with the default schema defined in the technical specification:', { width: colWidth });
  doc.moveDown(0.2);

  const schemaItems = [
    { field: 'Headline at Root', detail: 'Headline is formatted as a root-level string located right after the location and links keys.' },
    { field: 'Isolated Projects', detail: 'Personal projects are extracted into a root-level key (projects: [ { name, summary, github_link } ]) separate from experience.' },
    { field: 'Certifications Key', detail: 'Certifications are parsed into a root-level array and mapped to their respective Google Drive credentials in order.' },
    { field: '2D Arrays (Tables)', detail: 'Skills and Provenance are output as arrays of arrays (e.g. skills: [ [name, confidence, sources[]] ]) representing tables.' }
  ];

  schemaItems.forEach(item => {
    doc.fillColor(secondaryColor).font('Helvetica-Bold').text(`• ${item.field}: `, { continued: true, width: colWidth })
       .font('Helvetica').fillColor(textColor).text(item.detail);
    doc.moveDown(0.15);
  });
  const leftColMaxY = doc.y;

  // ---------------- RIGHT COLUMN ----------------
  doc.y = currentY; // Reset y to column start

  // 4. Merger & Conflict Resolution
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('4. MERGING & CONFLICT RESOLUTION', rightColX, doc.y);
  doc.moveDown(0.2);
  doc.fillColor(textColor).font('Helvetica').fontSize(8.5);
  doc.text('We match profiles across multiple sources. Conflicting fields are resolved using a confidence matrix:', { width: colWidth });
  doc.moveDown(0.2);

  doc.fillColor(secondaryColor).font('Helvetica-Bold').text('• Trust Weights: ', { continued: true, width: colWidth })
     .font('Helvetica').fillColor(textColor).text('Recruiter CSV holds higher trust for admin data (Name, email: 0.95). Unstructured PDF resumes are trusted for skills, experience, projects, and education (0.90).');
  doc.moveDown(0.15);

  doc.fillColor(secondaryColor).font('Helvetica-Bold').text('• Core Merges: ', { continued: true, width: colWidth })
     .font('Helvetica').fillColor(textColor).text('Deduplicates contact info. Cross-references current company titles. Unions skill catalogs.');
  doc.moveDown(0.15);

  doc.fillColor(secondaryColor).font('Helvetica-Bold').text('• Confidence Scores: ', { continued: true, width: colWidth })
     .font('Helvetica').fillColor(textColor).text('Skills get +0.05 confidence if verified in experience logs. Overall profile confidence is a weighted average of populated fields.');
  doc.moveDown(0.15);

  doc.fillColor(secondaryColor).font('Helvetica-Bold').text('• Provenance: ', { continued: true, width: colWidth })
     .font('Helvetica').fillColor(textColor).text('Every merged property logs its origin (file name and parser method) for auditable traceability.');
  doc.moveDown(0.4);

  // 5. Runtime Projection Layer
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('5. RUNTIME SCHEMA PROJECTION');
  doc.moveDown(0.2);
  doc.fillColor(textColor).font('Helvetica').fontSize(8.5);
  doc.text('A schema-agnostic projection layer reads config.json to reshape candidate outputs dynamically:', { width: colWidth });
  doc.moveDown(0.2);

  const projFeatures = [
    { name: 'Path Projection', desc: 'Supports selectors like emails[0], location.city, and 2D arrays (skills[].name).' },
    { name: 'Renaming & Toggles', desc: 'Remaps paths to custom target keys; toggles provenance and confidence metadata output.' },
    { name: 'Missing Policies', desc: 'If a path is empty, it can be set to null, omitted from result.json, or throw a validation error.' }
  ];

  projFeatures.forEach(feat => {
    doc.fillColor(secondaryColor).font('Helvetica-Bold').text(`• ${feat.name}: `, { continued: true, width: colWidth })
       .font('Helvetica').fillColor(textColor).text(feat.desc);
    doc.moveDown(0.15);
  });
  doc.moveDown(0.4);

  // 6. Edge Cases & Deferrals
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('6. EDGE CASES & SCOPE DEFERRALS');
  doc.moveDown(0.2);
  doc.fillColor(textColor).font('Helvetica').fontSize(8.5);
  
  const edgeCases = [
    { title: 'Formatting Collisions', desc: 'Low-quality inputs (spaces, parentheses) are E.164-normalized. For missing country codes, we cross-reference candidate region mapping.' },
    { title: 'Date Ambiguity', desc: 'Dates (June 2021, 06/2021, present) are parsed using a token-regex match. Missing months default to 01.' },
    { title: 'Link False-Positives', desc: 'Tokenizes and scores repository URLs against project titles, preventing mismatched project repo links.' },
    { title: 'Time-Pressure Deferral', desc: 'Deferred OCR image resume scanning and live API connection verification in favor of offline binary parsing to ensure 100% reliability.' }
  ];

  edgeCases.forEach(pt => {
    doc.fillColor(secondaryColor).font('Helvetica-Bold').text(`• ${pt.title}: `, { continued: true, width: colWidth })
       .font('Helvetica').fillColor(textColor).text(pt.desc);
    doc.moveDown(0.15);
  });

  // Footer Accent Line
  const finalY = Math.max(leftColMaxY, doc.y);
  doc.strokeColor(primaryColor).lineWidth(1).moveTo(36, finalY + 15).lineTo(576, finalY + 15).stroke();

  doc.end();

  pdfStream.on('finish', () => {
    console.log(`Successfully generated updated Technical Abstract PDF: ${OUTPUT_PATH}`);
  });
}

generateDesignPDF();
