import fs from 'fs';
import path from 'path';
import { parseCSVFile } from './parsers/csvParser.js';
import { parsePDFBuffer } from './parsers/pdfParser.js';
import { parseATSFile } from './parsers/atsParser.js';
import { mergeCandidateData } from './merger/merger.js';
import { validateCanonicalProfile } from './validator/validator.js';
import { projectProfile } from './projection/projection.js';
import { normalizeEmail } from './normalizers/emailNormalizer.js';
import { normalizePhone } from './normalizers/phoneNormalizer.js';
import { exportProfilesToPDF } from './exporters/pdfExporter.js';

// Define input and output file paths
const INPUT_DIR = path.resolve('input');
const OUTPUT_DIR = path.resolve('output');

const CSV_PATH = path.join(INPUT_DIR, 'candidate.csv');
const PDF_PATH = path.join(INPUT_DIR, 'resume.pdf');
const ATS_PATH = path.join(INPUT_DIR, 'ats_candidate.json');
const CONFIG_PATH = path.join(INPUT_DIR, 'config.json');

const CANONICAL_OUTPUT_PATH = path.join(OUTPUT_DIR, 'canonical_profile.json');
const RESULT_OUTPUT_PATH = path.join(OUTPUT_DIR, 'result.json');

/**
 * Main orchestrator of the Multi-Source Candidate Data Transformer pipeline.
 * Processes multiple candidates, groups them across sources, and outputs lists.
 */
