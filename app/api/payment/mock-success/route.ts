import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Locker from '@/models/Locker';
import Payment from '@/models/Payment';
import Session from '@/models/Session';
import { verifyToken, signToken } from '@/lib/auth';

// Only available in development — blocked in production
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { locker_id, duration_minutes, name } = await req.json();

  if (!locker_id || !duration_minutes) {
    return NextResponse.json({ error: 'locker_id and duration_minutes required' }, { status: 400 });
  }

  await connectDB();

  const locker = await Locker.findOne({ locker_id });
  if (!locker) return NextResponse.json({ error: 'Locker not found' }, { status: 404 });

  if (locker.status === 'occupied') {
    return NextResponse.json({ error: 'Locker is already occupied' }, { status: 409 });
  }

  const base = Math.max(100, Math.round((locker.hourly_rate / 60) * duration_minutes));
  const amount = base + 200;
  const fakeOrderId = `mock_order_${Date.now()}`;
  const fakePaymentId = `mock_pay_${Date.now()}`;

  const payment = await Payment.create({
    locker_id: locker._id,
    session_id: null,
    razorpay_order_id: fakeOrderId,
    razorpay_payment_id: fakePaymentId,
    amount,
    type: 'initial',
    duration_hours: duration_minutes / 60,
    status: 'paid',
  });

  const now = new Date();
  const paid_until = new Date(now.getTime() + duration_minutes * 60 * 1000);

  const session = await Session.create({
    locker_id: locker._id,
    user_name: name || payload.email,
    user_email: payload.email,
    start_time: now,
    paid_until,
    paid_duration_hours: duration_minutes / 60,
    status: 'active',
    initial_payment_id: payment._id,
  });

  await Payment.updateOne({ _id: payment._id }, { session_id: session._id });

  await Locker.updateOne(
    { _id: locker._id },
    { status: 'occupied', current_session_id: session._id, unlock_requested: true }
  );

  // UNLOCK is sent by the browser singleton (mqtt-browser.ts) on success page load
  const newToken = signToken({
    email: payload.email,
    locker_id,
    session_id: session._id.toString(),
  });

  return NextResponse.json({ session_id: session._id, token: newToken, paid_until });
}
