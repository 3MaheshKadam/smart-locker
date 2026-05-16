import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import Session from '@/models/Session';
import Locker from '@/models/Locker';
import { verifyToken } from '@/lib/auth';
import { calculateOvertimeHours, isInGracePeriod } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { session_id } = await req.json();
  if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 });

  await connectDB();

  const session = await Session.findById(session_id).populate<{ locker_id: { _id: mongoose.Types.ObjectId; hourly_rate: number; locker_id: string } | null }>('locker_id');
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.user_email !== payload.email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const now = new Date();
  const overtime_hours = calculateOvertimeHours(session.paid_until, now);
  const in_grace = isInGracePeriod(session.paid_until, now);

  const locker_doc = session.locker_id as { _id: mongoose.Types.ObjectId; hourly_rate: number; locker_id: string } | null;
  const hourly_rate = locker_doc?.hourly_rate ?? 2000;

  // Block unlock if overtime and not in grace period
  if (overtime_hours > 0 && !in_grace) {
    const overtime_amount = overtime_hours * hourly_rate + 200;
    return NextResponse.json(
      { error: 'overtime_due', overtime_hours, overtime_amount_paise: overtime_amount, session_id },
      { status: 402 }
    );
  }

  // All good — close session and trigger unlock
  await Session.updateOne({ _id: session._id }, { status: 'closed', end_time: now });

  if (locker_doc?._id) {
    await Locker.updateOne(
      { _id: locker_doc._id },
      { status: 'available', current_session_id: null, unlock_requested: true }
    );
    // UNLOCK is sent by the browser (mqtt-browser.ts singleton) immediately when user taps Unlock
  }

  return NextResponse.json({ message: 'Session closed. Locker unlocking.' });
}
