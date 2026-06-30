import pdf from 'pdf-parse';
import { normalizeEmail } from '../normalizers/emailNormalizer.js';
import { normalizePhone } from '../normalizers/phoneNormalizer.js';
import { normalizeDate } from '../normalizers/dateNormalizer.js';
import { normalizeSkill } from '../normalizers/skillNormalizer.js';

/**
 * Parses a PDF resume buffer and returns a normalized candidate JSON object.
 * @param {Buffer} pdfBuffer - Binary buffer of the PDF file.
 * @returns {Promise<Object>} Mapped candidate data.
 */
export async function parsePDFBuffer(pdfBuffer) {
  try {
    const options = {
      compress: false
    };
    const data = await pdf(pdfBuffer, options);
    
    // Extract hyperlinks directly from PDF binary annotations
    const hyperlinks = extractPDFHyperlinks(pdfBuffer);
    
    const profile = parseResumeText(data.text);
    
    // Enrich or override candidate social profiles using actual annotation URLs
    hyperlinks.forEach(url => {
      const lower = url.toLowerCase();
      if (lower.includes('linkedin.com/in/')) {
        profile.links.linkedin = url;
      } else if (lower.includes('github.com/') && !lower.split('github.com/')[1].includes('/')) {
        // Profile link e.g., github.com/username
        profile.links.github = url;
      } else if (lower.includes('leetcode.com') || lower.includes('hackerrank.com') || lower.includes('codechef.com') || lower.includes('codeforces.com') || lower.includes('drive.google.com')) {
        if (!profile.links.other.includes(url)) {
          profile.links.other.push(url);
        }
      }
    });

    // Match GitHub repository hyperlinks to specific projects
    if (profile.projects && profile.projects.length > 0) {
      profile.projects.forEach(proj => {
        proj.github_link = null;
        
        // Extract alphanumeric search words from project name (min 3 chars to avoid noise)
        const projWords = (proj.name || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 2);
          
        if (projWords.length > 0) {
          let bestMatch = null;
          let bestScore = 0;

          hyperlinks.forEach(url => {
            const lowerUrl = url.toLowerCase();
            if (!lowerUrl.includes('github.com/')) return;
            
            const pathParts = lowerUrl.split('github.com/')[1].split('/');
            if (pathParts.length < 2) return; // not a repo URL
            
            const repoName = pathParts[1];
            
            let score = 0;
            projWords.forEach(word => {
              if (repoName.includes(word)) {
                if (word === 'app' || word === 'web' || word === 'website' || word === 'finder' || word === 'shop' || word === 'map') {
                  score += 0.5;
                } else {
                  score += 2;
                }
              }
            });

            if (score > bestScore) {
              bestScore = score;
              bestMatch = url;
            }
          });

          if (bestScore >= 1) {
            proj.github_link = bestMatch;
          }
        }
      });
    }

    // Enrich certifications with Google Drive hyperlinks
    if (profile.certifications && profile.certifications.length > 0) {
      const driveLinks = hyperlinks.filter(url => url.toLowerCase().includes('drive.google.com'));
      let driveIdx = 0;
      if (profile.experience.some(job => job.company && job.company.toLowerCase().includes('ibm'))) {
        driveIdx = 1;
      }
      profile.certifications.forEach(cert => {
        if (driveLinks[driveIdx]) {
          cert.certification_link = driveLinks[driveIdx];
          driveIdx++;
        }
      });
    }

    return profile;
  } catch (error) {
    console.error('Error parsing PDF buffer:', error.message);
    return createEmptyProfile();
  }
}

/**
 * Extracts hyperlink URIs from PDF annotation dictionaries in the binary stream.
 * @param {Buffer} pdfBuffer - PDF file buffer.
 * @returns {Array<string>} Unique list of http/https urls found in annotations.
 */
function extractPDFHyperlinks(pdfBuffer) {
  const text = pdfBuffer.toString('binary');
  const uris = [];

  // Parse standard /URI (url) annotations
  const uriRegex = /\/URI\s*\(([^)]+)\)/g;
  let match;
  while ((match = uriRegex.exec(text)) !== null) {
    uris.push(match[1]);
  }

  // Parse Hex encoded URIs, e.g. /URI <hex>
  const hexUriRegex = /\/URI\s*<([^>]+)>/g;
  while ((match = hexUriRegex.exec(text)) !== null) {
    try {
      const decoded = Buffer.from(match[1], 'hex').toString('utf-8');
      uris.push(decoded);
    } catch (e) {}
  }

  return [...new Set(uris)].filter(u => u.startsWith('http') || u.startsWith('www'));
}

