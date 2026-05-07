import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISession extends Document {
  locker_id: mongoose.Types.ObjectId;
  user_name: string;
  user_email: string;
  start_time: Date;
  paid_until: Date;
  end_time: Date | null;
  paid_duration_hours: number;
  status: 'active' | 'expired' | 'overtime' | 'closed';
  initial_payment_id: mongoose.Types.ObjectId | null;
  overtime_payment_id: mongoose.Types.ObjectId | null;
}

const SessionSchema = new Schema<ISession>(
  {
    locker_id: { type: Schema.Types.ObjectId, ref: 'Locker', required: true },
    user_name: { type: String, required: true },
    user_email: { type: String, required: true },
    start_time: { type: Date, required: true },
    paid_until: { type: Date, required: true },
    end_time: { type: Date, default: null },
    paid_duration_hours: { type: Number, required: true },
    status: { type: String, enum: ['active', 'expired', 'overtime', 'closed'], default: 'active' },
    initial_payment_id: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    overtime_payment_id: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
  },
  { timestamps: true }
);

const Session: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);

export default Session;
