import { NativeModules } from 'react-native';
import { CellularInfoService } from '../../src/services/native/CellularInfo';

describe('CellularInfoService - RF-01 Telemetría Celular', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe mapear la información nativa provista por CellularInfoModule correctamente', async () => {
    (NativeModules.CellularInfoModule.getCellularInfo as jest.Mock).mockResolvedValueOnce({
      carrier: 'Movistar AR',
      radioType: 'NR (5G)',
      generation: '5G',
      signalStrengthDbm: -72,
      signalLevel: 4,
      isRegistered: true,
    });

    const info = await CellularInfoService.getCellularInfo();

    expect(info.carrier).toBe('Movistar AR');
    expect(info.radioType).toBe('NR (5G)');
    expect(info.generation).toBe('5G');
    expect(info.signalStrengthDbm).toBe(-72);
    expect(info.signalLevel).toBe(4);
    expect(info.isRegistered).toBe(true);
  });

  it('debe retornar datos de fallback consistentes si el módulo nativo lanza error', async () => {
    (NativeModules.CellularInfoModule.getCellularInfo as jest.Mock).mockRejectedValueOnce(
      new Error('Permission denied')
    );

    const info = await CellularInfoService.getCellularInfo();

    expect(info).toBeDefined();
    expect(info.generation).toBe('4G');
    expect(info.signalLevel).toBe(3);
    expect(info.signalStrengthDbm).toBe(-75);
    expect(info.isRegistered).toBe(true);
  });
});
