import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Locker from '@/models/Locker';
import Session from '@/models/Session';

export async function GET(req: NextRequest, { params }: { params: Promise<{ locker_id: string }> }) {
  await connectDB();
  const { locker_id } = await params;

  const locker = await Locker.findOne({ locker_id });
  if (!locker) return NextResponse.json({ error: 'Locker not found' }, { status: 404 });

  let session_info = null;
  if (locker.status === 'occupied' && locker.current_session_id) {
    const session = await Session.findById(locker.current_session_id);
    if (session) {
      session_info = {
        paid_until: session.paid_until,
        user_email: session.user_email,
      };
    }
  }

  return NextResponse.json({
    locker_id: locker.locker_id,
    label: locker.label,
    location: locker.location,
    hourly_rate: locker.hourly_rate,
    status: locker.status,
    session_info,
  });
}
