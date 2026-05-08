'use client';

import { useEffect, useState } from 'react';

interface OvertimeCounterProps {
  paidUntil: string; // ISO date
  hourlyRate: number; // paise
}

export default function OvertimeCounter({ paidUntil, hourlyRate }: OvertimeCounterProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    function tick() {
      const diff = Date.now() - new Date(paidUntil).getTime();
      setElapsedMs(Math.max(0, diff));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [paidUntil]);

  const totalSecs = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  // Billing: ceil to next full hour
  const billingHours = Math.ceil(elapsedMs / (1000 * 60 * 60));
  const charge = billingHours * hourlyRate + 200; // + convenience fee

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-xs text-red-500 uppercase tracking-wide font-semibold mb-1">Overtime elapsed</p>
        <span className="font-mono text-3xl font-bold text-red-600">
          {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </span>
      </div>
      <div className="bg-red-50 rounded-xl p-3 text-sm space-y-1">
        <div className="flex justify-between text-red-700">
          <span>Billing unit</span>
          <span>{billingHours} hr{billingHours !== 1 ? 's' : ''} (rounded up)</span>
        </div>
        <div className="flex justify-between font-bold text-red-800">
          <span>Amount due now</span>
          <span>₹{(charge / 100).toFixed(2)}</span>
        </div>
        <p className="text-xs text-red-400 pt-1">Charge increases every full hour.</p>
      </div>
    </div>
  );
}
