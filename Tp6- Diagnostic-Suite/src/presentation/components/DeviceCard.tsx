import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DiscoveredDevice } from '../../core/types';

export interface DeviceCardProps {
  device: DiscoveredDevice;
  onDiagnose: (device: DiscoveredDevice) => void;
  onInstall: (device: DiscoveredDevice) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onDiagnose,
  onInstall,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.ipText}>{device.ip}</Text>
          <Text style={styles.hostnameText}>{device.hostname}</Text>
        </View>
        <View style={styles.rttBadge}>
          <Text style={styles.rttText}>{device.responseTimeMs} ms</Text>
        </View>
      </View>

      <View style={styles.metaGrid}>
        <Text style={styles.metaText}>
          <Text style={styles.metaLabel}>MAC: </Text>
          {device.mac}
        </Text>
        <Text style={styles.metaText}>
          <Text style={styles.metaLabel}>Vendor: </Text>
          {device.vendor}
        </Text>
      </View>

      <View style={styles.badgesRow}>
        <View
          style={[
            styles.protocolBadge,
            device.snmpReachable ? styles.badgeActive : styles.badgeInactive,
          ]}>
          <Text style={styles.protocolBadgeText}>
            SNMP UDP/161 {device.snmpReachable ? 'READY' : 'N/A'}
          </Text>
        </View>
        <View
          style={[
            styles.protocolBadge,
            device.sshReachable ? styles.badgeActive : styles.badgeInactive,
          ]}>
          <Text style={styles.protocolBadgeText}>
            SSH TCP/22 {device.sshReachable ? 'OPEN' : 'N/A'}
          </Text>
        </View>
        {device.services.map(service => (
          <View key={service} style={styles.serviceChip}>
            <Text style={styles.serviceChipText}>{service}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => onDiagnose(device)}>
          <Text style={styles.primaryButtonText}>SNMP & SSH Diagnostics</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => onInstall(device)}>
          <Text style={styles.secondaryButtonText}>Field Installation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleBlock: {
    flex: 1,
  },
  ipText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  hostnameText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  rttBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  rttText: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '700',
  },
  metaGrid: {
    marginBottom: 10,
  },
  metaText: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2,
  },
  metaLabel: {
    color: '#94a3b8',
    fontWeight: '700',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  protocolBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeActive: {
    backgroundColor: '#065f46',
  },
  badgeInactive: {
    backgroundColor: '#334155',
  },
  protocolBadgeText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '700',
  },
  serviceChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  serviceChipText: {
    color: '#94a3b8',
    fontSize: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#0f766e',
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});

