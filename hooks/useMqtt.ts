'use client';

import { useEffect, useRef, useState } from 'react';

export type MqttStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export function useMqtt(lockerId: string) {
  const [status, setStatus] = useState<MqttStatus>('connecting');
  const clientRef = useRef<import('mqtt').MqttClient | null>(null);

  useEffect(() => {
    let mounted = true;

    import('mqtt').then((mod) => {
      if (!mounted) return;

      const mqtt = (mod.default ?? mod) as typeof import('mqtt');
      const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
        connectTimeout: 4000,
        reconnectPeriod: 1000,
        clientId: 'web_' + Math.random().toString(16).substr(2, 8),
        clean: true,
      });

      clientRef.current = client;

      client.on('connect',   () => { if (mounted) setStatus('connected'); });
      client.on('reconnect', () => { if (mounted) setStatus('reconnecting'); });
      client.on('close',     () => { if (mounted) setStatus('disconnected'); });
      client.on('error',     () => { if (mounted) setStatus('error'); });
    });

    return () => {
      mounted = false;
      clientRef.current?.end(true);
      clientRef.current = null;
    };
  }, []);

  function sendCommand(command: 'UNLOCK' | 'LOCK') {
    const client = clientRef.current;

    if (!client || !client.connected) {
      console.warn('[MQTT] not connected — cannot send', command);
      return;
    }

    const topic = `locker/${lockerId}/cmd`;

    client.publish(topic, command, { qos: 0, retain: false }, (err) => {
      if (err) console.error('[MQTT] publish error:', err);
      else     console.log(`[MQTT] published ${command} to ${topic}`);
    });
  }

  return { status, sendCommand };
}
