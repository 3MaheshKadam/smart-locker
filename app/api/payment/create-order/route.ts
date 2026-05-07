import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Locker from '@/models/Locker';
import Payment from '@/models/Payment';
import Session from '@/models/Session';
import { razorpay } from '@/lib/razorpay';
import { verifyToken } from '@/lib/auth';
import { calculateOvertimeHours, isInGracePeriod } from '@/lib/utils';

const CONVENIENCE_FEE_PAISE = 200; // ₹2

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { locker_id, duration_hours, type, session_id } = await req.json();

  if (!locker_id || !type) {
    return NextResponse.json({ error: 'locker_id and type are required' }, { status: 400 });
  }

  await connectDB();

  const locker = await Locker.findOne({ locker_id });
  if (!locker) return NextResponse.json({ error: 'Locker not found' }, { status: 404 });

  let amount = 0;
  let hours = duration_hours;

  if (type === 'initial') {
    if (!duration_hours || duration_hours < 1 || duration_hours > 12) {
      return NextResponse.json({ error: 'duration_hours must be between 1 and 12' }, { status: 400 });
    }
    amount = locker.hourly_rate * duration_hours + CONVENIENCE_FEE_PAISE;
  } else if (type === 'overtime') {
    if (!session_id) return NextResponse.json({ error: 'session_id required for overtime' }, { status: 400 });
    const session = await Session.findById(session_id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.user_email !== payload.email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (isInGracePeriod(session.paid_until)) {
      return NextResponse.json({ error: 'Still within grace period. No overtime due yet.' }, { status: 400 });
    }

    hours = calculateOvertimeHours(session.paid_until);
    if (hours <= 0) return NextResponse.json({ error: 'No overtime due' }, { status: 400 });
    amount = locker.hourly_rate * hours + CONVENIENCE_FEE_PAISE;
  } else {
    return NextResponse.json({ error: 'type must be initial or overtime' }, { status: 400 });
  }

  const order = await razorpay.orders.create({
    amount,
    currency: 'INR',
    receipt: `locker_${locker_id}_${Date.now()}`,
  });

  await Payment.create({
    locker_id: locker._id,
    session_id: session_id || null,
    razorpay_order_id: order.id,
    amount,
    type,
    duration_hours: hours,
    status: 'pending',
  });

  return NextResponse.json({
    order_id: order.id,
    amount,
    currency: 'INR',
    duration_hours: hours,
  });
}
