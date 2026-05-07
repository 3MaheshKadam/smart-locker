import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPayment extends Document {
  session_id: mongoose.Types.ObjectId | null;
  locker_id: mongoose.Types.ObjectId;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: number; // paise
  type: 'initial' | 'overtime';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  duration_hours: number;
}

const PaymentSchema = new Schema<IPayment>(
  {
    session_id: { type: Schema.Types.ObjectId, ref: 'Session', default: null },
    locker_id: { type: Schema.Types.ObjectId, ref: 'Locker', required: true },
    razorpay_order_id: { type: String, required: true, unique: true },
    razorpay_payment_id: { type: String, default: null },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['initial', 'overtime'], required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    duration_hours: { type: Number, required: true },
  },
  { timestamps: true }
);

const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);

export default Payment;
