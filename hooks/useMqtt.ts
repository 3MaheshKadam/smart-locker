'use client';

import { useEffect, useState } from 'react';
import { initMqtt, sendMqttCommand, subscribeStatus, getStatus, MqttStatus } from '@/lib/mqtt-browser';

export type { MqttStatus };

export function useMqtt(lockerId: string) {
  const [status, setStatus] = useState<MqttStatus>(getStatus());

  useEffect(() => {
    initMqtt();
    const unsub = subscribeStatus(setStatus);
    return unsub;
  }, []);

  function sendCommand(command: 'UNLOCK' | 'LOCK') {
    sendMqttCommand(lockerId, command);
  }

  return { status, sendCommand };
}
