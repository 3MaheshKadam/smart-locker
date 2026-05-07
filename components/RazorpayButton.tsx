'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

interface RazorpayButtonProps {
  orderId: string;
  amount: number; // paise
  email: string;
  name: string;
  label?: string;
  onSuccess: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  onFailure?: (err: unknown) => void;
  className?: string;
}

export default function RazorpayButton({
  orderId, amount, email, name, label = 'Pay Now', onSuccess, onFailure, className,
}: RazorpayButtonProps) {
  const [loading, setLoading] = useState(false);

  function loadScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function handlePay() {
    setLoading(true);
    const loaded = await loadScript();
    if (!loaded) {
      alert('Failed to load payment gateway. Check your internet connection.');
      setLoading(false);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount,
      currency: 'INR',
      name: 'Smart Locker',
      description: 'Locker rental payment',
      order_id: orderId,
      prefill: { name, email },
      theme: { color: '#6366f1' },
      handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        setLoading(false);
        onSuccess(response);
      },
      modal: {
        ondismiss: () => setLoading(false),
      },
    };

    const rz = new window.Razorpay(options);
    rz.on('payment.failed', (resp: unknown) => {
      setLoading(false);
      onFailure?.(resp);
    });
    rz.open();
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className={cn(
        'w-full py-4 rounded-xl font-bold text-white transition-all',
        'bg-indigo-600 hover:bg-indigo-700 active:scale-95',
        loading && 'opacity-70 cursor-not-allowed',
        className
      )}
    >
      {loading ? 'Opening payment...' : label}
    </button>
  );
}
