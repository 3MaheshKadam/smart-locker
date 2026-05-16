import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Session from '@/models/Session';
import Locker from '@/models/Locker';
import { verifyToken } from '@/lib/auth';
import { calculateOvertimeHours, isInGracePeriod } from '@/lib/utils';

export async function GET(req: NextRequest, { params }: { params: Promise<{ session_id: string }> }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  await connectDB();
  const { session_id } = await params;

  const session = await Session.findById(session_id).populate<{ locker_id: { hourly_rate: number } | null }>('locker_id');
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.user_email !== payload.email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const now = new Date();
  const overtime_hours = calculateOvertimeHours(session.paid_until, now);
  const in_grace = isInGracePeriod(session.paid_until, now);
  const locker = session.locker_id as { hourly_rate: number } | null;
  const hourly_rate = locker?.hourly_rate ?? 2000;
  const overtime_amount = overtime_hours > 0 && !in_grace ? overtime_hours * hourly_rate + 200 : 0;

  return NextResponse.json({
    session_id: session._id,
    user_name: session.user_name,
    user_email: session.user_email,
    start_time: session.start_time,
    paid_until: session.paid_until,
    status: session.status,
    overtime_hours: in_grace ? 0 : overtime_hours,
    in_grace_period: in_grace,
    overtime_amount_paise: overtime_amount,
  });
}
