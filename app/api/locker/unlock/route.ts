import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Locker from '@/models/Locker';

// ESP polls this endpoint every 5 seconds
export async function GET(req: NextRequest) {
  const locker_id = req.nextUrl.searchParams.get('locker_id');
  const esp_secret = req.headers.get('x-esp-secret');

  if (esp_secret !== process.env.ESP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!locker_id) return NextResponse.json({ error: 'locker_id required' }, { status: 400 });

  await connectDB();
  const locker = await Locker.findOne({ locker_id });
  if (!locker) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Update heartbeat
  await Locker.updateOne({ locker_id }, { last_seen: new Date() });

  if (locker.unlock_requested) {
    // Reset flag immediately so locker only opens once
    await Locker.updateOne({ locker_id }, { unlock_requested: false });
    return NextResponse.json({ unlock: true });
  }

  return NextResponse.json({ unlock: false });
}
