import { describe, it } from 'node:test';
import assert from 'node:assert';
import { projectProfile } from '../src/projection/projection.js';

describe('Projection Layer', () => {
  const canonicalProfile = {
    candidate_id: 'cand_1234',
    full_name: 'Busam Greeshma',
    emails: ['greeshmabusam@gmail.com', 'greeshma.alt@gmail.com'],
    phones: ['+919966123377'],
    location: { city: 'Hyderabad', region: 'Telangana', country: 'IN' },
    links: {
      linkedin: 'linkedin.com/in/busam-greeshma',
      github: 'github.com/BusamGreeshma',
      portfolio: null,
      other: []
    },
    headline: 'Software Intern',
    years_experience: 0,
    skills: [
      [ 'C++', 0.9, ['resume.pdf'] ],
      [ 'React', 0.95, ['resume.pdf'] ]
    ],
    experience: [],
    education: [],
    provenance: [
      [ 'full_name', 'candidate.csv', 'import' ]
    ],
    overall_confidence: 0.92
  };

  it('should select subset and map paths correctly', () => {
    const config = {
      fields: [
        { path: 'name', from: 'full_name', type: 'string', required: true },
        { path: 'primary_email', from: 'emails[0]', type: 'string', required: true },
        { path: 'github_link', from: 'links.github', type: 'string' },
        { path: 'skill_names', from: 'skills[].name', type: 'string[]' },
        { path: 'years_experience', type: 'number' }
      ],
      include_confidence: false,
      include_provenance: false,
      on_missing: 'null'
    };

    const projected = projectProfile(canonicalProfile, config);

    assert.deepStrictEqual(projected, {
      name: 'Busam Greeshma',
      primary_email: 'greeshmabusam@gmail.com',
      github_link: 'github.com/BusamGreeshma',
      skill_names: ['C++', 'React'],
      years_experience: 0
    });
    assert.strictEqual(projected.overall_confidence, undefined);
    assert.strictEqual(projected.provenance, undefined);
  });

  it('should support toggles for confidence and provenance', () => {
    const config = {
      fields: [{ path: 'name', from: 'full_name' }],
      include_confidence: true,
      include_provenance: true
    };

    const projected = projectProfile(canonicalProfile, config);
    assert.strictEqual(projected.name, 'Busam Greeshma');
    assert.strictEqual(projected.overall_confidence, 0.92);
    assert.strictEqual(projected.provenance.length, 1);
    assert.deepStrictEqual(projected.provenance[0], [ 'full_name', 'candidate.csv', 'import' ]);
  });

  it('should handle missing values based on on_missing configurations', () => {
    // 1. "null" setting
    const configNull = {
      fields: [
        { path: 'name', from: 'full_name' },
        { path: 'missing_field', from: 'nonexistent' }
      ],
      on_missing: 'null',
      include_confidence: false,
      include_provenance: false
    };
    assert.deepStrictEqual(projectProfile(canonicalProfile, configNull), {
      name: 'Busam Greeshma',
      missing_field: null
    });

    // 2. "omit" setting
    const configOmit = {
      fields: [
        { path: 'name', from: 'full_name' },
        { path: 'missing_field', from: 'nonexistent' }
      ],
      on_missing: 'omit',
      include_confidence: false,
      include_provenance: false
    };
    assert.deepStrictEqual(projectProfile(canonicalProfile, configOmit), {
      name: 'Busam Greeshma'
    });

    // 3. "error" setting
    const configError = {
      fields: [
        { path: 'name', from: 'full_name' },
        { path: 'missing_field', from: 'nonexistent' }
      ],
      on_missing: 'error'
    };
    assert.throws(() => projectProfile(canonicalProfile, configError));
  });
});
