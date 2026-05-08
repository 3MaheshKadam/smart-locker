'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const MINUTE_OPTIONS = [1, 2, 5, 10, 15, 30];
const HOUR_OPTIONS = [1, 2, 3, 6, 12];

interface DurationPickerProps {
  value: number;       // always in minutes
  onChange: (minutes: number) => void;
  hourlyRate: number;  // paise per hour
}

export default function DurationPicker({ value, onChange, hourlyRate }: DurationPickerProps) {
  const [tab, setTab] = useState<'minutes' | 'hours'>(value < 60 ? 'minutes' : 'hours');

  const ratePerMin = hourlyRate / 60;
  const cost = Math.max(100, Math.round(ratePerMin * value));

  function selectMinutes(m: number) {
    setTab('minutes');
    onChange(m);
  }

  function selectHours(h: number) {
    setTab('hours');
    onChange(h * 60);
  }

  return (
    <div className="space-y-4">

      {/* Tab toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        <button
          type="button"
          onClick={() => { setTab('minutes'); if (value >= 60) onChange(1); }}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
            tab === 'minutes'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Minutes
        </button>
        <button
          type="button"
          onClick={() => { setTab('hours'); if (value < 60) onChange(60); }}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
            tab === 'hours'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Hours
        </button>
      </div>

      {/* Quick options */}
      {tab === 'minutes' && (
        <div className="flex flex-wrap gap-2">
          {MINUTE_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => selectMinutes(m)}
              className={cn(
                'px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all',
                value === m
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-indigo-300'
              )}
            >
              {m}m
            </button>
          ))}
        </div>
      )}

      {tab === 'hours' && (
        <div className="flex flex-wrap gap-2">
          {HOUR_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => selectHours(h)}
              className={cn(
                'px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all',
                value === h * 60
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-indigo-300'
              )}
            >
              {h}h
            </button>
          ))}
        </div>
      )}

      {/* Slider */}
      {tab === 'minutes' ? (
        <div className="space-y-1">
          <label className="text-sm text-gray-500">Custom: {value} minute{value !== 1 ? 's' : ''}</label>
          <input
            type="range" min={1} max={59} step={1} value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>1 min</span><span>59 min</span>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-sm text-gray-500">Custom: {value / 60} hour{value / 60 !== 1 ? 's' : ''}</label>
          <input
            type="range" min={1} max={12} step={1} value={value / 60}
            onChange={(e) => onChange(Number(e.target.value) * 60)}
            className="w-full accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>1 hr</span><span>12 hr</span>
          </div>
        </div>
      )}

      {/* Rate hint */}
      <p className="text-xs text-gray-400">
        ₹{(hourlyRate / 100).toFixed(0)}/hr ×{' '}
        {tab === 'minutes' ? `${value} min` : `${value / 60} hr`}
        {' '}= ₹{(cost / 100).toFixed(2)}
      </p>
    </div>
  );
}
