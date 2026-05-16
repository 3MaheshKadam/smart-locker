'use client';

import { useEffect, useState } from 'react';
import { Lock, Users, IndianRupee, RefreshCw, Wrench, LockKeyhole, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import LockerStatusBadge from '@/components/LockerStatusBadge';
import MqttStatus from '@/components/MqttStatus';

interface LockerRow {
  locker_id: string;
  label: string;
  location: string;
  hourly_rate: number;
  status: 'available' | 'occupied' | 'maintenance';
  current_session_id: { user_name: string; user_email: string; paid_until: string } | null;
  last_seen: string;
}

interface DashboardData {
  lockers: LockerRow[];
  active_count: number;
  today_revenue_paise: number;
}

interface LockerForm {
  locker_id: string;
  label: string;
  location: string;
  hourly_rate: string;
  status: string;
}

const emptyForm: LockerForm = { locker_id: '', label: '', location: '', hourly_rate: '2000' };

export default function AdminPage() {
  const [data, setData]           = useState<DashboardData | null>(null);
  const [secret, setSecret]       = useState('');
  const [authed, setAuthed]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Add locker modal
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState<LockerForm>(emptyForm);
  const [addLoading, setAddLoading] = useState(false);

  // Edit locker inline
  const [editId, setEditId]       = useState<string | null>(null);
  const [editForm, setEditForm]   = useState<Partial<LockerForm>>({});
  const [editLoading, setEditLoading] = useState(false);

  function flash(text: string, ok = true) {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  }

  async function fetchData(s: string) {
    setLoading(true);
    const res = await fetch('/api/admin/lockers', { headers: { Authorization: `Bearer ${s}` } });
    if (res.status === 401) { alert('Wrong admin secret'); setLoading(false); return; }
    setData(await res.json());
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
    flash(d.message || d.error, res.ok);
    fetchData(secret);
  }

  async function forceLock(locker_id: string) {
    const res = await fetch('/api/admin/force-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ locker_id }),
    });
    const d = await res.json();
    flash(d.message || d.error, res.ok);
  }

  async function addLocker() {
    if (!addForm.locker_id || !addForm.label || !addForm.location || !addForm.hourly_rate) {
      flash('All fields are required', false); return;
    }
    setAddLoading(true);
    const res = await fetch('/api/admin/lockers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ ...addForm, hourly_rate: Number(addForm.hourly_rate) }),
    });
    const d = await res.json();
    setAddLoading(false);
    if (!res.ok) { flash(d.error, false); return; }
    flash(`Locker "${addForm.locker_id}" added`);
    setShowAdd(false);
    setAddForm(emptyForm);
    fetchData(secret);
  }

  async function saveEdit(locker_id: string) {
    setEditLoading(true);
    const res = await fetch('/api/admin/lockers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ locker_id, ...editForm, hourly_rate: editForm.hourly_rate ? Number(editForm.hourly_rate) : undefined }),
    });
    const d = await res.json();
    setEditLoading(false);
    if (!res.ok) { flash(d.error, false); return; }
    flash(`Locker "${locker_id}" updated`);
    setEditId(null);
    fetchData(secret);
  }

  async function deleteLocker(locker_id: string) {
    if (!confirm(`Delete locker "${locker_id}"? This cannot be undone.`)) return;
    const res = await fetch('/api/admin/lockers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ locker_id }),
    });
    const d = await res.json();
    flash(d.message || d.error, res.ok);
    if (res.ok) fetchData(secret);
  }

  // ── Login screen ────────────────────────────────────────────
  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Admin Login</h1>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData(secret)}
            placeholder="Admin secret"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:border-indigo-500 text-gray-900"
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

  // ── Dashboard ────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <MqttStatus lockerId="admin" />
            <button
              onClick={() => fetchData(secret)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Flash message */}
        {actionMsg && (
          <div className={`rounded-xl p-3 text-sm border ${actionMsg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {actionMsg.text}
          </div>
        )}

        {data && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1">
                <div className="flex items-center gap-2 text-gray-500 text-sm"><Lock className="w-4 h-4" /> Total</div>
                <p className="text-2xl font-bold text-gray-900">{data.lockers.length}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1">
                <div className="flex items-center gap-2 text-gray-500 text-sm"><Users className="w-4 h-4" /> Active</div>
                <p className="text-2xl font-bold text-gray-900">{data.active_count}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1">
                <div className="flex items-center gap-2 text-gray-500 text-sm"><IndianRupee className="w-4 h-4" /> Today</div>
                <p className="text-2xl font-bold text-gray-900">₹{(data.today_revenue_paise / 100).toFixed(0)}</p>
              </div>
            </div>

            {/* Locker table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Lockers</h2>
                <button
                  onClick={() => { setShowAdd(true); setAddForm(emptyForm); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Locker
                </button>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">ID</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Label / Location</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Rate</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">Current User</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">Expires</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.lockers.map((l) => (
                    <tr key={l.locker_id} className="hover:bg-gray-50">

                      {/* ID */}
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{l.locker_id}</td>

                      {/* Label / Location — inline edit */}
                      <td className="px-4 py-3">
                        {editId === l.locker_id ? (
                          <div className="space-y-1">
                            <input
                              value={editForm.label ?? l.label}
                              onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                              className="w-full px-2 py-1 border rounded text-gray-900 text-xs"
                              placeholder="Label"
                            />
                            <input
                              value={editForm.location ?? l.location}
                              onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                              className="w-full px-2 py-1 border rounded text-gray-900 text-xs"
                              placeholder="Location"
                            />
                          </div>
                        ) : (
                          <>
                            <p className="font-medium text-gray-900">{l.label}</p>
                            <p className="text-xs text-gray-400">{l.location}</p>
                          </>
                        )}
                      </td>

                      {/* Rate — inline edit */}
                      <td className="px-4 py-3 text-gray-600">
                        {editId === l.locker_id ? (
                          <input
                            type="number"
                            value={editForm.hourly_rate ?? String(l.hourly_rate)}
                            onChange={(e) => setEditForm((f) => ({ ...f, hourly_rate: e.target.value }))}
                            className="w-20 px-2 py-1 border rounded text-gray-900 text-xs"
                            placeholder="Paise"
                          />
                        ) : (
                          `₹${(l.hourly_rate / 100).toFixed(0)}/hr`
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {editId === l.locker_id ? (
                          <select
                            value={editForm.status ?? l.status}
                            onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                            className="px-2 py-1 border rounded text-gray-900 text-xs"
                          >
                            <option value="available">available</option>
                            <option value="occupied">occupied</option>
                            <option value="maintenance">maintenance</option>
                          </select>
                        ) : (
                          <LockerStatusBadge status={l.status} />
                        )}
                      </td>

                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                        {l.current_session_id ? (
                          <div>
                            <p>{l.current_session_id.user_name}</p>
                            <p className="text-xs text-gray-400">{l.current_session_id.user_email}</p>
                          </div>
                        ) : '—'}
                      </td>

                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                        {l.current_session_id
                          ? new Date(l.current_session_id.paid_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {editId === l.locker_id ? (
                            <>
                              <button
                                onClick={() => saveEdit(l.locker_id)}
                                disabled={editLoading}
                                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium"
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-3 h-3" /> Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              {l.status === 'occupied' && (
                                <button
                                  onClick={() => forceUnlock(l.locker_id)}
                                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                                >
                                  <Wrench className="w-3 h-3" /> Force Unlock
                                </button>
                              )}
                              <button
                                onClick={() => forceLock(l.locker_id)}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 font-medium"
                              >
                                <LockKeyhole className="w-3 h-3" /> Lock
                              </button>
                              <button
                                onClick={() => { setEditId(l.locker_id); setEditForm({}); }}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                              <button
                                onClick={() => deleteLocker(l.locker_id)}
                                disabled={l.status === 'occupied'}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 font-medium disabled:opacity-30"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Add Locker Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Add Locker</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Locker ID <span className="text-red-500">*</span></label>
                <input
                  value={addForm.locker_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, locker_id: e.target.value.toUpperCase() }))}
                  placeholder="e.g. L01 — must match ESP firmware"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-gray-900 focus:border-indigo-500 outline-none text-sm font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">Must exactly match the ID in the ESP8266 firmware</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Label <span className="text-red-500">*</span></label>
                <input
                  value={addForm.label}
                  onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Locker A1"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-gray-900 focus:border-indigo-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Location <span className="text-red-500">*</span></label>
                <input
                  value={addForm.location}
                  onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Ground Floor - Block A"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-gray-900 focus:border-indigo-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Hourly Rate (paise) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={addForm.hourly_rate}
                  onChange={(e) => setAddForm((f) => ({ ...f, hourly_rate: e.target.value }))}
                  placeholder="2000 = ₹20/hr"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-gray-900 focus:border-indigo-500 outline-none text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {addForm.hourly_rate ? `₹${(Number(addForm.hourly_rate) / 100).toFixed(0)} per hour` : ''}
                </p>
              </div>
            </div>

            <button
              onClick={addLocker}
              disabled={addLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-60"
            >
              {addLoading ? 'Adding...' : 'Add Locker'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
