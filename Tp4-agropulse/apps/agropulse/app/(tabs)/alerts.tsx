import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/utils/supabase';
import { getPlotStatus, PlotStatus } from '../../src/utils/plotStatus';

interface AlertItem {
  id: string;
  plotId: string;
  plotName: string;
  type: 'dry' | 'wet' | 'stale';
  title: string;
  description: string;
  time: string;
  severity: 'high' | 'medium' | 'low';
}

export default function AlertsScreen() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = async () => {
    try {
      const { data: plotsData } = await supabase.from('plots').select('*');
      const { data: stationsData } = await supabase.from('stations').select('*');
      const { data: readingsData } = await supabase
        .from('readings')
        .select('*')
        .order('measured_at', { ascending: false })
        .limit(100);

      const generatedAlerts: AlertItem[] = [];

      plotsData?.forEach((plot) => {
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

        if (status === 'dry') {
          generatedAlerts.push({
            id: `alert-dry-${plot.id}`,
            plotId: plot.id,
            plotName: plot.name,
            type: 'dry',
            title: `Estrés Hídrico en ${plot.name}`,
            description: `Humedad actual ${latestReading?.moisture_pct}% por debajo del mínimo recomendado (${plot.threshold_min}%). Se aconseja encender riego.`,
            time: latestReading?.measured_at ? new Date(latestReading.measured_at).toLocaleTimeString() : 'Reciente',
            severity: 'high',
          });
        } else if (status === 'wet') {
          generatedAlerts.push({
            id: `alert-wet-${plot.id}`,
            plotId: plot.id,
            plotName: plot.name,
            type: 'wet',
            title: `Exceso de Humedad en ${plot.name}`,
            description: `Humedad actual ${latestReading?.moisture_pct}% por encima del máximo (${plot.threshold_max}%). Verificar drenaje o apagar válvulas.`,
            time: latestReading?.measured_at ? new Date(latestReading.measured_at).toLocaleTimeString() : 'Reciente',
            severity: 'medium',
          });
        } else if (status === 'stale') {
          generatedAlerts.push({
            id: `alert-stale-${plot.id}`,
            plotId: plot.id,
            plotName: plot.name,
            type: 'stale',
            title: `Sin datos recientes en ${plot.name}`,
            description: `No se han recibido telemetrías en los últimos 15 minutos. Revise conectividad de las estaciones.`,
            time: latestReading?.measured_at ? new Date(latestReading.measured_at).toLocaleTimeString() : 'Sin registro',
            severity: 'low',
          });
        }
      });

      setAlerts(generatedAlerts);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const sub = supabase
      .channel('alerts-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'readings' }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAlerts(); }} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isHigh = item.severity === 'high';
          const isMedium = item.severity === 'medium';
          const cardBorder = isHigh ? '#EF4444' : isMedium ? '#3B82F6' : '#9CA3AF';
          const icon = isHigh ? '🚨' : isMedium ? '💧' : '📡';

          return (
            <TouchableOpacity
              style={[styles.alertCard, { borderLeftColor: cardBorder }]}
              activeOpacity={0.8}
              onPress={() => router.push(`/plot/${item.plotId}` as any)}
            >
              <View style={styles.alertHeader}>
                <Text style={styles.icon}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>{item.title}</Text>
                  <Text style={styles.alertTime}>{item.time}</Text>
                </View>
              </View>
              <Text style={styles.alertDescription}>{item.description}</Text>
              <View style={styles.cardAction}>
                <Text style={styles.actionText}>Ver detalle del lote →</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>Todo bajo control</Text>
            <Text style={styles.emptyText}>No hay alertas activas en tus lotes.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  listContent: { padding: 16 },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  icon: { fontSize: 22 },
  alertTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  alertTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  alertDescription: { fontSize: 14, color: '#4B5563', lineHeight: 20 },
  cardAction: { marginTop: 12, alignItems: 'flex-end' },
  actionText: { fontSize: 13, fontWeight: '600', color: '#10B981' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  emptyText: { color: '#6B7280', fontSize: 14, marginTop: 4 },
});
