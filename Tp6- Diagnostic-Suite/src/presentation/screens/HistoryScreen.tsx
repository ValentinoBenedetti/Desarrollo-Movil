import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { database, StoreRepository } from '../../layers/store/database';
import {
  Device,
  Diagnostic,
  Installation,
  OutboxItem,
} from '../../layers/store/models';
import { networkMonitor } from '../../layers/sync/NetworkMonitor';
import { outboxManager, OutboxManager } from '../../layers/sync/OutboxManager';
import { syncWorker } from '../../layers/sync/SyncWorker';
import { SyncBadge } from '../components/SyncBadge';

export const HistoryScreen: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [backendUrl, setBackendUrl] = useState(syncWorker.getBackendBaseUrl());
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(
    null,
  );

  const refreshOfflineRecords = useCallback(async () => {
    const [devs, diags, insts, outbox] = await Promise.all([
      StoreRepository.listDevices(),
      StoreRepository.listDiagnostics(),
      StoreRepository.listInstallations(),
      StoreRepository.listOutboxItems(),
    ]);
    setDevices(devs);
    setDiagnostics(diags);
    setInstallations(insts);
    setOutboxItems(outbox);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshOfflineRecords();
    }, [refreshOfflineRecords]),
  );

  // Automatically refresh the list on screen whenever SyncWorker state changes (e.g. when toggling ONLINE/OFFLINE badge)
  useEffect(() => {
    const unsubscribe = syncWorker.subscribe(() => {
      refreshOfflineRecords();
    });
    return unsubscribe;
  }, [refreshOfflineRecords]);

  const handleApplyBackendUrl = () => {
    syncWorker.setBackendBaseUrl(backendUrl);
    setSyncNotice(`Sync endpoint updated to ${syncWorker.getBackendBaseUrl()}`);
  };

  const handleForceSyncNow = async () => {
    setSyncNotice('Switching to ONLINE mode and dispatching Outbox FIFO batch...');
    networkMonitor.setSimulatedOffline(false);
    await outboxManager.resetFailedItemsForImmediateRetry();
    await syncWorker.processPendingOutbox();
    await refreshOfflineRecords();
    setSyncNotice('All pending Outbox records synchronized with backend.');
  };

  const handleClearDemoRecords = async () => {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
    await refreshOfflineRecords();
    setSyncNotice('Local offline store cleared for a fresh demo recording.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.screenTitle}>Offline Store & Outbox</Text>
          <Text style={styles.screenSubtitle}>
            WatermelonDB SQLite + Deferred Sync Queue
          </Text>
        </View>
        <SyncBadge />
      </View>

      {syncNotice && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{syncNotice}</Text>
        </View>
      )}

      {/* Sync Backend Endpoint & Outbox Control */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync Backend Configuration & Outbox Control</Text>
        <View style={styles.urlRow}>
          <TextInput
            style={styles.urlInput}
            value={backendUrl}
            onChangeText={setBackendUrl}
            autoCapitalize="none"
            placeholder="http://localhost:4600"
            placeholderTextColor="#64748b"
          />
          <TouchableOpacity style={styles.urlSaveBtn} onPress={handleApplyBackendUrl}>
            <Text style={styles.urlSaveText}>Set URL</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.syncNowBtn} onPress={handleForceSyncNow}>
          <Text style={styles.syncNowText}>
            Flush Pending Outbox Queue Now ({outboxItems.length} total records)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.clearBtn}
          onPress={handleClearDemoRecords}>
          <Text style={styles.clearBtnText}>
            Reset / Clear Old Records Before Recording Video
          </Text>
        </TouchableOpacity>
      </View>

      {/* Outbox Queue Inspector */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          1. Transactional Outbox Queue ({outboxItems.length})
        </Text>
        {outboxItems.length === 0 ? (
          <Text style={styles.emptyText}>Outbox queue is empty.</Text>
        ) : (
          outboxItems.map(item => {
            const nextBackoffSec =
              OutboxManager.computeExponentialBackoffMs(item.attempts + 1) / 1000;
            return (
              <View key={item.id} style={styles.recordBox}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordType}>{item.eventType}</Text>
                  <Text
                    style={[
                      styles.statusPill,
                      item.status === 'SYNCED'
                        ? styles.statusSynced
                        : item.status === 'FAILED'
                          ? styles.statusFailed
                          : styles.statusPending,
                    ]}>
                    {item.status} (Attempts: {item.attempts})
                  </Text>
                </View>
                <Text style={styles.recordMeta}>
                  Outbox ID: {item.id} · Next Backoff: {nextBackoffSec}s
                </Text>
                {item.lastError ? (
                  <Text style={styles.errorText}>Last Error: {item.lastError}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* Field Installations History */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          2. Field Installation Reports ({installations.length})
        </Text>
        {installations.length === 0 ? (
          <Text style={styles.emptyText}>
            No field installations registered yet.
          </Text>
        ) : (
          installations.map(inst => (
            <View key={inst.id} style={styles.recordBox}>
              <View style={styles.recordHeader}>
                <Text style={styles.recordType}>{inst.siteName}</Text>
                <Text
                  style={[
                    styles.statusPill,
                    inst.status === 'SYNCED'
                      ? styles.statusSynced
                      : styles.statusPending,
                  ]}>
                  {inst.status}
                </Text>
              </View>
              <Text style={styles.recordMeta}>
                SN: {inst.serialNumber} · Model: {inst.equipmentModel}
              </Text>
              <Text style={styles.recordMeta}>
                GPS: {inst.latitude.toFixed(6)}, {inst.longitude.toFixed(6)} · Tech:{' '}
                {inst.technicianId}
              </Text>
              <Text style={styles.pdfPathText}>PDF: {inst.pdfUri}</Text>
              <TouchableOpacity
                style={styles.previewReportBtn}
                onPress={() => setSelectedInstallation(inst)}>
                <Text style={styles.previewReportBtnText}>
                  View Full Report on Phone
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Diagnostics History */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          3. Offline Diagnostic Snapshots ({diagnostics.length})
        </Text>
        {diagnostics.length === 0 ? (
          <Text style={styles.emptyText}>No SNMP/SSH diagnostics stored yet.</Text>
        ) : (
          diagnostics.map(diag => {
            const snmp = diag.parsedSnmpSummary;
            return (
              <View key={diag.id} style={styles.recordBox}>
                <Text style={styles.recordType}>
                  {snmp?.sysName ?? 'Target Node'} ({snmp?.targetIp ?? diag.deviceId})
                </Text>
                {snmp && (
                  <Text style={styles.recordMeta}>
                    Uptime: {snmp.sysUpTimeFormatted} · IN: {snmp.ifInOctets1}B · OUT:{' '}
                    {snmp.ifOutOctets1}B
                  </Text>
                )}
                {diag.sshOutput ? (
                  <Text style={styles.sshSnippet} numberOfLines={3}>
                    {diag.sshOutput}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* Persisted Equipment Inventory */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          4. Known Network Nodes ({devices.length})
        </Text>
        {devices.map(dev => (
          <View key={dev.id} style={styles.recordBox}>
            <Text style={styles.recordType}>
              {dev.ip} — {dev.hostname}
            </Text>
            <Text style={styles.recordMeta}>
              MAC: {dev.mac} · Vendor: {dev.vendor}
              {dev.serialNumber ? ` · SN: ${dev.serialNumber}` : ''}
            </Text>
          </View>
        ))}
      </View>

      {/* In-App Full Installation Report Viewer Modal */}
      <Modal
        visible={Boolean(selectedInstallation)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedInstallation(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalHeaderTitle}>
                INSTALLATION CERTIFICATE (PDF PREVIEW)
              </Text>
              {selectedInstallation && (
                <>
                  <Text style={styles.modalField}>
                    <Text style={styles.modalLabel}>Site: </Text>
                    {selectedInstallation.siteName}
                  </Text>
                  <Text style={styles.modalField}>
                    <Text style={styles.modalLabel}>Technician: </Text>
                    {selectedInstallation.technicianId}
                  </Text>
                  <Text style={styles.modalField}>
                    <Text style={styles.modalLabel}>Serial Number (QR): </Text>
                    {selectedInstallation.serialNumber}
                  </Text>
                  <Text style={styles.modalField}>
                    <Text style={styles.modalLabel}>Equipment Model: </Text>
                    {selectedInstallation.equipmentModel}
                  </Text>
                  <Text style={styles.modalField}>
                    <Text style={styles.modalLabel}>GPS Coordinates: </Text>
                    {selectedInstallation.latitude.toFixed(6)},{' '}
                    {selectedInstallation.longitude.toFixed(6)}
                  </Text>
                  <Text style={styles.modalField}>
                    <Text style={styles.modalLabel}>Notes: </Text>
                    {selectedInstallation.notes}
                  </Text>
                  <Text style={styles.modalField}>
                    <Text style={styles.modalLabel}>Local PDF File: </Text>
                    {selectedInstallation.pdfUri}
                  </Text>
                  <Text style={styles.modalField}>
                    <Text style={styles.modalLabel}>Sync Status: </Text>
                    {selectedInstallation.status}
                  </Text>
                  {selectedInstallation.photoUri ? (
                    <Image
                      source={{ uri: selectedInstallation.photoUri }}
                      style={styles.modalImage}
                      resizeMode="cover"
                    />
                  ) : null}
                </>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setSelectedInstallation(null)}>
              <Text style={styles.closeModalText}>Close Report Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  screenTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  screenSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
  },
  banner: {
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  bannerText: {
    color: '#e0f2fe',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  urlRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  urlSaveBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 6,
  },
  urlSaveText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  syncNowBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  syncNowText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  clearBtn: {
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  clearBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
  },
  recordBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recordType: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#ffffff',
  },
  statusSynced: {
    backgroundColor: '#059669',
  },
  statusPending: {
    backgroundColor: '#d97706',
  },
  statusFailed: {
    backgroundColor: '#dc2626',
  },
  recordMeta: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  pdfPathText: {
    color: '#38bdf8',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  previewReportBtn: {
    marginTop: 8,
    backgroundColor: '#0369a1',
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  previewReportBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  errorText: {
    color: '#f87171',
    fontSize: 10,
    marginTop: 4,
  },
  sshSnippet: {
    color: '#22c55e',
    fontFamily: 'monospace',
    fontSize: 10,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    maxHeight: '85%',
  },
  modalHeaderTitle: {
    color: '#0369a1',
    fontSize: 15,
    fontWeight: '800',
    borderBottomWidth: 2,
    borderBottomColor: '#0284c7',
    paddingBottom: 8,
    marginBottom: 12,
  },
  modalField: {
    color: '#0f172a',
    fontSize: 12,
    marginBottom: 6,
  },
  modalLabel: {
    fontWeight: '700',
    color: '#334155',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 10,
  },
  closeModalBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  closeModalText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
