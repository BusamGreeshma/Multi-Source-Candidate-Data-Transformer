import { normalizeEmail } from '../normalizers/emailNormalizer.js';
import { normalizePhone } from '../normalizers/phoneNormalizer.js';
import { normalizeDate } from '../normalizers/dateNormalizer.js';
import { normalizeSkill } from '../normalizers/skillNormalizer.js';

// Confidence weights of sources for individual fields
const CONFIDENCE_WEIGHTS = {
  csv: {
    full_name: 0.95,
    emails: 0.95,
    phones: 0.95,
    current_company: 0.90,
    title: 0.90,
    location: 0.40,
    years_experience: 0.40,
    skills: 0.30,
    experience: 0.50,
    projects: 0.30,
    education: 0.50
  },
  ats: {
    full_name: 0.90,
    emails: 0.90,
    phones: 0.90,
    current_company: 0.95,
    title: 0.95,
    location: 0.50,
    years_experience: 0.50,
    skills: 0.40,
    experience: 0.85,
    projects: 0.40,
    education: 0.80
  },
  pdf: {
    full_name: 0.80,
    emails: 0.85,
    phones: 0.80,
    current_company: 0.85,
    title: 0.85,
    location: 0.85,
    years_experience: 0.85,
    skills: 0.90,
    experience: 0.90,
    projects: 0.90,
    education: 0.90
  }
};

/**
 * Merges raw parsed candidate data from CSV, PDF, and ATS sources.
 * Resolves conflicts using a deterministic source-confidence matrix.
 * Populates field provenance (as tuples) and calculates confidence scores.
 * @param {Object} csvData - Raw candidate record from CSV (or null).
 * @param {Object} pdfData - Raw candidate record from PDF (or null).
 * @param {Object} atsData - Raw candidate record from ATS JSON (or null).
 * @returns {Object} Canonical candidate profile.
 */
