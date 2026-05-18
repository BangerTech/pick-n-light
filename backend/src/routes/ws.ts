import { FastifyPluginAsync, FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { wledEvents, LedStateEvent, getMqttStatus } from '../services/wled';

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(websocket);

  fastify.get('/ws', { websocket: true }, (socket) => {
    // Sofort aktuellen MQTT-Status senden
    socket.send(JSON.stringify({
      type: 'mqtt_status',
      status: getMqttStatus(),
    }));

    const onState = (event: LedStateEvent) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(event));
      }
    };

    wledEvents.on('state', onState);

    socket.on('close', () => {
      wledEvents.off('state', onState);
    });
  });
};

export default plugin;
