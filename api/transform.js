import { parseCSVString } from '../src/parsers/csvParser.js';
import { parsePDFBuffer } from '../src/parsers/pdfParser.js';
import { mapATSCandidate } from '../src/parsers/atsParser.js';
import { mergeCandidateData } from '../src/merger/merger.js';
import { validateCanonicalProfile } from '../src/validator/validator.js';
import { projectProfile } from '../src/projection/projection.js';
import { normalizeEmail } from '../src/normalizers/emailNormalizer.js';
import { normalizePhone } from '../src/normalizers/phoneNormalizer.js';

/**
 * Serverless API handler for Vercel.
 * Ingests files as JSON payload and executes the pipeline online.
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { csvText, atsJson, configJson, resumeBase64 } = req.body;

    let csvCandidates = [];
    if (csvText) {
      csvCandidates = parseCSVString(csvText);
    }

    let atsCandidates = [];
    if (atsJson) {
      const parsedAts = typeof atsJson === 'string' ? JSON.parse(atsJson) : atsJson;
      const atsCand = mapATSCandidate(parsedAts);
      if (atsCand) {
        atsCandidates.push(atsCand);
      }
    }

    let pdfCandidates = [];
    if (resumeBase64) {
      const pdfBuffer = Buffer.from(resumeBase64, 'base64');
      const pdfCand = await parsePDFBuffer(pdfBuffer);
      if (pdfCand) {
        pdfCand._sourceFile = 'resume.pdf';
        pdfCandidates.push(pdfCand);
      }
    }

    if (csvCandidates.length === 0 && atsCandidates.length === 0 && pdfCandidates.length === 0) {
      return res.status(400).json({ error: 'No valid candidate inputs provided' });
    }

    const canonicalProfiles = [];
    const projectedProfiles = [];

    const findMatchAndRemove = (sourceCand, targetList) => {
      const idx = targetList.findIndex(targetCand => {
        const sourceEmails = sourceCand.email ? [normalizeEmail(sourceCand.email)] : (sourceCand.emails || []).map(normalizeEmail);
        const targetEmails = targetCand.email ? [normalizeEmail(targetCand.email)] : (targetCand.emails || []).map(normalizeEmail);
        const hasEmailMatch = sourceEmails.some(se => se && targetEmails.includes(se));

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

    const remainingPdfs = [...pdfCandidates];
    const remainingAts = [...atsCandidates];

    for (const csvCand of csvCandidates) {
      const matchingPdf = findMatchAndRemove(csvCand, remainingPdfs);
      const matchingAts = findMatchAndRemove(csvCand, remainingAts);
      const merged = mergeCandidateData(csvCand, matchingPdf, matchingAts);
      canonicalProfiles.push(merged);
    }

    for (const atsCand of remainingAts) {
      const matchingPdf = findMatchAndRemove(atsCand, remainingPdfs);
      const merged = mergeCandidateData(null, matchingPdf, atsCand);
      canonicalProfiles.push(merged);
    }

    for (const pdfCand of remainingPdfs) {
      const merged = mergeCandidateData(null, pdfCand, null);
      canonicalProfiles.push(merged);
    }

    const validationErrors = {};
    canonicalProfiles.forEach(profile => {
      const val = validateCanonicalProfile(profile);
      if (!val.isValid) {
        validationErrors[profile.full_name || 'Unknown'] = val.errors;
      }
    });

    const configObj = typeof configJson === 'string' ? JSON.parse(configJson) : (configJson || {});
    for (const profile of canonicalProfiles) {
      const projected = projectProfile(profile, configObj);
      projectedProfiles.push(projected);
    }

    return res.status(200).json({
      success: true,
      canonical: canonicalProfiles,
      projected: projectedProfiles,
      validationErrors
    });
  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({ error: error.message });
  }
}
