const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('Upcoming-Workshops-Tracker.xlsx', { cellDates: true });
const sheet = wb.Sheets['Upcoming-track-list'];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

// Only keep meaningful columns; drop __EMPTY_*
const cleaned = rows.map(r => {
  const out = {};
  for (const k of Object.keys(r)) {
    if (k.startsWith('__EMPTY')) continue;
    const v = r[k];
    if (v === '' || v == null) continue;
    out[k.trim()] = v instanceof Date ? v.toISOString().split('T')[0] : v;
  }
  return out;
}).filter(r => Object.keys(r).length > 0);

console.log('Total rows:', cleaned.length);
console.log('Sample keys:', Object.keys(cleaned[0] || {}));
fs.writeFileSync('sheet-dump.json', JSON.stringify(cleaned, null, 2));
console.log('Wrote sheet-dump.json');
