import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOTPEmail(to: string, otp: string, lockerLabel: string) {
  await transporter.sendMail({
    from: `"Smart Locker" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Your Smart Locker OTP',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#1f2937;margin-bottom:8px;">Smart Locker</h2>
        <p style="color:#6b7280;margin-bottom:24px;">Verifying access for <strong>${lockerLabel}</strong></p>
        <div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;">
          <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#111827;">${otp}</span>
        </div>
        <p style="color:#6b7280;margin-top:24px;font-size:14px;">This OTP expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
      </div>
    `,
  });
}

export async function sendExpiryWarningEmail(to: string, lockerLabel: string, minutesLeft: number) {
  await transporter.sendMail({
    from: `"Smart Locker" <${process.env.SMTP_USER}>`,
    to,
    subject: `Locker expiring in ${minutesLeft} minutes`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#1f2937;">⏰ Locker Expiring Soon</h2>
        <p style="color:#6b7280;">Your booking for <strong>${lockerLabel}</strong> expires in <strong>${minutesLeft} minutes</strong>.</p>
        <p style="color:#6b7280;">Please return to collect your belongings. After a 10-minute grace period, overtime charges will apply.</p>
      </div>
    `,
  });
}
