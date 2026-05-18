import { useState, useEffect, useRef } from 'react';

export type MqttStatus = 'connected' | 'disconnected' | 'connecting';

export interface LedStateEvent {
  type: 'led_on' | 'led_off' | 'mqtt_status';
  mqttTopic?: string;
  ledStart?: number;
  ledCount?: number;
  color?: [number, number, number];
  status?: MqttStatus;
}

export function useWledStatus() {
  const [mqttStatus, setMqttStatus] = useState<MqttStatus>('connecting');
  const [lastEvent, setLastEvent] = useState<LedStateEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    function connect() {
      if (!mounted) return;

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${window.location.host}/api/ws`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!mounted) return;
        try {
          const data: LedStateEvent = JSON.parse(event.data);
          setLastEvent(data);
          if (data.type === 'mqtt_status' && data.status) {
            setMqttStatus(data.status);
          }
        } catch {
          // Ungültige Nachricht ignorieren
        }
      };

      ws.onclose = () => {
        if (!mounted) return;
        setMqttStatus('connecting');
        // Automatisch neu verbinden nach 3s
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      mounted = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { mqttStatus, lastEvent };
}
