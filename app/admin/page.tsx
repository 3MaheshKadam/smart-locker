'use client';

import { useEffect, useState } from 'react';
import { Lock, Users, IndianRupee, RefreshCw, Wrench } from 'lucide-react';
import LockerStatusBadge from '@/components/LockerStatusBadge';

interface LockerRow {
  locker_id: string;
  label: string;
  location: string;
  status: 'available' | 'occupied' | 'maintenance';
  current_session_id: { user_name: string; user_email: string; paid_until: string } | null;
  last_seen: string;
}

interface DashboardData {
  lockers: LockerRow[];
  active_count: number;
  today_revenue_paise: number;
}

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || '';

export default function AdminPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  async function fetchData(s: string) {
    setLoading(true);
    const res = await fetch('/api/admin/lockers', {
      headers: { Authorization: `Bearer ${s}` },
    });
    if (res.status === 401) { alert('Wrong admin secret'); setLoading(false); return; }
    const json = await res.json();
    setData(json);
    setAuthed(true);
    setLoading(false);
  }

  async function forceUnlock(locker_id: string) {
    const res = await fetch('/api/admin/force-unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ locker_id }),
    });
    const d = await res.json();
    setActionMsg(d.message || d.error);
    fetchData(secret);
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Admin Login</h1>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Admin secret"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => fetchData(secret)}
            disabled={!secret}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl disabled:opacity-50"
          >
            Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={() => fetchData(secret)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {actionMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
            {actionMsg}
          </div>
        )}

        {data && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Lock className="w-4 h-4" /> Total
                </div>
                <p className="text-2xl font-bold text-gray-900">{data.lockers.length}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Users className="w-4 h-4" /> Active
                </div>
                <p className="text-2xl font-bold text-gray-900">{data.active_count}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <IndianRupee className="w-4 h-4" /> Today
                </div>
                <p className="text-2xl font-bold text-gray-900">₹{(data.today_revenue_paise / 100).toFixed(0)}</p>
              </div>
            </div>

            {/* Locker table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Locker</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">Current User</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">Expires</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.lockers.map((l) => (
                    <tr key={l.locker_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{l.label}</p>
                        <p className="text-xs text-gray-400">{l.location}</p>
                      </td>
                      <td className="px-4 py-3">
                        <LockerStatusBadge status={l.status} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                        {l.current_session_id ? l.current_session_id.user_name : '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                        {l.current_session_id
                          ? new Date(l.current_session_id.paid_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {l.status === 'occupied' && (
                          <button
                            onClick={() => forceUnlock(l.locker_id)}
                            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            <Wrench className="w-3 h-3" /> Force Unlock
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
