/**
 * UBIX Synthetic Data Generator
 * 
 * Generates realistic synthetic business data for Karnataka departments
 * with intentional variations for entity resolution testing.
 */

import { getDatabase, closeDatabase } from './database.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// REFERENCE DATA
// ============================================================

const DEPARTMENTS = [
  { name: 'Department of Commercial Taxes', code: 'DCT', description: 'GST & commercial tax administration' },
  { name: 'Department of Labour', code: 'DOL', description: 'Labour law compliance and worker welfare' },
  { name: 'Department of Factories & Boilers', code: 'DFB', description: 'Factory inspection and safety' },
  { name: 'Karnataka State Pollution Control Board', code: 'KSPCB', description: 'Environmental compliance' },
  { name: 'Karnataka Electricity Regulatory Commission', code: 'KERC', description: 'Power consumption and regulation' },
  { name: 'Department of Industries & Commerce', code: 'DIC', description: 'Industrial policy and promotion' },
  { name: 'Department of Excise', code: 'DOE', description: 'Excise duty and licensing' },
  { name: 'Food Safety & Standards Authority', code: 'FSSA', description: 'Food safety compliance' },
  { name: 'Department of Mines & Geology', code: 'DMG', description: 'Mining licenses and regulation' },
  { name: 'Department of Urban Development', code: 'DUD', description: 'Urban planning and development' },
  { name: 'Karnataka Industrial Area Development Board', code: 'KIADB', description: 'Industrial area management' },
  { name: 'Drug Control Department', code: 'DCD', description: 'Pharmaceutical regulation' },
  { name: 'Department of Tourism', code: 'DOT', description: 'Tourism licensing and promotion' },
  { name: 'Karnataka State Fire & Emergency Services', code: 'KSFES', description: 'Fire safety compliance' },
  { name: 'Department of Legal Metrology', code: 'DLM', description: 'Weights and measures regulation' },
];

const KARNATAKA_DISTRICTS = [
  'Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Mangaluru', 'Hubballi-Dharwad',
  'Belagavi', 'Kalaburagi', 'Ballari', 'Davangere', 'Shivamogga',
  'Tumakuru', 'Raichur', 'Hassan', 'Udupi', 'Mandya',
  'Chikkamagaluru', 'Chitradurga', 'Kodagu', 'Bagalkot', 'Gadag',
  'Haveri', 'Koppal', 'Ramanagara', 'Yadgir', 'Chamarajanagar',
];

const AREAS = {
  'Bengaluru Urban': ['MG Road', 'Whitefield', 'Electronic City', 'Koramangala', 'Indiranagar', 'Jayanagar', 'Rajajinagar', 'Peenya Industrial Area', 'Bommasandra', 'HSR Layout', 'BTM Layout', 'Malleshwaram', 'Basavanagudi', 'Yelahanka', 'Banashankari'],
  'Mysuru': ['Hebbal Industrial Area', 'Hootagalli', 'KRS Road', 'Metagalli', 'Vijayanagar'],
  'Mangaluru': ['Baikampady Industrial Area', 'Yeyyadi', 'Surathkal', 'Kankanady', 'Bejai'],
  'Hubballi-Dharwad': ['Gokul Road', 'Tarihal Industrial Area', 'Rayapur', 'Vidyanagar'],
};

const BUSINESS_PREFIXES = [
  'Sri', 'Shree', 'Royal', 'National', 'Indian', 'Southern', 'Karnataka',
  'Bharath', 'Vishwa', 'Mahalakshmi', 'Venkateshwara', 'Ganesha', 'Nandi',
  'Golden', 'Silver', 'Star', 'Diamond', 'Crystal', 'Premier', 'Supreme',
  'Global', 'Universal', 'Modern', 'New', 'Classic', 'Elite', 'Prime',
];

const BUSINESS_CORES = [
  'Textiles', 'Industries', 'Enterprises', 'Trading', 'Engineering',
  'Chemicals', 'Pharmaceuticals', 'Foods', 'Steel', 'Plastics',
  'Electronics', 'Auto Parts', 'Garments', 'Beverages', 'Packaging',
  'Machinery', 'Tools', 'Ceramics', 'Polymers', 'Agro Products',
  'IT Solutions', 'Software', 'Construction', 'Granite', 'Exports',
  'Paper Products', 'Rubber', 'Paints', 'Fertilizers', 'Rice Mill',
  'Oil Mill', 'Flour Mill', 'Spices', 'Cashew', 'Coffee',
  'Silk', 'Handicrafts', 'Furniture', 'Cement', 'Tiles',
];

