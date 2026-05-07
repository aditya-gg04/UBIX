/**
 * UBIX Name & Address Normalizer
 * 
 * Normalizes business names, addresses, and identifiers
 * to improve matching accuracy.
 */

// ============================================================
// ABBREVIATION MAPS
// ============================================================

const NAME_ABBREVIATIONS = {
  'pvt': 'private',
  'pvt.': 'private',
  'ltd': 'limited',
  'ltd.': 'limited',
  'co': 'company',
  'co.': 'company',
  'corp': 'corporation',
  'corp.': 'corporation',
  'mfg': 'manufacturing',
  'mfg.': 'manufacturing',
  'intl': 'international',
  'natl': 'national',
  'engg': 'engineering',
  'engg.': 'engineering',
  'engr': 'engineering',
  'tech': 'technology',
  'ind': 'industries',
  'inds': 'industries',
  'bros': 'brothers',
  'assoc': 'associates',
  'grp': 'group',
  'svc': 'services',
  'svcs': 'services',
  'prod': 'products',
  'mkt': 'market',
  'dist': 'distributors',
  'agri': 'agriculture',
  'pharm': 'pharmaceuticals',
  'chem': 'chemicals',
  'elec': 'electronics',
  'const': 'construction',
  '&': 'and',
};

const ADDRESS_ABBREVIATIONS = {
  'rd': 'road',
  'rd.': 'road',
  'st': 'street',
  'st.': 'street',
  'ave': 'avenue',
  'ave.': 'avenue',
  'blvd': 'boulevard',
  'dr': 'drive',
  'dr.': 'drive',
  'ln': 'lane',
  'ct': 'court',
  'pl': 'place',
  'sq': 'square',
  'no.': 'number',
  'no': 'number',
  'opp': 'opposite',
  'opp.': 'opposite',
  'nr': 'near',
  'nr.': 'near',
  'dist': 'district',
  'dist.': 'district',
  'indl': 'industrial',
  'ind.': 'industrial',
  'ind': 'industrial',
};

const TITLE_PREFIXES = ['sri', 'shree', 'shri', 'smt', 'the', 'messrs', 'm/s'];

// ============================================================
// NORMALIZER FUNCTIONS
// ============================================================

/**
 * Normalize a business name for matching
 */
export function normalizeName(name) {
  if (!name) return '';
  
  let normalized = name
    .toLowerCase()
    .trim()
    // Remove special characters except spaces and alphanumeric
    .replace(/[^\w\s]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Remove common title prefixes
  for (const prefix of TITLE_PREFIXES) {
    if (normalized.startsWith(prefix + ' ')) {
      normalized = normalized.slice(prefix.length + 1);
    }
  }

  // Expand abbreviations
  const tokens = normalized.split(' ');
  const expanded = tokens.map(token => NAME_ABBREVIATIONS[token] || token);
  
  // Remove empty tokens and rejoin
  normalized = expanded.filter(t => t.length > 0).join(' ');

  return normalized;
}

/**
 * Normalize an address for matching
 */
export function normalizeAddress(address) {
  if (!address) return '';

  let normalized = address
    .toLowerCase()
    .trim()
    // Remove pin codes
    .replace(/\b\d{6}\b/g, '')
    // Remove special characters except spaces, numbers, and letters
    .replace(/[^\w\s]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Expand abbreviations
  const tokens = normalized.split(' ');
  const expanded = tokens.map(token => ADDRESS_ABBREVIATIONS[token] || token);
  
  normalized = expanded.filter(t => t.length > 0).join(' ');

  // Remove common noise words
  const noiseWords = ['india', 'karnataka', 'state'];
  const finalTokens = normalized.split(' ').filter(t => !noiseWords.includes(t));
  
  return finalTokens.join(' ');
}

/**
 * Normalize PAN (always uppercase, stripped)
 */
export function normalizePAN(pan) {
  if (!pan) return null;
  return pan.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Normalize GSTIN (always uppercase, stripped)
 */
export function normalizeGSTIN(gstin) {
  if (!gstin) return null;
  return gstin.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Extract PAN from GSTIN (characters 3-12)
 */
export function extractPANFromGSTIN(gstin) {
  const normalized = normalizeGSTIN(gstin);
  if (!normalized || normalized.length < 12) return null;
  return normalized.substring(2, 12);
}

/**
 * Normalize phone number (last 10 digits)
 */
export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Tokenize a string into meaningful tokens
 */
export function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1); // Remove single characters
}

/**
 * Get name tokens (normalized + tokenized)
 */
export function getNameTokens(name) {
  return tokenize(normalizeName(name));
}

/**
 * Get address tokens (normalized + tokenized)
 */
export function getAddressTokens(address) {
  return tokenize(normalizeAddress(address));
}

/**
 * Normalize a full record
 */
export function normalizeRecord(record) {
  return {
    source_record_id: record.id,
    normalized_name: normalizeName(record.business_name),
    normalized_address: normalizeAddress(record.address),
    normalized_pan: normalizePAN(record.pan),
    normalized_gstin: normalizeGSTIN(record.gstin),
    normalized_phone: normalizePhone(record.phone),
    name_tokens: JSON.stringify(getNameTokens(record.business_name)),
    address_tokens: JSON.stringify(getAddressTokens(record.address)),
  };
}

export default {
  normalizeName,
  normalizeAddress,
  normalizePAN,
  normalizeGSTIN,
  extractPANFromGSTIN,
  normalizePhone,
  tokenize,
  getNameTokens,
  getAddressTokens,
  normalizeRecord,
};
