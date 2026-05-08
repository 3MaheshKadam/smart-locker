import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Session from '@/models/Session';
import Locker from '@/models/Locker';
import Payment from '@/models/Payment';
import { verifyToken } from '@/lib/auth';
import { calculateOvertimeHours, isInGracePeriod } from '@/lib/utils';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { session_id, locker_id } = await req.json();
  if (!session_id || !locker_id) {
    return NextResponse.json({ error: 'session_id and locker_id required' }, { status: 400 });
  }

  await connectDB();

  const session = await Session.findById(session_id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.user_email !== payload.email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const locker = await Locker.findOne({ locker_id });
  if (!locker) return NextResponse.json({ error: 'Locker not found' }, { status: 404 });

  const overtime_hours = calculateOvertimeHours(session.paid_until);
  const in_grace = isInGracePeriod(session.paid_until);

  if (overtime_hours <= 0 || in_grace) {
    return NextResponse.json({ error: 'No overtime due' }, { status: 400 });
  }

  const amount = locker.hourly_rate * overtime_hours + 200;

  const payment = await Payment.create({
    locker_id: locker._id,
    session_id: session._id,
    razorpay_order_id: `mock_ot_order_${Date.now()}`,
    razorpay_payment_id: `mock_ot_pay_${Date.now()}`,
    amount,
    type: 'overtime',
    duration_hours: overtime_hours,
    status: 'paid',
  });

  const new_paid_until = new Date(
    session.paid_until.getTime() + overtime_hours * 60 * 60 * 1000
  );

  await Session.updateOne(
    { _id: session._id },
    { overtime_payment_id: payment._id, paid_until: new_paid_until, status: 'active' }
  );

  return NextResponse.json({ message: 'Overtime mock payment recorded', new_paid_until });
}
