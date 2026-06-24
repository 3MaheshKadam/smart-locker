// Run: node scripts/seed-lockers.mjs
// Creates L01–L05 in MongoDB (skips any that already exist)

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read MONGODB_URI from .env.local
const envPath = resolve(__dirname, '../.env.local');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map((p, i) => i === 0 ? p.trim() : l.slice(l.indexOf('=') + 1).trim()))
);

const MONGODB_URI = envVars['MONGODB_URI'];
if (!MONGODB_URI) { console.error('MONGODB_URI not found in .env.local'); process.exit(1); }

const lockers = [
  { locker_id: 'L01', label: 'Locker 1', location: 'Ground Floor', hourly_rate: 2000, status: 'available', unlock_requested: false },
  { locker_id: 'L02', label: 'Locker 2', location: 'Ground Floor', hourly_rate: 2000, status: 'available', unlock_requested: false },
  { locker_id: 'L03', label: 'Locker 3', location: 'Ground Floor', hourly_rate: 2000, status: 'available', unlock_requested: false },
  { locker_id: 'L04', label: 'Locker 4', location: 'First Floor',  hourly_rate: 2500, status: 'available', unlock_requested: false },
  { locker_id: 'L05', label: 'Locker 5', location: 'First Floor',  hourly_rate: 2500, status: 'available', unlock_requested: false },
];

const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db();
const col = db.collection('lockers');

for (const locker of lockers) {
  const exists = await col.findOne({ locker_id: locker.locker_id });
  if (exists) {
    console.log(`  skip  ${locker.locker_id} (already exists)`);
  } else {
    await col.insertOne({ ...locker, createdAt: new Date(), updatedAt: new Date() });
    console.log(`  ✓ created  ${locker.locker_id} — ${locker.label} @ ${locker.location} (₹${locker.hourly_rate / 100}/hr)`);
  }
}

await client.close();
console.log('\nDone.');
