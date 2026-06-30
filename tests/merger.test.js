import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mergeCandidateData } from '../src/merger/merger.js';

describe('Merger and Conflict Resolution', () => {
  it('should merge CSV and PDF candidate data correctly', () => {
    const csvData = {
      name: 'Busam Greeshma',
      email: 'greeshmabusam@gmail.com',
      phone: '+919966123377',
      current_company: 'IBM Skills Build and CSRBOX',
      title: 'Intern'
    };

    const pdfData = {
      full_name: 'Greeshma Busam',
      headline: 'Software Engineer Intern',
      emails: ['greeshma.alternative@gmail.com', 'greeshmabusam@gmail.com'],
      phones: ['+91 99661-23377'],
      location: { city: 'Hyderabad', region: 'Telangana', country: 'IN' },
      links: {
        linkedin: 'linkedin.com/in/busam-greeshma',
        github: 'github.com/BusamGreeshma',
        portfolio: null,
        other: []
      },
      years_experience: 0,
      skills: ['c++', 'python', 'java'],
      experience: [
        {
          company: 'IBM Skills Build and CSRBOX',
          title: 'Internship',
          start: '2025-01',
          end: 'Present',
          summary: 'Used python and databases.'
        }
      ],
      education: [
        {
          institution: 'CMR Engineering College',
          degree: 'Bachelor of Technology',
          field: 'Computer Science and Engineering',
          end_year: 'Present'
        }
      ],
      projects: []
    };

    const atsData = {
      name: 'Busam Greeshma',
      email: 'greeshma.ats@gmail.com',
      phone: '+919966123377',
      current_company: 'IBM Skills Build and CSRBOX',
      title: 'Data Science Intern',
      experience: [
        {
          company: 'IBM Skills Build and CSRBOX',
          title: 'Data Science Intern',
          start: '2025-01',
          end: 'Present',
          summary: 'Analyzing data Science.'
        }
      ]
    };

    const result = mergeCandidateData(csvData, pdfData, atsData);

    // Conflict: CSV has 'Busam Greeshma', PDF has 'Greeshma Busam'. CSV wins
    assert.strictEqual(result.full_name, 'Busam Greeshma');

    // Emails unioned & lowercased
    assert.deepStrictEqual(result.emails, ['greeshmabusam@gmail.com', 'greeshma.ats@gmail.com', 'greeshma.alternative@gmail.com']);

    // Phones unioned & E.164 formatted
    assert.deepStrictEqual(result.phones, ['+919966123377']);

    // Headline is root-level
    assert.strictEqual(result.headline, 'Software Engineer Intern');

    // Experience company cross-referenced
    assert.strictEqual(result.experience[0].company, 'IBM Skills Build and CSRBOX');
    assert.strictEqual(result.experience[0].title, 'Data Science Intern'); // ATS title wins

    // Skills canonicalized and confidence evaluated
    assert.strictEqual(result.skills[0][0], 'C++');
    assert.ok(result.skills[0][2].includes('resume.pdf'));

    // Provenance list contains entries
    assert.ok(result.provenance.length > 5);
    assert.ok(result.provenance.some(p => p[0] === 'full_name' && p[1] === 'candidate.csv' && p[2] === 'structured_csv_import'));

    // Overall confidence calculation
    assert.ok(result.overall_confidence > 0.5);
    assert.ok(result.overall_confidence <= 1.0);
  });
});