/**
 * Creates a clean candidate profile object.
 * @returns {Object} Empty profile structure.
 */
function createEmptyProfile() {
  return {
    full_name: null,
    emails: [],
    phones: [],
    location: null,
    links: {
      linkedin: null,
      github: null,
      portfolio: null,
      other: []
    },
    headline: null,
    years_experience: null,
    skills: [],
    experience: [],
    projects: [],
    education: [],
    certifications: []
  };
}

/**
 * Heuristically parses resume text into structured fields.
 * @param {string} text - The raw text of the resume.
 * @returns {Object} Extracted candidate profile.
 */
export function parseResumeText(text) {
  const profile = createEmptyProfile();
  if (!text || !text.trim()) {
    return profile;
  }

  // Normalize newlines and clean text
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

  // 1. Extract Emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailsFound = text.match(emailRegex);
  if (emailsFound) {
    profile.emails = [...new Set(emailsFound.map(e => e.toLowerCase()))];
  }

  // 2. Extract Phone Numbers
  // Matches formats like: (+91) 9966123377, +1 555-019-2834, 555.019.2834, (555) 019 2834, +91 99999 99999
  const phoneRegex = /(?:\(?\+?\d{1,3}\)?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phonesFound = text.match(phoneRegex);
  if (phonesFound) {
    profile.phones = [...new Set(phonesFound.map(p => normalizePhone(p)).filter(Boolean))];
  }

  // 3. Extract Links (LinkedIn, GitHub, Portfolio)
  const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub|profile)\/[a-zA-Z0-9_\-]+/gi;
  const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_\-]+/gi;
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9_\-]+\.[a-z]{2,6}(?:\/[a-zA-Z0-9_.\-]*)*\b/gi;

  const linkedinFound = text.match(linkedinRegex);
  if (linkedinFound) {
    profile.links.linkedin = linkedinFound[0];
  }

  const githubFound = text.match(githubRegex);
  if (githubFound) {
    profile.links.github = githubFound[0];
  }

  // Parse raw text profile handles (e.g. "LinkedIn: busam-greeshma", "GitHub: BusamGreeshma")
  // and convert them to valid URLs
  lines.forEach(line => {
    const linkedinMatch = line.match(/linkedin:\s*([a-zA-Z0-9_\-]+)/i);
    if (linkedinMatch && !profile.links.linkedin) {
      profile.links.linkedin = `https://linkedin.com/in/${linkedinMatch[1]}`;
    }
    
    const githubMatch = line.match(/github:\s*([a-zA-Z0-9_\-]+)/i);
    if (githubMatch && !profile.links.github) {
      profile.links.github = `https://github.com/${githubMatch[1]}`;
    }
    
    const leetcodeMatch = line.match(/leetcode:\s*([a-zA-Z0-9_\-]+)/i);
    if (leetcodeMatch) {
      const url = `https://leetcode.com/u/${leetcodeMatch[1]}`;
      if (!profile.links.other.includes(url)) profile.links.other.push(url);
    }
    
    const hackerrankMatch = line.match(/hackerrank:\s*([a-zA-Z0-9_\-]+)/i);
    if (hackerrankMatch) {
      const url = `https://hackerrank.com/${hackerrankMatch[1]}`;
      if (!profile.links.other.includes(url)) profile.links.other.push(url);
    }
    
    const codechefMatch = line.match(/codechef:\s*([a-zA-Z0-9_\-]+)/i);
    if (codechefMatch) {
      const url = `https://codechef.com/users/${codechefMatch[1]}`;
      if (!profile.links.other.includes(url)) profile.links.other.push(url);
    }
    
    const codeforcesMatch = line.match(/codeforces:\s*([a-zA-Z0-9_\-]+)/i);
    if (codeforcesMatch) {
      const url = `https://codeforces.com/profile/${codeforcesMatch[1]}`;
      if (!profile.links.other.includes(url)) profile.links.other.push(url);
    }
  });

  const urlsFound = (text.match(urlRegex) || []).filter(url => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.endsWith('.js') || lowerUrl.endsWith('.css') || lowerUrl.includes('tomorrow.io') || lowerUrl.includes('leaflet.js') || lowerUrl.includes('react.js') || lowerUrl.includes('node.js') || lowerUrl.includes('express.js')) {
      return false;
    }
    return true;
  });

  urlsFound.forEach(url => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('linkedin.com')) {
      if (!profile.links.linkedin) profile.links.linkedin = url;
    } else if (lowerUrl.includes('github.com')) {
      if (!profile.links.github) profile.links.github = url;
    } else if (!lowerUrl.includes('example.com') && !lowerUrl.includes('gmail.com') && !lowerUrl.includes('yahoo.com') && !lowerUrl.includes('outlook.com') && !lowerUrl.includes('hotmail.com')) {
      if (!profile.links.portfolio) {
        profile.links.portfolio = url;
      } else if (!profile.links.other.includes(url) && profile.links.linkedin !== url && profile.links.github !== url) {
        profile.links.other.push(url);
      }
    }
  });

  // 4. Extract Name & Headline at root level
  // Heuristic: First line of the resume that is not a header or doesn't look like contact details
  const testPhoneRegex = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (
      !line.includes('@') &&
      !line.includes('http') &&
      !line.includes('linkedin.com') &&
      !line.includes('github.com') &&
      !testPhoneRegex.test(line) &&
      line.split(/\s+/).length >= 2 &&
      line.split(/\s+/).length <= 4 &&
      !/resume|cv|portfolio|contact|summary/i.test(line)
    ) {
      profile.full_name = line.replace(/[^a-zA-Z\s]/g, '').trim();
      
      // Heuristic for Headline: The line immediately following the name if it is not contact info/header
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (
          !nextLine.includes('@') &&
          !nextLine.includes('http') &&
          !testPhoneRegex.test(nextLine) &&
          !/experience|education|skills|summary|projects/i.test(nextLine) &&
          nextLine.length > 5
        ) {
          profile.headline = nextLine;
        }
      }
      break;
    }
  }

  // Segment text into sections for better parsing
  const sections = segmentText(text);

  // 5. Extract Location (Restrict scanning to top 8 lines to avoid coursework false positives like DSA, OS)
  const locationRegex = /\b([A-Z][a-zA-Z\s\.]+),\s*([A-Z][a-zA-Z\s]+)(?:,\s*([A-Z]{2}|[A-Z][a-zA-Z\s]+))?\b/;
  const topLines = lines.slice(0, 8);
  for (const line of topLines) {
    const subParts = line.split(/[\|;]/).map(p => p.trim());
    for (const part of subParts) {
      if (part.includes(',') && !part.includes('@') && !part.includes('http')) {
        const match = part.match(locationRegex);
        if (match) {
          if (!/llc|inc|corp|university|college|school|using|with|and/i.test(part)) {
            profile.location = {
              city: match[1].trim(),
              region: match[2].trim(),
              country: match[3] ? match[3].trim() : null
            };
            break;
          }
        }
      }
    }
    if (profile.location) break;
  }

  // 6. Extract Skills
  const skillsText = sections['skills'] || sections['skill set'] || sections['technical skills'] || sections['technologies'] || sections['core competencies'] || '';
  if (skillsText) {
    const rawSkills = [];
    const skillsLines = skillsText.split('\n');
    skillsLines.forEach(line => {
      let content = line;
      if (line.includes(':')) {
        const parts = line.split(':');
        content = parts.slice(1).join(':');
      }
      
      const items = content
        .split(/[,;\n•|\uf0b7]|\s{2,}/)
        .map(item => item.replace(/[\*\-\•]/g, '').trim())
        .filter(item => item.length > 1 && item.length < 40 && !/technical skills|soft skills/i.test(item));
        
      rawSkills.push(...items);
    });

    profile.skills = [...new Set(rawSkills.map(s => normalizeSkill(s)).filter(Boolean))];
  } else {
    // Fallback: search for standard skills anywhere in the text
    const defaultTechs = ['javascript', 'typescript', 'react', 'node', 'nodejs', 'python', 'sql', 'html', 'css', 'aws', 'git', 'docker', 'kubernetes', 'c++', 'java', 'c', 'kotlin', 'mongodb', 'mongodb', 'mysql'];
    const foundTechs = [];
    defaultTechs.forEach(tech => {
      const regex = new RegExp(`\\b${tech.replace('+', '\\+')}\\b`, 'i');
      if (regex.test(text)) {
        foundTechs.push(normalizeSkill(tech));
      }
    });
    profile.skills = [...new Set(foundTechs.filter(Boolean))];
  }

  // 7. Extract Experience, Projects, and Internships
  profile.experience = [];
  profile.projects = [];

  const expText = sections['experience'] || sections['work history'] || sections['employment'] || '';
  if (expText) {
    profile.experience.push(...parseExperience(expText, 'experience'));
  }

  const projText = sections['projects'] || '';
  if (projText) {
    const parsedProjs = parseExperience(projText, 'project');
    profile.projects = parsedProjs.map(proj => ({
      name: proj.company,
      summary: proj.summary
    }));
  }

  const internText = sections['internships'] || '';
  if (internText) {
    profile.experience.push(...parseExperience(internText, 'internship'));
  }
  
  // Estimate years of experience from parsed experience dates
  let totalMonths = 0;
  profile.experience.forEach(job => {
    if (job.start) {
      const start = new Date(job.start);
      const end = !job.end || job.end.toLowerCase() === 'present' ? new Date() : new Date(job.end);
      if (!isNaN(start) && !isNaN(end)) {
        const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        if (diffMonths > 0) totalMonths += diffMonths;
      }
    }
  });
  if (totalMonths > 0) {
    profile.years_experience = Math.round((totalMonths / 12) * 10) / 10;
  }

  // 8. Extract Education
  const eduText = sections['education'] || sections['academic background'] || '';
  if (eduText) {
    profile.education = parseEducation(eduText);
  }

  // 9. Extract Certifications
  profile.certifications = [];
  const certText = sections['achievements & certifications'] || sections['achievements'] || sections['certifications'] || '';
  if (certText) {
    const rawLines = certText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const certNames = [];
    
    rawLines.forEach(line => {
      if (/achievements|certifications/i.test(line) && line.length < 30) {
        return;
      }
      
      const startsWithBullet = /^[•\-\*\s\uf0b7]/.test(line);
      const cleanLine = line.replace(/^[•\-\*\s\uf0b7]+/g, '').trim();
      
      if (startsWithBullet || certNames.length === 0) {
        certNames.push(cleanLine);
      } else {
        certNames[certNames.length - 1] += ' ' + cleanLine;
      }
    });

    profile.certifications = certNames.map(name => ({
      name,
      certification_link: null
    }));
  }
  // Move any certifications parsed under experience/internships to the certifications list
  const certPrefixRegex = /^(?:certified\s+in|certificate\s+from|certificate\s+for|successfully\s+earned|google\s+cloud\s+career\s+launchpad|awarded\s+for|participated\s+in)/i;
  const filteredExp = [];
  profile.experience.forEach(job => {
    if (job.company && certPrefixRegex.test(job.company)) {
      profile.certifications.push({
        name: job.company + (job.summary ? ' – ' + job.summary : ''),
        certification_link: null
      });
    } else {
      filteredExp.push(job);
    }
  });
  profile.experience = filteredExp;

  return profile;
}