const BUSINESS_SUFFIXES = [
  'Pvt Ltd', 'Private Limited', 'Limited', 'LLP',
  'Co', 'Company', '& Sons', '& Associates', '& Brothers',
  'Works', 'Corporation', 'Group', 'Hub', 'Center',
];

const BUSINESS_TYPES = [
  'Manufacturing', 'Trading', 'Service', 'Processing',
  'Export', 'Import', 'Retail', 'Wholesale',
  'IT/ITES', 'Hospitality', 'Healthcare', 'Construction',
];

const EVENT_TYPES = [
  'inspection', 'tax_filing', 'license_renewal', 'power_consumption',
  'registration', 'compliance_check', 'pollution_test', 'safety_audit',
  'labor_inspection', 'fire_safety_check', 'food_safety_inspection',
  'annual_return', 'waste_disposal_report', 'water_usage_report',
];

// ============================================================
// RANDOM HELPERS
// ============================================================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function generatePAN() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const entityTypes = 'CFHPT'; // Company, Firm, HUF, Person, Trust
  let pan = '';
  for (let i = 0; i < 3; i++) pan += letters[randInt(0, 25)];
  pan += 'P'; // Category
  pan += entityTypes[randInt(0, 4)];
  for (let i = 0; i < 4; i++) pan += randInt(0, 9);
  pan += letters[randInt(0, 25)];
  return pan;
}

function generateGSTIN(pan, stateCode = '29') {
  const entityNum = randInt(1, 9);
  const checkDigit = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[randInt(0, 35)];
  return `${stateCode}${pan}${entityNum}Z${checkDigit}`;
}

function generatePhone() {
  const prefixes = ['98', '97', '96', '95', '94', '93', '91', '90', '88', '87', '86', '85', '70', '73', '74', '75', '76', '77', '78', '79'];
  return pick(prefixes) + String(randInt(10000000, 99999999));
}

function generateEmail(name) {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
  const domains = ['gmail.com', 'yahoo.co.in', 'rediffmail.com', 'outlook.com', 'hotmail.com'];
  return `${clean}${randInt(1, 999)}@${pick(domains)}`;
}

