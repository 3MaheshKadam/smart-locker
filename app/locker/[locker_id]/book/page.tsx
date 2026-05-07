'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import DurationPicker from '@/components/DurationPicker';
import PriceSummary from '@/components/PriceSummary';
import RazorpayButton from '@/components/RazorpayButton';

interface LockerInfo {
  label: string;
  hourly_rate: number;
}

export default function BookPage() {
  const router = useRouter();
  const params = useParams<{ locker_id: string }>();

  const [locker, setLocker] = useState<LockerInfo | null>(null);
  const [duration, setDuration] = useState(1);
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('sl_token');
    const n = localStorage.getItem('sl_name') || '';
    const e = localStorage.getItem('sl_email') || '';
    if (!t) { router.replace(`/locker/${params.locker_id}/register?action=book`); return; }
    setToken(t);
    setName(n);
    setEmail(e);

    fetch(`/api/locker/${params.locker_id}`)
      .then((r) => r.json())
      .then(setLocker);
  }, [params.locker_id, router]);

  async function createOrder() {
    setError('');
    setCreatingOrder(true);
    const res = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ locker_id: params.locker_id, duration_hours: duration, type: 'initial' }),
    });
    const data = await res.json();
    setCreatingOrder(false);
    if (!res.ok) { setError(data.error); return; }
    setOrderId(data.order_id);
  }

  async function handlePaymentSuccess(paymentData: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const res = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...paymentData, name }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    localStorage.setItem('sl_token', data.token);
    router.push(`/locker/${params.locker_id}/success?session_id=${data.session_id}`);
  }

  if (!locker) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading...</div>
      </main>
    );
  }

  const totalAmount = locker.hourly_rate * duration + 200;

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Choose Duration</h1>
          <p className="text-gray-500 text-sm">{locker.label}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <DurationPicker value={duration} onChange={(h) => { setDuration(h); setOrderId(''); }} hourlyRate={locker.hourly_rate} />
          <PriceSummary hourlyRate={locker.hourly_rate} hours={duration} />
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        {!orderId ? (
          <button
            onClick={createOrder}
            disabled={creatingOrder}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-60"
          >
            {creatingOrder ? 'Preparing payment...' : 'Proceed to Pay'}
          </button>
        ) : (
          <RazorpayButton
            orderId={orderId}
            amount={totalAmount}
            email={email}
            name={name}
            label={`Pay ₹${(totalAmount / 100).toFixed(0)}`}
            onSuccess={handlePaymentSuccess}
            onFailure={() => setError('Payment failed. Please try again.')}
          />
        )}
      </div>
    </main>
  );
}
