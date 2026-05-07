import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Payment from '@/models/Payment';
import { verifyWebhookSignature } from '@/lib/razorpay';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  await connectDB();

  if (event.event === 'payment.captured') {
    const { order_id, id: payment_id } = event.payload.payment.entity;
    await Payment.updateOne(
      { razorpay_order_id: order_id },
      { razorpay_payment_id: payment_id, status: 'paid' }
    );
  }

  if (event.event === 'payment.failed') {
    const { order_id } = event.payload.payment.entity;
    await Payment.updateOne({ razorpay_order_id: order_id }, { status: 'failed' });
  }

  return NextResponse.json({ received: true });
}
