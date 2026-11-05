import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { syncWorker, SyncWorker } from './SyncWorker';

export interface ConnectivitySnapshot {
  isConnected: boolean;
  isInternetReachable: boolean;
  connectionType: string;
  localIpAddress: string | null;
}

export type ConnectivityListener = (snapshot: ConnectivitySnapshot) => void;

/**
 * Reactive Network Connectivity Monitor built on `@react-native-community/netinfo`.
 * Detects transitions from offline field sites to online coverage
 * (`isConnected === true && isInternetReachable === true`) and wakes up `SyncWorker`.
 */
export class NetworkMonitor {
  private subscription: NetInfoSubscription | null = null;
  private lastRawState: NetInfoState | null = null;
  private simulatedOffline = false;
  private currentSnapshot: ConnectivitySnapshot = {
    isConnected: false,
    isInternetReachable: false,
    connectionType: 'unknown',
    localIpAddress: null,
  };
  private readonly listeners = new Set<ConnectivityListener>();

  public constructor(private readonly worker: SyncWorker = syncWorker) {}

  public setSimulatedOffline(offline: boolean): void {
    this.simulatedOffline = offline;
    this.worker.setSimulatedOffline(offline);
    if (this.lastRawState) {
      this.handleNetInfoChange(this.lastRawState);
    } else {
      this.currentSnapshot = {
        ...this.currentSnapshot,
        isConnected: !offline,
        isInternetReachable: !offline,
      };
      for (const listener of this.listeners) {
        listener(this.currentSnapshot);
      }
    }
  }

  public isSimulatedOffline(): boolean {
    return this.simulatedOffline;
  }

  /**
   * Starts monitoring OS network interface state changes.
   */
  public start(): void {
    if (this.subscription) {
      return;
    }

    this.subscription = NetInfo.addEventListener((state: NetInfoState) => {
      this.handleNetInfoChange(state);
    });

    NetInfo.fetch()
      .then(state => this.handleNetInfoChange(state))
      .catch(() => {
        // Ignore initial fetch errors
      });
  }

  /**
   * Stops listening to network state transitions.
   */
  public stop(): void {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
  }

  public getSnapshot(): ConnectivitySnapshot {
    return this.currentSnapshot;
  }

  public subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSnapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handleNetInfoChange(state: NetInfoState): void {
    this.lastRawState = state;
    const isConnected = !this.simulatedOffline && state.isConnected === true;
    const isInternetReachable =
      !this.simulatedOffline && state.isInternetReachable !== false;
    const details = state.details as { ipAddress?: string } | null;

    this.currentSnapshot = {
      isConnected,
      isInternetReachable,
      connectionType: this.simulatedOffline ? 'offline-sim' : state.type,
      localIpAddress: details?.ipAddress ?? null,
    };

    for (const listener of this.listeners) {
      listener(this.currentSnapshot);
    }

    // Wake up SyncWorker immediately when both link and internet reachability are true
    if (isConnected && isInternetReachable) {
      this.worker.processPendingOutbox().catch(() => {
        // Errors are captured and retried with exponential backoff inside SyncWorker
      });
    }
  }
}

export const networkMonitor = new NetworkMonitor();

