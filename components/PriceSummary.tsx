interface PriceSummaryProps {
  hourlyRate: number;      // paise per hour
  durationMinutes: number; // total duration in minutes
  type?: 'initial' | 'overtime';
}

const CONVENIENCE_FEE = 200; // paise

export default function PriceSummary({ hourlyRate, durationMinutes, type = 'initial' }: PriceSummaryProps) {
  const base = Math.max(100, Math.round((hourlyRate / 60) * durationMinutes));
  const total = base + CONVENIENCE_FEE;

  const durationLabel =
    durationMinutes < 60
      ? `${durationMinutes} min`
      : `${durationMinutes / 60} hr${durationMinutes / 60 !== 1 ? 's' : ''}`;

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
      <div className="flex justify-between text-gray-600">
        <span>₹{(hourlyRate / 100).toFixed(0)}/hr × {durationLabel}</span>
        <span>₹{(base / 100).toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>Convenience fee</span>
        <span>₹{(CONVENIENCE_FEE / 100).toFixed(0)}</span>
      </div>
      <div className="border-t pt-2 flex justify-between font-bold text-gray-900">
        <span>{type === 'overtime' ? 'Overtime Total' : 'Total'}</span>
        <span>₹{(total / 100).toFixed(2)}</span>
      </div>
    </div>
  );
}
