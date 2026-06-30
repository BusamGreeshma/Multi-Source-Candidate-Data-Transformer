import fs from 'fs';

/**
 * Parses the semi-structured ATS JSON blob and maps its custom fields to the canonical candidate layout.
 * ATS Field Mapping:
 * - fullName -> full_name
 * - contactEmail -> email
 * - cellPhone -> phone
 * - currentEmployer -> current_company
 * - jobTitle -> title
 * @param {string} filePath - Absolute path to the ATS JSON file.
 * @returns {Object|null} Mapped candidate object or null if file reading fails.
 */
export function parseATSFile(filePath) {
  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const parsedJson = JSON.parse(rawData);
    return mapATSCandidate(parsedJson);
  } catch (error) {
    console.error(`Error reading ATS file at ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Maps the custom ATS keys to standard candidate schema keys.
 * @param {Object} data - Mapped JSON payload.
 * @returns {Object} Canonical structured candidate.
 */
export function mapATSCandidate(data) {
  if (!data || !data.candidate) {
    return null;
  }

  const c = data.candidate;
  
  // Map custom ATS field structures to candidate schema fields
  return {
    name: c.fullName || null,
    email: c.contactEmail || null,
    phone: c.cellPhone || null,
    current_company: c.currentEmployer || null,
    title: c.jobTitle || null,
    skills: c.skills ? [
      ...(Array.isArray(c.skills.technicalSkills) ? c.skills.technicalSkills : []),
      ...(Array.isArray(c.skills.softSkills) ? c.skills.softSkills : []),
      ...(Array.isArray(c.skills.database) ? c.skills.database : [])
    ] : [],
    education: c.collegename ? [{
      institution: c.collegename,
      degree: null,
      field: null,
      end_year: null,
      cgpa: c.cgpa || null
    }] : [],
    experience: Array.isArray(c.workHistory) ? c.workHistory.map(job => ({
      company: job.employer || null,
      title: job.role || null,
      start: job.since || null,
      end: job.until || null,
      summary: job.description || null
    })) : []
  };
}
