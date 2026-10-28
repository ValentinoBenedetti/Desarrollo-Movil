import { NativeModules, Platform } from 'react-native';
import { CellularInfo } from '../../core/types/network';

const { CellularInfoModule } = NativeModules;

export class CellularInfoService {
  /**
   * Obtiene la telemetría celular actual del dispositivo (operador, radio, generación, RSSI/RSRP).
   */
  public static async getCellularInfo(): Promise<CellularInfo> {
    if (!CellularInfoModule) {
      console.warn(
        '[CellularInfo] CellularInfoModule no está vinculado nativamente en esta plataforma.'
      );
      return this.getFallbackInfo();
    }

    try {
      const data = await CellularInfoModule.getCellularInfo();
      return {
        carrier: data.carrier || 'Desconocido',
        radioType: data.radioType || 'Desconocido',
        generation: data.generation || 'UNKNOWN',
        signalStrengthDbm:
          typeof data.signalStrengthDbm === 'number'
            ? data.signalStrengthDbm
            : null,
        signalLevel: typeof data.signalLevel === 'number' ? data.signalLevel : 0,
        isRegistered: Boolean(data.isRegistered),
      };
    } catch (error) {
      console.error('[CellularInfo] Error al consultar telemetría nativa:', error);
      return this.getFallbackInfo();
    }
  }

  private static getFallbackInfo(): CellularInfo {
    return {
      carrier: Platform.select({ android: 'Emulador Android', ios: 'Simulador iOS', default: 'Desconocido' }),
      radioType: 'LTE (Simulado)',
      generation: '4G',
      signalStrengthDbm: -75,
      signalLevel: 3,
      isRegistered: true,
    };
  }
}
