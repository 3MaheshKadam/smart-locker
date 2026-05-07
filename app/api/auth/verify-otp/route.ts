import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import OTP from '@/models/OTP';
import Session from '@/models/Session';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, otp, locker_id, name } = await req.json();

  if (!email || !otp || !locker_id) {
    return NextResponse.json({ error: 'email, otp, and locker_id are required' }, { status: 400 });
  }

  await connectDB();

  const record = await OTP.findOne({ email, locker_id, verified: false });

  if (!record) {
    return NextResponse.json({ error: 'OTP not found. Please request a new one.' }, { status: 400 });
  }

  if (new Date() > record.expires_at) {
    await OTP.deleteOne({ _id: record._id });
    return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
  }

  if (record.attempts >= 3) {
    await OTP.deleteOne({ _id: record._id });
    return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new OTP.' }, { status: 400 });
  }

  const isValid = await bcrypt.compare(otp, record.otp_hash);
  if (!isValid) {
    await OTP.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    return NextResponse.json(
      { error: `Incorrect OTP. ${2 - record.attempts} attempt(s) remaining.` },
      { status: 400 }
    );
  }

  await OTP.updateOne({ _id: record._id }, { verified: true });

  // Check if this email has an active session on this locker
  const activeSession = await Session.findOne({
    user_email: email,
    status: { $in: ['active', 'overtime'] },
  }).populate('locker_id');

  const token = signToken({ email, locker_id, session_id: activeSession?._id?.toString() });

  return NextResponse.json({
    token,
    active_session: activeSession
      ? {
          session_id: activeSession._id,
          paid_until: activeSession.paid_until,
          status: activeSession.status,
        }
      : null,
    name: name || null,
  });
}
