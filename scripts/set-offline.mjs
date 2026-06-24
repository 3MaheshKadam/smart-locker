import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf-8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const client = new MongoClient(env.MONGODB_URI);
await client.connect();
const res = await client.db().collection('lockers').updateMany(
  { locker_id: { $in: ['L02', 'L03', 'L04', 'L05'] } },
  { $set: { status: 'maintenance' } }
);
console.log('Updated:', res.modifiedCount, 'lockers → maintenance (Offline)');
await client.close();
