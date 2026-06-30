import fs from 'fs';

/**
 * Parses a simple CSV string or file into an array of objects.
 * Handles basic quoted values containing commas.
 * @param {string} filePath - Absolute path to the CSV file.
 * @returns {Array<Object>} List of candidate records parsed from CSV.
 */
export function parseCSVFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseCSVString(content);
  } catch (error) {
    console.error(`Error reading CSV file at ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Parses CSV string.
 * @param {string} content - Raw CSV text content.
 * @returns {Array<Object>} Array of records.
 */
export function parseCSVString(content) {
  if (!content || !content.trim()) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  if (lines.length === 0) {
    return [];
  }

  // Parse header line
  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    const values = parseCSVLine(line);
    const record = {};

    headers.forEach((header, index) => {
      const cleanHeader = header.trim().toLowerCase();
      // Keep values, trim quotes
      let val = values[index] !== undefined ? values[index].trim() : '';
      
      // Clean leading/trailing quotes if present
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      
      record[cleanHeader] = val;
    });

    records.push(record);
  }

  return records;
}

/**
 * Parses a single CSV line, handling quotes containing commas.
 * @param {string} line - Single CSV row.
 * @returns {Array<string>} Fields in the line.
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
