import { NextRequest, NextResponse } from 'next/server';
import { publishLock } from '@/lib/mqtt';

function checkAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const [, token] = auth.split(' ');
  return token === process.env.ADMIN_SECRET;
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { locker_id } = await req.json();
  if (!locker_id) return NextResponse.json({ error: 'locker_id required' }, { status: 400 });

  publishLock(locker_id).catch(console.error);

  return NextResponse.json({ message: 'Lock command sent' });
}