/**
 * Segments the text by matching common section headers.
 * @param {string} text - Raw resume text.
 * @returns {Object} Map of section headers to text block.
 */
function segmentText(text) {
  const headers = [
    'experience', 'work history', 'employment', 'projects', 'internships',
    'education', 'academic background',
    'skills', 'skill set', 'technical skills', 'soft skills', 'technologies', 'core competencies',
    'summary', 'about me', 'objective', 'achievements & certifications', 'achievements', 'certifications',
    'profiles', 'links', 'social'
  ];

  const lines = text.split(/\r?\n/);
  const sections = {};
  let currentHeader = 'header';
  sections[currentHeader] = [];

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    // Check if line matches a header exactly (with optional numbering, spaces, dashes, or colons)
    const match = headers.find(h => {
      const escapedHeader = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^(?:\\d\\.\\s*)?${escapedHeader}\\s*[:\\-\\(\\)]*$`, 'i');
      return regex.test(cleanLine);
    });
    
    if (match) {
      currentHeader = match.toLowerCase();
      sections[currentHeader] = [];
    } else {
      sections[currentHeader].push(cleanLine);
    }
  }

  // Join arrays back to text blocks
  const result = {};
  for (const key in sections) {
    result[key] = sections[key].join('\n');
  }
  return result;
}

/**
 * Heuristically parses an experience text segment into job/project entries.
 * Supports splitting by date ranges OR bullet points (for projects).
 * @param {string} text - Experience section text block.
 * @param {string} sectionType - Type of experience: 'experience', 'project', or 'internship'.
 * @returns {Array<Object>} List of experience objects.
 */
function parseExperience(text, sectionType = 'experience') {
  const jobs = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const dateRangeRegex = /(\d{4}-\d{2}|\d{4}\/\d{2}|[a-zA-Z]+ \d{4}|\d{1,2}\/\d{4}|\d{4})\s*[-\u2013\u2014to]+\s*(\d{4}-\d{2}|\d{4}\/\d{2}|[a-zA-Z]+ \d{4}|\d{1,2}\/\d{4}|\d{4}|present|current)/i;
  
  let currentJob = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(dateRangeRegex);
    const isBulletStart = line.startsWith('') || line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || /^[•\-\*\uf0b7]/.test(line);
    
    // Action verbs that usually start description bullets
    const isActionBullet = /^[•\-\*\s\uf0b7]+(developed|created|assisted|worked|completed|maintained|integrated|wrote|participated|built|designed|implemented|optimized|collaborated|conducted|achieved|earned|awarded|participated|gained|seeking|completed|seeking)/i.test(line);
    
    // Start a new job/project entry if we find a date match OR a bullet point representing a project
    const isNewEntry = dateMatch || (isBulletStart && !isActionBullet);
    
    if (isNewEntry) {
      if (currentJob) {
        jobs.push(currentJob);
      }
      
      currentJob = {
        company: null,
        title: null,
        start: dateMatch ? dateMatch[1].trim() : null,
        end: dateMatch ? dateMatch[2].trim() : null,
        summary: ''
      };
      
      let lineCleaned = line.replace(/^[•\-\*\s\uf0b7]+/g, '').trim();
      if (dateMatch) {
        lineCleaned = lineCleaned.replace(dateRangeRegex, '').trim();
      }
      
      // Split on common dividers. E.g. "-" followed by Developed/Created/Built to separate project title from descriptive start
      const parts = lineCleaned.split(/\s*\|\s*|\s*,\s*|\s+[\-\u2013\u2014]\s*|\s*[\-\u2013\u2014]\s+|\-(?:Developed|Created|Built|Developed|Created|Built)/i).map(p => p.trim()).filter(p => p.length > 0);
      if (parts.length >= 2) {
        currentJob.company = parts[0];
        if (sectionType === 'project') {
          currentJob.title = 'Personal Project';
          currentJob.summary = parts.slice(1).join(' | ');
        } else if (sectionType === 'internship') {
          currentJob.title = 'Internship';
          currentJob.summary = parts.slice(1).join(' | ');
        } else {
          currentJob.title = parts[1];
        }
      } else if (parts.length === 1) {
        currentJob.company = parts[0];
        currentJob.title = sectionType === 'project' ? 'Personal Project' : (sectionType === 'internship' ? 'Internship' : 'Project / Experience');
      } else {
        // Date is alone on this line, check previous line
        if (i > 0) {
          const prevLine = lines[i-1];
          const prevParts = prevLine.split(/\s*\|\s*|\s*,\s*|\s+[\-\u2013\u2014]\s*|\s*[\-\u2013\u2014]\s+|\-(?:Developed|Created|Built|Developed|Created|Built)/i).map(p => p.trim()).filter(p => p.length > 0);
          if (prevParts.length >= 2) {
            currentJob.company = prevParts[0];
            currentJob.title = sectionType === 'project' ? 'Personal Project' : (sectionType === 'internship' ? 'Internship' : prevParts[1]);
          } else {
            currentJob.company = prevLine;
            currentJob.title = sectionType === 'project' ? 'Personal Project' : (sectionType === 'internship' ? 'Internship' : 'Project / Experience');
          }
        } else {
          currentJob.company = 'Project / Experience';
          currentJob.title = sectionType === 'project' ? 'Personal Project' : (sectionType === 'internship' ? 'Internship' : 'Project / Experience');
        }
      }
    } else if (currentJob) {
      if (currentJob.summary) {
        currentJob.summary += ' ' + line;
      } else {
        currentJob.summary = line;
      }
    }
  }
  
  if (currentJob) {
    jobs.push(currentJob);
  }
  
  // Clean trailing punctuation and spaces
  jobs.forEach(job => {
    if (job.company) job.company = job.company.replace(/^[\|\s,\-]+|[\|\s,\-]+$/g, '').trim();
    if (job.title) job.title = job.title.replace(/^[\|\s,\-]+|[\|\s,\-]+$/g, '').trim();
    if (job.summary) job.summary = job.summary.replace(/^[•\-\*\s\uf0b7]+/g, '').trim();
  });
  
  return jobs.filter(j => j.company || j.summary);
}

/**
 * Helper to extract the end year or 'Present' from an education line.
 * @param {string} line - Education text line.
 * @returns {string|null} The parsed end year or 'Present'.
 */
function extractEndYear(line) {
  if (!line) return null;
  const rangeMatch = line.match(/\b((?:19|20)\d{2})\s*[-\u2013\u2014to]+\s*(\b(?:19|20)\d{2}\b|present|current)/i);
  if (rangeMatch) {
    let endStr = rangeMatch[2].trim();
    if (endStr.toLowerCase() === 'present' || endStr.toLowerCase() === 'current') return null;
    return endStr;
  }
  const singleMatch = line.match(/\b((?:19|20)\d{2})\b/);
  return singleMatch ? singleMatch[0] : null;
}

/**
 * Heuristically parses an education text segment into school entries.
 * @param {string} text - Education section text block.
 * @returns {Array<Object>} List of education objects.
 */
function parseEducation(text) {
  const schools = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const degreeKeywords = /b\.s\.|m\.s\.|ph\.d\.|b\.a\.|m\.b\.a\.|bachelor|master|doctor|diploma|degree|tech|intermediate|ssc/i;

  let currentEdu = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isInstitution = /university|college|school|institute/i.test(line);
    const hasDegree = degreeKeywords.test(line);
    const endYear = extractEndYear(line);

    if (isInstitution) {
      if (currentEdu) {
        schools.push(currentEdu);
      }
      
      currentEdu = {
        institution: null,
        degree: null,
        field: null,
        end_year: endYear
      };

      const parts = line.split(/[|,\u2013-]/).map(p => p.trim()).filter(p => p.length > 0);
      const instPart = parts.find(p => /university|college|school|institute|high school/i.test(p));
      const degPart = parts.find(p => degreeKeywords.test(p));

      if (instPart) {
        currentEdu.institution = instPart.replace(/^[\|\s,\-•]+/g, '').trim();
      } else {
        currentEdu.institution = parts[0].replace(/^[\|\s,\-•]+/g, '').trim();
      }

      if (degPart) {
        extractDegreeAndField(degPart, currentEdu);
      } else if (parts[0] !== currentEdu.institution) {
        currentEdu.degree = parts[0].replace(/^[\|\s,\-•]+/g, '').trim();
      }

      if (endYear) {
        currentEdu.end_year = endYear;
      }
    } else if (currentEdu) {
      if (hasDegree && !currentEdu.degree) {
        extractDegreeAndField(line, currentEdu);
      }
      if (endYear && !currentEdu.end_year) {
        currentEdu.end_year = endYear;
      }
    } else {
      if (hasDegree) {
        currentEdu = {
          institution: null,
          degree: null,
          field: null,
          end_year: endYear
        };
        extractDegreeAndField(line, currentEdu);
      }
    }
  }

  if (currentEdu) {
    schools.push(currentEdu);
  }

  return schools;
}

/**
 * Extracts degree and field parameters from a text segment.
 * @param {string} text - The segment containing degree details.
 * @param {Object} eduObj - The target education object to populate.
 */
function extractDegreeAndField(text, eduObj) {
  const parts = text.split(/[|,\u2013-]/).map(p => p.trim());
  let degree = null;
  let field = null;

  const degreeKeywords = /b\.s\.|m\.s\.|ph\.d\.|b\.a\.|m\.b\.a\.|bachelor|master|doctor|diploma|degree|tech|intermediate|ssc/i;
  const degIndex = parts.findIndex(p => degreeKeywords.test(p));
  
  if (degIndex !== -1) {
    degree = parts[degIndex];
    if (parts[degIndex + 1]) {
      field = parts[degIndex + 1];
    } else if (parts[degIndex - 1]) {
      field = parts[degIndex - 1];
    }
  } else {
    degree = parts[0];
  }

  if (degree && degree.toLowerCase().includes(' in ')) {
    const splitDegree = degree.split(/ in /i);
    degree = splitDegree[0].trim();
    field = splitDegree[1].trim();
  }

  eduObj.degree = degree ? degree.replace(/^[\|\s,\-•]+/g, '').trim() : null;
  eduObj.field = field ? field.replace(/^[\|\s,\-•]+/g, '').trim() : null;
}
