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

  const lockers = await Locker.find().populate({ path: 'current_session_id', model: Session });
  const activeCount = lockers.filter((l) => l.status === 'occupied').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const payments = await Payment.find({ status: 'paid', createdAt: { $gte: today } });
  const revenue = payments.reduce((sum, p) => sum + p.amount, 0);

  return NextResponse.json({ lockers, active_count: activeCount, today_revenue_paise: revenue });
}

// Add a new locker
export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { locker_id, label, location, hourly_rate } = await req.json();

  if (!locker_id || !label || !location || !hourly_rate) {
    return NextResponse.json({ error: 'locker_id, label, location and hourly_rate are required' }, { status: 400 });
  }

  await connectDB();

  const existing = await Locker.findOne({ locker_id });
  if (existing) return NextResponse.json({ error: `Locker "${locker_id}" already exists` }, { status: 409 });

  const locker = await Locker.create({ locker_id, label, location, hourly_rate });
  return NextResponse.json({ message: 'Locker created', locker }, { status: 201 });
}

// Edit a locker
export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { locker_id, label, location, hourly_rate, status } = await req.json();
  if (!locker_id) return NextResponse.json({ error: 'locker_id required' }, { status: 400 });

  await connectDB();

  const updates: Record<string, unknown> = {};
  if (label)       updates.label = label;
  if (location)    updates.location = location;
  if (hourly_rate) updates.hourly_rate = hourly_rate;
  if (status)      updates.status = status;

  const locker = await Locker.findOneAndUpdate({ locker_id }, updates, { new: true });
  if (!locker) return NextResponse.json({ error: 'Locker not found' }, { status: 404 });

  return NextResponse.json({ message: 'Locker updated', locker });
}

// Delete a locker
export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { locker_id } = await req.json();
  if (!locker_id) return NextResponse.json({ error: 'locker_id required' }, { status: 400 });

  await connectDB();

  const locker = await Locker.findOne({ locker_id });
  if (!locker) return NextResponse.json({ error: 'Locker not found' }, { status: 404 });
  if (locker.status === 'occupied') return NextResponse.json({ error: 'Cannot delete an occupied locker' }, { status: 409 });

  await Locker.deleteOne({ locker_id });
  return NextResponse.json({ message: 'Locker deleted' });
}
