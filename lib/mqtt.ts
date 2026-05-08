import mqtt from 'mqtt';

// Free public HiveMQ broker — no account needed
const BROKER_URL = 'mqtt://broker.hivemq.com:1883';

// Unique prefix so your topics don't clash with other public users
// In production set MQTT_TOPIC_PREFIX in .env to something secret
const TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || 'smartlocker_proj';

let client: mqtt.MqttClient | null = null;

function getClient(): mqtt.MqttClient {
  if (client && client.connected) return client;

  client = mqtt.connect(BROKER_URL, {
    clientId: `nextjs_server_${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
  });

  client.on('error', (err) => console.error('[MQTT] error:', err.message));
  client.on('connect', () => console.log('[MQTT] connected to HiveMQ'));

  return client;
}

export function publishUnlock(locker_id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const c = getClient();
    const topic = `${TOPIC_PREFIX}/${locker_id}/unlock`;
    const payload = JSON.stringify({ cmd: 'unlock', ts: Date.now() });

    c.publish(topic, payload, { qos: 1, retain: false }, (err) => {
      if (err) {
        console.error('[MQTT] publish error:', err);
        reject(err);
      } else {
        console.log(`[MQTT] published unlock to ${topic}`);
        resolve();
      }
    });
  });
}
