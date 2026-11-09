import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  dataProvider,
  ObserverLocation,
  ValidationPosition,
} from '../services/DataProvider';
import {
  OrbitalEngine,
  PropagatedState,
  ValidationErrorMetrics,
} from '../engine/OrbitalEngine';

export interface ValidationSampleRecord {
  id: string;
  noradId: number;
  satelliteName: string;
  source: string;
  timestampIso: string;
  epochAgeHours: number;
  localLat: number;
  localLon: number;
  localAltKm: number;
  remoteLat: number;
  remoteLon: number;
  remoteAltKm: number;
  metrics: ValidationErrorMetrics;
}

export interface ValidationScreenProps {
  initialNoradId?: number;
  observer?: ObserverLocation;
}

const DEFAULT_OBSERVER: ObserverLocation = {
  latitude: -32.4845,
  longitude: -58.2322,
  altitudeKm: 0.025,
};

/**
 * Validation Screen (RF-15 & RF-16)
 * Performs real-time cross-validation between local SGP4 propagation (satellite.js)
 * and independent telemetry endpoints:
 *  - Where the ISS at? API (unauthenticated, for ISS NORAD 25544)
 *  - N2YO REST API (for any satellite NORAD ID)
 * Computes 2D ground distance error (Haversine km), 3D chord error (km), and altitude delta.
 */
