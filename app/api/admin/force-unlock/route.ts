import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Locker from '@/models/Locker';
import Session from '@/models/Session';

function checkAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const [, token] = auth.split(' ');
  return token === process.env.ADMIN_SECRET;
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { locker_id } = await req.json();
  if (!locker_id) return NextResponse.json({ error: 'locker_id required' }, { status: 400 });

  await connectDB();

  const locker = await Locker.findOne({ locker_id });
  if (!locker) return NextResponse.json({ error: 'Locker not found' }, { status: 404 });

  if (locker.current_session_id) {
    await Session.updateOne(
      { _id: locker.current_session_id },
      { status: 'closed', end_time: new Date() }
    );
  }

  await Locker.updateOne(
    { locker_id },
    { unlock_requested: true, status: 'available', current_session_id: null }
  );

  return NextResponse.json({ message: 'Force unlock triggered' });
}
