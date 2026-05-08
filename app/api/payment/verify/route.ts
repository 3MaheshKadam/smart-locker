import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Payment from '@/models/Payment';
import Session from '@/models/Session';
import Locker from '@/models/Locker';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import { verifyToken, signToken } from '@/lib/auth';
import { publishUnlock } from '@/lib/mqtt';

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, name } = await req.json();

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 });
  }

  const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!isValid) return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });

  await connectDB();

  const payment = await Payment.findOne({ razorpay_order_id });
  if (!payment) return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });

  await Payment.updateOne(
    { _id: payment._id },
    { razorpay_payment_id, status: 'paid' }
  );

  const locker = await Locker.findById(payment.locker_id);
  if (!locker) return NextResponse.json({ error: 'Locker not found' }, { status: 404 });

  if (payment.type === 'initial') {
    const now = new Date();
    const paid_until = new Date(now.getTime() + payment.duration_hours * 60 * 60 * 1000);

    const session = await Session.create({
      locker_id: locker._id,
      user_name: name || payload.email,
      user_email: payload.email,
      start_time: now,
      paid_until,
      paid_duration_hours: payment.duration_hours,
      status: 'active',
      initial_payment_id: payment._id,
    });

    await Payment.updateOne({ _id: payment._id }, { session_id: session._id });

    await Locker.updateOne(
      { _id: locker._id },
      { status: 'occupied', current_session_id: session._id, unlock_requested: true }
    );

    // Fire MQTT instantly (non-blocking) — ESP receives unlock command in <1s
    publishUnlock(locker.locker_id).catch(console.error);

    const newToken = signToken({ email: payload.email, locker_id: locker.locker_id, session_id: session._id.toString() });

    return NextResponse.json({ session_id: session._id, token: newToken, paid_until });
  }

  if (payment.type === 'overtime') {
    const session = await Session.findById(payment.session_id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const new_paid_until = new Date(
      session.paid_until.getTime() + payment.duration_hours * 60 * 60 * 1000
    );

    await Session.updateOne(
      { _id: session._id },
      { overtime_payment_id: payment._id, paid_until: new_paid_until, status: 'active' }
    );

    await Locker.updateOne({ _id: locker._id }, { unlock_requested: true });

    publishUnlock(locker.locker_id).catch(console.error);

    return NextResponse.json({ session_id: session._id, paid_until: new_paid_until });
  }

  return NextResponse.json({ error: 'Unknown payment type' }, { status: 400 });
}
