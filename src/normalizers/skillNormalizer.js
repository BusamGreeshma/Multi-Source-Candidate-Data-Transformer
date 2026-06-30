const CANONICAL_SKILLS = {
  // JavaScript
  'javascript': 'JavaScript',
  'js': 'JavaScript',
  'ecmascript': 'JavaScript',

  // TypeScript
  'typescript': 'TypeScript',
  'ts': 'TypeScript',

  // React
  'react': 'React',
  'reactjs': 'React',
  'react.js': 'React',
  'react js': 'React',

  // Node.js
  'node': 'Node.js',
  'nodejs': 'Node.js',
  'node.js': 'Node.js',
  'node js': 'Node.js',

  // Python
  'python': 'Python',
  'py': 'Python',

  // SQL
  'sql': 'SQL',
  'mysql': 'SQL',
  'postgresql': 'SQL',
  'postgres': 'SQL',

  // HTML / CSS
  'html': 'HTML',
  'html5': 'HTML',
  'css': 'CSS',
  'css3': 'CSS',

  // Cloud / DevOps
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'k8s': 'Kubernetes',

  // Git
  'git': 'Git',
  'github': 'Git',
  'gitlab': 'Git'
};

/**
 * Normalizes a raw skill name to its canonical spelling.
 * If the skill is not in the dictionary, it trims and capitalizes it cleanly.
 * @param {string} rawSkill - The raw skill string.
 * @returns {string|null} The canonical skill name or null.
 */
export function normalizeSkill(rawSkill) {
  if (!rawSkill || typeof rawSkill !== 'string') {
    return null;
  }

  const clean = rawSkill.trim().toLowerCase().replace(/\s+/g, ' ');

  if (!clean) {
    return null;
  }

  // Check direct mapping
  if (CANONICAL_SKILLS[clean]) {
    return CANONICAL_SKILLS[clean];
  }

  // If not in mapping, capitalize words (Title Case)
  return clean
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
