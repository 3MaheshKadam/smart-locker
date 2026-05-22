import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Clock, Lock } from 'lucide-react';
import LockerStatusBadge from '@/components/LockerStatusBadge';
import { connectDB } from '@/lib/db';
import Locker from '@/models/Locker';
import Session from '@/models/Session';

interface LockerData {
  locker_id: string;
  label: string;
  location: string;
  hourly_rate: number;
  status: 'available' | 'occupied' | 'maintenance';
  session_info: { paid_until: string; user_email: string } | null;
}

async function getLocker(locker_id: string): Promise<LockerData | null> {
  await connectDB();
  const locker = await Locker.findOne({ locker_id }).lean<any>();
  if (!locker) return null;

  let session_info = null;
  if (locker.status === 'occupied' && locker.current_session_id) {
    const session = await Session.findById(locker.current_session_id).lean<any>();
    if (session) {
      session_info = {
        paid_until: session.paid_until,
        user_email: session.user_email,
      };
    }
  }

  return {
    locker_id: locker.locker_id,
    label: locker.label,
    location: locker.location,
    hourly_rate: locker.hourly_rate,
    status: locker.status,
    session_info,
  };
}

export default async function LockerLandingPage({ params }: { params: Promise<{ locker_id: string }> }) {
  const { locker_id } = await params;
  const locker = await getLocker(locker_id);

  if (!locker) notFound();

  const isAvailable = locker.status === 'available';
  const isMaintenance = locker.status === 'maintenance';

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-3">
            <Lock className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{locker.label}</h1>
          <div className="flex items-center justify-center gap-1 text-gray-500 text-sm">
            <MapPin className="w-4 h-4" />
            <span>{locker.location}</span>
          </div>
        </div>

        {/* Status card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Status</span>
            <LockerStatusBadge status={locker.status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Rate</span>
            {process.env.NEXT_PUBLIC_TEST_PRICE_PAISE ? (
              <span className="font-semibold text-amber-600">₹{(Number(process.env.NEXT_PUBLIC_TEST_PRICE_PAISE) / 100).toFixed(2)} (test)</span>
            ) : (
              <span className="font-semibold text-gray-900">₹{(locker.hourly_rate / 100).toFixed(0)} / hr</span>
            )}
          </div>
          {locker.status === 'occupied' && locker.session_info && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-sm">Free at</span>
              <span className="text-sm font-medium text-gray-700">
                {new Date(locker.session_info.paid_until).toLocaleTimeString('en-IN', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>

        {/* CTA */}
        {isAvailable && (
          <Link
            href={`/locker/${locker_id}/register?action=book`}
            className="block w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-center font-bold rounded-xl transition-all active:scale-95"
          >
            Book This Locker
          </Link>
        )}

        {locker.status === 'occupied' && (
          <Link
            href={`/locker/${locker_id}/register?action=return`}
            className="block w-full py-4 bg-gray-800 hover:bg-gray-900 text-white text-center font-bold rounded-xl transition-all active:scale-95"
          >
            Return &amp; Unlock
          </Link>
        )}

        {isMaintenance && (
          <div className="text-center text-gray-500 text-sm">
            This locker is currently under maintenance. Please try another locker.
          </div>
        )}

        <div className="flex items-center gap-2 justify-center text-gray-400 text-xs">
          <Clock className="w-3 h-3" />
          <span>Min booking: 1 hour · Max: 12 hours</span>
        </div>
      </div>
    </main>
  );
}