export const ValidationScreen: React.FC<ValidationScreenProps> = ({
  initialNoradId = 25544,
  observer = DEFAULT_OBSERVER,
}) => {
  const [noradInput, setNoradInput] = useState<string>(String(initialNoradId));
  const [n2yoKeyInput, setN2yoKeyInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [lastLocalState, setLastLocalState] = useState<PropagatedState | null>(null);
  const [lastRemoteState, setLastRemoteState] = useState<ValidationPosition | null>(null);
  const [lastMetrics, setLastMetrics] = useState<ValidationErrorMetrics | null>(null);
  const [lastEpochAgeHours, setLastEpochAgeHours] = useState<number>(0);
  const [history, setHistory] = useState<ValidationSampleRecord[]>([]);

  const runValidation = useCallback(
    async (providerPreference?: 'WhereTheISS' | 'N2YO') => {
      const noradId = parseInt(noradInput.trim(), 10);
      if (Number.isNaN(noradId)) {
        Alert.alert('NORAD ID Invalido', 'Ingresa un numero NORAD valido (ej. 25544).');
        return;
      }

      if (n2yoKeyInput.trim()) {
        dataProvider.n2yo.setRuntimeApiKey(n2yoKeyInput.trim());
      }

      setLoading(true);
      try {
        // 1. Obtain cached/fresh local orbital elements (OMM/TLE)
        const orbitalMeta = await dataProvider.getOrbitalData(noradId, false);

        // 2. Fetch live independent validation coordinates from WhereTheISS or N2YO
        const remotePos = await dataProvider.getValidationPosition(
          noradId,
          observer,
          providerPreference
        );

        // 3. Propagate local SGP4 at the exact timestamp reported by the validation API
        const sampleDate = new Date(remotePos.timestamp);
        const localPos = OrbitalEngine.propagateAt(
          orbitalMeta.record,
          sampleDate,
          observer
        );

        if (!localPos) {
          throw new Error('Falló la propagación SGP4 local para el timestamp recibido.');
        }

        // 4. Compute 2D Haversine & 3D spatial error metrics in km
        const errorMetrics = OrbitalEngine.computeValidationError(
          {
            latitude: localPos.latitude,
            longitude: localPos.longitude,
            altitudeKm: localPos.altitudeKm,
          },
          {
            latitude: remotePos.latitude,
            longitude: remotePos.longitude,
            altitudeKm: remotePos.altitudeKm,
          }
        );

        setLastLocalState(localPos);
        setLastRemoteState(remotePos);
        setLastMetrics(errorMetrics);
        setLastEpochAgeHours(orbitalMeta.epochAgeHours);

        const entry: ValidationSampleRecord = {
          id: `${Date.now()}`,
          noradId,
          satelliteName: orbitalMeta.record.name,
          source: remotePos.source,
          timestampIso: sampleDate.toISOString(),
          epochAgeHours: orbitalMeta.epochAgeHours,
          localLat: localPos.latitude,
          localLon: localPos.longitude,
          localAltKm: localPos.altitudeKm,
          remoteLat: remotePos.latitude,
          remoteLon: remotePos.longitude,
          remoteAltKm: remotePos.altitudeKm,
          metrics: errorMetrics,
        };

        setHistory(prev => [entry, ...prev.slice(0, 14)]);
      } catch (err) {
        Alert.alert('Error en Validacion Cruzada', String(err));
      } finally {
        setLoading(false);
      }
    },
    [noradInput, n2yoKeyInput, observer]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        Validacion Cruzada: SGP4 Local vs APIs Externas
      </Text>
      <Text style={styles.subtitle}>
        Compara la posicion propagada localmente en el mismo instante UTC contra
        Where the ISS at? (NORAD 25544) o N2YO REST API (cualquier satelite).
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>NORAD Catalog ID</Text>
        <TextInput
          style={styles.input}
          value={noradInput}
          onChangeText={setNoradInput}
          keyboardType="numeric"
          placeholder="25544 (ISS)"
          placeholderTextColor="#64748B"
        />

        <Text style={styles.label}>
          N2YO API Key (Opcional para ISS, requerida para otros NORAD IDs)
        </Text>
        <TextInput
          style={styles.input}
          value={n2yoKeyInput}
          onChangeText={setN2yoKeyInput}
          placeholder="Ingresa tu API Key de N2YO si validas otro satelite..."
          placeholderTextColor="#64748B"
          secureTextEntry
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => {
              setNoradInput('25544');
              runValidation('WhereTheISS');
            }}
            disabled={loading}
          >
            <Text style={styles.btnText}>Validar ISS (WhereTheISS)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => runValidation('N2YO')}
            disabled={loading}
          >
            <Text style={styles.btnText}>Validar con N2YO</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={styles.loaderText}>
              Consultando efemeride y comparando instante UTC...
            </Text>
          </View>
        )}
      </View>

      {lastLocalState && lastRemoteState && lastMetrics && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>
              {lastLocalState.name} (#{lastLocalState.noradId})
            </Text>
            <Text style={styles.sourceTag}>vs {lastRemoteState.source}</Text>
          </View>

          <View style={styles.errorBanner}>
            <View style={styles.errorBox}>
              <Text style={styles.errorLabel}>ERROR 2D (HAVERSINE)</Text>
              <Text style={styles.errorValue}>
                {lastMetrics.groundDistanceErrorKm.toFixed(3)} km
              </Text>
            </View>
            <View style={styles.errorBox}>
              <Text style={styles.errorLabel}>ERROR ESPACIAL 3D</Text>
              <Text style={styles.errorValue}>
                {lastMetrics.spatial3DErrorKm.toFixed(3)} km
              </Text>
            </View>
            <View style={styles.errorBox}>
              <Text style={styles.errorLabel}>EDAD EPOCA TLE/OMM</Text>
              <Text style={styles.errorValue}>
                {lastEpochAgeHours.toFixed(1)} h
              </Text>
            </View>
          </View>

          <View style={styles.comparisonTable}>
            <View style={styles.tableRowHeader}>
              <Text style={[styles.cell, styles.cellParam]}>Parametro</Text>
              <Text style={styles.cell}>SGP4 Local</Text>
              <Text style={styles.cell}>{lastRemoteState.source}</Text>
              <Text style={styles.cell}>Delta (|Δ|)</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.cell, styles.cellParam]}>Latitud (°)</Text>
              <Text style={styles.cell}>{lastLocalState.latitude.toFixed(4)}</Text>
              <Text style={styles.cell}>{lastRemoteState.latitude.toFixed(4)}</Text>
              <Text style={styles.cell}>
                {lastMetrics.latitudeDeltaDeg.toFixed(4)}°
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.cell, styles.cellParam]}>Longitud (°)</Text>
              <Text style={styles.cell}>{lastLocalState.longitude.toFixed(4)}</Text>
              <Text style={styles.cell}>
                {lastRemoteState.longitude.toFixed(4)}
              </Text>
              <Text style={styles.cell}>
                {lastMetrics.longitudeDeltaDeg.toFixed(4)}°
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.cell, styles.cellParam]}>Altitud (km)</Text>
              <Text style={styles.cell}>
                {lastLocalState.altitudeKm.toFixed(2)}
              </Text>
              <Text style={styles.cell}>
                {lastRemoteState.altitudeKm.toFixed(2)}
              </Text>
              <Text style={styles.cell}>
                {lastMetrics.altitudeDeltaKm.toFixed(2)} km
              </Text>
            </View>
          </View>

          <Text style={styles.technicalNote}>
            Nota Tecnica: El modelo SGP4/SDP4 propaga perturbaciones seculares y
            periodicas ($J_2, J_3, J_4$ y arrastre atmosferico B*). Una divergencia de
            0.5 a 5 km es esperada cuando las fuentes utilizan epocas TLE ligeramente
            distintas o correcciones atmosfericas finas diferentes.
          </Text>
        </View>
      )}

      {/* Historical Validation Log Table (Section 6 Deliverable) */}
      {history.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.historyTitle}>
            Historial de Mediciones para el Informe de Validacion
          </Text>
          {history.map(item => (
            <View key={item.id} style={styles.historyRow}>
              <View>
                <Text style={styles.historySat}>
                  {item.satelliteName} (#{item.noradId}) vs {item.source}
                </Text>
                <Text style={styles.historyMeta}>
                  UTC: {item.timestampIso.slice(11, 19)} | Epoca:{' '}
                  {item.epochAgeHours.toFixed(1)}h
                </Text>
              </View>
              <View style={styles.historyErrorCol}>
                <Text style={styles.historyErrorVal}>
                  2D: {item.metrics.groundDistanceErrorKm.toFixed(2)} km
                </Text>
                <Text style={styles.historyErrorSub}>
                  3D: {item.metrics.spatial3DErrorKm.toFixed(2)} km
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  content: { padding: 14, paddingBottom: 32 },
  title: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: '#94A3B8', fontSize: 12, marginBottom: 14, lineHeight: 18 },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  label: { color: '#CBD5E1', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#0284C7' },
  btnSecondary: { backgroundColor: '#4F46E5' },
  btnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  loaderText: { color: '#38BDF8', fontSize: 12, marginLeft: 8 },
  resultCard: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0284C7',
    marginBottom: 14,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  sourceTag: {
    backgroundColor: '#1E293B',
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorBox: { flex: 1, alignItems: 'center' },
  errorLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '700' },
  errorValue: { color: '#34D399', fontSize: 14, fontWeight: '800', marginTop: 2 },
  comparisonTable: {
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  cell: { flex: 1, color: '#E2E8F0', fontSize: 11, textAlign: 'right' },
  cellParam: { textAlign: 'left', fontWeight: '700', color: '#94A3B8' },
  technicalNote: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },
  historyTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  historySat: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  historyMeta: { color: '#64748B', fontSize: 10 },
  historyErrorCol: { alignItems: 'flex-end' },
  historyErrorVal: { color: '#38BDF8', fontSize: 12, fontWeight: '700' },
  historyErrorSub: { color: '#94A3B8', fontSize: 10 },
});

