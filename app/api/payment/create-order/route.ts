import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Locker from '@/models/Locker';
import Payment from '@/models/Payment';
import Session from '@/models/Session';
import { razorpay } from '@/lib/razorpay';
import { verifyToken } from '@/lib/auth';
import { calculateOvertimeMinutes, isInGracePeriod } from '@/lib/utils';

const CONVENIENCE_FEE_PAISE = 200;

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { locker_id, duration_minutes, type, session_id } = await req.json();

  if (!locker_id || !type) {
    return NextResponse.json({ error: 'locker_id and type are required' }, { status: 400 });
  }

  await connectDB();

  const locker = await Locker.findOne({ locker_id });
  if (!locker) return NextResponse.json({ error: 'Locker not found' }, { status: 404 });

  let amount = 0;
  let minutes = duration_minutes;

  if (type === 'initial') {
    if (!duration_minutes || duration_minutes < 1 || duration_minutes > 720) {
      return NextResponse.json({ error: 'duration_minutes must be between 1 and 720' }, { status: 400 });
    }
    const base = Math.max(100, Math.round((locker.hourly_rate / 60) * duration_minutes));
    amount = base + CONVENIENCE_FEE_PAISE;
  } else if (type === 'overtime') {
    if (!session_id) return NextResponse.json({ error: 'session_id required for overtime' }, { status: 400 });
    const session = await Session.findById(session_id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.user_email !== payload.email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (isInGracePeriod(session.paid_until)) {
      return NextResponse.json({ error: 'Still within grace period. No overtime due yet.' }, { status: 400 });
    }

    minutes = calculateOvertimeMinutes(session.paid_until);
    if (minutes <= 0) return NextResponse.json({ error: 'No overtime due' }, { status: 400 });

    // Overtime billed in full-hour ceiling
    const overtimeHours = Math.ceil(minutes / 60);
    amount = locker.hourly_rate * overtimeHours + CONVENIENCE_FEE_PAISE;
    minutes = overtimeHours * 60; // round up to full hours for billing
  } else {
    return NextResponse.json({ error: 'type must be initial or overtime' }, { status: 400 });
  }

  // Rs 1 for live-credential testing
  amount = 100;

  console.log('[create-order] using key:', process.env.RAZORPAY_KEY_ID?.slice(0, 14));

  let order;
  try {
    order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `locker_${locker_id}_${Date.now()}`,
    });
  } catch (err: unknown) {
    const rzpErr = err as { error?: { description?: string; code?: string; reason?: string } };
    console.error('[Razorpay]', JSON.stringify(rzpErr, null, 2));
    const msg = rzpErr?.error?.description || rzpErr?.error?.reason || 'Razorpay order creation failed';
    return NextResponse.json({ error: msg, detail: rzpErr?.error }, { status: 502 });
  }

  await Payment.create({
    locker_id: locker._id,
    session_id: session_id || null,
    razorpay_order_id: order.id,
    amount,
    type,
    duration_hours: minutes / 60,
    status: 'pending',
  });

  return NextResponse.json({ order_id: order.id, amount, currency: 'INR', duration_minutes: minutes });
}
