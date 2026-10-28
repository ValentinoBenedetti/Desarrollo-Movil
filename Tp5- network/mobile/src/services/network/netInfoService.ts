import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useNetworkStore } from '../../core/store/useNetworkStore';

class NetInfoService {
  private unsubscribe: (() => void) | null = null;

  public startListening(): void {
    if (this.unsubscribe) {
      return;
    }

    // Suscripción al stream reactivo de NetInfo
    this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      this.handleStateChange(state);
    });

    // Lectura inicial del estado
    NetInfo.fetch().then((state) => {
      this.handleStateChange(state);
    });
  }

  public stopListening(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private handleStateChange(state: NetInfoState): void {
    const isConnected = Boolean(state.isConnected);
    const connectionType = state.type;
    const isInternetReachable = state.isInternetReachable;

    useNetworkStore.getState().setNetInfo({
      isConnected,
      connectionType,
      isInternetReachable,
    });
  }
}

export const netInfoService = new NetInfoService();
