import * as Keychain from 'react-native-keychain';
import { DeviceVaultCredentials, NetworkVendor, SnmpVersion } from '../../core/types';

/**
 * Zero-Trust Hardware-Backed Credential Vault (OWASP Mobile Top 10 M1/M9 compliant).
 *
 * Uses Android Keystore (AES-256-GCM / RSA OAEP StrongBox/TEE) and iOS Keychain
 * (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`) via `react-native-keychain`.
 *
 * Strictly forbids storing SSH passwords, private keys, or SNMP community strings
 * in AsyncStorage, SQLite/WatermelonDB, or plaintext configuration files.
 */
export class VaultService {
  private static readonly SERVICE_PREFIX = 'com.fcyt.networkdiagnosticssuite.vault';
  private static readonly INDEX_SERVICE = 'com.fcyt.networkdiagnosticssuite.vault.index';

  private static getServiceNameForTarget(targetIp: string): string {
    const sanitizedIp = targetIp.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${VaultService.SERVICE_PREFIX}.${sanitizedIp}`;
  }

  /**
   * Encrypts and stores SSH and SNMP credentials for a specific device IP
   * inside the hardware-backed OS Keystore/Keychain.
   */
  public async saveDeviceCredentials(credentials: DeviceVaultCredentials): Promise<void> {
    const service = VaultService.getServiceNameForTarget(credentials.targetIp);
    const serializedPayload = JSON.stringify({
      ...credentials,
      updatedAtIso: new Date().toISOString(),
    });

    await Keychain.setGenericPassword(credentials.sshUsername || 'admin', serializedPayload, {
      service,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      storage: Keychain.STORAGE_TYPE.AES,
    });

    await this.registerTargetInIndex(credentials.targetIp);
  }

  /**
   * Retrieves and decrypts stored credentials for a specific target IP from Keystore/Keychain.
   * Returns null if no credentials have been provisioned for the device.
   */
  public async getDeviceCredentials(targetIp: string): Promise<DeviceVaultCredentials | null> {
    const service = VaultService.getServiceNameForTarget(targetIp);
    const result = await Keychain.getGenericPassword({ service });

    if (!result) {
      return null;
    }

    try {
      const parsed = JSON.parse(result.password) as DeviceVaultCredentials;
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Returns stored credentials for `targetIp` or falls back to safe ephemeral defaults
   * without persisting defaults to disk.
   */
  public async getOrDefaultCredentials(
    targetIp: string,
    defaultVendor: NetworkVendor = 'linux',
  ): Promise<DeviceVaultCredentials> {
    const existing = await this.getDeviceCredentials(targetIp);
    if (existing) {
      return existing;
    }

    const fallbackVersion: SnmpVersion = '2c';
    return {
      targetIp,
      snmpCommunity: 'public',
      snmpVersion: fallbackVersion,
      sshUsername: 'admin',
      sshPort: 22,
      vendor: defaultVendor,
      updatedAtIso: new Date().toISOString(),
    };
  }

  /**
   * Permanently wipes the credentials for a target IP from the hardware Keystore/Keychain.
   */
  public async deleteDeviceCredentials(targetIp: string): Promise<boolean> {
    const service = VaultService.getServiceNameForTarget(targetIp);
    const removed = await Keychain.resetGenericPassword({ service });
    await this.removeTargetFromIndex(targetIp);
    return removed;
  }

  /**
   * Lists the IP addresses that have credentials stored in the vault (metadata only, no secrets).
   */
  public async listProvisionedTargets(): Promise<string[]> {
    const indexRecord = await Keychain.getGenericPassword({
      service: VaultService.INDEX_SERVICE,
    });
    if (!indexRecord) {
      return [];
    }
    try {
      const parsed = JSON.parse(indexRecord.password);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async registerTargetInIndex(targetIp: string): Promise<void> {
    const current = await this.listProvisionedTargets();
    if (!current.includes(targetIp)) {
      const updated = [...current, targetIp];
      await Keychain.setGenericPassword('vault-index', JSON.stringify(updated), {
        service: VaultService.INDEX_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
  }

  private async removeTargetFromIndex(targetIp: string): Promise<void> {
    const current = await this.listProvisionedTargets();
    const updated = current.filter(ip => ip !== targetIp);
    await Keychain.setGenericPassword('vault-index', JSON.stringify(updated), {
      service: VaultService.INDEX_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
}

export const vaultService = new VaultService();

