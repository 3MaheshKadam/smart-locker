import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import OTP from '@/models/OTP';
import Locker from '@/models/Locker';
import { sendOTPEmail } from '@/lib/mailer';
import { generateOTP } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const { email, locker_id } = await req.json();

  if (!email || !locker_id) {
    return NextResponse.json({ error: 'email and locker_id are required' }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  await connectDB();

  const locker = await Locker.findOne({ locker_id });
  if (!locker) return NextResponse.json({ error: 'Locker not found' }, { status: 404 });

  // Rate limit: max 3 resends per email per locker per 10 minutes
  const recent = await OTP.findOne({ email, locker_id, verified: false });
  if (recent) {
    if (recent.resend_count >= 3) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please wait 10 minutes.' },
        { status: 429 }
      );
    }
    // Cooldown: 60s between resends
    const secondsSinceLast = (Date.now() - recent.createdAt.getTime()) / 1000;
    if (secondsSinceLast < 60) {
      return NextResponse.json(
        { error: `Please wait ${Math.ceil(60 - secondsSinceLast)} seconds before resending.` },
        { status: 429 }
      );
    }
    await OTP.deleteOne({ _id: recent._id });
  }

  const otp = generateOTP();
  const otp_hash = await bcrypt.hash(otp, 10);
  const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await OTP.create({
    email,
    otp_hash,
    locker_id,
    expires_at,
    resend_count: recent ? recent.resend_count + 1 : 0,
  });

  try {
    await sendOTPEmail(email, otp, locker.label);
  } catch {
    await OTP.deleteOne({ email, locker_id, verified: false });
    return NextResponse.json({ error: 'Failed to send OTP email. Please try again later.' }, { status: 500 });
  }

  return NextResponse.json({ message: 'OTP sent successfully' });
}
