import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import {
  magnetometer,
  SensorTypes,
  setUpdateIntervalForType,
} from 'react-native-sensors';
import Svg, {
  Circle as SvgCircle,
  Ellipse as SvgEllipse,
  G,
  Line as SvgLine,
  Path as SvgPath,
  Polygon as SvgPolygon,
  Rect as SvgRect,
  Text as SvgText,
} from 'react-native-svg';
import {
  ConstellationGroup,
  dataProvider,
  ObserverLocation,
  OrbitalDataWithMeta,
} from '../services/DataProvider';
import {
  GeoCoordinate,
  OrbitalEngine,
  PassWindow,
  PropagatedState,
  SkyTrackPoint,
} from '../engine/OrbitalEngine';

export interface MapScreenProps {
  onSchedulePassNotification?: (pass: PassWindow, leadMinutes: number) => Promise<void>;
  onSelectSatelliteForValidation?: (noradId: number) => void;
}

const DEFAULT_OBSERVER: ObserverLocation = {
  // FCyT UADER - Concepcion del Uruguay, Entre Rios, Argentina
  latitude: -32.4845,
  longitude: -58.2322,
  altitudeKm: 0.025,
};

const CONSTELLATION_TABS: { key: ConstellationGroup; label: string }[] = [
  { key: 'stations', label: 'Stations / ISS' },
  { key: 'starlink', label: 'Starlink (SupGP)' },
  { key: 'gps-ops', label: 'GPS (MEO)' },
  { key: 'weather', label: 'Weather / GEO' },
];

const MIN_ELEVATION_OPTIONS = [5, 10, 20, 30];

// Simplified continent polygons in [lon, lat] for the offline-ready Vector World Map
const CONTINENT_POLYGONS: number[][][] = [
  // South America
  [
    [-80, 10], [-75, 11], [-60, 8], [-50, 0], [-35, -6], [-38, -15],
    [-48, -28], [-58, -35], [-66, -48], [-72, -54], [-75, -45], [-71, -30],
    [-70, -18], [-77, -12], [-81, -4],
  ],
  // North America
  [
    [-165, 65], [-130, 70], [-85, 72], [-60, 50], [-75, 35], [-81, 25],
    [-90, 18], [-80, 9], [-95, 16], [-105, 22], [-118, 33], [-124, 48],
    [-145, 60],
  ],
  // Eurasia
  [
    [-10, 36], [-9, 43], [-2, 48], [10, 55], [28, 70], [80, 73], [140, 68],
    [170, 62], [142, 45], [122, 30], [105, 10], [95, 16], [78, 8], [68, 24],
    [55, 22], [42, 12], [33, 31], [15, 38],
  ],
  // Africa
  [
    [-17, 15], [-6, 35], [10, 37], [32, 31], [43, 12], [51, 11], [40, -10],
    [35, -25], [20, -35], [14, -22], [9, -2], [-8, 5],
  ],
  // Australia
  [
    [114, -22], [122, -16], [136, -12], [145, -15], [153, -26], [147, -38],
    [131, -32], [115, -34],
  ],
];

/**
 * Vector World Map Fallback / Primary Renderer (RF-10, RF-11, RF-12, RF-13)
 * Guarantees 100% functional rendering on any Android device without requiring a paid Google Maps API key,
 * while also allowing 1-tap switching to native react-native-maps.
 */