function generateDate(yearStart, yearEnd) {
  const year = randInt(yearStart, yearEnd);
  const month = String(randInt(1, 12)).padStart(2, '0');
  const day = String(randInt(1, 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================
// BUSINESS GENERATOR
// ============================================================

function generateBusinessName() {
  const usePrefix = Math.random() > 0.3;
  const useSuffix = Math.random() > 0.2;
  let name = '';
  if (usePrefix) name += pick(BUSINESS_PREFIXES) + ' ';
  name += pick(BUSINESS_CORES);
  if (useSuffix) name += ' ' + pick(BUSINESS_SUFFIXES);
  return name;
}

function generateAddress(district) {
  const areas = AREAS[district] || [`${district} Main Road`, `${district} Industrial Area`, `${district} Market`];
  const area = pick(areas);
  const plotNo = randInt(1, 500);
  const formats = [
    `No. ${plotNo}, ${area}, ${district}`,
    `Plot ${plotNo}, ${area}, ${district}, Karnataka`,
    `#${plotNo}, ${area}, ${district} - ${randInt(560001, 590099)}`,
    `${plotNo}/${randInt(1, 20)}, ${area}, Near ${pick(['Bus Stand', 'Railway Station', 'Main Circle', 'Post Office', 'Temple'])}, ${district}`,
  ];
  return pick(formats);
}

// Create intentional name variations
function createNameVariation(name) {
  const variations = [
    // Abbreviation changes
    (n) => n.replace('Private Limited', 'Pvt Ltd'),
    (n) => n.replace('Pvt Ltd', 'Private Limited'),
    (n) => n.replace('Private Limited', 'Pvt. Ltd.'),
    (n) => n.replace('Limited', 'Ltd'),
    (n) => n.replace('Ltd', 'Limited'),
    (n) => n.replace('Company', 'Co'),
    (n) => n.replace('Co', 'Company'),
    (n) => n.replace('& Sons', 'and Sons'),
    (n) => n.replace('& Associates', 'and Associates'),
    // Case changes
    (n) => n.toUpperCase(),
    (n) => n.toLowerCase(),
    // Spacing changes
    (n) => n.replace(/\s+/g, '  '),
    // Minor typos
    (n) => { const i = randInt(1, n.length - 2); return n.slice(0, i) + n.slice(i + 1); },
    // Adding/removing Sri/Shree
    (n) => n.replace('Sri ', 'Shree '),
    (n) => n.replace('Shree ', 'Sri '),
    // Add 'The' prefix
    (n) => 'The ' + n,
  ];
  return pick(variations)(name);
}

// Create intentional address variations
function createAddressVariation(address) {
  const variations = [
    (a) => a.replace('Road', 'Rd'),
    (a) => a.replace('Rd', 'Road'),
    (a) => a.replace('Street', 'St'),
    (a) => a.replace('No.', 'Number'),
    (a) => a.replace('No.', '#'),
    (a) => a.replace('Near', 'Opp'),
    (a) => a.replace(', Karnataka', ''),
    (a) => a + ', Karnataka, India',
    (a) => a.toUpperCase(),
    (a) => a.replace('Industrial Area', 'Indl Area'),
    (a) => a.replace('Industrial Area', 'Ind. Area'),
  ];
  return pick(variations)(address);
}

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

function seed() {
  console.log('🌱 UBIX Synthetic Data Generator');
  console.log('================================\n');

  const db = getDatabase();

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  db.exec(`
    DELETE FROM unlinked_events;
    DELETE FROM activity_classifications;
    DELETE FROM activity_events;
    DELETE FROM review_decisions;
    DELETE FROM match_candidates;
    DELETE FROM ubid_links;
    DELETE FROM ubids;
    DELETE FROM normalized_records;
    DELETE FROM source_records;
    DELETE FROM departments;
    DELETE FROM pipeline_runs;
    DELETE FROM sqlite_sequence;
  `);

  // Insert departments
  console.log('🏛️  Creating departments...');
  const insertDept = db.prepare(
    'INSERT INTO departments (name, code, description) VALUES (?, ?, ?)'
  );
  const deptTransaction = db.transaction(() => {
    for (const dept of DEPARTMENTS) {
      insertDept.run(dept.name, dept.code, dept.description);
    }
  });
  deptTransaction();
  console.log(`   ✓ ${DEPARTMENTS.length} departments created`);

  // Generate core businesses
  console.log('\n🏢 Generating businesses...');
  const businesses = [];
  const NUM_BUSINESSES = 500;

  for (let i = 0; i < NUM_BUSINESSES; i++) {
    const name = generateBusinessName();
    const pan = Math.random() > 0.15 ? generatePAN() : null; // 15% missing PAN
    const gstin = pan && Math.random() > 0.2 ? generateGSTIN(pan) : null; // 20% missing GSTIN
    const district = pick(KARNATAKA_DISTRICTS);
    const address = generateAddress(district);
    const phone = Math.random() > 0.1 ? generatePhone() : null;
    const email = Math.random() > 0.3 ? generateEmail(name) : null;
    const businessType = pick(BUSINESS_TYPES);
    const registrationDate = generateDate(2010, 2024);

    businesses.push({ name, pan, gstin, district, address, phone, email, businessType, registrationDate });
  }
  console.log(`   ✓ ${NUM_BUSINESSES} businesses generated`);

  // Generate source records with variations
  console.log('\n📄 Generating source records across departments...');
  const insertRecord = db.prepare(`
    INSERT INTO source_records (department_id, business_name, pan, gstin, address, district, phone, email, business_type, registration_date, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalRecords = 0;
  const recordTransaction = db.transaction(() => {
    for (const biz of businesses) {
      // Each business appears in 1-6 departments
      const numDepts = randInt(1, Math.min(6, DEPARTMENTS.length));
      const deptIndices = pickN(Array.from({ length: DEPARTMENTS.length }, (_, i) => i + 1), numDepts);

      for (const deptId of deptIndices) {
        // Apply variations to simulate real-world inconsistencies
        const usedName = Math.random() > 0.4 ? createNameVariation(biz.name) : biz.name;
        const usedAddress = Math.random() > 0.5 ? createAddressVariation(biz.address) : biz.address;
        const usedPan = biz.pan && Math.random() > 0.2 ? biz.pan : null; // Sometimes PAN is missing
        const usedGstin = biz.gstin && Math.random() > 0.3 ? biz.gstin : null;
        const usedPhone = biz.phone && Math.random() > 0.15 ? biz.phone : null;
        const usedEmail = biz.email && Math.random() > 0.25 ? biz.email : null;

        const rawJson = JSON.stringify({
          original_name: biz.name,
          department_record_id: `${DEPARTMENTS[deptId - 1].code}-${randInt(10000, 99999)}`,
        });

        insertRecord.run(
          deptId, usedName, usedPan, usedGstin, usedAddress, biz.district,
          usedPhone, usedEmail, biz.businessType, biz.registrationDate, rawJson
        );
        totalRecords++;
      }
    }
  });
  recordTransaction();
  console.log(`   ✓ ${totalRecords} source records created`);

  // Update department record counts
  db.exec(`
    UPDATE departments SET record_count = (
      SELECT COUNT(*) FROM source_records WHERE source_records.department_id = departments.id
    )
  `);

  // Generate activity events
  console.log('\n📅 Generating activity events...');
  const insertEvent = db.prepare(`
    INSERT INTO activity_events (source_record_id, department_id, event_type, event_date, event_details)
    VALUES (?, ?, ?, ?, ?)
  `);

  const records = db.prepare('SELECT id, department_id, business_name FROM source_records').all();
  let totalEvents = 0;

  const eventTransaction = db.transaction(() => {
    for (const record of records) {
      // Each record gets 0-5 events
      const numEvents = randInt(0, 5);
      for (let i = 0; i < numEvents; i++) {
        const eventType = pick(EVENT_TYPES);
        const eventDate = generateDate(2022, 2026);
        const details = JSON.stringify({
          description: `${eventType.replace('_', ' ')} for ${record.business_name}`,
          outcome: pick(['passed', 'failed', 'pending', 'completed', 'in_progress']),
          inspector: `Inspector ${randInt(100, 999)}`,
          remarks: pick([
            'All documents in order',
            'Minor observations noted',
            'Follow-up required',
            'Satisfactory compliance',
            'Violations observed - notice issued',
            'Pending documentation',
            null,
          ]),
        });

        insertEvent.run(record.id, record.department_id, eventType, eventDate, details);
        totalEvents++;
      }
    }
  });
  eventTransaction();
  console.log(`   ✓ ${totalEvents} activity events created`);

  // Generate some unlinked events
  console.log('\n🔗 Generating unlinked events...');
  const insertUnlinked = db.prepare(`
    INSERT INTO unlinked_events (department_id, event_type, event_date, business_name_hint, raw_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  const NUM_UNLINKED = 50;
  const unlinkedTransaction = db.transaction(() => {
    for (let i = 0; i < NUM_UNLINKED; i++) {
      const deptId = randInt(1, DEPARTMENTS.length);
      const eventType = pick(EVENT_TYPES);
      const eventDate = generateDate(2023, 2026);
      const nameHint = generateBusinessName();
      const rawJson = JSON.stringify({ source: 'manual_entry', ref: `UNK-${randInt(1000, 9999)}` });

      insertUnlinked.run(deptId, eventType, eventDate, nameHint, rawJson);
    }
  });
  unlinkedTransaction();
  console.log(`   ✓ ${NUM_UNLINKED} unlinked events created`);

  // Summary
  const stats = {
    departments: db.prepare('SELECT COUNT(*) as count FROM departments').get().count,
    records: db.prepare('SELECT COUNT(*) as count FROM source_records').get().count,
    events: db.prepare('SELECT COUNT(*) as count FROM activity_events').get().count,
    unlinked: db.prepare('SELECT COUNT(*) as count FROM unlinked_events').get().count,
    recordsWithPan: db.prepare('SELECT COUNT(*) as count FROM source_records WHERE pan IS NOT NULL').get().count,
    recordsWithGstin: db.prepare('SELECT COUNT(*) as count FROM source_records WHERE gstin IS NOT NULL').get().count,
  };

  console.log('\n' + '='.repeat(50));
  console.log('📊 SEED SUMMARY');
  console.log('='.repeat(50));
  console.log(`   Departments:         ${stats.departments}`);
  console.log(`   Source Records:       ${stats.records}`);
  console.log(`   Records with PAN:    ${stats.recordsWithPan} (${Math.round(stats.recordsWithPan / stats.records * 100)}%)`);
  console.log(`   Records with GSTIN:  ${stats.recordsWithGstin} (${Math.round(stats.recordsWithGstin / stats.records * 100)}%)`);
  console.log(`   Activity Events:     ${stats.events}`);
  console.log(`   Unlinked Events:     ${stats.unlinked}`);
  console.log('='.repeat(50));
  console.log('\n✅ Seeding complete!\n');

  closeDatabase();
}

seed();
