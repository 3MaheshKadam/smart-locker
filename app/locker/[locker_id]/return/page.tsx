'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle, Unlock, Mail, ArrowLeft, Clock } from 'lucide-react';
import OtpInput from '@/components/OtpInput';
import OvertimeCounter from '@/components/OvertimeCounter';
import PriceSummary from '@/components/PriceSummary';
import RazorpayButton from '@/components/RazorpayButton';
import CountdownTimer from '@/components/CountdownTimer';
import MqttStatus from '@/components/MqttStatus';
import { useMqtt } from '@/hooks/useMqtt';
import { cn, formatINR } from '@/lib/utils';

interface LockerStatus {
  label: string;
  location: string;
  hourly_rate: number;
  status: string;
  session_info: { paid_until: string } | null;
}

interface SessionData {
  session_id: string;
  user_name: string;
  paid_until: string;
  start_time: string;
  status: string;
  overtime_hours: number;
  in_grace_period: boolean;
  overtime_amount_paise: number;
}

type Stage =
  | 'loading'          // fetching locker status
  | 'status'           // show time info — no auth yet
  | 'otp-request'      // enter email
  | 'otp-verify'       // enter OTP
  | 'summary'          // verified + on time → unlock button
  | 'overtime'         // verified + overtime → payment
  | 'unlocking'
  | 'done'
  | 'error';

