import notifee from '@notifee/react-native';
import { NotificationService } from '../../src/services/notifications/notificationService';

describe('NotificationService - RF-06 Detección de Degradación y Alertas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no debe emitir alerta si la red se encuentra en condiciones óptimas', async () => {
    const notified = await NotificationService.evaluateAndNotify({
      isConnected: true,
      latency: {
        host: 'Google DNS',
        minMs: 25,
        avgMs: 35,
        maxMs: 50,
        jitterMs: 12,
        packetLossPercent: 0,
        samples: [25, 35, 50],
        timestamp: Date.now(),
      },
      cellular: {
        carrier: 'Claro',
        radioType: 'LTE',
        generation: '4G',
        signalStrengthDbm: -80,
        signalLevel: 3,
        isRegistered: true,
      },
    });

    expect(notified).toBe(false);
    expect(notifee.displayNotification).not.toHaveBeenCalled();
  });

  it('debe alertar inmediatamente si la conexión a Internet se cae por completo', async () => {
    const notified = await NotificationService.evaluateAndNotify({
      isConnected: false,
    });

    expect(notified).toBe(true);
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Conexión Perdida'),
      })
    );
  });

  it('debe alertar ante pérdida severa de paquetes (>= 20%)', async () => {
    const notified = await NotificationService.evaluateAndNotify({
      isConnected: true,
      latency: {
        host: 'Cloudflare',
        minMs: 40,
        avgMs: 45,
        maxMs: 50,
        jitterMs: 5,
        packetLossPercent: 25,
        samples: [40, 45, 50],
        timestamp: Date.now(),
      },
    });

    expect(notified).toBe(true);
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Alta Pérdida de Paquetes'),
      })
    );
  });

  it('debe alertar ante latencia RTT degradada (> 300 ms)', async () => {
    const notified = await NotificationService.evaluateAndNotify({
      isConnected: true,
      latency: {
        host: 'QoS Server',
        minMs: 320,
        avgMs: 350,
        maxMs: 400,
        jitterMs: 15,
        packetLossPercent: 0,
        samples: [320, 350, 400],
        timestamp: Date.now(),
      },
    });

    expect(notified).toBe(true);
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Latencia Elevada'),
      })
    );
  });

  it('debe alertar ante fluctuación de retardo (Jitter > 80 ms)', async () => {
    const notified = await NotificationService.evaluateAndNotify({
      isConnected: true,
      latency: {
        host: 'Google DNS',
        minMs: 20,
        avgMs: 120,
        maxMs: 250,
        jitterMs: 95,
        packetLossPercent: 0,
        samples: [20, 200, 50],
        timestamp: Date.now(),
      },
    });

    expect(notified).toBe(true);
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Jitter Inestable'),
      })
    );
  });

  it('debe alertar ante señal celular crítica (< -115 dBm)', async () => {
    const notified = await NotificationService.evaluateAndNotify({
      isConnected: true,
      cellular: {
        carrier: 'Personal',
        radioType: 'LTE',
        generation: '4G',
        signalStrengthDbm: -120,
        signalLevel: 0,
        isRegistered: true,
      },
    });

    expect(notified).toBe(true);
    expect(notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Señal Celular Crítica'),
      })
    );
  });
});