const VectorWorldMap: React.FC<{
  observer: ObserverLocation;
  liveState: PropagatedState | null;
  groundTrackSegments: GeoCoordinate[][];
  footprintRadiusMeters: number;
  showConstellationLayer: boolean;
  constellationStates: PropagatedState[];
}> = ({
  observer,
  liveState,
  groundTrackSegments,
  footprintRadiusMeters,
  showConstellationLayer,
  constellationStates,
}) => {
  const width = 360;
  const height = 180;

  const lonToX = (lon: number) => ((lon + 180) / 360) * width;
  const latToY = (lat: number) => ((90 - lat) / 180) * height;

  // Convert footprint radius (meters) to approximate equirectangular degrees
  const footprintDegLat = (footprintRadiusMeters / 1000 / 6371.0) * (180 / Math.PI);
  const satLatRad = liveState ? (liveState.latitude * Math.PI) / 180 : 0;
  const footprintDegLon =
    footprintDegLat / Math.max(0.25, Math.cos(satLatRad));

  return (
    <View style={styles.vectorMapContainer}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice">
        <SvgRect x={0} y={0} width={width} height={height} fill="#070D19" />

        {/* Latitude / Longitude Graticule Grid */}
        {[-120, -60, 0, 60, 120].map(lon => (
          <SvgLine
            key={`mer-${lon}`}
            x1={lonToX(lon)}
            y1={0}
            x2={lonToX(lon)}
            y2={height}
            stroke={lon === 0 ? '#1E293B' : '#0F172A'}
            strokeWidth={lon === 0 ? 1 : 0.7}
          />
        ))}
        {[-60, -30, 0, 30, 60].map(lat => (
          <SvgLine
            key={`par-${lat}`}
            x1={0}
            y1={latToY(lat)}
            x2={width}
            y2={latToY(lat)}
            stroke={lat === 0 ? '#1E293B' : '#0F172A'}
            strokeWidth={lat === 0 ? 1 : 0.7}
          />
        ))}

        {/* Continents */}
        {CONTINENT_POLYGONS.map((poly, idx) => {
          const pts = poly
            .map(([lon, lat]) => `${lonToX(lon).toFixed(1)},${latToY(lat).toFixed(1)}`)
            .join(' ');
          return (
            <SvgPolygon
              key={`cont-${idx}`}
              points={pts}
              fill="#162238"
              stroke="#263B5E"
              strokeWidth={0.8}
            />
          );
        })}

        {/* Antimeridian-Safe Ground Track Segments (RF-11) */}
        {groundTrackSegments.map((segment, idx) => {
          if (segment.length < 2) {
            return null;
          }
          const d = segment
            .map((pt, i) => {
              const x = lonToX(pt.longitude).toFixed(1);
              const y = latToY(pt.latitude).toFixed(1);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            })
            .join(' ');
          return (
            <SvgPath
              key={`vgt-${idx}`}
              d={d}
              stroke="#38BDF8"
              strokeWidth={1.6}
              strokeDasharray="4,2"
              fill="none"
            />
          );
        })}

        {/* Constellation Layer Satellites (RF-13) */}
        {showConstellationLayer &&
          constellationStates.map(sat => (
            <SvgCircle
              key={`vconst-${sat.noradId}`}
              cx={lonToX(sat.longitude)}
              cy={latToY(sat.latitude)}
              r={2.4}
              fill="#A855F7"
              stroke="#E9D5FF"
              strokeWidth={0.5}
            />
          ))}

        {/* Observer Ground Station Marker */}
        <SvgCircle
          cx={lonToX(observer.longitude)}
          cy={latToY(observer.latitude)}
          r={3.5}
          fill="#10B981"
          stroke="#FFFFFF"
          strokeWidth={0.8}
        />

        {/* Footprint Coverage Area & Live Satellite Marker (RF-10, RF-12) */}
        {liveState && (
          <G>
            {footprintRadiusMeters > 0 && (
              <SvgEllipse
                cx={lonToX(liveState.longitude)}
                cy={latToY(liveState.latitude)}
                rx={Math.min(95, footprintDegLon)}
                ry={Math.min(60, footprintDegLat)}
                fill="rgba(244, 63, 94, 0.20)"
                stroke="#F43F5E"
                strokeWidth={1.2}
              />
            )}
            <SvgCircle
              cx={lonToX(liveState.longitude)}
              cy={latToY(liveState.latitude)}
              r={4.5}
              fill="#F43F5E"
              stroke="#FFFFFF"
              strokeWidth={1.2}
            />
            <SvgText
              x={Math.min(width - 42, Math.max(12, lonToX(liveState.longitude)))}
              y={Math.max(12, latToY(liveState.latitude) - 7)}
              fill="#FFFFFF"
              fontSize="7.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {liveState.name}
            </SvgText>
          </G>
        )}
      </Svg>
    </View>
  );
};

