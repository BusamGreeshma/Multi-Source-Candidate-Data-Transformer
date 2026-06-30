import { normalizePhone } from '../normalizers/phoneNormalizer.js';
import { normalizeSkill } from '../normalizers/skillNormalizer.js';

/**
 * Projects the canonical candidate profile into the requested output schema.
 * @param {Object} canonicalProfile - The validated canonical candidate profile.
 * @param {Object} config - The runtime output configuration.
 * @returns {Object} The projected candidate profile.
 * @throws {Error} If a required field is missing and on_missing is set to "error".
 */
export function projectProfile(canonicalProfile, config) {
  const projected = {};

  const onMissingGlobal = config.on_missing || 'null'; // 'null' | 'omit' | 'error'
  const includeConfidence = config.include_confidence !== false; // default true
  const includeProvenance = config.include_provenance !== false; // default true

  // If no fields specified, return canonical profile (with toggles applied)
  if (!config.fields || !Array.isArray(config.fields)) {
    const output = { ...canonicalProfile };
    if (!includeConfidence) {
      delete output.overall_confidence;
      if (output.skills) {
        output.skills = output.skills.map(({ name, sources }) => ({ name, sources }));
      }
    }
    if (!includeProvenance) {
      delete output.provenance;
    }
    return output;
  }

  // Iterate over field mapping configurations
  for (const fieldConfig of config.fields) {
    const targetPath = fieldConfig.path; // The output field name/path
    const sourcePath = fieldConfig.from || targetPath; // The canonical source path
    const isRequired = fieldConfig.required === true;

    let value = getValueByPath(canonicalProfile, sourcePath);

    // Apply normalization if requested
    if (value !== null && value !== undefined && fieldConfig.normalize) {
      value = applyFieldNormalization(value, fieldConfig.normalize);
    }

    // Handle missing value
    const isMissing = value === undefined || value === null || (Array.isArray(value) && value.length === 0);

    if (isMissing) {
      if (isRequired || onMissingGlobal === 'error') {
        if (onMissingGlobal === 'error' || isRequired) {
          throw new Error(`Required field '${targetPath}' is missing in the candidate profile`);
        }
      }
      
      if (onMissingGlobal === 'omit') {
        // Do not add key to projected object
        continue;
      } else {
        // Default to null
        projected[targetPath] = null;
      }
    } else {
      projected[targetPath] = value;
    }
  }

  // Inject metadata at the root level if configured
  if (includeConfidence && canonicalProfile.overall_confidence !== undefined) {
    projected.overall_confidence = canonicalProfile.overall_confidence;
  }
  if (includeProvenance && canonicalProfile.provenance !== undefined) {
    projected.provenance = canonicalProfile.provenance;
  }

  return projected;
}

/**
 * Extracts a value from an object based on a path.
 * Supports:
 * - Simple paths: "full_name", "location"
 * - Dot paths: "location.city", "links.linkedin"
 * - Array indices: "emails[0]", "phones[1]"
 * - Array projections: "skills[].name" (maps names over skills array)
 * @param {Object} obj - The source object.
 * @param {string} path - The path string.
 * @returns {*} The extracted value.
 */
function getValueByPath(obj, path) {
  if (!obj || !path) return null;

  // Handle skills[].name projection
  if (path.includes('[].')) {
    const [arrayKey, fieldKey] = path.split('[].');
    const arr = obj[arrayKey];
    if (Array.isArray(arr)) {
      return arr.map(item => {
        if (Array.isArray(item)) {
          if (arrayKey === 'skills') {
            if (fieldKey === 'name') return item[0];
            if (fieldKey === 'confidence') return item[1];
            if (fieldKey === 'sources') return item[2];
          }
          if (arrayKey === 'provenance') {
            if (fieldKey === 'field') return item[0];
            if (fieldKey === 'source') return item[1];
            if (fieldKey === 'method') return item[2];
          }
          return null;
        }
        return item[fieldKey];
      }).filter(val => val !== undefined && val !== null);
    }
    return null;
  }

  // Handle indexed array access, e.g., emails[0]
  const arrayIdxMatch = path.match(/^([a-zA-Z0-9_]+)\[(\d+)\]$/);
  if (arrayIdxMatch) {
    const key = arrayIdxMatch[1];
    const index = parseInt(arrayIdxMatch[2], 10);
    const arr = obj[key];
    if (Array.isArray(arr) && arr[index] !== undefined) {
      return arr[index];
    }
    return null;
  }

  // Handle nested dot notation, e.g., location.city
  if (path.includes('.')) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return null;
      current = current[part];
    }
    return current;
  }

  // Direct key access
  return obj[path] !== undefined ? obj[path] : null;
}

/**
 * Applies normalization type to projected values.
 * @param {*} value - The value to normalize.
 * @param {string} normType - Type of normalization ('E164' | 'canonical' | 'lowercase').
 * @returns {*} Normalized value.
 */
function applyFieldNormalization(value, normType) {
  const norm = normType.toLowerCase();

  const applySingle = val => {
    if (typeof val !== 'string') return val;
    if (norm === 'e164') {
      return normalizePhone(val);
    }
    if (norm === 'canonical') {
      return normalizeSkill(val);
    }
    if (norm === 'lowercase') {
      return val.toLowerCase();
    }
    return val;
  };

  if (Array.isArray(value)) {
    return value.map(applySingle).filter(v => v !== null);
  }

  return applySingle(value);
}
