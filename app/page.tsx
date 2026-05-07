import Link from 'next/link';
import { Lock, QrCode, Shield } from 'lucide-react';

export default function HomePage() {
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

        <p className="text-xs text-gray-400">
          Demo:{' '}
          <Link href="/locker/L001" className="text-indigo-500 underline">
            Open Locker L001
          </Link>
        </p>
      </div>
    </main>
  );
}
