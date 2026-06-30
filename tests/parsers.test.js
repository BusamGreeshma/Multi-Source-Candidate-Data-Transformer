import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseCSVString } from '../src/parsers/csvParser.js';
import { parseResumeText } from '../src/parsers/pdfParser.js';
import { mapATSCandidate } from '../src/parsers/atsParser.js';

describe('CSV Parser', () => {
  it('should parse simple CSV candidate rows', () => {
    const csv = `name,email,phone,current_company,title
Busam Greeshma,greeshmabusam@gmail.com,+919966123377,Student,null`;
    
    const result = parseCSVString(csv);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Busam Greeshma');
    assert.strictEqual(result[0].email, 'greeshmabusam@gmail.com');
    assert.strictEqual(result[0].phone, '+919966123377');
    assert.strictEqual(result[0].current_company, 'Student');
    assert.strictEqual(result[0].title, 'null');
  });

  it('should parse quoted fields containing commas', () => {
    const csv = `name,email,phone,current_company,title
"Busam, Greeshma",greeshmabusam@gmail.com,"+91,9966,1233,77",Student,"null"`;
    
    const result = parseCSVString(csv);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Busam, Greeshma');
    assert.strictEqual(result[0].phone, '+91,9966,1233,77');
    assert.strictEqual(result[0].title, 'null');
  });
});

describe('PDF Text Parser Heuristics', () => {
  it('should parse resume sections correctly', () => {
    const resumeText = `
Busam Greeshma
Software Engineer Intern
greeshmabusam@gmail.com | (+91) 9966123377 | Hyderabad, Telangana, IN
github.com/BusamGreeshma | linkedin.com/in/busam-greeshma

Summary
Passionate engineer with experience.

Education
CMR Engineering College
Bachelor of Technology in Computer Science
2023-Present

Skills
C++, Python, Java, React, Node.js

Projects
Food Delivery App
Used React and node.
`;

    const result = parseResumeText(resumeText);
    
    assert.strictEqual(result.full_name, 'Busam Greeshma');
    assert.strictEqual(result.headline, 'Software Engineer Intern');
    assert.ok(result.emails.includes('greeshmabusam@gmail.com'));
    assert.ok(result.phones.includes('+919966123377'));
    assert.strictEqual(result.links.linkedin, 'linkedin.com/in/busam-greeshma');
    assert.strictEqual(result.links.github, 'github.com/BusamGreeshma');
    
    assert.deepStrictEqual(result.location, {
      city: 'Hyderabad',
      region: 'Telangana',
      country: 'IN'
    });

    assert.deepStrictEqual(result.skills, ['C++', 'Python', 'Java', 'React', 'Node.js']);
    
    assert.strictEqual(result.education.length, 1);
    assert.strictEqual(result.education[0].institution, 'CMR Engineering College');
    assert.strictEqual(result.education[0].degree, 'Bachelor of Technology');
    assert.strictEqual(result.education[0].field, 'Computer Science');
    assert.strictEqual(result.education[0].end_year, null); // Ongoing maps to null
  });
});

describe('ATS Parser Mapping', () => {
  it('should map custom ATS fields to standard candidate shape', () => {
    const ats = {
      candidate: {
        fullName: 'Busam Greeshma',
        contactEmail: 'greeshmabusam@gmail.com',
        cellPhone: '9966123377',
        currentEmployer: 'Student',
        jobTitle: 'null',
        workHistory: [
          {
            employer: 'Student',
            role: 'null',
            since: '2023-09',
            until: 'Present',
            description: 'Studying Computer Science.'
          }
        ]
      }
    };
    
    const result = mapATSCandidate(ats);
    
    assert.strictEqual(result.name, 'Busam Greeshma');
    assert.strictEqual(result.email, 'greeshmabusam@gmail.com');
    assert.strictEqual(result.phone, '9966123377');
    assert.strictEqual(result.current_company, 'Student');
    assert.strictEqual(result.title, 'null');
    assert.strictEqual(result.experience[0].company, 'Student');
    assert.strictEqual(result.experience[0].title, 'null');
    assert.strictEqual(result.experience[0].start, '2023-09');
    assert.strictEqual(result.experience[0].end, 'Present');
  });
});
