import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILocker extends Document {
  locker_id: string;
  label: string;
  location: string;
  hourly_rate: number;
  status: 'available' | 'occupied' | 'maintenance';
  current_session_id: mongoose.Types.ObjectId | null;
  unlock_requested: boolean;
  last_seen: Date;
}

const LockerSchema = new Schema<ILocker>(
  {
    locker_id: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    location: { type: String, required: true },
    hourly_rate: { type: Number, required: true, default: 2000 }, // paise (₹20/hr)
    status: { type: String, enum: ['available', 'occupied', 'maintenance'], default: 'available' },
    current_session_id: { type: Schema.Types.ObjectId, ref: 'Session', default: null },
    unlock_requested: { type: Boolean, default: false },
    last_seen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Locker: Model<ILocker> =
  mongoose.models.Locker || mongoose.model<ILocker>('Locker', LockerSchema);

export default Locker;
