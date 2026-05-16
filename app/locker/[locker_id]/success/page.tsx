'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, MapPin } from 'lucide-react';
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
  const { status, sendCommand } = useMqtt(params.locker_id);

  // Send UNLOCK directly from browser via WebSocket as soon as broker connects
  useEffect(() => {
    if (status === 'connected') {
      sendCommand('UNLOCK');
    }
  }, [status]);

  useEffect(() => {
    if (!session_id) return;
    const token = localStorage.getItem('sl_token');
    fetch(`/api/session/${session_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setSession);
  }, [session_id]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">

        <div className="flex justify-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Locker Opening!</h1>
          <p className="text-gray-500 text-sm">Payment confirmed. Please place your belongings and close the door.</p>
        </div>

        <div className="flex justify-center">
          <MqttStatus lockerId={params.locker_id} />
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
          className="block w-full py-4 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl transition-all"
        >
          Return & Unlock Later
        </Link>
      </div>
    </main>
  );
}
