/**
 * Validates a merged candidate profile against the canonical schema.
 * @param {Object} profile - The candidate profile to validate.
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
export function validateCanonicalProfile(profile) {
  const errors = [];

  // Helper to check types
  const isString = val => typeof val === 'string';
  const isNumber = val => typeof val === 'number' && !isNaN(val);
  const isArray = val => Array.isArray(val);
  const isObject = val => val !== null && typeof val === 'object' && !Array.isArray(val);

  if (!profile) {
    return { isValid: false, errors: ['Profile is empty or null'] };
  }

  // 1. candidate_id
  if (!profile.candidate_id || !isString(profile.candidate_id)) {
    errors.push('candidate_id must be a non-empty string');
  }

  // 2. full_name
  if (profile.full_name !== null && !isString(profile.full_name)) {
    errors.push('full_name must be a string or null');
  }

  // 3. emails
  if (!isArray(profile.emails) || !profile.emails.every(isString)) {
    errors.push('emails must be an array of strings');
  }

  // 4. phones (E.164 check)
  if (!isArray(profile.phones) || !profile.phones.every(isString)) {
    errors.push('phones must be an array of strings');
  } else {
    // E.164 regex: +[1-9]\d{1,14}
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    profile.phones.forEach((phone, idx) => {
      if (!e164Regex.test(phone)) {
        errors.push(`phones[${idx}] ('${phone}') is not in valid E.164 format (e.g. +15550192834)`);
      }
    });
  }

  // 5. location
  if (profile.location !== null) {
    if (!isObject(profile.location)) {
      errors.push('location must be an object or null');
    } else {
      const { city, region, country } = profile.location;
      if (city !== null && !isString(city)) errors.push('location.city must be a string or null');
      if (region !== null && !isString(region)) errors.push('location.region must be a string or null');
      if (country !== null) {
        if (!isString(country)) {
          errors.push('location.country must be a string or null');
        } else if (country.length !== 2) {
          errors.push(`location.country ('${country}') must be a 2-character ISO-3166 alpha-2 code`);
        }
      }
    }
  }

  // 6. links
  if (!isObject(profile.links)) {
    errors.push('links must be an object');
  } else {
    const { linkedin, github, portfolio, other } = profile.links;
    if (linkedin !== null && !isString(linkedin)) errors.push('links.linkedin must be a string or null');
    if (github !== null && !isString(github)) errors.push('links.github must be a string or null');
    if (portfolio !== null && !isString(portfolio)) errors.push('links.portfolio must be a string or null');
    if (!isArray(other) || !other.every(isString)) errors.push('links.other must be an array of strings');
  }

  // 6b. headline (Root-level)
  if (profile.headline !== undefined && profile.headline !== null && !isString(profile.headline)) {
    errors.push('headline must be a string or null');
  }

  // 7. years_experience
  if (profile.years_experience !== null && !isNumber(profile.years_experience)) {
    errors.push('years_experience must be a number or null');
  }

  // 8. skills
  if (!isArray(profile.skills)) {
    errors.push('skills must be an array');
  } else {
    profile.skills.forEach((skill, idx) => {
      if (!isArray(skill)) {
        errors.push(`skills[${idx}] must be an array (tuple format)`);
      } else {
        if (skill.length < 3) {
          errors.push(`skills[${idx}] must be a tuple of [name, confidence, sources]`);
        } else {
          if (!skill[0] || !isString(skill[0])) errors.push(`skills[${idx}][0] (name) must be a non-empty string`);
          if (!isNumber(skill[1]) || skill[1] < 0 || skill[1] > 1) {
            errors.push(`skills[${idx}][1] (confidence) must be a number between 0 and 1`);
          }
          if (!isArray(skill[2]) || !skill[2].every(isString)) {
            errors.push(`skills[${idx}][2] (sources) must be an array of strings`);
          }
        }
      }
    });
  }

  // 9. experience
  if (!isArray(profile.experience)) {
    errors.push('experience must be an array');
  } else {
    const dateRegex = /^\d{4}-\d{2}$/; // YYYY-MM
    profile.experience.forEach((job, idx) => {
      if (!isObject(job)) {
        errors.push(`experience[${idx}] must be an object`);
      } else {
        if (job.company !== null && !isString(job.company)) errors.push(`experience[${idx}].company must be a string or null`);
        if (job.title !== null && !isString(job.title)) errors.push(`experience[${idx}].title must be a string or null`);
        if (job.summary !== null && !isString(job.summary)) errors.push(`experience[${idx}].summary must be a string or null`);
        
        if (job.start !== null) {
          if (!isString(job.start)) {
            errors.push(`experience[${idx}].start must be a string or null`);
          } else if (!dateRegex.test(job.start)) {
            errors.push(`experience[${idx}].start ('${job.start}') must be in YYYY-MM format`);
          }
        }

        if (job.end !== null) {
          if (!isString(job.end)) {
            errors.push(`experience[${idx}].end must be a string or null`);
          } else if (job.end !== 'Present' && !dateRegex.test(job.end)) {
            errors.push(`experience[${idx}].end ('${job.end}') must be in YYYY-MM format or 'Present'`);
          }
        }
      }
    });
  }


  // 9b. projects
  if (profile.projects !== undefined) {
    if (!isArray(profile.projects)) {
      errors.push('projects must be an array');
    } else {
      profile.projects.forEach((proj, idx) => {
        if (!isObject(proj)) {
          errors.push(`projects[${idx}] must be an object`);
        } else {
          if (proj.name !== null && !isString(proj.name)) errors.push(`projects[${idx}].name must be a string or null`);
          if (proj.summary !== null && !isString(proj.summary)) errors.push(`projects[${idx}].summary must be a string or null`);
          if (proj.github_link !== undefined && proj.github_link !== null && !isString(proj.github_link)) {
            errors.push(`projects[${idx}].github_link must be a string or null`);
          }
        }
      });
    }
  }

  // 10. education
  if (!isArray(profile.education)) {
    errors.push('education must be an array');
  } else {
    const yearMonthRegex = /^\d{4}-\d{2}$/;
    profile.education.forEach((edu, idx) => {
      if (!isObject(edu)) {
        errors.push(`education[${idx}] must be an object`);
      } else {
        if (edu.institution !== null && !isString(edu.institution)) errors.push(`education[${idx}].institution must be a string or null`);
        if (edu.degree !== null && !isString(edu.degree)) errors.push(`education[${idx}].degree must be a string or null`);
        if (edu.field !== null && !isString(edu.field)) errors.push(`education[${idx}].field must be a string or null`);
        
        if (edu.end_year !== null) {
          if (!isString(edu.end_year)) {
            errors.push(`education[${idx}].end_year must be a string or null`);
          } else if (edu.end_year !== 'Present' && !yearMonthRegex.test(edu.end_year)) {
            errors.push(`education[${idx}].end_year ('${edu.end_year}') must be in YYYY-MM format or 'Present'`);
          }
        }
        if (edu.cgpa !== undefined && edu.cgpa !== null && !isString(edu.cgpa)) {
          errors.push(`education[${idx}].cgpa must be a string or null`);
        }
      }
    });
  }

  // 10b. certifications
  if (profile.certifications !== undefined) {
    if (!isArray(profile.certifications)) {
      errors.push('certifications must be an array');
    } else {
      profile.certifications.forEach((cert, idx) => {
        if (!isObject(cert)) {
          errors.push(`certifications[${idx}] must be an object`);
        } else {
          if (cert.name !== null && !isString(cert.name)) errors.push(`certifications[${idx}].name must be a string or null`);
          if (cert.certification_link !== undefined && cert.certification_link !== null && !isString(cert.certification_link)) {
            errors.push(`certifications[${idx}].certification_link must be a string or null`);
          }
        }
      });
    }
  }

  // 11. provenance
  if (!isArray(profile.provenance)) {
    errors.push('provenance must be an array');
  } else {
    profile.provenance.forEach((p, idx) => {
      if (!isArray(p)) {
        errors.push(`provenance[${idx}] must be an array (tuple format)`);
      } else {
        if (p.length < 3) {
          errors.push(`provenance[${idx}] must be a tuple of [field, source, method]`);
        } else {
          if (!p[0] || !isString(p[0])) errors.push(`provenance[${idx}][0] (field) must be a non-empty string`);
          if (!p[1] || !isString(p[1])) errors.push(`provenance[${idx}][1] (source) must be a non-empty string`);
          if (!p[2] || !isString(p[2])) errors.push(`provenance[${idx}][2] (method) must be a non-empty string`);
        }
      }
    });
  }

  // 12. overall_confidence
  if (!isNumber(profile.overall_confidence) || profile.overall_confidence < 0 || profile.overall_confidence > 1) {
    errors.push('overall_confidence must be a number between 0 and 1');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
