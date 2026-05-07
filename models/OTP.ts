import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOTP extends Document {
  email: string;
  otp_hash: string;
  locker_id: string;
  expires_at: Date;
  verified: boolean;
  attempts: number;
  resend_count: number;
  createdAt: Date;
  updatedAt: Date;
}

const OTPSchema = new Schema<IOTP>(
  {
    email: { type: String, required: true },
    otp_hash: { type: String, required: true },
    locker_id: { type: String, required: true },
    expires_at: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    resend_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-delete expired OTP documents after TTL
OTPSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const OTP: Model<IOTP> = mongoose.models.OTP || mongoose.model<IOTP>('OTP', OTPSchema);

export default OTP;