async function main() {
  console.log('--------------------------------------------------');
  console.log('Starting Candidate Data Transformer Pipeline...');
  console.log('--------------------------------------------------');

  try {
    // 1. Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 2. Read and Parse Structured CSV Candidates
    let csvCandidates = [];
    if (fs.existsSync(CSV_PATH)) {
      console.log(`Parsing structured CSV candidate list from ${CSV_PATH}...`);
      csvCandidates = parseCSVFile(CSV_PATH);
      console.log(`Parsed ${csvCandidates.length} candidate rows from CSV.`);
    } else {
      console.warn(`CSV input file not found at ${CSV_PATH}.`);
    }

    // 3. Read and Parse Semi-Structured ATS JSON Candidate
    let atsCandidates = [];
    if (fs.existsSync(ATS_PATH)) {
      console.log(`Parsing semi-structured ATS candidate JSON from ${ATS_PATH}...`);
      const atsCand = parseATSFile(ATS_PATH);
      if (atsCand) {
        atsCandidates.push(atsCand);
        console.log(`Parsed 1 candidate record from ATS JSON.`);
      }
    } else {
      console.warn(`ats_candidate.json not found at ${ATS_PATH}.`);
    }

    // 4. Read and Parse Unstructured Resume PDFs
    const pdfCandidates = [];
    
    // Explicitly parse the primary resume.pdf if it exists
    if (fs.existsSync(PDF_PATH)) {
      console.log(`Parsing unstructured PDF resume from ${PDF_PATH}...`);
      try {
        const pdfBuffer = fs.readFileSync(PDF_PATH);
        const pdfCand = await parsePDFBuffer(pdfBuffer);
        if (pdfCand) {
          pdfCand._sourceFile = 'resume.pdf';
          console.log(`Successfully parsed candidate from resume.pdf: ${pdfCand.full_name || 'Unknown Name'}`);
          pdfCandidates.push(pdfCand);
        }
      } catch (e) {
        console.error(`Error reading/parsing primary PDF resume.pdf:`, e.message);
      }
    } else {
      console.warn(`Primary PDF input resume not found at ${PDF_PATH}.`);
    }

    // Scan for any other PDF files in input directory
    console.log(`Scanning input directory for other resume PDF files...`);
    if (fs.existsSync(INPUT_DIR)) {
      const files = fs.readdirSync(INPUT_DIR);
      for (const file of files) {
        if (file.toLowerCase().endsWith('.pdf') && file.toLowerCase() !== 'resume.pdf' && !file.toLowerCase().startsWith('bharathsrinivas')) {
          const pdfPath = path.join(INPUT_DIR, file);
          console.log(`Parsing unstructured PDF resume from ${pdfPath}...`);
          try {
            const pdfBuffer = fs.readFileSync(pdfPath);
            const pdfCand = await parsePDFBuffer(pdfBuffer);
            if (pdfCand) {
              pdfCand._sourceFile = file;
              console.log(`Successfully parsed candidate from ${file}: ${pdfCand.full_name || 'Unknown Name'}`);
              pdfCandidates.push(pdfCand);
            }
          } catch (e) {
            console.error(`Error reading/parsing PDF ${file}:`, e.message);
          }
        }
      }
    }

    // Check if at least one source has data
    if (csvCandidates.length === 0 && atsCandidates.length === 0 && pdfCandidates.length === 0) {
      throw new Error('All candidate sources are missing or failed to parse. Cannot run pipeline.');
    }

    // 5. Match and Merge Candidates across sources using Email or Phone
    console.log('Merging candidates across CSV, PDF, and ATS sources...');
    const canonicalProfiles = [];
    const projectedProfiles = [];

    // Helper to find matches in another list
    const findMatchAndRemove = (sourceCand, targetList) => {
      const idx = targetList.findIndex(targetCand => {
        // Compare emails
        const sourceEmails = sourceCand.email ? [normalizeEmail(sourceCand.email)] : (sourceCand.emails || []).map(normalizeEmail);
        const targetEmails = targetCand.email ? [normalizeEmail(targetCand.email)] : (targetCand.emails || []).map(normalizeEmail);
        const hasEmailMatch = sourceEmails.some(se => se && targetEmails.includes(se));

        // Compare phones
        const sourcePhones = sourceCand.phone ? [normalizePhone(sourceCand.phone)] : (sourceCand.phones || []).map(normalizePhone);
        const targetPhones = targetCand.phone ? [normalizePhone(targetCand.phone)] : (targetCand.phones || []).map(normalizePhone);
        const hasPhoneMatch = sourcePhones.some(sp => sp && targetPhones.includes(sp));

        return hasEmailMatch || hasPhoneMatch;
      });

      if (idx !== -1) {
        return targetList.splice(idx, 1)[0];
      }
      return null;
    };

    // Keep temporary copies of PDF and ATS lists to consume
    const remainingPdfs = [...pdfCandidates];
    const remainingAts = [...atsCandidates];

    // First process all CSV candidates
    for (const csvCand of csvCandidates) {
      const matchingPdf = findMatchAndRemove(csvCand, remainingPdfs);
      const matchingAts = findMatchAndRemove(csvCand, remainingAts);
      
      const merged = mergeCandidateData(csvCand, matchingPdf, matchingAts);
      
      // Override PDF provenance file name to the actual filename if matched
      if (matchingPdf && matchingPdf._sourceFile) {
        merged.provenance.forEach(prov => {
          if (prov[1] === 'resume.pdf') {
            prov[1] = matchingPdf._sourceFile;
          }
        });
      }

      canonicalProfiles.push(merged);
    }

    // Process remaining ATS candidates
    for (const atsCand of remainingAts) {
      const matchingPdf = findMatchAndRemove(atsCand, remainingPdfs);
      const merged = mergeCandidateData(null, matchingPdf, atsCand);
      
      if (matchingPdf && matchingPdf._sourceFile) {
        merged.provenance.forEach(prov => {
          if (prov[1] === 'resume.pdf') {
            prov[1] = matchingPdf._sourceFile;
          }
        });
      }
      
      canonicalProfiles.push(merged);
    }

    // Process remaining PDF candidates
    for (const pdfCand of remainingPdfs) {
      const merged = mergeCandidateData(null, pdfCand, null);
      if (pdfCand._sourceFile) {
        merged.provenance.forEach(prov => {
          if (prov[1] === 'resume.pdf') {
            prov[1] = pdfCand._sourceFile;
          }
        });
      }
      canonicalProfiles.push(merged);
    }

    // 6. Validate each merged profile
    console.log(`Validating ${canonicalProfiles.length} canonical candidate profiles...`);
    canonicalProfiles.forEach(profile => {
      const validation = validateCanonicalProfile(profile);
      if (!validation.isValid) {
        console.warn(`Canonical schema validation warning for ${profile.full_name || 'Unknown'}:`);
        validation.errors.forEach(err => console.warn(` - [Warning] ${err}`));
      }
    });

    // 7. Load custom runtime output config and project profiles
    console.log(`Loading runtime output schema configuration from ${CONFIG_PATH}...`);
    let config = {};
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      } catch (err) {
        console.error(`Malformed config.json. Falling back to default projection. Error: ${err.message}`);
      }
    } else {
      console.warn('config.json not found. Emitting default canonical profile.');
    }

    console.log('Projecting and shaping final candidate profiles...');
    for (const profile of canonicalProfiles) {
      const projected = projectProfile(profile, config);
      projectedProfiles.push(projected);
    }

    // 8. Write outputs
    console.log(`Writing canonical candidate profiles list (Default Schema) to ${CANONICAL_OUTPUT_PATH}...`);
    fs.writeFileSync(CANONICAL_OUTPUT_PATH, JSON.stringify(canonicalProfiles, null, 2), 'utf-8');

    console.log(`Writing projected candidate profiles list (Custom Configuration) to ${RESULT_OUTPUT_PATH}...`);
    fs.writeFileSync(RESULT_OUTPUT_PATH, JSON.stringify(projectedProfiles, null, 2), 'utf-8');

    const CANONICAL_PDF_PATH = path.join(OUTPUT_DIR, 'canonical_profile.pdf');
    console.log(`Writing canonical candidate profiles list (PDF format) to ${CANONICAL_PDF_PATH}...`);
    await exportProfilesToPDF(canonicalProfiles, CANONICAL_PDF_PATH);

    console.log('--------------------------------------------------');
    console.log('Pipeline finished successfully!');
    console.log(`- Canonical Output: ${CANONICAL_OUTPUT_PATH}`);
    console.log(`- Canonical PDF: ${CANONICAL_PDF_PATH}`);
    console.log(`- Configured Result: ${RESULT_OUTPUT_PATH}`);
    console.log('--------------------------------------------------');
  } catch (error) {
    console.error('Fatal pipeline execution error:', error.message);
    process.exit(1);
  }
}

// Execute pipeline
main();
