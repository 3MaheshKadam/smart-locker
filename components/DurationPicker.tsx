'use client';

import { cn } from '@/lib/utils';

const QUICK_OPTIONS = [1, 2, 3, 6, 12];

interface DurationPickerProps {
  value: number;
  onChange: (hours: number) => void;
  hourlyRate: number; // paise
}

export default function DurationPicker({ value, onChange, hourlyRate }: DurationPickerProps) {
  const displayRate = (hourlyRate / 100).toFixed(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {QUICK_OPTIONS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onChange(h)}
            className={cn(
              'px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all',
              value === h
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-600 hover:border-indigo-300'
            )}
          >
            {h}h
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-sm text-gray-500">Custom: {value} hour{value !== 1 ? 's' : ''}</label>
        <input
          type="range"
          min={1}
          max={12}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>1h</span>
          <span>12h</span>
        </div>
      </div>

      <p className="text-xs text-gray-400">₹{displayRate}/hr × {value}hr = ₹{((hourlyRate * value) / 100).toFixed(0)}</p>
    </div>
  );
}
