import React, { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { QoSMeasurementPoint } from '../../core/types/network';
import { DatabaseService } from '../../services/database/databaseService';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { theme } from '../theme';

export const AnalyticsScreen: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [measurements, setMeasurements] = useState<QoSMeasurementPoint[]>([]);

  const filters = [
    { id: 'ALL', label: 'Todas' },
    { id: '4G', label: '4G LTE' },
    { id: '5G', label: '5G NR' },
    { id: 'wifi', label: 'WiFi' },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const filterArg = selectedFilter === 'ALL' ? undefined : { networkType: selectedFilter };
        const data = await DatabaseService.getMeasurements(filterArg);
        setMeasurements(data);
      } catch (err) {
        console.warn('[AnalyticsScreen] Error al consultar mediciones:', err);
      }
    };

    loadData();
  }, [selectedFilter]);

  // Datos para gráfico de latencia (invertido para orden cronológico)
  const latencyData = measurements
    .filter((m) => m.latency && m.latency.avgMs > 0)
    .slice(0, 20)
    .reverse()
    .map((m, idx) => ({
      x: idx,
      y: m.latency!.avgMs,
    }));

  // Datos para gráfico de throughput (Mbps)
  const throughputData = measurements
    .filter((m) => m.throughput && m.throughput.speedMbps > 0)
    .slice(0, 20)
    .reverse()
    .map((m, idx) => ({
      x: idx,
      y: m.throughput!.speedMbps,
    }));

  const renderItem = ({ item }: { item: QoSMeasurementPoint }) => {
    const dateStr = new Date(item.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const netBadge = item.cellularInfo?.generation || item.connectionType.toUpperCase();
    const rtt = item.latency ? `${item.latency.avgMs} ms` : 'Sin Ping';
    const jitter = item.latency ? `Jitter: ${item.latency.jitterMs}ms` : '';
    const speed = item.throughput ? `${item.throughput.speedMbps} Mbps` : '';

    return (
      <View style={styles.historyRow}>
        <View style={styles.historyLeft}>
          <View style={styles.badgeRow}>
            <Text style={styles.netBadge}>{netBadge}</Text>
            <Text style={styles.carrierText}>
              {item.cellularInfo?.carrier || 'Red de datos'}
            </Text>
          </View>
          <Text style={styles.dateText}>{dateStr}</Text>
          {item.location ? (
            <Text style={styles.coordsText}>
              GPS: {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
            </Text>
          ) : null}
        </View>

        <View style={styles.historyRight}>
          <Text style={styles.rttText}>{rtt}</Text>
          {jitter ? <Text style={styles.jitterText}>{jitter}</Text> : null}
          {speed ? <Text style={styles.speedText}>{speed}</Text> : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Selector de filtros */}
      <View style={styles.filtersContainer}>
        {filters.map((f) => {
          const isSelected = selectedFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
              onPress={() => setSelectedFilter(f.id)}
            >
              <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Gráficos de Series Temporales */}
      <View style={styles.chartsContainer}>
        <TimeSeriesChart
          title="Latencia RTT Promedio"
          data={latencyData}
          unit="ms"
          color={theme.colors.primary}
          height={130}
        />
        <TimeSeriesChart
          title="Throughput de Descarga"
          data={throughputData}
          unit="Mbps"
          color={theme.colors.success}
          height={130}
        />
      </View>

      {/* Historial de Mediciones */}
      <Text style={styles.historyTitle}>
        Historial ({measurements.length} mediciones)
      </Text>
      <FlatList
        data={measurements}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay mediciones registradas con este filtro.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  filterChip: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#04101E',
  },
  chartsContainer: {
    marginBottom: theme.spacing.xs,
  },
  historyTitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  listContent: {
    paddingBottom: theme.spacing.lg,
  },
  historyRow: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginVertical: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLeft: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  netBadge: {
    backgroundColor: theme.colors.primaryMuted,
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  carrierText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  dateText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  coordsText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  rttText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  jitterText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  speedText: {
    color: theme.colors.success,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
});
