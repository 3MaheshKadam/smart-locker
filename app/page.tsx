import Link from 'next/link';
import { Lock, QrCode, Shield } from 'lucide-react';
import { connectDB } from '@/lib/db';
import Locker from '@/models/Locker';

async function getLockers() {
  await connectDB();
  const lockers = await Locker.find().sort({ locker_id: 1 }).lean();
  return lockers as { locker_id: string; label: string; location: string; hourly_rate: number; status: string }[];
}

export default async function HomePage() {
  const lockers = await getLockers();

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-3xl">
            <Lock className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Smart Locker</h1>
          <p className="text-gray-500">Scan the QR code on a locker to get started.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 text-left">
          <div className="flex gap-3">
            <QrCode className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Scan QR Code</p>
              <p className="text-sm text-gray-500">Find any available locker and scan its QR code</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Verify & Pay</p>
              <p className="text-sm text-gray-500">Confirm your email with OTP and pay per hour</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Lock className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-gray-900">Use & Return</p>
              <p className="text-sm text-gray-500">Locker opens instantly. Scan again to retrieve</p>
            </div>
          </div>
        </div>

        {lockers.length > 0 && (
          <div className="space-y-3 text-left">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide text-center">All Lockers</p>
            <div className="grid grid-cols-2 gap-3">
              {lockers.map((locker) => {
                const available = locker.status === 'available';
                const maintenance = locker.status === 'maintenance';
                return (
                  <Link
                    key={locker.locker_id}
                    href={`/locker/${locker.locker_id}`}
                    className={`bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-1 transition-all active:scale-95 ${
                      available
                        ? 'border-gray-100 hover:border-indigo-300 hover:shadow-md'
                        : maintenance
                        ? 'border-gray-100 opacity-60 pointer-events-none'
                        : 'border-gray-100 hover:border-indigo-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 text-sm">{locker.label}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        available
                          ? 'bg-green-100 text-green-700'
                          : maintenance
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {available ? 'Free' : maintenance ? 'N/A' : 'Busy'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{locker.location}</p>
                    <p className="text-xs font-medium text-indigo-600 mt-1">
                      ₹{(locker.hourly_rate / 100).toFixed(0)}/hr
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
