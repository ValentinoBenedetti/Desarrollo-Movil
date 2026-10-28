import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNetworkStore } from '../../core/store/useNetworkStore';
import { DatabaseService } from '../../services/database/databaseService';
import { CoveragePoint, HeatmapMapView } from '../components/HeatmapMapView';
import { theme } from '../theme';

export const MapScreen: React.FC = () => {
  const currentLocation = useNetworkStore((state) => state.currentLocation);
  const [points, setPoints] = useState<CoveragePoint[]>([]);
  const [useHeatmap, setUseHeatmap] = useState(false);

  const loadPoints = async () => {
    try {
      let dbPoints = await DatabaseService.getHeatmapPoints();
      const uniqueCoords = new Set(
        dbPoints.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`)
      );
      if (uniqueCoords.size <= 1) {
        await DatabaseService.seedDemoRoute();
        dbPoints = await DatabaseService.getHeatmapPoints();
      }
      setPoints(dbPoints);
    } catch (err) {
      console.warn('[MapScreen] Error cargando puntos de cobertura:', err);
    }
  };

  const handleSeedDemo = async () => {
    try {
      await DatabaseService.seedDemoRoute();
      await loadPoints();
    } catch (err) {
      console.warn('[MapScreen] Error al sembrar ruta demo:', err);
    }
  };

  useEffect(() => {
    loadPoints();
  }, [currentLocation]);

  return (
    <View style={styles.container}>
      <HeatmapMapView
        currentLocation={currentLocation}
        points={points}
        useHeatmapOverlay={useHeatmap}
      />

      {/* Barra flotante de control superior */}
      <View style={styles.topBar}>
        <View style={styles.infoBadge}>
          <Text style={styles.infoText}>
            {points.length} puntos de cobertura
          </Text>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.toggleButton, useHeatmap && styles.toggleButtonActive]}
            onPress={() => setUseHeatmap(!useHeatmap)}
          >
            <Text style={[styles.toggleText, useHeatmap && styles.toggleTextActive]}>
              {useHeatmap ? 'Heatmap' : 'Círculos'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggleButton} onPress={handleSeedDemo}>
            <Text style={styles.toggleText}>+ Ruta</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshButton} onPress={loadPoints}>
            <Text style={styles.refreshButtonText}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoBadge: {
    backgroundColor: 'rgba(19, 28, 46, 0.92)',
    borderColor: theme.colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  infoText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    backgroundColor: 'rgba(19, 28, 46, 0.92)',
    borderColor: theme.colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#04101E',
  },
  refreshButton: {
    backgroundColor: 'rgba(19, 28, 46, 0.92)',
    borderColor: theme.colors.surfaceBorder,
    borderWidth: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
