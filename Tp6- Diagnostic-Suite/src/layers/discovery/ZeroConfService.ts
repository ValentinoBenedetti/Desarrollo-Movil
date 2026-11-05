import Zeroconf, { Service } from 'react-native-zeroconf';
import { TELECOM_OUI_VENDORS } from '../../core/constants/oids';
import { DiscoveredDevice } from '../../core/types';

export type ZeroConfNodeCallback = (device: DiscoveredDevice) => void;

/**
 * mDNS / Bonjour / DNS-SD Service Discovery Engine based on `react-native-zeroconf`.
 * Listens for multicast announcements on 224.0.0.251:5353 across telecom service types.
 */
export class ZeroConfService {
  private zeroconf: Zeroconf;
  private isScanning = false;
  private readonly discoveredByIp = new Map<string, DiscoveredDevice>();

  constructor() {
    this.zeroconf = new Zeroconf();
  }

  /**
   * Starts mDNS resolution for a specific service type (e.g., 'ssh', 'http', 'workstation')
   * and invokes `onDeviceFound` whenever a service resolves to an IPv4 host.
   */
  public startDiscovery(
    serviceType = 'ssh',
    protocol: 'tcp' | 'udp' = 'tcp',
    domain = 'local.',
    onDeviceFound?: ZeroConfNodeCallback,
  ): void {
    if (this.isScanning) {
      this.stopDiscovery();
    }

    this.isScanning = true;

    this.zeroconf.on('resolved', (service: Service) => {
      const ipv4 = this.extractIpv4Address(service.addresses);
      if (!ipv4) {
        return;
      }

      const txtRecord = (service.txt ?? {}) as Record<string, string>;
      const macFromTxt =
        txtRecord.mac ?? txtRecord.hwaddr ?? txtRecord.ethaddr ?? '00:00:00:00:00:00';
      const normalizedMac = macFromTxt.toUpperCase();
      const ouiPrefix = normalizedMac.slice(0, 8);
      const vendor =
        txtRecord.vendor ??
        txtRecord.model ??
        TELECOM_OUI_VENDORS[ouiPrefix] ??
        'mDNS Network Node';

      const existing = this.discoveredByIp.get(ipv4);
      const serviceTag = `${service.name} (_${serviceType}._${protocol}:${service.port})`;

      const mergedServices = existing
        ? Array.from(new Set([...existing.services, serviceTag]))
        : [serviceTag];

      const device: DiscoveredDevice = {
        ip: ipv4,
        mac: normalizedMac !== '00:00:00:00:00:00' ? normalizedMac : (existing?.mac ?? 'N/A (L2 Protected)'),
        hostname: service.host || service.name || existing?.hostname || ipv4,
        vendor: existing?.vendor && existing.vendor !== 'Unknown Vendor' ? existing.vendor : vendor,
        services: mergedServices,
        snmpReachable: existing?.snmpReachable ?? service.port === 161,
        sshReachable: existing?.sshReachable ?? service.port === 22,
        responseTimeMs: existing?.responseTimeMs ?? 5,
        lastSeen: Date.now(),
      };

      this.discoveredByIp.set(ipv4, device);
      if (onDeviceFound) {
        onDeviceFound(device);
      }
    });

    this.zeroconf.on('error', () => {
      this.isScanning = false;
    });

    this.zeroconf.scan(serviceType, protocol, domain);
  }

  /**
   * Stops active mDNS multicast listener and releases native multicast locks.
   */
  public stopDiscovery(): void {
    if (!this.isScanning) {
      return;
    }
    try {
      this.zeroconf.stop();
      this.zeroconf.removeDeviceListeners();
    } catch {
      // Ignore cleanup errors when native listener is already stopped
    } finally {
      this.isScanning = false;
    }
  }

  public getDiscoveredNodes(): DiscoveredDevice[] {
    return Array.from(this.discoveredByIp.values());
  }

  private extractIpv4Address(addresses?: string[]): string | null {
    if (!Array.isArray(addresses)) {
      return null;
    }
    for (const addr of addresses) {
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(addr) && !addr.startsWith('127.')) {
        return addr;
      }
    }
    return null;
  }
}