/**
 * Polar Sky Chart Component (RF-05)
 * Renders concentric elevation circles (0°, 30°, 60°, 90° zenith), cardinal axes,
 * the predicted pass trajectory path, and the real-time satellite position.
 */
const PolarSkyChart: React.FC<{
  pass: PassWindow | null;
  liveState: PropagatedState | null;
  headingDeg: number;
  compassMode: boolean;
}> = ({ pass, liveState, headingDeg, compassMode }) => {
  const size = 210;
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  const polarToCartesian = (azimuthDeg: number, elevationDeg: number) => {
    const clampedEl = Math.max(0, Math.min(90, elevationDeg));
    const r = ((90 - clampedEl) / 90) * maxRadius;
    const rotatedAz = compassMode ? azimuthDeg - headingDeg : azimuthDeg;
    const angleRad = ((rotatedAz - 90) * Math.PI) / 180;
    return {
      x: center + r * Math.cos(angleRad),
      y: center + r * Math.sin(angleRad),
    };
  };

  const buildTrackPath = (points: SkyTrackPoint[]): string => {
    if (points.length === 0) {
      return '';
    }
    return points
      .map((pt, idx) => {
        const { x, y } = polarToCartesian(pt.azimuthDeg, pt.elevationDeg);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const trackD = pass ? buildTrackPath(pass.skyTrack) : '';
  const livePoint =
    liveState && liveState.elevationDeg >= 0
      ? polarToCartesian(liveState.azimuthDeg, liveState.elevationDeg)
      : null;

  return (
    <View style={styles.skyChartContainer}>
      <Svg width={size} height={size}>
        <G>
          <SvgCircle
            cx={center}
            cy={center}
            r={maxRadius}
            stroke="#334155"
            strokeWidth={1.5}
            fill="#0F172A"
          />
          <SvgCircle
            cx={center}
            cy={center}
            r={(maxRadius * 2) / 3}
            stroke="#1E293B"
            strokeDasharray="4,4"
            strokeWidth={1}
            fill="none"
          />
          <SvgCircle
            cx={center}
            cy={center}
            r={maxRadius / 3}
            stroke="#1E293B"
            strokeDasharray="4,4"
            strokeWidth={1}
            fill="none"
          />

          <SvgLine
            x1={center}
            y1={center - maxRadius}
            x2={center}
            y2={center + maxRadius}
            stroke="#1E293B"
            strokeWidth={1}
          />
          <SvgLine
            x1={center - maxRadius}
            y1={center}
            x2={center + maxRadius}
            y2={center}
            stroke="#1E293B"
            strokeWidth={1}
          />

          <SvgText
            x={center}
            y={14}
            fill="#38BDF8"
            fontSize="11"
            fontWeight="bold"
            textAnchor="middle"
          >
            {compassMode ? `${Math.round(headingDeg)}°` : 'N'}
          </SvgText>
          <SvgText
            x={size - 10}
            y={center + 4}
            fill="#94A3B8"
            fontSize="10"
            textAnchor="middle"
          >
            E
          </SvgText>
          <SvgText
            x={center}
            y={size - 6}
            fill="#94A3B8"
            fontSize="10"
            textAnchor="middle"
          >
            S
          </SvgText>
          <SvgText
            x={10}
            y={center + 4}
            fill="#94A3B8"
            fontSize="10"
            textAnchor="middle"
          >
            W
          </SvgText>

          {trackD !== '' && (
            <SvgPath
              d={trackD}
              stroke="#22D3EE"
              strokeWidth={2.5}
              fill="none"
            />
          )}

          {pass && pass.skyTrack.length > 1 && (
            <>
              {(() => {
                const aosPt = polarToCartesian(pass.aosAzimuthDeg, 0);
                const maxPt = polarToCartesian(
                  pass.maxAzimuthDeg,
                  pass.maxElevationDeg
                );
                const losPt = polarToCartesian(pass.losAzimuthDeg, 0);
                return (
                  <>
                    <SvgCircle cx={aosPt.x} cy={aosPt.y} r={4} fill="#10B981" />
                    <SvgCircle cx={maxPt.x} cy={maxPt.y} r={4} fill="#FACC15" />
                    <SvgCircle cx={losPt.x} cy={losPt.y} r={4} fill="#EF4444" />
                  </>
                );
              })()}
            </>
          )}

          {livePoint && (
            <SvgCircle
              cx={livePoint.x}
              cy={livePoint.y}
              r={6}
              fill="#F43F5E"
              stroke="#FFFFFF"
              strokeWidth={1.5}
            />
          )}
        </G>
      </Svg>
    </View>
  );
};

export const MapScreen: React.FC<MapScreenProps> = ({
  onSchedulePassNotification,
  onSelectSatelliteForValidation,
}) => {
  const mapRef = useRef<MapView | null>(null);

  const [selectedGroup, setSelectedGroup] = useState<ConstellationGroup>('stations');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalog, setCatalog] = useState<OrbitalDataWithMeta[]>([]);
  const [selectedSatMeta, setSelectedSatMeta] = useState<OrbitalDataWithMeta | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [observer, setObserver] = useState<ObserverLocation>(DEFAULT_OBSERVER);
  const [liveState, setLiveState] = useState<PropagatedState | null>(null);
  const [groundTrackSegments, setGroundTrackSegments] = useState<GeoCoordinate[][]>([]);
  const [footprintRadiusMeters, setFootprintRadiusMeters] = useState<number>(0);
  const [minElevationDeg, setMinElevationDeg] = useState<number>(10);

  // Map Engine Toggle: Vectorial HD (works without Google Cloud billing key) vs Google Maps Native
  const [useNativeGoogleMap, setUseNativeGoogleMap] = useState<boolean>(false);

  // Constellation Layer (RF-13)
  const [showConstellationLayer, setShowConstellationLayer] = useState<boolean>(false);
  const [constellationStates, setConstellationStates] = useState<PropagatedState[]>([]);

  // Passes, SkyChart & Compass Overlay (RF-04, RF-05, RF-07)
  const [upcomingPasses, setUpcomingPasses] = useState<PassWindow[]>([]);
  const [selectedPassIndex, setSelectedPassIndex] = useState<number>(0);
  const [showSkyPanel, setShowSkyPanel] = useState<boolean>(true);
  const [compassMode, setCompassMode] = useState<boolean>(false);
  const [deviceHeadingDeg, setDeviceHeadingDeg] = useState<number>(0);

  useEffect(() => {
    const requestLocation = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            return;
          }
        }
        Geolocation.getCurrentPosition(
          pos => {
            setObserver({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitudeKm: (pos.coords.altitude ?? 25) / 1000,
            });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      } catch {}
    };
    requestLocation();
  }, []);

  useEffect(() => {
    if (!compassMode) {
      return;
    }
    try {
      setUpdateIntervalForType(SensorTypes.magnetometer, 200);
      const sub = magnetometer.subscribe({
        next: ({ x, y }) => {
          let angle = Math.atan2(y, x) * (180 / Math.PI);
          angle = (angle + 360) % 360;
          setDeviceHeadingDeg(angle);
        },
        error: () => {},
      });
      return () => sub.unsubscribe();
    } catch {
      return undefined;
    }
  }, [compassMode]);

  const loadGroupCatalog = useCallback(
    async (group: ConstellationGroup, forceRefresh = false) => {
      setLoadingCatalog(true);
      try {
        const items = await dataProvider.getCatalog(group, 60, forceRefresh);
        setCatalog(items);
        if (items.length > 0) {
          setSelectedSatMeta(prev => {
            const match = prev
              ? items.find(i => i.record.noradId === prev.record.noradId)
              : null;
            return match ?? items[0];
          });
        }
      } catch (err) {
        Alert.alert('Data Provider Warning', String(err));
      } finally {
        setLoadingCatalog(false);
      }
    },
    []
  );

  useEffect(() => {
    loadGroupCatalog(selectedGroup, false);
  }, [selectedGroup, loadGroupCatalog]);

  useEffect(() => {
    if (!selectedSatMeta) {
      return;
    }

    const updateRealTimePosition = () => {
      const now = new Date();
      const state = OrbitalEngine.propagateAt(
        selectedSatMeta.record,
        now,
        observer
      );
      if (state) {
        setLiveState(state);
        const radius = OrbitalEngine.computeFootprintRadiusMeters(
          state.altitudeKm,
          minElevationDeg
        );
        setFootprintRadiusMeters(radius);
      }
    };

    updateRealTimePosition();
    const timer = setInterval(updateRealTimePosition, 2000);
    return () => clearInterval(timer);
  }, [selectedSatMeta, observer, minElevationDeg]);

  useEffect(() => {
    if (!selectedSatMeta) {
      return;
    }
    const now = new Date();
    const segments = OrbitalEngine.computeGroundTrackSegments(
      selectedSatMeta.record,
      now,
      observer,
      40
    );
    setGroundTrackSegments(segments);

    const passes = OrbitalEngine.predictVisibilityWindows(
      selectedSatMeta.record,
      observer,
      minElevationDeg,
      24,
      5
    );
    setUpcomingPasses(passes);
    setSelectedPassIndex(0);
  }, [selectedSatMeta, observer, minElevationDeg]);

  useEffect(() => {
    if (!showConstellationLayer || catalog.length === 0) {
      setConstellationStates([]);
      return;
    }

    const computeBatch = () => {
      const records = catalog.map(c => c.record);
      const states = OrbitalEngine.propagateConstellationBatch(
        records,
        new Date(),
        observer,
        40
      );
      setConstellationStates(states);
    };

    computeBatch();
    const interval = setInterval(computeBatch, 4000);
    return () => clearInterval(interval);
  }, [showConstellationLayer, catalog, observer]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return catalog;
    }
    return catalog.filter(
      item =>
        item.record.name.toLowerCase().includes(q) ||
        String(item.record.noradId).includes(q)
    );
  }, [catalog, searchQuery]);

  const handleDirectNoradLookup = useCallback(async () => {
    const numericId = parseInt(searchQuery.trim(), 10);
    if (Number.isNaN(numericId)) {
      return;
    }
    setLoadingCatalog(true);
    try {
      const meta = await dataProvider.getOrbitalData(numericId, false);
      setSelectedSatMeta(meta);
      setCatalog(prev =>
        prev.some(p => p.record.noradId === meta.record.noradId)
          ? prev
          : [meta, ...prev]
      );
    } catch (err) {
      Alert.alert('NORAD Lookup Failed', String(err));
    } finally {
      setLoadingCatalog(false);
    }
  }, [searchQuery]);

  const activePass = upcomingPasses[selectedPassIndex] ?? null;

  const targetAzimuth =
    liveState && liveState.elevationDeg > 0
      ? liveState.azimuthDeg
      : activePass?.aosAzimuthDeg ?? 0;
  const azimuthDelta = ((targetAzimuth - deviceHeadingDeg + 540) % 360) - 180;

  return (
    <View style={styles.container}>
      {/* Top Filter & Search Bar (RF-01, RF-08, RF-16) */}
      <View style={styles.topPanel}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsRow}
        >
          {CONSTELLATION_TABS.map(tab => {
            const active = tab.key === selectedGroup;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, active && styles.tabButtonActive]}
                onPress={() => setSelectedGroup(tab.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o NORAD ID (ej. 25544)..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleDirectNoradLookup}
          />
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => loadGroupCatalog(selectedGroup, true)}
          >
            <Text style={styles.refreshBtnText}>Sync</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.satListScroll}
        >
          {filteredCatalog.slice(0, 25).map(item => {
            const isSelected =
              selectedSatMeta?.record.noradId === item.record.noradId;
            return (
              <TouchableOpacity
                key={item.record.noradId}
                style={[styles.satChip, isSelected && styles.satChipSelected]}
                onPress={() => {
                  setSelectedSatMeta(item);
                  onSelectSatelliteForValidation?.(item.record.noradId);
                }}
              >
                <Text style={styles.satChipName} numberOfLines={1}>
                  {item.record.name}
                </Text>
                <Text style={styles.satChipId}>#{item.record.noradId}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Map Layer (RF-10, RF-11, RF-12, RF-13) */}
      <View style={styles.mapWrapper}>
        {useNativeGoogleMap ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={{
              latitude: 0,
              longitude: 0,
              latitudeDelta: 120,
              longitudeDelta: 120,
            }}
          >
            <Marker
              coordinate={{
                latitude: observer.latitude,
                longitude: observer.longitude,
              }}
              title="Estacion Terrena (Observador)"
              description={`Lat ${observer.latitude.toFixed(3)}°, Lon ${observer.longitude.toFixed(3)}°`}
              pinColor="#10B981"
            />

            {groundTrackSegments.map((segment, index) => (
              <Polyline
                key={`gt-seg-${index}`}
                coordinates={segment}
                strokeColor="#38BDF8"
                strokeWidth={2.5}
                lineDashPattern={[6, 3]}
              />
            ))}

            {liveState && footprintRadiusMeters > 0 && (
              <Circle
                center={{
                  latitude: liveState.latitude,
                  longitude: liveState.longitude,
                }}
                radius={footprintRadiusMeters}
                strokeColor="rgba(244, 63, 94, 0.85)"
                fillColor="rgba(244, 63, 94, 0.18)"
                strokeWidth={2}
              />
            )}

            {liveState && (
              <Marker
                coordinate={{
                  latitude: liveState.latitude,
                  longitude: liveState.longitude,
                }}
                title={`${liveState.name} (NORAD ${liveState.noradId})`}
                description={`Alt: ${liveState.altitudeKm.toFixed(1)} km | Vel: ${liveState.velocityKmS.toFixed(2)} km/s`}
                pinColor="#F43F5E"
              />
            )}

            {showConstellationLayer &&
              constellationStates.map(sat => (
                <Marker
                  key={`const-${sat.noradId}`}
                  coordinate={{
                    latitude: sat.latitude,
                    longitude: sat.longitude,
                  }}
                  title={sat.name}
                  description={`Alt ${sat.altitudeKm.toFixed(0)} km`}
                  pinColor="#A855F7"
                />
              ))}
          </MapView>
        ) : (
          <VectorWorldMap
            observer={observer}
            liveState={liveState}
            groundTrackSegments={groundTrackSegments}
            footprintRadiusMeters={footprintRadiusMeters}
            showConstellationLayer={showConstellationLayer}
            constellationStates={constellationStates}
          />
        )}

        {/* Map Floating Action Controls */}
        <View style={styles.mapFloatingControls}>
          <TouchableOpacity
            style={[
              styles.floatBtn,
              showConstellationLayer && styles.floatBtnActive,
            ]}
            onPress={() => setShowConstellationLayer(v => !v)}
          >
            <Text style={styles.floatBtnText}>
              Constelacion ({showConstellationLayer ? 'ON' : 'OFF'})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.floatBtn, showSkyPanel && styles.floatBtnActive]}
            onPress={() => setShowSkyPanel(v => !v)}
          >
            <Text style={styles.floatBtnText}>
              Sky Chart ({upcomingPasses.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.floatBtn}
            onPress={() => setUseNativeGoogleMap(v => !v)}
          >
            <Text style={styles.floatBtnText}>
              Mapa: {useNativeGoogleMap ? 'Google' : 'Vector HD'}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingCatalog && (
          <View style={styles.loadingBadge}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={styles.loadingText}>Cargando efemerides...</Text>
          </View>
        )}
      </View>

      {/* Expandable Sky Chart, Pass Predictor & Compass Drawer (RF-04, RF-05, RF-06, RF-07) */}
      {showSkyPanel && (
        <View style={styles.skyDrawer}>
          <View style={styles.skyHeaderRow}>
            <Text style={styles.skyTitle}>
              Sky Chart Polar & Ventanas AOS/LOS
            </Text>
            <TouchableOpacity
              style={[
                styles.compassToggle,
                compassMode && styles.compassToggleActive,
              ]}
              onPress={() => setCompassMode(c => !c)}
            >
              <Text style={styles.compassToggleText}>
                {compassMode
                  ? `Brujula ON (${Math.round(deviceHeadingDeg)}°)`
                  : 'Modo Brujula'}
              </Text>
            </TouchableOpacity>
          </View>

          {compassMode && (
            <View style={styles.compassAssistBanner}>
              <Text style={styles.compassAssistText}>
                Apuntar a Azimut {targetAzimuth.toFixed(1)}° |{' '}
                {Math.abs(azimuthDelta) < 8
                  ? 'ALINEADO CON EL SATELITE'
                  : azimuthDelta > 0
                  ? `Gira ${Math.abs(azimuthDelta).toFixed(0)}° a la DERECHA`
                  : `Gira ${Math.abs(azimuthDelta).toFixed(0)}° a la IZQUIERDA`}
              </Text>
            </View>
          )}

          <View style={styles.skyContentRow}>
            <PolarSkyChart
              pass={activePass}
              liveState={liveState}
              headingDeg={deviceHeadingDeg}
              compassMode={compassMode}
            />

            <View style={styles.passListColumn}>
              <View style={styles.elSelectorRow}>
                <Text style={styles.elSelectorLabel}>El. Min:</Text>
                {MIN_ELEVATION_OPTIONS.map(el => (
                  <TouchableOpacity
                    key={el}
                    style={[
                      styles.elChip,
                      minElevationDeg === el && styles.elChipActive,
                    ]}
                    onPress={() => setMinElevationDeg(el)}
                  >
                    <Text style={styles.elChipText}>{el}°</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={styles.passesScroll}>
                {upcomingPasses.length === 0 ? (
                  <Text style={styles.noPassText}>
                    Sin pases ≥ {minElevationDeg}° en las proximas 24h.
                  </Text>
                ) : (
                  upcomingPasses.map((p, idx) => {
                    const selected = idx === selectedPassIndex;
                    const aosDate = new Date(p.aosTime);
                    return (
                      <TouchableOpacity
                        key={p.aosTime}
                        style={[
                          styles.passCard,
                          selected && styles.passCardSelected,
                        ]}
                        onPress={() => setSelectedPassIndex(idx)}
                      >
                        <Text style={styles.passCardTime}>
                          AOS: {aosDate.toLocaleTimeString()} (
                          {Math.round(p.durationSec / 60)}m)
                        </Text>
                        <Text style={styles.passCardMeta}>
                          Max El: {p.maxElevationDeg.toFixed(1)}° | Az:{' '}
                          {p.aosAzimuthDeg.toFixed(0)}°→
                          {p.losAzimuthDeg.toFixed(0)}°
                        </Text>
                        <TouchableOpacity
                          style={styles.notifyBtn}
                          onPress={() => onSchedulePassNotification?.(p, 5)}
                        >
                          <Text style={styles.notifyBtnText}>
                            Alerta -5 min
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      )}

      {/* Telemetry & Orbital Data Staleness Footer (RF-02, RF-03, RF-16) */}
      {liveState && selectedSatMeta && (
        <View style={styles.telemetryBar}>
          <View style={styles.telemetryHeader}>
            <Text style={styles.telemetrySatName}>
              {liveState.name} ({liveState.orbitRegime})
            </Text>
            <View
              style={[
                styles.ttlBadge,
                selectedSatMeta.isStale ? styles.ttlBadgeStale : styles.ttlBadgeOk,
              ]}
            >
              <Text style={styles.ttlBadgeText}>
                {selectedSatMeta.record.source} • Edad:{' '}
                {selectedSatMeta.ageHours.toFixed(1)}h{' '}
                {selectedSatMeta.isStale ? '(DESACTUALIZADO)' : '(VIGENTE)'}
              </Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>LAT / LON</Text>
              <Text style={styles.metricValue}>
                {liveState.latitude.toFixed(3)}° / {liveState.longitude.toFixed(3)}°
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>ALTITUD / VEL</Text>
              <Text style={styles.metricValue}>
                {liveState.altitudeKm.toFixed(1)} km •{' '}
                {liveState.velocityKmS.toFixed(2)} km/s
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>AZIMUT / ELEV</Text>
              <Text
                style={[
                  styles.metricValue,
                  liveState.elevationDeg > 0 && styles.metricVisible,
                ]}
              >
                {liveState.azimuthDeg.toFixed(1)}° /{' '}
                {liveState.elevationDeg.toFixed(1)}°
              </Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>FOOTPRINT (≥{minElevationDeg}°)</Text>
              <Text style={styles.metricValue}>
                R = {(footprintRadiusMeters / 1000).toFixed(0)} km
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  topPanel: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  tabsRow: { flexDirection: 'row', marginBottom: 6 },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    marginRight: 8,
  },
  tabButtonActive: { backgroundColor: '#0284C7' },
  tabText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  searchInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  refreshBtn: {
    marginLeft: 8,
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshBtnText: { color: '#38BDF8', fontSize: 12, fontWeight: '700' },
  satListScroll: { flexDirection: 'row' },
  satChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  satChipSelected: {
    backgroundColor: '#0369A1',
    borderColor: '#38BDF8',
  },
  satChipName: { color: '#F1F5F9', fontSize: 11, fontWeight: '700', maxWidth: 110 },
  satChipId: { color: '#94A3B8', fontSize: 10 },
  mapWrapper: { flex: 1 },
  map: { flex: 1 },
  vectorMapContainer: { flex: 1, backgroundColor: '#070D19' },
  mapFloatingControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 6,
  },
  floatBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 4,
  },
  floatBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  floatBtnText: { color: '#F8FAFC', fontSize: 11, fontWeight: '600' },
  loadingBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  loadingText: { color: '#E2E8F0', fontSize: 11, marginLeft: 6 },
  skyDrawer: {
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    padding: 8,
  },
  skyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  skyTitle: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  compassToggle: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  compassToggleActive: { backgroundColor: '#059669', borderColor: '#34D399' },
  compassToggleText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  compassAssistBanner: {
    backgroundColor: '#1E293B',
    padding: 6,
    borderRadius: 6,
    marginBottom: 6,
    alignItems: 'center',
  },
  compassAssistText: { color: '#38BDF8', fontSize: 11, fontWeight: '700' },
  skyContentRow: { flexDirection: 'row', alignItems: 'center' },
  skyChartContainer: { alignItems: 'center', justifyContent: 'center' },
  passListColumn: { flex: 1, marginLeft: 8, maxHeight: 205 },
  elSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  elSelectorLabel: { color: '#94A3B8', fontSize: 11, marginRight: 6 },
  elChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 4,
  },
  elChipActive: { backgroundColor: '#0284C7' },
  elChipText: { color: '#F8FAFC', fontSize: 11, fontWeight: '600' },
  passesScroll: { flex: 1 },
  noPassText: { color: '#64748B', fontSize: 11, marginTop: 10 },
  passCard: {
    backgroundColor: '#1E293B',
    padding: 6,
    borderRadius: 6,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  passCardSelected: { borderColor: '#22D3EE', backgroundColor: '#172554' },
  passCardTime: { color: '#F8FAFC', fontSize: 11, fontWeight: '700' },
  passCardMeta: { color: '#94A3B8', fontSize: 10, marginVertical: 2 },
  notifyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D9488',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 2,
  },
  notifyBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  telemetryBar: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  telemetryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  telemetrySatName: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  ttlBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  ttlBadgeOk: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  ttlBadgeStale: { backgroundColor: 'rgba(239, 68, 68, 0.25)' },
  ttlBadgeText: { color: '#E2E8F0', fontSize: 10, fontWeight: '600' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  metricCell: { width: '50%', marginBottom: 4 },
  metricLabel: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  metricValue: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  metricVisible: { color: '#34D399' },
});
