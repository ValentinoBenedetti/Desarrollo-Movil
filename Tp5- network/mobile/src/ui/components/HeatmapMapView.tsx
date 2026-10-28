import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { theme } from '../theme';

export interface CoveragePoint {
  latitude: number;
  longitude: number;
  weight: number; // 0.1 a 1.0
  title?: string;
  description?: string;
}

interface HeatmapMapViewProps {
  currentLocation?: { latitude: number; longitude: number } | null;
  points: CoveragePoint[];
  useHeatmapOverlay?: boolean;
}

export const HeatmapMapView: React.FC<HeatmapMapViewProps> = ({
  currentLocation,
  points,
  useHeatmapOverlay = false,
}) => {
  const centerLat = currentLocation?.latitude || -32.4825; // Concepción del Uruguay / default
  const centerLng = currentLocation?.longitude || -58.2328;

  const htmlContent = useMemo(() => {
    const pointsJson = JSON.stringify(points || []);
    const userLocJson = currentLocation ? JSON.stringify(currentLocation) : 'null';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #0b1120; }
    .leaflet-container { background: #0b1120; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .user-pulse {
      width: 20px;
      height: 20px;
      background: #0ea5e9;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 12px #38bdf8;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${centerLat}, ${centerLng}], 14);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    var points = ${pointsJson};
    var isHeatmap = ${useHeatmapOverlay};

    points.forEach(function(p) {
      var color = p.weight >= 0.7 ? '#10B981' : (p.weight >= 0.4 ? '#F59E0B' : '#EF4444');
      var label = p.weight >= 0.7 ? 'Excelente' : (p.weight >= 0.4 ? 'Regular' : 'Baja Cobertura');
      var circle = L.circle([p.latitude, p.longitude], {
        color: color,
        fillColor: color,
        fillOpacity: isHeatmap ? 0.65 : 0.45,
        radius: isHeatmap ? 180 : 120,
        weight: isHeatmap ? 0 : 2
      }).addTo(map);

      var title = p.title || ('Cobertura ' + label);
      var desc = p.description || ('Calidad: ' + Math.round(p.weight * 100) + '%');
      circle.bindPopup('<b>' + title + '</b><br>' + desc);
    });

    var userLoc = ${userLocJson};
    if (userLoc) {
      var pulseIcon = L.divIcon({
        className: 'user-pulse',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker([userLoc.latitude, userLoc.longitude], { icon: pulseIcon }).addTo(map)
        .bindPopup('<b>Tu Ubicación</b>');
    }
  </script>
</body>
</html>
    `;
  }, [centerLat, centerLng, points, currentLocation, useHeatmapOverlay]);

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: htmlContent }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        scrollEnabled={false}
      />

      {/* Leyenda del mapa */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
          <Text style={styles.legendText}>Buena (≥ -85 dBm)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.warning }]} />
          <Text style={styles.legendText}>Media (-86 a -105 dBm)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.danger }]} />
          <Text style={styles.legendText}>Baja (≤ -106 dBm)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: theme.borderRadius.md,
  },
  map: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0b1120',
  },
  legend: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: 'rgba(19, 28, 46, 0.92)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderColor: theme.colors.surfaceBorder,
    borderWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
});
