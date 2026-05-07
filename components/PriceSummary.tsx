interface PriceSummaryProps {
  hourlyRate: number; // paise
  hours: number;
  type?: 'initial' | 'overtime';
}

const CONVENIENCE_FEE = 200; // paise

export default function PriceSummary({ hourlyRate, hours, type = 'initial' }: PriceSummaryProps) {
  const base = hourlyRate * hours;
  const total = base + CONVENIENCE_FEE;

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
      <div className="flex justify-between text-gray-600">
        <span>₹{(hourlyRate / 100).toFixed(0)}/hr × {hours} hr{hours !== 1 ? 's' : ''}</span>
        <span>₹{(base / 100).toFixed(0)}</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>Convenience fee</span>
        <span>₹{(CONVENIENCE_FEE / 100).toFixed(0)}</span>
      </div>
      <div className="border-t pt-2 flex justify-between font-bold text-gray-900">
        <span>{type === 'overtime' ? 'Overtime Total' : 'Total'}</span>
        <span>₹{(total / 100).toFixed(0)}</span>
      </div>
    </div>
  );
}
