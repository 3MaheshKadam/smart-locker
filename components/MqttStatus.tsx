'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { useMqtt, MqttStatus as Status } from '@/hooks/useMqtt';

const styles: Record<Status, { text: string; color: string; bg: string }> = {
  connecting:   { text: 'Connecting...',   color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  connected:    { text: 'Connected',       color: 'text-green-700',  bg: 'bg-green-50 border-green-200'  },
  reconnecting: { text: 'Reconnecting...', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  disconnected: { text: 'Disconnected',    color: 'text-red-700',    bg: 'bg-red-50 border-red-200'      },
  error:        { text: 'Error',           color: 'text-red-700',    bg: 'bg-red-50 border-red-200'      },
};

export default function MqttStatus({ lockerId }: { lockerId: string }) {
  const { status } = useMqtt(lockerId);
  const { text, color, bg } = styles[status];

  return (
    <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border ${bg} ${color}`}>
      {status === 'connected'
        ? <Wifi className="w-3.5 h-3.5" />
        : <WifiOff className="w-3.5 h-3.5" />}
      IoT Broker: <span className="font-bold">{text}</span>
    </div>
  );
}
