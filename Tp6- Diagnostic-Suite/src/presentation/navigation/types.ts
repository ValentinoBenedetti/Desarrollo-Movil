import { DiscoveredDevice, SnmpDiagnosticSummary } from '../../core/types';

export type RootTabParamList = {
  Discovery: undefined;
  Diagnostic:
    | {
        device?: DiscoveredDevice;
        persistedDeviceId?: string;
      }
    | undefined;
  Installation:
    | {
        device?: DiscoveredDevice;
        persistedDeviceId?: string;
        snmpSummary?: SnmpDiagnosticSummary | null;
        sshOutput?: string;
      }
    | undefined;
  History: undefined;
};