export function mergeCandidateData(csvData, pdfData, atsData) {
  const profile = {
    candidate_id: null,
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
    provenance: [],
    overall_confidence: 0
  };

  // Generate unique candidate ID based on email if available, or generate a random one
  let primaryEmail = null;
  if (csvData && csvData.email) {
    primaryEmail = normalizeEmail(csvData.email);
  } else if (atsData && atsData.email) {
    primaryEmail = normalizeEmail(atsData.email);
  } else if (pdfData && pdfData.emails && pdfData.emails.length > 0) {
    primaryEmail = normalizeEmail(pdfData.emails[0]);
  }
  
  if (primaryEmail) {
    profile.candidate_id = 'cand_' + Buffer.from(primaryEmail).toString('hex').slice(0, 16);
  } else {
    profile.candidate_id = 'cand_' + Math.random().toString(36).substring(2, 10);
  }
  
  profile.provenance.push([
    'candidate_id',
    primaryEmail ? 
      (csvData && csvData.email ? 'candidate.csv' : (atsData && atsData.email ? 'ats_candidate.json' : 'resume.pdf')) : 'system',
    primaryEmail ? 'email_hashing' : 'random_generator'
  ]);

  const fieldConfidences = {};

  // 1. Merge full_name
  const nameCsv = csvData ? csvData.name : null;
  const nameAts = atsData ? atsData.name : null;
  const namePdf = pdfData ? pdfData.full_name : null;

  const names = [
    { val: nameCsv, source: 'candidate.csv', weight: CONFIDENCE_WEIGHTS.csv.full_name, method: 'structured_csv_import' },
    { val: nameAts, source: 'ats_candidate.json', weight: CONFIDENCE_WEIGHTS.ats.full_name, method: 'semi_structured_json_import' },
    { val: namePdf, source: 'resume.pdf', weight: CONFIDENCE_WEIGHTS.pdf.full_name, method: 'pdf_name_heuristic' }
  ].filter(n => n.val !== null && n.val !== undefined);

  if (names.length > 0) {
    names.sort((a, b) => b.weight - a.weight);
    profile.full_name = names[0].val.trim();
    fieldConfidences.full_name = names[0].weight;
    profile.provenance.push([ 'full_name', names[0].source, names[0].method ]);
  } else {
    profile.full_name = null;
    fieldConfidences.full_name = 0;
  }

  // 2. Merge emails
  const emailsSet = new Set();
  const emailSources = [];
  
  if (csvData && csvData.email) {
    const e = normalizeEmail(csvData.email);
    if (e) {
      emailsSet.add(e);
      emailSources.push({ email: e, source: 'candidate.csv', method: 'structured_csv_import', conf: CONFIDENCE_WEIGHTS.csv.emails });
    }
  }
  if (atsData && atsData.email) {
    const e = normalizeEmail(atsData.email);
    if (e) {
      emailsSet.add(e);
      if (!emailSources.some(x => x.email === e)) {
        emailSources.push({ email: e, source: 'ats_candidate.json', method: 'semi_structured_json_import', conf: CONFIDENCE_WEIGHTS.ats.emails });
      }
    }
  }
  if (pdfData && pdfData.emails) {
    pdfData.emails.forEach(email => {
      const e = normalizeEmail(email);
      if (e) {
        emailsSet.add(e);
        if (!emailSources.some(x => x.email === e)) {
          emailSources.push({ email: e, source: 'resume.pdf', method: 'pdf_regex_extractor', conf: CONFIDENCE_WEIGHTS.pdf.emails });
        }
      }
    });
  }
  profile.emails = Array.from(emailsSet);
  if (profile.emails.length > 0) {
    fieldConfidences.emails = Math.max(...emailSources.map(s => s.conf));
    emailSources.forEach(s => {
      profile.provenance.push([ `emails[${profile.emails.indexOf(s.email)}]`, s.source, s.method ]);
    });
  } else {
    fieldConfidences.emails = 0;
  }

  // 3. Merge phones
  const phonesSet = new Set();
  const phoneSources = [];

  if (csvData && csvData.phone) {
    const rawPhones = csvData.phone.split(/[,;|/]/).map(p => p.trim());
    rawPhones.forEach(rawPhone => {
      const p = normalizePhone(rawPhone);
      if (p) {
        phonesSet.add(p);
        if (!phoneSources.some(x => x.phone === p)) {
          phoneSources.push({ phone: p, source: 'candidate.csv', method: 'structured_csv_import', conf: CONFIDENCE_WEIGHTS.csv.phones });
        }
      }
    });
  }
  if (atsData && atsData.phone) {
    const rawPhones = atsData.phone.split(/[,;|/]/).map(p => p.trim());
    rawPhones.forEach(rawPhone => {
      const p = normalizePhone(rawPhone);
      if (p) {
        phonesSet.add(p);
        if (!phoneSources.some(x => x.phone === p)) {
          phoneSources.push({ phone: p, source: 'ats_candidate.json', method: 'semi_structured_json_import', conf: CONFIDENCE_WEIGHTS.ats.phones });
        }
      }
    });
  }
  if (pdfData && pdfData.phones) {
    pdfData.phones.forEach(phone => {
      const p = normalizePhone(phone);
      if (p) {
        phonesSet.add(p);
        if (!phoneSources.some(x => x.phone === p)) {
          phoneSources.push({ phone: p, source: 'resume.pdf', method: 'pdf_regex_extractor', conf: CONFIDENCE_WEIGHTS.pdf.phones });
        }
      }
    });
  }
  profile.phones = Array.from(phonesSet);
  if (profile.phones.length > 0) {
    fieldConfidences.phones = Math.max(...phoneSources.map(s => s.conf));
    phoneSources.forEach(s => {
      profile.provenance.push([ `phones[${profile.phones.indexOf(s.phone)}]`, s.source, s.method ]);
    });
  } else {
    fieldConfidences.phones = 0;
  }

  // 4. Merge location
  const locPdf = pdfData ? pdfData.location : null;
  if (locPdf) {
    profile.location = {
      city: locPdf.city || null,
      region: locPdf.region || null,
      country: locPdf.country ? locPdf.country.toUpperCase().slice(0, 2) : null
    };
    fieldConfidences.location = CONFIDENCE_WEIGHTS.pdf.location;
    profile.provenance.push([ 'location', 'resume.pdf', 'pdf_location_heuristic' ]);
  } else {
    profile.location = null;
    fieldConfidences.location = 0;
  }

  // 5. Merge links
  if (pdfData && pdfData.links) {
    profile.links.linkedin = pdfData.links.linkedin || null;
    profile.links.github = pdfData.links.github || null;
    profile.links.portfolio = pdfData.links.portfolio || null;
    profile.links.other = pdfData.links.other || [];

    fieldConfidences.links = CONFIDENCE_WEIGHTS.pdf.skills;
    
    ['linkedin', 'github', 'portfolio'].forEach(linkField => {
      if (profile.links[linkField]) {
        profile.provenance.push([ `links.${linkField}`, 'resume.pdf', 'pdf_regex_extractor' ]);
      }
    });
    profile.links.other.forEach((link, idx) => {
      profile.provenance.push([ `links.other[${idx}]`, 'resume.pdf', 'pdf_regex_extractor' ]);
    });
  } else {
    fieldConfidences.links = 0;
  }

  // 5b. Merge headline (Root-level)
  const headlinePdf = pdfData ? pdfData.headline : null;
  if (headlinePdf) {
    profile.headline = headlinePdf;
    fieldConfidences.headline = CONFIDENCE_WEIGHTS.pdf.full_name || 0.90;
    profile.provenance.push([ 'headline', 'resume.pdf', 'pdf_regex_extractor' ]);
  } else {
    profile.headline = null;
    fieldConfidences.headline = 0;
  }

  // 6. Years of Experience
  const yrsPdf = pdfData ? pdfData.years_experience : null;
  if (yrsPdf !== null && yrsPdf !== undefined) {
    profile.years_experience = yrsPdf;
    fieldConfidences.years_experience = CONFIDENCE_WEIGHTS.pdf.years_experience;
    profile.provenance.push([ 'years_experience', 'resume.pdf', 'pdf_date_estimation' ]);
  } else {
    profile.years_experience = null;
    fieldConfidences.years_experience = 0;
  }

  // 7. Merge skills (output as list of arrays/tuples [[name, confidence, sources]])
  const skillsMap = new Map();
  if (pdfData && pdfData.skills) {
    pdfData.skills.forEach(skill => {
      const canonicalName = normalizeSkill(skill);
      if (canonicalName) {
        skillsMap.set(canonicalName, {
          confidence: CONFIDENCE_WEIGHTS.pdf.skills,
          sources: ['resume.pdf']
        });
      }
    });
  }

  if (atsData && atsData.skills) {
    atsData.skills.forEach(skill => {
      const canonicalName = normalizeSkill(skill);
      if (canonicalName) {
        if (skillsMap.has(canonicalName)) {
          const meta = skillsMap.get(canonicalName);
          if (!meta.sources.includes('ats_candidate.json')) {
            meta.sources.push('ats_candidate.json');
          }
        } else {
          skillsMap.set(canonicalName, {
            confidence: CONFIDENCE_WEIGHTS.ats.skills || 0.85,
            sources: ['ats_candidate.json']
          });
        }
      }
    });
  }
  
  if (pdfData && pdfData.experience && pdfData.experience.length > 0) {
    pdfData.experience.forEach(job => {
      const summary = (job.summary || '').toLowerCase();
      skillsMap.forEach((meta, skillName) => {
        if (summary.includes(skillName.toLowerCase())) {
          meta.confidence = Math.min(0.99, meta.confidence + 0.05);
          if (!meta.sources.includes('resume.pdf (experience)')) {
            meta.sources.push('resume.pdf (experience)');
          }
        }
      });
    });
  }

  profile.skills = Array.from(skillsMap.entries()).map(([name, meta]) => {
    profile.provenance.push([ `skills[${name}]`, meta.sources.join(', '), 'skills_canonical_mapping' ]);
    return [
      name,
      parseFloat(meta.confidence.toFixed(2)),
      meta.sources
    ];
  });

  // Calculate skills confidence using the tuple index 1
  fieldConfidences.skills = profile.skills.length > 0 ? 
    parseFloat((profile.skills.reduce((sum, s) => sum + s[1], 0) / profile.skills.length).toFixed(2)) : 0;

  // 8. Merge Experience (excluding projects)
  if (pdfData && pdfData.experience && pdfData.experience.length > 0) {
    profile.experience = pdfData.experience.map((job, index) => {
      const startNorm = normalizeDate(job.start);
      const endNorm = normalizeDate(job.end);
      
      let comp = job.company;
      let titl = job.title;
      let sourceName = 'resume.pdf';
      let parseMethod = 'pdf_experience_heuristic';

      if (atsData && atsData.current_company && comp) {
        const isAtsMatch = comp.toLowerCase().includes(atsData.current_company.toLowerCase()) || 
                           atsData.current_company.toLowerCase().includes(comp.toLowerCase());
        if (isAtsMatch) {
          comp = atsData.current_company;
          if (atsData.title && CONFIDENCE_WEIGHTS.ats.title > CONFIDENCE_WEIGHTS.pdf.title) {
            titl = atsData.title;
          }
          sourceName = 'ats_candidate.json';
          parseMethod = 'cross_source_ats_matching';
        }
      }

      if (csvData && csvData.current_company && comp && sourceName !== 'ats_candidate.json') {
        const isCsvMatch = comp.toLowerCase().includes(csvData.current_company.toLowerCase()) || 
                           csvData.current_company.toLowerCase().includes(comp.toLowerCase());
        
        if (isCsvMatch) {
          comp = csvData.current_company;
          if (csvData.title && CONFIDENCE_WEIGHTS.csv.title > CONFIDENCE_WEIGHTS.pdf.title) {
            titl = csvData.title;
          }
          sourceName = 'candidate.csv & resume.pdf';
          parseMethod = 'cross_source_company_matching';
        }
      }

      profile.provenance.push([ `experience[${index}]`, sourceName, parseMethod ]);

      return {
        company: comp || null,
        title: titl || null,
        start: startNorm || job.start,
        end: endNorm || job.end,
        summary: job.summary || null
      };
    });
    fieldConfidences.experience = CONFIDENCE_WEIGHTS.pdf.experience;
  } else if (atsData && atsData.current_company) {
    profile.experience = [{
      company: atsData.current_company,
      title: atsData.title || null,
      start: null,
      end: 'Present',
      summary: 'Current employment details from Applicant Tracking System.'
    }];
    fieldConfidences.experience = CONFIDENCE_WEIGHTS.ats.experience;
    profile.provenance.push([ 'experience[0]', 'ats_candidate.json', 'semi_structured_json_import' ]);
  } else if (csvData && csvData.current_company) {
    profile.experience = [{
      company: csvData.current_company,
      title: csvData.title || null,
      start: null,
      end: 'Present',
      summary: 'Current employment details from recruiter export.'
    }];
    fieldConfidences.experience = CONFIDENCE_WEIGHTS.csv.experience;
    profile.provenance.push([ 'experience[0]', 'candidate.csv', 'structured_csv_import' ]);
  } else {
    fieldConfidences.experience = 0;
  }

  // 8b. Merge Projects
  if (pdfData && pdfData.projects) {
    profile.projects = pdfData.projects.map((proj, index) => {
      profile.provenance.push([ `projects[${index}]`, 'resume.pdf', 'pdf_projects_heuristic' ]);
      if (proj.github_link) {
        profile.provenance.push([ `projects[${index}].github_link`, 'resume.pdf', 'pdf_hyperlinks_annotations_extraction' ]);
      }
      return {
        name: proj.name || null,
        summary: proj.summary || null,
        github_link: proj.github_link || null
      };
    });
    fieldConfidences.projects = CONFIDENCE_WEIGHTS.pdf.projects;
  } else {
    fieldConfidences.projects = 0;
  }

  // 9. Merge Education
  const mergedEduList = [];
  
  if (pdfData && pdfData.education && pdfData.education.length > 0) {
    pdfData.education.forEach((edu, index) => {
      const endYearNorm = edu.end_year ? normalizeDate(edu.end_year) : null;
      let sourceName = 'resume.pdf';
      let method = 'pdf_education_heuristic';
      let cgpaVal = null;

      if (atsData && atsData.education) {
        const atsMatch = atsData.education.find(ae => 
          ae.institution && edu.institution && 
          (ae.institution.toLowerCase().includes(edu.institution.toLowerCase()) || 
           edu.institution.toLowerCase().includes(ae.institution.toLowerCase()))
        );
        if (atsMatch) {
          cgpaVal = atsMatch.cgpa;
          sourceName = 'resume.pdf & ats_candidate.json';
          method = 'pdf_education_heuristic_with_ats_enrichment';
        }
      }

      profile.provenance.push([ `education[${index}]`, sourceName, method ]);

      const eduEntry = {
        institution: edu.institution || null,
        degree: edu.degree || null,
        field: edu.field || null,
        end_year: endYearNorm ? endYearNorm.slice(0, 7) : null
      };
      if (cgpaVal) {
        eduEntry.cgpa = cgpaVal;
      }
      mergedEduList.push(eduEntry);
    });
    
    if (atsData && atsData.education) {
      atsData.education.forEach(ae => {
        const alreadyMerged = mergedEduList.some(me => 
          me.institution && ae.institution && 
          (me.institution.toLowerCase().includes(ae.institution.toLowerCase()) || 
           ae.institution.toLowerCase().includes(me.institution.toLowerCase()))
        );
        if (!alreadyMerged) {
          profile.provenance.push([ `education[${mergedEduList.length}]`, 'ats_candidate.json', 'semi_structured_json_import' ]);
          mergedEduList.push({
            institution: ae.institution || null,
            degree: ae.degree || null,
            field: ae.field || null,
            end_year: ae.end_year || null,
            cgpa: ae.cgpa || null
          });
        }
      });
    }

    profile.education = mergedEduList;
    fieldConfidences.education = CONFIDENCE_WEIGHTS.pdf.education;
  } else if (atsData && atsData.education && atsData.education.length > 0) {
    profile.education = atsData.education.map((ae, index) => {
      profile.provenance.push([ `education[${index}]`, 'ats_candidate.json', 'semi_structured_json_import' ]);
      return {
        institution: ae.institution || null,
        degree: ae.degree || null,
        field: ae.field || null,
        end_year: ae.end_year || null,
        cgpa: ae.cgpa || null
      };
    });
    fieldConfidences.education = CONFIDENCE_WEIGHTS.ats.education || 0.85;
  } else {
    fieldConfidences.education = 0;
  }

  // 9b. Merge Certifications
  if (pdfData && pdfData.certifications && pdfData.certifications.length > 0) {
    profile.certifications = pdfData.certifications.map((cert, index) => {
      profile.provenance.push([ `certifications[${index}]`, 'resume.pdf', 'pdf_certifications_heuristic' ]);
      if (cert.certification_link) {
        profile.provenance.push([ `certifications[${index}].certification_link`, 'resume.pdf', 'pdf_hyperlinks_annotations_extraction' ]);
      }
      return {
        name: cert.name || null,
        certification_link: cert.certification_link || null
      };
    });
    fieldConfidences.certifications = CONFIDENCE_WEIGHTS.pdf.projects;
  } else {
    profile.certifications = [];
    fieldConfidences.certifications = 0;
  }

  // 10. Calculate overall profile confidence
  const coreFields = ['full_name', 'emails', 'phones', 'location', 'headline', 'years_experience', 'skills', 'experience', 'projects', 'education', 'certifications'];
  let sumConfidence = 0;
  let countFields = 0;

  coreFields.forEach(f => {
    if (fieldConfidences[f] > 0) {
      sumConfidence += fieldConfidences[f];
      countFields++;
    }
  });

  profile.overall_confidence = countFields > 0 ? 
    parseFloat((sumConfidence / countFields).toFixed(2)) : 0;

  profile.provenance.push([ 'overall_confidence', 'system', 'weighted_fields_average' ]);

  return profile;
}