export default function ReturnPage() {
  const params = useParams<{ locker_id: string }>();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('loading');
  const [lockerStatus, setLockerStatus] = useState<LockerStatus | null>(null);
  const [isOvertime, setIsOvertime] = useState(false);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);

  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderAmount, setOrderAmount] = useState(0);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { sendCommand } = useMqtt(params.locker_id);

  // Step 1: fetch locker status (public, no auth)
  useEffect(() => {
    const storedEmail = localStorage.getItem('sl_email') || '';
    const storedName = localStorage.getItem('sl_name') || '';
    const storedToken = localStorage.getItem('sl_token') || '';
    setEmail(storedEmail);
    setName(storedName);
    setToken(storedToken);

    fetch(`/api/locker/${params.locker_id}`)
      .then((r) => r.json())
      .then((data: LockerStatus) => {
        setLockerStatus(data);
        if (data.status !== 'occupied' || !data.session_info) {
          setError('No active session found on this locker.');
          setStage('error');
          return;
        }
        const overtime = new Date(data.session_info.paid_until).getTime() < Date.now();
        setIsOvertime(overtime);
        setStage('status');
      });
  }, [params.locker_id]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Update overtime flag live (in case user is on status screen when time expires)
  useEffect(() => {
    if (stage !== 'status' || !lockerStatus?.session_info) return;
    const id = setInterval(() => {
      const ot = new Date(lockerStatus.session_info!.paid_until).getTime() < Date.now();
      setIsOvertime(ot);
    }, 5000);
    return () => clearInterval(id);
  }, [stage, lockerStatus]);

  // ── Dev bypass — skip OTP ────────────────────────────────
  async function skipOtp() {
    const storedToken = localStorage.getItem('sl_token') || '';
    if (!storedToken) { setError('No token in localStorage — book a session first'); return; }

    try {
      const payload = JSON.parse(atob(storedToken.split('.')[1]));
      const sid = payload.session_id;
      if (!sid) { setError('Token has no session_id — book a fresh session'); return; }

      setSessionId(sid);
      const res = await fetch(`/api/session/${sid}`, { headers: { Authorization: `Bearer ${storedToken}` } });
      if (!res.ok) { setError('Session fetch failed'); return; }
      const sessData: SessionData = await res.json();
      setSession(sessData);
      setToken(storedToken);
      setStage(sessData.overtime_hours > 0 && !sessData.in_grace_period ? 'overtime' : 'summary');
    } catch {
      setError('Could not decode token');
    }
  }

  // ── OTP ──────────────────────────────────────────────────
  async function sendOTP() {
    if (!email) { setError('Please enter your email'); return; }
    setError('');
    setOtpLoading(true);
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, locker_id: params.locker_id }),
    });
    const data = await res.json();
    setOtpLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setStage('otp-verify');
    setCooldown(60);
  }

  async function verifyOTP() {
    if (otp.length < 6) { setError('Enter the 6-digit OTP'); return; }
    setError('');
    setOtpLoading(true);
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, locker_id: params.locker_id, name }),
    });
    const data = await res.json();
    setOtpLoading(false);

    if (!res.ok) { setError(data.error); return; }

    localStorage.setItem('sl_token', data.token);
    setToken(data.token);

    if (!data.active_session) {
      setError('No active session found for this email on this locker.');
      return;
    }

    const sid = data.active_session.session_id;
    setSessionId(sid);

    const sessRes = await fetch(`/api/session/${sid}`, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    const sessData: SessionData = await sessRes.json();
    setSession(sessData);

    if (sessData.overtime_hours > 0 && !sessData.in_grace_period) {
      setStage('overtime');
    } else {
      setStage('summary');
    }
  }

  // ── Unlock ────────────────────────────────────────────────
  async function handleUnlock() {
    setActionLoading(true);
    const res = await fetch('/api/session/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const data = await res.json();
    setActionLoading(false);

    if (res.status === 402) {
      setSession((prev) =>
        prev ? { ...prev, overtime_hours: data.overtime_hours, overtime_amount_paise: data.overtime_amount_paise } : prev
      );
      setStage('overtime');
      return;
    }
    if (!res.ok) { setError(data.error); setStage('error'); return; }

    // Publish UNLOCK directly from browser via WebSocket (same as index.html)
    sendCommand('UNLOCK');
    setStage('done');
  }

  // ── Overtime payment ──────────────────────────────────────
  async function createOvertimeOrder() {
    setError('');
    setActionLoading(true);
    const res = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ locker_id: params.locker_id, type: 'overtime', session_id: sessionId }),
    });
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setOrderId(data.order_id);
    setOrderAmount(data.amount);
  }

  async function handleMockOvertimePayment() {
    setError('');
    setActionLoading(true);
    const res = await fetch('/api/payment/mock-overtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ session_id: sessionId, locker_id: params.locker_id }),
    });
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) { setError(data.error); return; }
    await handleUnlock();
  }

  async function handleOvertimePaymentSuccess(paymentData: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    try {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...paymentData, name }),
      });
      if (!res.ok) {
        let msg = 'Payment verification failed';
        try { const d = await res.json(); msg = d.error || msg; } catch {}
        console.error('[Payment] overtime verify failed, status:', res.status, msg);
        setError(`${msg}. Payment ID: ${paymentData.razorpay_payment_id}`);
        return;
      }
      await handleUnlock();
    } catch (err) {
      console.error('[Payment] handleOvertimePaymentSuccess error:', err);
      setError(`Network error during verification. Payment ID: ${paymentData.razorpay_payment_id}`);
    }
  }

  // ══════════════════════════════════════════════════════════
  // Renders
  // ══════════════════════════════════════════════════════════

  if (stage === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Checking locker status...</div>
      </main>
    );
  }

  if (stage === 'done') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Locker Unlocked!</h1>
          <p className="text-gray-500 text-sm">Please collect your belongings. Thank you!</p>
          <div className="flex justify-center">
            <MqttStatus lockerId={params.locker_id} />
          </div>
          <button
            onClick={() => router.push(`/locker/${params.locker_id}`)}
            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl"
          >
            Done
          </button>
        </div>
      </main>
    );
  }

  if (stage === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-red-500">{error || 'Something went wrong.'}</p>
          <button onClick={() => router.push(`/locker/${params.locker_id}`)} className="text-indigo-600 underline text-sm">
            Go back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Back button */}
        <button
          onClick={() => {
            if (stage === 'otp-verify') { setStage('otp-request'); setOtp(''); setError(''); }
            else if (stage === 'otp-request') { setStage('status'); setError(''); }
            else router.back();
          }}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* ── STAGE: status — show time info before any auth ── */}
        {stage === 'status' && lockerStatus?.session_info && (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">{lockerStatus.label}</h1>
              <p className="text-gray-500 text-sm">{lockerStatus.location}</p>
            </div>

            {/* On time */}
            {!isOvertime && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <div className="flex items-center gap-2 text-green-600 font-semibold">
                  <Clock className="w-4 h-4" />
                  Time remaining
                </div>
                <div className="text-center">
                  <CountdownTimer
                    paidUntil={lockerStatus.session_info.paid_until}
                    onExpired={() => setIsOvertime(true)}
                  />
                </div>
                <p className="text-xs text-center text-gray-400">
                  Paid until{' '}
                  {new Date(lockerStatus.session_info.paid_until).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            )}

            {/* Overtime */}
            {isOvertime && (
              <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 space-y-4">
                <div className="flex items-center gap-2 text-red-600 font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  Paid time exceeded
                </div>
                <OvertimeCounter
                  paidUntil={lockerStatus.session_info.paid_until}
                  hourlyRate={lockerStatus.hourly_rate}
                />
              </div>
            )}

            <button
              onClick={() => setStage('otp-request')}
              className={cn(
                'w-full py-4 font-bold rounded-xl transition-all text-white',
                isOvertime
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              )}
            >
              {isOvertime ? 'Verify to Pay & Unlock' : 'Verify to Unlock'}
            </button>

            {(process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_MOCK_PAYMENT === 'true') && (
              <button
                onClick={skipOtp}
                className="w-full py-3 border-2 border-dashed border-amber-400 text-amber-600 font-semibold rounded-xl text-sm hover:bg-amber-50"
              >
                Skip OTP (Dev)
              </button>
            )}
          </>
        )}

        {/* ── STAGE: otp-request ── */}
        {stage === 'otp-request' && (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">Verify Identity</h1>
              <p className="text-gray-500 text-sm">Enter the email you used when booking.</p>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none text-gray-900"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={sendOTP}
                disabled={otpLoading || !email}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-60"
              >
                {otpLoading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </div>
          </>
        )}

        {/* ── STAGE: otp-verify ── */}
        {stage === 'otp-verify' && (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">Enter OTP</h1>
              <p className="text-gray-500 text-sm">Code sent to <strong>{email}</strong></p>
            </div>
            <OtpInput value={otp} onChange={setOtp} disabled={otpLoading} />
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              onClick={verifyOTP}
              disabled={otpLoading || otp.length < 6}
              className={cn(
                'w-full py-4 text-white font-bold rounded-xl transition-all',
                otp.length === 6
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                  : 'bg-gray-300 cursor-not-allowed'
              )}
            >
              {otpLoading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              onClick={sendOTP}
              disabled={cooldown > 0 || otpLoading}
              className="w-full text-sm text-indigo-600 disabled:text-gray-400"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
            </button>
          </>
        )}

        {/* ── STAGE: summary — on time, show unlock ── */}
        {stage === 'summary' && session && lockerStatus && (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">Ready to Unlock</h1>
              <p className="text-gray-500 text-sm">Identity verified — {session.user_name}</p>
            </div>

            {session.in_grace_period && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-orange-700 text-sm">
                Within 10-minute grace period — no extra charge.
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Started</span>
                <span>{new Date(session.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Paid until</span>
                <span>{new Date(session.paid_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Time remaining</span>
                <CountdownTimer
                  paidUntil={session.paid_until}
                  onExpired={() => {
                    fetch(`/api/session/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } })
                      .then((r) => r.json())
                      .then((d: SessionData) => {
                        setSession(d);
                        if (d.overtime_hours > 0 && !d.in_grace_period) setStage('overtime');
                      });
                  }}
                />
              </div>
            </div>

            <MqttStatus lockerId={params.locker_id} />

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleUnlock}
              disabled={actionLoading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Unlock className="w-5 h-5" />
              {actionLoading ? 'Unlocking...' : 'Unlock Locker'}
            </button>
          </>
        )}

        {/* ── STAGE: overtime — payment required ── */}
        {stage === 'overtime' && session && lockerStatus && (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">Pay Overtime</h1>
              <p className="text-gray-500 text-sm">Identity verified — {session.user_name}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-5 space-y-4">
              <OvertimeCounter
                paidUntil={session.paid_until}
                hourlyRate={lockerStatus.hourly_rate}
              />
            </div>

            <PriceSummary
              hourlyRate={lockerStatus.hourly_rate}
              durationMinutes={session.overtime_hours * 60}
              type="overtime"
            />

            {error && <p className="text-red-500 text-sm">{error}</p>}

            {!orderId ? (
              <button
                onClick={createOvertimeOrder}
                disabled={actionLoading}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl disabled:opacity-60"
              >
                {actionLoading ? 'Preparing...' : `Pay ${formatINR(session.overtime_amount_paise)} & Unlock`}
              </button>
            ) : (
              <RazorpayButton
                orderId={orderId}
                amount={orderAmount}
                email={email}
                name={name}
                label={`Pay ${formatINR(orderAmount)} & Unlock`}
                onSuccess={handleOvertimePaymentSuccess}
                onFailure={() => setError('Payment failed. Please try again.')}
                className="bg-red-600 hover:bg-red-700"
              />
            )}

            {(process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_MOCK_PAYMENT === 'true') && (
              <button
                onClick={handleMockOvertimePayment}
                disabled={actionLoading}
                className="w-full py-3 border-2 border-dashed border-amber-400 text-amber-600 font-semibold rounded-xl text-sm hover:bg-amber-50 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : `Skip Overtime Payment (Dev) — ${formatINR(session.overtime_amount_paise)}`}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
