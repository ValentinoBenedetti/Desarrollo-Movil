import { create } from 'zustand';
import {
  CellularInfo,
  GeoLocation,
  LatencyMetric,
  QoSMeasurementPoint,
  ThroughputMetric,
} from '../types/network';

interface NetworkState {
  // Estado actual de conectividad
  isConnected: boolean;
  connectionType: string;
  isInternetReachable: boolean | null;

  // Telemetría celular en tiempo real
  cellularInfo: CellularInfo | null;

  // Ubicación actual
  currentLocation: GeoLocation | null;

  // Últimas métricas de pruebas activas
  lastLatency: LatencyMetric | null;
  lastDownload: ThroughputMetric | null;
  lastUpload: ThroughputMetric | null;

  // Flags de ejecución de pruebas
  isTestingLatency: boolean;
  isTestingThroughput: boolean;

  // Historial en memoria de mediciones de la sesión
  recentPoints: QoSMeasurementPoint[];

  // Configuración de endpoints y host
  backendUrl: string;
  pingHost: string;

  // Acciones
  setBackendUrl: (url: string) => void;
  setPingHost: (host: string) => void;
  setNetInfo: (status: {
    isConnected: boolean;
    connectionType: string;
    isInternetReachable: boolean | null;
  }) => void;
  setCellularInfo: (info: CellularInfo | null) => void;
  setCurrentLocation: (loc: GeoLocation | null) => void;
  setLatencyMetric: (metric: LatencyMetric) => void;
  setThroughputMetric: (metric: ThroughputMetric) => void;
  setIsTestingLatency: (isTesting: boolean) => void;
  setIsTestingThroughput: (isTesting: boolean) => void;
  addMeasurementPoint: (point: QoSMeasurementPoint) => void;
  clearHistory: () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: false,
  connectionType: 'unknown',
  isInternetReachable: null,

  cellularInfo: null,
  currentLocation: null,

  lastLatency: null,
  lastDownload: null,
  lastUpload: null,

  isTestingLatency: false,
  isTestingThroughput: false,

  recentPoints: [],

  backendUrl: 'http://192.168.0.32:3000',
  pingHost: '8.8.8.8',

  setBackendUrl: (backendUrl) => set({ backendUrl }),
  setPingHost: (pingHost) => set({ pingHost }),

  setNetInfo: (status) =>
    set({
      isConnected: status.isConnected,
      connectionType: status.connectionType,
      isInternetReachable: status.isInternetReachable,
    }),

  setCellularInfo: (cellularInfo) => set({ cellularInfo }),

  setCurrentLocation: (currentLocation) => set({ currentLocation }),

  setLatencyMetric: (metric) => set({ lastLatency: metric }),

  setThroughputMetric: (metric) => {
    if (metric.direction === 'download') {
      set({ lastDownload: metric });
    } else {
      set({ lastUpload: metric });
    }
  },

  setIsTestingLatency: (isTestingLatency) => set({ isTestingLatency }),

  setIsTestingThroughput: (isTestingThroughput) => set({ isTestingThroughput }),

  addMeasurementPoint: (point) =>
    set((state) => ({
      recentPoints: [point, ...state.recentPoints].slice(0, 100), // Mantiene últimas 100 en memoria
    })),

  clearHistory: () => set({ recentPoints: [] }),
}));
