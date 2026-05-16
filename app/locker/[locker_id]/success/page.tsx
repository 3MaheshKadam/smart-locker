'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Lock, Unlock, ShieldCheck } from 'lucide-react';
import CountdownTimer from '@/components/CountdownTimer';
import MqttStatus from '@/components/MqttStatus';
import { useMqtt } from '@/hooks/useMqtt';
import Link from 'next/link';

interface SessionInfo {
  user_name: string;
  paid_until: string;
  status: string;
}

export default function SuccessPage() {
  const params = useParams<{ locker_id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session_id = searchParams.get('session_id');

  const [session, setSession] = useState<SessionInfo | null>(null);
  // true = locker is locked (default after auto-lock), false = open
  const [locked, setLocked] = useState(false);
  const { status, sendCommand } = useMqtt(params.locker_id);
  const lockSent = useRef(false);

  // Auto-LOCK once when MQTT first connects — secures the locker on payment success
  useEffect(() => {
    if (status === 'connected' && !lockSent.current) {
      lockSent.current = true;
      sendCommand('LOCK');
      setLocked(true);
    }
  }, [status]);

  useEffect(() => {
    if (!session_id) return;
    const token = localStorage.getItem('sl_token');
    if (!token) { router.replace(`/locker/${params.locker_id}/register?action=book`); return; }
    fetch(`/api/session/${session_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (r.status === 401) { router.replace(`/locker/${params.locker_id}/register?action=book`); return; }
      return r.json();
    }).then((data) => { if (data) setSession(data); });
  }, [session_id]);

  function handleLock() {
    console.log('[Button] LOCK pressed');
    sendCommand('LOCK');
    setLocked(true);
  }

  function handleUnlock() {
    console.log('[Button] UNLOCK pressed');
    sendCommand('UNLOCK');
    setLocked(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">

        <div className="flex justify-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Payment Confirmed!</h1>
          <p className="text-gray-500 text-sm">
            {status !== 'connected'
              ? 'Connecting to locker...'
              : locked
              ? 'Locker is secured. Tap Unlock when you reach the locker.'
              : 'Locker is open. Place your items and tap Lock.'}
          </p>
        </div>

        <div className="flex justify-center">
          <MqttStatus lockerId={params.locker_id} />
        </div>

        {/* Lock status indicator */}
        <div className={`flex items-center justify-center gap-3 py-4 rounded-2xl ${locked ? 'bg-gray-100' : 'bg-indigo-50'}`}>
          {locked
            ? <><ShieldCheck className="w-6 h-6 text-gray-600" /><span className="font-semibold text-gray-700">Locker Locked</span></>
            : <><Unlock className="w-6 h-6 text-indigo-600" /><span className="font-semibold text-indigo-700">Locker Open</span></>
          }
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleUnlock}
            disabled={status !== 'connected' || !locked}
            className="py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Unlock className="w-5 h-5" />
            Unlock
          </button>
          <button
            onClick={handleLock}
            disabled={status !== 'connected' || locked}
            className="py-4 bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Lock className="w-5 h-5" />
            Lock
          </button>
        </div>

        {session && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-gray-500 text-sm">Time remaining</p>
              <CountdownTimer
                paidUntil={session.paid_until}
                onExpired={() => router.push(`/locker/${params.locker_id}/return`)}
              />
            </div>
            <div className="text-xs text-gray-400">
              Expires at {new Date(session.paid_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <p className="text-xs text-gray-400">You will receive a reminder email 15 minutes before expiry.</p>
          </div>
        )}

        <Link
          href={`/locker/${params.locker_id}/return`}
          className="block w-full py-4 border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-bold rounded-xl transition-all"
        >
          Return &amp; Unlock Later
        </Link>
      </div>
    </main>
  );
}
