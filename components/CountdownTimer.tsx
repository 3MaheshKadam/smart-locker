'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  paidUntil: string; // ISO date string
  onExpired?: () => void;
}

export default function CountdownTimer({ paidUntil, onExpired }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function tick() {
      const diff = new Date(paidUntil).getTime() - Date.now();
      setRemaining(diff);
      if (diff <= 0) onExpired?.();
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [paidUntil, onExpired]);

  if (remaining <= 0) {
    return <span className="text-red-600 font-bold">Expired</span>;
  }

  const totalSecs = Math.floor(remaining / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const isWarning = remaining < 15 * 60 * 1000;

  return (
    <span className={cn('font-mono font-bold text-2xl', isWarning ? 'text-orange-500' : 'text-indigo-600')}>
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}
