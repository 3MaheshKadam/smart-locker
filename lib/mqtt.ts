import mqtt from 'mqtt';

const BROKER_URL = process.env.MQTT_BROKER_URL || 'wss://broker.hivemq.com:8884/mqtt';

let client: mqtt.MqttClient | null = null;

function getConnectedClient(): Promise<mqtt.MqttClient> {
  return new Promise((resolve, reject) => {
    // Reuse existing connected client
    if (client && client.connected) {
      resolve(client);
      return;
    }

    // Create a new client if none exists or previous one died
    if (!client || client.disconnected) {
      client = mqtt.connect(BROKER_URL, {
        clientId: `nextjs_server_${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 0, // don't auto-reconnect on server — create fresh client next call
      });
      client.on('error', (err) => console.error('[MQTT] error:', err.message));
      client.on('connect', () => console.log('[MQTT] connected'));
    }

    // Wait for connect if not yet connected
    if (client.connected) {
      resolve(client);
    } else {
      const timeout = setTimeout(() => {
        reject(new Error('[MQTT] connection timeout'));
      }, 12000);

      client.once('connect', () => {
        clearTimeout(timeout);
        resolve(client!);
      });

      client.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    }
  });
}

async function publish(locker_id: string, command: 'UNLOCK' | 'LOCK'): Promise<void> {
  const c = await getConnectedClient();
  const topic = `locker/${locker_id}/cmd`;

  return new Promise((resolve, reject) => {
    c.publish(topic, command, { qos: 0, retain: false }, (err) => {
      if (err) {
        console.error('[MQTT] publish error:', err);
        reject(err);
      } else {
        console.log(`[MQTT] published ${command} to ${topic}`);
        resolve();
      }
    });
  });
}

export function publishUnlock(locker_id: string): Promise<void> {
  return publish(locker_id, 'UNLOCK');
}

export function publishLock(locker_id: string): Promise<void> {
  return publish(locker_id, 'LOCK');
}
