import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/utils/supabase';
import { getPlotStatus, PlotStatus } from '../../src/utils/plotStatus';

interface PlotItem {
  id: string;
  name: string;
  crop: string;
  threshold_min: number;
  threshold_max: number;
  status: PlotStatus;
  lastMoisture: number | null;
  lastUpdate: string | null;
}

const STATUS_BADGE: Record<PlotStatus, { bg: string; text: string; label: string }> = {
  optimal: { bg: '#D1FAE5', text: '#065F46', label: 'Óptimo' },
  dry: { bg: '#FEE2E2', text: '#991B1B', label: 'Seco (Riego Urgente)' },
  wet: { bg: '#DBEAFE', text: '#1E40AF', label: 'Exceso Hídrico' },
  stale: { bg: '#F3F4F6', text: '#4B5563', label: 'Sin datos recientes' },
};

export default function PlotsScreen() {
  const router = useRouter();
  const [plots, setPlots] = useState<PlotItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPlots = async () => {
    try {
      const { data: plotsData } = await supabase.from('plots').select('*');
      const { data: stationsData } = await supabase.from('stations').select('*');
      const { data: readingsData } = await supabase
        .from('readings')
        .select('*')
        .order('measured_at', { ascending: false })
        .limit(100);

      if (plotsData) {
        const enriched = plotsData.map((plot) => {
          const plotStations = stationsData?.filter((s) => s.plot_id === plot.id) || [];
          const stationIds = plotStations.map((s) => s.id);
          const latestReading = readingsData?.find((r) => stationIds.includes(r.station_id));

          const status = latestReading
            ? getPlotStatus(
                latestReading.moisture_pct,
                latestReading.measured_at,
                plot.threshold_min,
                plot.threshold_max
              )
            : 'stale';

          let visualStatus = status;
          if (status === 'stale' && latestReading?.moisture_pct != null) {
            if (latestReading.moisture_pct < plot.threshold_min) visualStatus = 'dry';
            else if (latestReading.moisture_pct > plot.threshold_max) visualStatus = 'wet';
            else visualStatus = 'optimal';
          }

          return {
            id: plot.id,
            name: plot.name,
            crop: plot.crop,
            threshold_min: plot.threshold_min,
            threshold_max: plot.threshold_max,
            status: visualStatus,
            lastMoisture: latestReading?.moisture_pct ?? null,
            lastUpdate: latestReading?.measured_at ?? null,
          };
        });
        setPlots(enriched);
      }
    } catch (err) {
      console.error('Error fetching plots list:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlots();

    const sub = supabase
      .channel('plots-screen-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'readings' }, () => {
        fetchPlots();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlots();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={plots}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const badge = STATUS_BADGE[item.status];
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => router.push(`/plot/${item.id}` as any)}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.plotName}>{item.name}</Text>
                  <Text style={styles.plotCrop}>Cultivo: {item.crop}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.footerLabel}>Humedad actual:</Text>
                <Text style={styles.moistureValue}>
                  {item.lastMoisture !== null ? `${Number(item.lastMoisture).toFixed(1)}%` : 'N/D'}
                </Text>
              </View>
              <Text style={styles.thresholdInfo}>
                Umbrales: {item.threshold_min}% - {item.threshold_max}%
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay lotes registrados.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  listContent: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  plotName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  plotCrop: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerLabel: { fontSize: 14, color: '#4B5563' },
  moistureValue: { fontSize: 18, fontWeight: '700', color: '#10B981' },
  thresholdInfo: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#6B7280', fontSize: 16 },
});
