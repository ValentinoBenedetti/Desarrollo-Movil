import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConnectivitySnapshot, networkMonitor } from '../../layers/sync/NetworkMonitor';
import { OutboxStats } from '../../layers/sync/OutboxManager';
import { syncWorker } from '../../layers/sync/SyncWorker';

export const SyncBadge: React.FC = () => {
  const [connectivity, setConnectivity] = useState<ConnectivitySnapshot>(
    networkMonitor.getSnapshot(),
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<OutboxStats>({
    pendingCount: 0,
    inFlightCount: 0,
    syncedCount: 0,
    failedCount: 0,
  });

  useEffect(() => {
    const unsubNet = networkMonitor.subscribe(setConnectivity);
    const unsubSync = syncWorker.subscribe(state => {
      setIsSyncing(state.isSyncing);
      setStats(state.stats);
    });
    return () => {
      unsubNet();
      unsubSync();
    };
  }, []);

  const isOnline = connectivity.isConnected && connectivity.isInternetReachable;
  const queuedTotal = stats.pendingCount + stats.inFlightCount;

  const handleToggleOfflineOrSync = () => {
    const nextOfflineState = !networkMonitor.isSimulatedOffline();
    networkMonitor.setSimulatedOffline(nextOfflineState);
    if (!nextOfflineState) {
      syncWorker.processPendingOutbox().catch(() => {
        // Handled by worker state
      });
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isOnline ? styles.onlineBorder : styles.offlineBorder,
      ]}
      onPress={handleToggleOfflineOrSync}
      activeOpacity={0.8}>
      <View
        style={[
          styles.dot,
          isSyncing
            ? styles.dotSyncing
            : isOnline
              ? styles.dotOnline
              : styles.dotOffline,
        ]}
      />
      <View style={styles.textColumn}>
        <Text style={styles.statusLabel}>
          {isSyncing
            ? 'SYNCING OUTBOX...'
            : isOnline
              ? `ONLINE (${connectivity.connectionType.toUpperCase()})`
              : 'OFFLINE MODE'}
        </Text>
        <Text style={styles.queueLabel}>
          Outbox: {queuedTotal} pending · {stats.syncedCount} synced
          {stats.failedCount > 0 ? ` · ${stats.failedCount} retry` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  onlineBorder: {
    borderColor: '#059669',
  },
  offlineBorder: {
    borderColor: '#d97706',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 8,
  },
  dotOnline: {
    backgroundColor: '#10b981',
  },
  dotOffline: {
    backgroundColor: '#f59e0b',
  },
  dotSyncing: {
    backgroundColor: '#38bdf8',
  },
  textColumn: {
    flexDirection: 'column',
  },
  statusLabel: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  queueLabel: {
    color: '#94a3b8',
    fontSize: 10,
  },
});

