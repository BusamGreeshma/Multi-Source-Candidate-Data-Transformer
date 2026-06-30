import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeEmail } from '../src/normalizers/emailNormalizer.js';
import { normalizePhone } from '../src/normalizers/phoneNormalizer.js';
import { normalizeDate } from '../src/normalizers/dateNormalizer.js';
import { normalizeSkill } from '../src/normalizers/skillNormalizer.js';

describe('Email Normalizer', () => {
  it('should convert email to lowercase and trim spaces', () => {
    assert.strictEqual(normalizeEmail('  JOHN.doe@EXAMPLE.com  '), 'john.doe@example.com');
  });

  it('should return null for invalid inputs', () => {
    assert.strictEqual(normalizeEmail(null), null);
    assert.strictEqual(normalizeEmail(undefined), null);
    assert.strictEqual(normalizeEmail(123), null);
  });
});

describe('Phone Normalizer', () => {
  it('should format US 10-digit numbers to E.164', () => {
    assert.strictEqual(normalizePhone('555-019-2834'), '+15550192834');
    assert.strictEqual(normalizePhone('(555) 019-2834'), '+15550192834');
    assert.strictEqual(normalizePhone('555 019 2834'), '+15550192834');
  });

  it('should preserve existing country code if starting with plus', () => {
    assert.strictEqual(normalizePhone('+91 99999 99999'), '+919999999999');
    assert.strictEqual(normalizePhone('+1 (555) 019-2834'), '+15550192834');
  });

  it('should return null for invalid numbers', () => {
    assert.strictEqual(normalizePhone(null), null);
    assert.strictEqual(normalizePhone('abc'), null);
  });
});

describe('Date Normalizer', () => {
  it('should format text month dates to YYYY-MM', () => {
    assert.strictEqual(normalizeDate('June 2021'), '2021-06');
    assert.strictEqual(normalizeDate('Jan 2019'), '2019-01');
    assert.strictEqual(normalizeDate('2021 June'), '2021-06');
  });

  it('should format slash/dash dates to YYYY-MM', () => {
    assert.strictEqual(normalizeDate('06/2021'), '2021-06');
    assert.strictEqual(normalizeDate('6/2021'), '2021-06');
    assert.strictEqual(normalizeDate('2021-06-15'), '2021-06');
  });

  it('should return Present for ongoing dates', () => {
    assert.strictEqual(normalizeDate('Present'), 'Present');
    assert.strictEqual(normalizeDate('current'), 'Present');
    assert.strictEqual(normalizeDate('ongoing'), 'Present');
  });

  it('should handle raw year input', () => {
    assert.strictEqual(normalizeDate('2018'), '2018-01');
  });

  it('should return null for invalid date string', () => {
    assert.strictEqual(normalizeDate('not a date'), null);
    assert.strictEqual(normalizeDate(null), null);
  });
});

describe('Skill Normalizer', () => {
  it('should canonicalize common tech skill variations', () => {
    assert.strictEqual(normalizeSkill('reactjs'), 'React');
    assert.strictEqual(normalizeSkill('React.js'), 'React');
    assert.strictEqual(normalizeSkill('nodejs'), 'Node.js');
    assert.strictEqual(normalizeSkill('ts'), 'TypeScript');
    assert.strictEqual(normalizeSkill('js'), 'JavaScript');
  });

  it('should title case and clean other skills', () => {
    assert.strictEqual(normalizeSkill('   software architecture  '), 'Software Architecture');
    assert.strictEqual(normalizeSkill('c++'), 'C++');
  });

  it('should return null for empty values', () => {
    assert.strictEqual(normalizeSkill(null), null);
    assert.strictEqual(normalizeSkill('   '), null);
  });
});
