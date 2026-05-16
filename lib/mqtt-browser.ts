// Module-level singleton — one connection for the entire app lifecycle.
// Mirrors index.html exactly: connect once on load, never destroy.

export type MqttStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

type StatusListener = (s: MqttStatus) => void;

let client: any = null;
let currentStatus: MqttStatus = 'connecting';
const listeners = new Set<StatusListener>();

function notify(s: MqttStatus) {
  currentStatus = s;
  listeners.forEach((l) => l(s));
}

export function initMqtt() {
  if (typeof window === 'undefined') return; // SSR guard
  if (client) return;                         // already connected

  const mqttLib = (window as any).mqtt;
  if (!mqttLib) {
    console.error('[MQTT] CDN script not loaded yet');
    return;
  }

  const brokerUrl =
    process.env.NEXT_PUBLIC_MQTT_BROKER_URL || 'wss://broker.hivemq.com:8884/mqtt';

  client = mqttLib.connect(brokerUrl, {
    connectTimeout: 10000,
    reconnectPeriod: 1000,
    clientId: 'web_' + Math.random().toString(16).substr(2, 8),
    clean: true,
  });

  client.on('connect',   () => { console.log('[MQTT] status: connected ✓'); notify('connected'); });
  client.on('reconnect', () => { console.log('[MQTT] status: reconnecting…'); notify('reconnecting'); });
  client.on('close',     () => { console.log('[MQTT] status: disconnected'); notify('disconnected'); });
  client.on('error',     (e: unknown) => { console.error('[MQTT] status: error —', e); notify('error'); });
}

export function sendMqttCommand(lockerId: string, command: 'UNLOCK' | 'LOCK') {
  if (!client || !client.connected) {
    console.warn('[MQTT] not connected — cannot send', command);
    return;
  }
  const topic = `locker/${lockerId}/cmd`;
  client.publish(topic, command, { qos: 0, retain: false }, (err: unknown) => {
    if (err) console.error('[MQTT] publish error', err);
    else     console.log(`[MQTT] published ${command} to ${topic}`);
  });
}

export function subscribeStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(currentStatus); // give current state immediately
  return () => listeners.delete(listener);
}

export function getStatus(): MqttStatus {
  return currentStatus;
}
