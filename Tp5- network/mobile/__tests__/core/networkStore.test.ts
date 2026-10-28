import { useNetworkStore } from '../../src/core/store/useNetworkStore';
import { QoSMeasurementPoint } from '../../src/core/types/network';

describe('useNetworkStore - Estado reactivo Zustand', () => {
  beforeEach(() => {
    useNetworkStore.getState().clearHistory();
  });

  it('debe inicializarse con valores por defecto consistentes', () => {
    const state = useNetworkStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.connectionType).toBe('unknown');
    expect(state.recentPoints).toEqual([]);
    expect(state.isTestingLatency).toBe(false);
    expect(state.isTestingThroughput).toBe(false);
  });

  it('debe actualizar información de conectividad con setNetInfo', () => {
    useNetworkStore.getState().setNetInfo({
      isConnected: true,
      connectionType: 'wifi',
      isInternetReachable: true,
    });

    const state = useNetworkStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.connectionType).toBe('wifi');
    expect(state.isInternetReachable).toBe(true);
  });

  it('debe agregar puntos de medición respetando el orden LIFO y límite de 100 muestras', () => {
    for (let i = 1; i <= 105; i++) {
      const point: QoSMeasurementPoint = {
        id: `point-${i}`,
        timestamp: 1000 + i,
        connectionType: 'cellular',
        isConnected: true,
      };
      useNetworkStore.getState().addMeasurementPoint(point);
    }

    const state = useNetworkStore.getState();
    expect(state.recentPoints.length).toBe(100);
    // El más reciente debe ser el primero (LIFO)
    expect(state.recentPoints[0].id).toBe('point-105');
    // El último retenido debe ser point-6
    expect(state.recentPoints[99].id).toBe('point-6');
  });

  it('debe limpiar historial de mediciones con clearHistory', () => {
    useNetworkStore.getState().addMeasurementPoint({
      id: 'test',
      timestamp: 1234,
      connectionType: 'wifi',
      isConnected: true,
    });
    expect(useNetworkStore.getState().recentPoints.length).toBe(1);

    useNetworkStore.getState().clearHistory();
    expect(useNetworkStore.getState().recentPoints.length).toBe(0);
  });
});
