import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Locker from '@/models/Locker';
import Session from '@/models/Session';
import Payment from '@/models/Payment';

function checkAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const [, token] = auth.split(' ');
  return token === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const lockers = await Locker.find().populate('current_session_id');
  const activeCount = lockers.filter((l) => l.status === 'occupied').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const payments = await Payment.find({ status: 'paid', createdAt: { $gte: today } });
  const revenue = payments.reduce((sum, p) => sum + p.amount, 0);

  return NextResponse.json({ lockers, active_count: activeCount, today_revenue_paise: revenue });
}

// Seed endpoint — create test lockers
export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();

  const seed = [
    { locker_id: 'L001', label: 'Locker A1', location: 'Ground Floor - Block A', hourly_rate: 2000 },
    { locker_id: 'L002', label: 'Locker A2', location: 'Ground Floor - Block A', hourly_rate: 2000 },
    { locker_id: 'L003', label: 'Locker B1', location: 'First Floor - Block B', hourly_rate: 2500 },
  ];

  for (const data of seed) {
    await Locker.updateOne({ locker_id: data.locker_id }, data, { upsert: true });
  }

  return NextResponse.json({ message: 'Lockers seeded', count: seed.length });
}
