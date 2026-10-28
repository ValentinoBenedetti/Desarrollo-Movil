import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNetworkStore } from '../../core/store/useNetworkStore';
import { BackgroundTaskService } from '../../services/background/backgroundTaskService';
import { MeasurementOrchestrator } from '../../services/measurement/measurementOrchestrator';
import { MetricCard } from '../components/MetricCard';
import { SignalGauge } from '../components/SignalGauge';
import { theme } from '../theme';

export const DashboardScreen: React.FC = () => {
  const store = useNetworkStore();
  const [isLiveSampling, setIsLiveSampling] = useState(false);
  const [isRunningManualTest, setIsRunningManualTest] = useState(false);

  const toggleLiveSampling = (value: boolean) => {
    setIsLiveSampling(value);
    if (value) {
      BackgroundTaskService.startLiveSampling(8);
    } else {
      BackgroundTaskService.stopLiveSampling();
    }
  };

  const handleRunManualTest = async () => {
    if (isRunningManualTest) return;
    setIsRunningManualTest(true);
    try {
      await MeasurementOrchestrator.runDiagnostics();
      Alert.alert('Diagnóstico Finalizado', 'Las métricas de red y QoS se registraron correctamente.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert('Fallo en la Medición', message);
    } finally {
      setIsRunningManualTest(false);
    }
  };

  const carrierName = store.cellularInfo?.carrier || 'Sin Red Celular';
  const radioTech = store.cellularInfo?.radioType || store.connectionType.toUpperCase();
  const generation = store.cellularInfo?.generation || 'N/A';
  const signalLevel = store.cellularInfo?.signalLevel ?? 0;
  const signalDbm = store.cellularInfo?.signalStrengthDbm ?? null;

  const latencyAvg = store.lastLatency ? `${store.lastLatency.avgMs}` : '--';
  const jitterVal = store.lastLatency ? `${store.lastLatency.jitterMs}` : '--';
  const lossVal = store.lastLatency ? `${store.lastLatency.packetLossPercent}%` : '--';
  const downloadSpeed = store.lastDownload ? `${store.lastDownload.speedMbps}` : '--';
  const uploadSpeed = store.lastUpload ? `${store.lastUpload.speedMbps}` : '--';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Banner de Estado de Conexión */}
      <View style={styles.statusBar}>
        <View style={styles.statusIndicator}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: store.isConnected ? theme.colors.success : theme.colors.danger },
            ]}
          />
          <Text style={styles.statusTitle}>
            {store.isConnected ? `Conectado vía ${store.connectionType.toUpperCase()}` : 'Sin Conexión'}
          </Text>
        </View>
        <Text style={styles.hostBadge}>
          {store.lastLatency?.host || 'Host por defecto'}
        </Text>
      </View>

      {/* Indicador de Señal Celular Nativa */}
      <SignalGauge
        level={signalLevel}
        dbm={signalDbm}
        carrier={carrierName}
        generation={`${generation} • ${radioTech}`}
      />

      {/* Switch de Muestreo Continuo */}
      <View style={styles.liveSamplingRow}>
        <View>
          <Text style={styles.liveSamplingTitle}>Mapeo Continuo en Vivo</Text>
          <Text style={styles.liveSamplingSubtitle}>
            Sondea RTT y GPS cada 8s para trayectos
          </Text>
        </View>
        <Switch
          value={isLiveSampling}
          onValueChange={toggleLiveSampling}
          trackColor={{ false: theme.colors.surfaceBorder, true: theme.colors.primary }}
          thumbColor={isLiveSampling ? theme.colors.white : theme.colors.textMuted}
        />
      </View>

      {/* Sección Latencia & Jitter */}
      <Text style={styles.sectionTitle}>Latencia y Sondas TCP</Text>
      <View style={styles.cardsRow}>
        <MetricCard
          label="RTT Promedio"
          value={latencyAvg}
          unit="ms"
          subtitle={store.lastLatency ? `Mín: ${store.lastLatency.minMs} | Máx: ${store.lastLatency.maxMs}` : undefined}
          variant="primary"
        />
        <MetricCard
          label="Jitter (RFC 3550)"
          value={jitterVal}
          unit="ms"
          subtitle="Fluctuación de retardo"
          variant={Number(jitterVal) > 50 ? 'warning' : 'default'}
        />
      </View>

      <View style={styles.cardsRow}>
        <MetricCard
          label="Pérdida Paquetes"
          value={lossVal}
          subtitle="Sondas fallidas"
          variant={store.lastLatency && store.lastLatency.packetLossPercent > 0 ? 'danger' : 'success'}
        />
        <MetricCard
          label="GPS Precisión"
          value={store.currentLocation ? `±${store.currentLocation.accuracy.toFixed(0)}` : '--'}
          unit="m"
          subtitle={store.currentLocation ? `${store.currentLocation.latitude.toFixed(4)}, ${store.currentLocation.longitude.toFixed(4)}` : 'Buscando satélites...'}
        />
      </View>

      {/* Sección Throughput */}
      <Text style={styles.sectionTitle}>Ancho de Banda (Throughput)</Text>
      <View style={styles.cardsRow}>
        <MetricCard
          label="Descarga (Down)"
          value={downloadSpeed}
          unit="Mbps"
          subtitle={store.lastDownload ? `${(store.lastDownload.bytesTransferred / (1024 * 1024)).toFixed(1)} MB transferidos` : 'Payload 5MB'}
          variant="success"
        />
        <MetricCard
          label="Subida (Up)"
          value={uploadSpeed}
          unit="Mbps"
          subtitle={store.lastUpload ? `${(store.lastUpload.bytesTransferred / (1024 * 1024)).toFixed(1)} MB transferidos` : 'Payload 2MB'}
          variant="primary"
        />
      </View>

      {/* Botón de Diagnóstico Manual */}
      <TouchableOpacity
        style={[styles.actionButton, isRunningManualTest && styles.actionButtonDisabled]}
        onPress={handleRunManualTest}
        disabled={isRunningManualTest}
      >
        {isRunningManualTest ? (
          <ActivityIndicator color={theme.colors.white} style={styles.buttonSpinner} />
        ) : null}
        <Text style={styles.actionButtonText}>
          {isRunningManualTest ? 'Ejecutando Diagnóstico Completo...' : 'Iniciar Test de Calidad (QoS)'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  statusBar: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  hostBadge: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  liveSamplingRow: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveSamplingTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  liveSamplingSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  cardsRow: {
    flexDirection: 'row',
    marginHorizontal: -theme.spacing.xs,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  buttonSpinner: {
    marginRight: 8,
  },
  actionButtonText: {
    color: '#04101E',
    fontSize: 15,
    fontWeight: '700',
  },
});
