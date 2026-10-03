import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/utils/supabase';
import { getPlotStatus, PlotStatus } from '../../src/utils/plotStatus';

interface PlotData {
  id: string;
  name: string;
  crop: string;
  geom: any;
  threshold_min: number;
  threshold_max: number;
  status?: PlotStatus;
  lastReading?: any;
}

interface StationData {
  id: string;
  name: string;
  plot_id: string;
  lat: number;
  lng: number;
}

const STATUS_CONFIG: Record<PlotStatus, { color: string; fill: string; label: string }> = {
  optimal: { color: '#10B981', fill: 'rgba(16, 185, 129, 0.45)', label: 'Óptimo' },
  dry: { color: '#EF4444', fill: 'rgba(239, 68, 68, 0.45)', label: 'Seco' },
  wet: { color: '#3B82F6', fill: 'rgba(59, 130, 246, 0.45)', label: 'Exceso' },
  stale: { color: '#6B7280', fill: 'rgba(107, 114, 128, 0.45)', label: 'Sin datos' },
};

function parseCoordinates(geom: any): [number, number][] {
  if (!geom) return [];
  let parsed = geom;
  if (typeof geom === 'string') {
    try {
      parsed = JSON.parse(geom);
    } catch {
      return [];
    }
  }

  // GeoJSON Polygon coordinates: [[[lng, lat], ...]]
  if (parsed?.coordinates && Array.isArray(parsed.coordinates)) {
    const ring = Array.isArray(parsed.coordinates[0]) ? parsed.coordinates[0] : parsed.coordinates;
    return ring
      .map((pt: any): [number, number] | null => {
        if (Array.isArray(pt) && pt.length >= 2) {
          // Leaflet expects [latitude, longitude]
          return [Number(pt[1]), Number(pt[0])];
        }
        if (pt && typeof pt === 'object') {
          return [Number(pt.latitude ?? pt.lat), Number(pt.longitude ?? pt.lng)];
        }
        return null;
      })
      .filter((p: any): p is [number, number] => p !== null && !isNaN(p[0]) && !isNaN(p[1]));
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((pt: any): [number, number] | null => {
        if (Array.isArray(pt) && pt.length >= 2) {
          return [Number(pt[1]), Number(pt[0])];
        }
        if (pt && typeof pt === 'object') {
          return [Number(pt.latitude ?? pt.lat), Number(pt.longitude ?? pt.lng)];
        }
        return null;
      })
      .filter((p: any): p is [number, number] => p !== null && !isNaN(p[0]) && !isNaN(p[1]));
  }

  return [];
}

export default function MapScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [plots, setPlots] = useState<PlotData[]>([]);
  const [stations, setStations] = useState<StationData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const { data: plotsData } = await supabase.from('plots').select('*');
      const { data: stationsData } = await supabase.from('stations').select('*');
      const { data: readingsData } = await supabase
        .from('readings')
        .select('*')
        .order('measured_at', { ascending: false })
        .limit(50);

      if (plotsData) {
        const enrichedPlots = plotsData.map((plot) => {
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
            ...plot,
            status,
            visualStatus,
            lastReading: latestReading,
          };
        });
        setPlots(enrichedPlots);
      }

      if (stationsData) {
        setStations(stationsData);
      }
    } catch (err) {
      console.error('Error fetching map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const subscription = supabase
      .channel('map-live-sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'readings' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'plot_click' && msg.plotId) {
        router.push(`/plot/${msg.plotId}` as any);
      }
    } catch (e) {
      console.error('WebView message error:', e);
    }
  };

  // Prepare map data for Leaflet
  const preparedPlots = plots.map((p: any) => {
    const visual = (p.visualStatus || p.status || 'stale') as PlotStatus;
    return {
      id: p.id,
      name: p.name,
      crop: p.crop,
      status: p.status || 'stale',
      color: STATUS_CONFIG[visual].color,
      fill: STATUS_CONFIG[visual].fill,
      coords: parseCoordinates(p.geom),
      moisture: p.lastReading?.moisture_pct != null ? `${p.lastReading.moisture_pct}%` : 'N/D',
    };
  });

  const preparedStations = stations.map((s) => ({
    id: s.id,
    name: s.name,
    plot_id: s.plot_id,
    lat: Number(s.lat),
    lng: Number(s.lng),
  }));

  const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e5e7eb; }
    .custom-popup { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; }
    .popup-title { font-weight: bold; font-size: 15px; margin-bottom: 4px; color: #111827; }
    .popup-btn {
      display: inline-block;
      margin-top: 8px;
      padding: 6px 12px;
      background: #10B981;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      text-align: center;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var plots = ${JSON.stringify(preparedPlots)};
    var stations = ${JSON.stringify(preparedStations)};

    var map = L.map('map', {
      center: [-31.395, -58.005],
      zoom: 14,
      zoomControl: true
    });

    var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Esri Satellite'
    }).addTo(map);

    var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: 'OpenStreetMap'
    });

    L.control.layers({ 'Satélite': satellite, 'Mapa Calles': osm }, null, { position: 'topright' }).addTo(map);

    var allBounds = [];

    // Render Polygons
    plots.forEach(function(plot) {
      if (plot.coords && plot.coords.length > 2) {
        var polygon = L.polygon(plot.coords, {
          color: plot.color,
          weight: 3,
          fillColor: plot.fill,
          fillOpacity: 0.65
        }).addTo(map);

        allBounds.push(polygon.getBounds());

        var popupContent = '<div class="custom-popup">' +
          '<div class="popup-title">' + plot.name + '</div>' +
          '<div>Cultivo: <b>' + plot.crop + '</b></div>' +
          '<div>Humedad: <b>' + plot.moisture + '</b></div>' +
          '<div class="popup-btn" onclick="openPlot(\\'' + plot.id + '\\')">Ver Detalle →</div>' +
          '</div>';

        polygon.bindPopup(popupContent);
      }
    });

    // Render Stations
    stations.forEach(function(st) {
      var marker = L.circleMarker([st.lat, st.lng], {
        radius: 8,
        fillColor: '#059669',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(map);

      marker.bindPopup('<div class="custom-popup"><b>📡 ' + st.name + '</b><br><div class="popup-btn" onclick="openPlot(\\'' + st.plot_id + '\\')">Ver Lote →</div></div>');
    });

    if (allBounds.length > 0) {
      var combinedBounds = allBounds[0];
      for (var i = 1; i < allBounds.length; i++) {
        combinedBounds.extend(allBounds[i]);
      }
      map.fitBounds(combinedBounds, { padding: [40, 40] });
    }

    function openPlot(plotId) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'plot_click', plotId: plotId }));
      }
    }
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: leafletHtml }}
        style={styles.map}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />

      {/* Floating Legend & Academic Disclaimer */}
      <View style={styles.legendContainer}>
        <View style={styles.legendRow}>
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.colorDot, { backgroundColor: val.color }]} />
              <Text style={styles.legendLabel}>{val.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.disclaimer}>⚠️ Datos ficticios académicos (Concordia, ER)</Text>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5E7EB' },
  map: { flex: 1 },
  legendContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 5,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  disclaimer: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 20,
    elevation: 4,
  },
});
