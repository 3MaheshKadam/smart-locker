'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Mail } from 'lucide-react';
import OtpInput from '@/components/OtpInput';
import { cn } from '@/lib/utils';

type Step = 'form' | 'otp';

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams<{ locker_id: string }>();
  const searchParams = useSearchParams();
  const action = searchParams.get('action') || 'book';

  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendOTP() {
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, locker_id: params.locker_id }),
    });
    const data = await res.json().catch(() => ({ error: 'Server error. Please try again.' }));
    setLoading(false);
    if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }
    setStep('otp');
    setCooldown(60);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name'); return; }
    await sendOTP();
  }

  async function handleOtpVerify() {
    if (otp.length < 6) { setError('Enter the 6-digit OTP'); return; }
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, locker_id: params.locker_id, name }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }

    localStorage.setItem('sl_token', data.token);
    localStorage.setItem('sl_email', email);
    localStorage.setItem('sl_name', name);

    if (action === 'return' && data.active_session) {
      router.push(`/locker/${params.locker_id}/return?session_id=${data.active_session.session_id}`);
    } else if (action === 'return' && !data.active_session) {
      setError('No active session found for this email on this locker.');
    } else {
      router.push(`/locker/${params.locker_id}/book`);
    }
  }

  async function devSkipOtp() {
    if (!name.trim() || !email.trim()) { setError('Enter name and email first'); return; }
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: '000000', locker_id: params.locker_id, name, dev_bypass: true }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }

    localStorage.setItem('sl_token', data.token);
    localStorage.setItem('sl_email', email);
    localStorage.setItem('sl_name', name);

    if (action === 'return' && data.active_session) {
      router.push(`/locker/${params.locker_id}/return?session_id=${data.active_session.session_id}`);
    } else if (action === 'return' && !data.active_session) {
      setError('No active session found for this email on this locker.');
    } else {
      router.push(`/locker/${params.locker_id}/book`);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        <button
          onClick={() => step === 'otp' ? setStep('form') : router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 'form' ? 'Verify Identity' : 'Enter OTP'}
          </h1>
          <p className="text-gray-500 text-sm">
            {step === 'form'
              ? 'We\'ll send a one-time password to your email.'
              : `Code sent to ${email}`}
          </p>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rahul Sharma"
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none text-gray-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none text-gray-900"
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-60"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
            {process.env.NODE_ENV !== 'production' && (
              <button
                type="button"
                onClick={devSkipOtp}
                disabled={loading}
                className="w-full py-3 border-2 border-dashed border-amber-400 text-amber-600 font-semibold rounded-xl text-sm hover:bg-amber-50 disabled:opacity-50"
              >
                Skip OTP (Dev)
              </button>
            )}
          </form>
        ) : (
          <div className="space-y-6">
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              onClick={handleOtpVerify}
              disabled={loading || otp.length < 6}
              className={cn(
                'w-full py-4 text-white font-bold rounded-xl transition-all',
                otp.length === 6
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                  : 'bg-gray-300 cursor-not-allowed'
              )}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <button
              onClick={sendOTP}
              disabled={cooldown > 0 || loading}
              className="w-full text-sm text-indigo-600 disabled:text-gray-400"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
            </button>

            {process.env.NODE_ENV !== 'production' && (
              <button
                onClick={devSkipOtp}
                disabled={loading}
                className="w-full py-3 border-2 border-dashed border-amber-400 text-amber-600 font-semibold rounded-xl text-sm hover:bg-amber-50 disabled:opacity-50"
              >
                Skip OTP (Dev)
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
