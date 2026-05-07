'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle, Unlock } from 'lucide-react';
import PriceSummary from '@/components/PriceSummary';
import RazorpayButton from '@/components/RazorpayButton';
import { formatINR } from '@/lib/utils';

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

interface LockerInfo {
  label: string;
  hourly_rate: number;
}

type Stage = 'loading' | 'summary' | 'overtime' | 'unlocking' | 'done' | 'error';

export default function ReturnPage() {
  const params = useParams<{ locker_id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session_id = searchParams.get('session_id');

  const [stage, setStage] = useState<Stage>('loading');
  const [session, setSession] = useState<SessionData | null>(null);
  const [locker, setLocker] = useState<LockerInfo | null>(null);
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('sl_token');
    const e = localStorage.getItem('sl_email') || '';
    const n = localStorage.getItem('sl_name') || '';
    if (!t) { router.replace(`/locker/${params.locker_id}/register?action=return`); return; }
    setToken(t);
    setEmail(e);
    setName(n);

    Promise.all([
      fetch(`/api/session/${session_id}`, { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json()),
      fetch(`/api/locker/${params.locker_id}`).then((r) => r.json()),
    ]).then(([sess, lock]) => {
      setSession(sess);
      setLocker(lock);
      setStage(sess.overtime_hours > 0 && !sess.in_grace_period ? 'overtime' : 'summary');
    });
  }, [session_id, params.locker_id, router]);

  async function handleUnlock() {
    setStage('unlocking');
    const res = await fetch('/api/session/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ session_id }),
    });
    const data = await res.json();

    if (res.status === 402) {
      setSession((prev) => prev ? { ...prev, overtime_hours: data.overtime_hours, overtime_amount_paise: data.overtime_amount_paise } : prev);
      setStage('overtime');
      return;
    }
    if (!res.ok) { setError(data.error); setStage('error'); return; }
    setStage('done');
  }

  async function createOvertimeOrder() {
    setError('');
    const res = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ locker_id: params.locker_id, type: 'overtime', session_id }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setOrderId(data.order_id);
  }

  async function handleOvertimePaymentSuccess(paymentData: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const res = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...paymentData, name }),
    });
    if (!res.ok) { setError('Payment verification failed'); return; }
    // Now close session
    await handleUnlock();
  }

  if (stage === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading session...</div>
      </main>
    );
  }

  if (stage === 'done') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Locker Unlocked!</h1>
          <p className="text-gray-500">Please collect your belongings. Thank you for using Smart Locker.</p>
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {stage === 'overtime' && session && locker && (
          <>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-700">Overtime Detected</p>
                <p className="text-red-600 text-sm mt-1">
                  Your paid time expired {session.overtime_hours} hour{session.overtime_hours !== 1 ? 's' : ''} ago.
                  Please pay the overtime fee to unlock.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="font-bold text-gray-900">Overtime Charges</h2>
              <PriceSummary hourlyRate={locker.hourly_rate} hours={session.overtime_hours} type="overtime" />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            {!orderId ? (
              <button
                onClick={createOvertimeOrder}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all"
              >
                Pay {formatINR(session.overtime_amount_paise)} Overtime Fee
              </button>
            ) : (
              <RazorpayButton
                orderId={orderId}
                amount={session.overtime_amount_paise}
                email={email}
                name={name}
                label={`Pay ${formatINR(session.overtime_amount_paise)} & Unlock`}
                onSuccess={handleOvertimePaymentSuccess}
                onFailure={() => setError('Payment failed. Please try again.')}
                className="bg-red-600 hover:bg-red-700"
              />
            )}
          </>
        )}

        {stage === 'summary' && session && (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">Ready to Unlock?</h1>
              <p className="text-gray-500 text-sm">Session summary for {session.user_name}</p>
            </div>

            {session.in_grace_period && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-orange-700 text-sm">
                You are within the 10-minute grace period. No extra charge.
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Started</span>
                <span>{new Date(session.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Paid until</span>
                <span>{new Date(session.paid_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleUnlock}
              disabled={stage === ('unlocking' as Stage)}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Unlock className="w-5 h-5" />
              {stage === ('unlocking' as Stage) ? 'Unlocking...' : 'Unlock Locker'}
            </button>
          </>
        )}

        {stage === 'error' && (
          <div className="text-center space-y-4">
            <p className="text-red-500">{error || 'Something went wrong.'}</p>
            <button onClick={() => router.push(`/locker/${params.locker_id}`)} className="text-indigo-600 underline text-sm">
              Go back
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
