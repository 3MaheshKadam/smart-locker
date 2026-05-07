import { cn } from '@/lib/utils';

type Status = 'available' | 'occupied' | 'maintenance';

const config: Record<Status, { label: string; classes: string }> = {
  available: { label: 'Available', classes: 'bg-green-100 text-green-700 border-green-200' },
  occupied: { label: 'Occupied', classes: 'bg-red-100 text-red-700 border-red-200' },
  maintenance: { label: 'Maintenance', classes: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export default function LockerStatusBadge({ status }: { status: Status }) {
  const { label, classes } = config[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border', classes)}>
      <span className={cn('w-2 h-2 rounded-full', {
        'bg-green-500': status === 'available',
        'bg-red-500': status === 'occupied',
        'bg-gray-400': status === 'maintenance',
      })} />
      {label}
    </span>
  );
}
