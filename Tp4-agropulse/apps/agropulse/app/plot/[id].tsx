import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/utils/supabase';
import { getPlotStatus, PlotStatus } from '../../src/utils/plotStatus';
import { enqueue, syncQueue } from '../../src/utils/offlineQueue';
import { useUserRole } from '../../src/utils/useUserRole';

interface PlotDetail {
  id: string;
  name: string;
  crop: string;
  threshold_min: number;
  threshold_max: number;
}

interface Station {
  id: string;
  name: string;
}

interface Valve {
  id: string;
  name: string;
  status: 'open' | 'closed';
}

interface Reading {
  id: string;
  measured_at: string;
  moisture_pct: number;
  temp_c: number;
  rain_mm: number;
  source: string;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function PlotDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { role, canCommand, canEditThreshold, canSubmitManual, isAdvisor } = useUserRole();

  const [plot, setPlot] = useState<PlotDetail | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [valves, setValves] = useState<Valve[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Manual form inputs
  const [moistureInput, setMoistureInput] = useState('');
  const [tempInput, setTempInput] = useState('');
  const [submittingReading, setSubmittingReading] = useState(false);

  // Threshold form inputs (RF-11)
  const [isEditingThresholds, setIsEditingThresholds] = useState(false);
  const [thresholdMinInput, setThresholdMinInput] = useState('');
  const [thresholdMaxInput, setThresholdMaxInput] = useState('');
  const [savingThresholds, setSavingThresholds] = useState(false);

  const fetchPlotData = async () => {
    try {
      await syncQueue(supabase);
      const { data: pData } = await supabase.from('plots').select('*').eq('id', id).single();
      const { data: sData } = await supabase.from('stations').select('*').eq('plot_id', id);
      const { data: vData } = await supabase.from('valves').select('*').eq('plot_id', id);

      if (pData) {
        setPlot(pData);
        setThresholdMinInput(String(pData.threshold_min ?? 25));
        setThresholdMaxInput(String(pData.threshold_max ?? 45));
      }
      if (sData) setStations(sData);
      if (vData) setValves(vData);

      if (sData && sData.length > 0) {
        const stationIds = sData.map((s) => s.id);
        const { data: rData } = await supabase
          .from('readings')
          .select('*')
          .in('station_id', stationIds)
          .order('measured_at', { ascending: false })
          .limit(10);
        if (rData) setReadings(rData);
      }
    } catch (err) {
      console.error('Error fetching plot details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlotData();

    // Subscribe to realtime updates for readings and valves
    const readingSub = supabase
      .channel(`plot-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'readings' }, () => {
        fetchPlotData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'valves' }, () => {
        fetchPlotData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(readingSub);
    };
  }, [id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlotData();
  }, [id]);

  const handleSaveThresholds = async () => {
    if (!canEditThreshold) {
      Alert.alert('Acceso Denegado (403)', 'Solo el Productor puede modificar los umbrales agronómicos del lote.');
      return;
    }

    const minVal = parseFloat(thresholdMinInput);
    const maxVal = parseFloat(thresholdMaxInput);

    if (isNaN(minVal) || isNaN(maxVal) || minVal < 0 || maxVal > 100 || minVal >= maxVal) {
      Alert.alert('Validación', 'Ingresá valores válidos donde el mínimo sea menor al máximo (0 a 100%).');
      return;
    }

    setSavingThresholds(true);
    try {
      const { data, error } = await supabase
        .from('plots')
        .update({ threshold_min: minVal, threshold_max: maxVal })
        .eq('id', id)
        .select();

      if (error || !data || data.length === 0) {
        Alert.alert('Error', 'No se pudieron actualizar los umbrales en la base de datos.');
      } else {
        setPlot((prev) => (prev ? { ...prev, threshold_min: minVal, threshold_max: maxVal } : null));
        setIsEditingThresholds(false);
        Alert.alert('Umbrales Actualizados', `Nuevo rango óptimo: ${minVal}% - ${maxVal}%.`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingThresholds(false);
    }
  };

  const toggleValve = async (valve: Valve) => {
    // 1. Client-side RBAC check (H2: Asesor rejection)
    if (!canCommand) {
      Alert.alert(
        'Acceso Denegado (403)',
        'Tu perfil de Asesor es de solo lectura. No estás autorizado para abrir ni cerrar válvulas de riego (RF-14 / H2).'
      );
      return;
    }

    const nextStatus = valve.status === 'open' ? 'closed' : 'open';
    try {
      // 2. Direct valve status update protected by PostgreSQL RLS
      const { data, error } = await supabase
        .from('valves')
        .update({ status: nextStatus })
        .eq('id', valve.id)
        .select();

      // In PostgREST, an RLS policy refusal returns 0 updated rows (data === [])
      if (error || !data || data.length === 0) {
        Alert.alert(
          'Acceso Denegado (403 / RLS)',
          'La base de datos rechazó la modificación por políticas de seguridad (Row Level Security).'
        );
        return;
      }

      // 3. Register command for audit / history
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        const commandAction = nextStatus === 'open' ? 'open' : 'close';
        const { error: cmdError } = await supabase.from('irrigation_commands').insert({
          valve_id: valve.id,
          requested_by: userData.user.id,
          action: commandAction,
          status: 'applied',
          client_request_id: generateUUID(),
          applied_at: new Date().toISOString(),
        });
        if (cmdError) {
          console.warn('Error al asentar comando en tabla de auditoría:', cmdError.message);
        }
      }

      setValves((prev) =>
        prev.map((v) => (v.id === valve.id ? { ...v, status: nextStatus } : v))
      );
      Alert.alert(
        'Válvula Actualizada',
        `Estado: ${nextStatus === 'open' ? 'ABIERTA (Regando)' : 'CERRADA'}`
      );
    } catch (err: any) {
      Alert.alert('Error de conexión', err.message);
    }
  };

  const handleManualReading = async () => {
    // Client-side role validation
    if (!canSubmitManual) {
      Alert.alert(
        'Acceso Denegado (403)',
        'El perfil Asesor solo tiene permisos de lectura y no puede cargar mediciones manuales.'
      );
      return;
    }

    const rawMoisture = parseFloat(moistureInput);
    const temp = parseFloat(tempInput);

    if (isNaN(rawMoisture) || isNaN(temp)) {
      Alert.alert('Validación', 'Por favor ingresá valores numéricos válidos.');
      return;
    }

    if (!stations.length) {
      Alert.alert('Aviso', 'Este lote no tiene estaciones asignadas.');
      return;
    }

    setSubmittingReading(true);
    const stationId = stations[0].id;
    const clientRequestId = generateUUID();
    const moisture = Math.round(rawMoisture);

    const payload = {
      station_id: stationId,
      moisture_pct: moisture,
      temp_c: temp,
      rain_mm: 0,
      source: 'manual',
      client_request_id: clientRequestId,
    };

    try {
      const { data, error } = await supabase.from('readings').insert(payload).select();
      if (error) {
        if (error.code === '23505') {
          Alert.alert('Idempotencia', 'Esta medición ya había sido registrada.');
          setMoistureInput('');
          setTempInput('');
          fetchPlotData();
          return;
        }

        if (error.code === '42501') {
          Alert.alert('Acceso Denegado (403)', 'No tenés permisos para registrar lecturas manuales.');
          return;
        }

        await enqueue({
          client_request_id: clientRequestId,
          type: 'reading',
          payload,
          timestamp: new Date().toISOString(),
        });
        Alert.alert('Guardado Offline', 'Sin conexión inmediata. Se guardó en la cola local para reintentar.');
      } else {
        Alert.alert('Éxito', `Medición manual registrada: ${moisture}% humedad, ${temp}°C.`);
        setMoistureInput('');
        setTempInput('');
        fetchPlotData();
      }
    } catch (err) {
      await enqueue({
        client_request_id: clientRequestId,
        type: 'reading',
        payload,
        timestamp: new Date().toISOString(),
      });
      Alert.alert('Guardado Offline', 'Se guardó en la cola local para sincronización.');
    } finally {
      setSubmittingReading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Cargando datos del lote...</Text>
      </View>
    );
  }

  const latestReading = readings[0];
  const currentStatus: PlotStatus = latestReading
    ? getPlotStatus(
        latestReading.moisture_pct,
        latestReading.measured_at,
        plot?.threshold_min ?? 25,
        plot?.threshold_max ?? 45
      )
    : 'stale';

  const roleLabel =
    role === 'producer'
      ? 'Productor (Control Total)'
      : role === 'operator'
      ? 'Operador (Comandos)'
      : 'Asesor (Solo Lectura)';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Role Banner */}
      <View style={[styles.roleBanner, isAdvisor ? styles.roleBannerAdvisor : styles.roleBannerAdmin]}>
        <Text style={styles.roleBannerText}>
          {isAdvisor ? '👁️ Perfil activo: ' : '🔑 Perfil activo: '}
          <Text style={{ fontWeight: '700' }}>{roleLabel}</Text>
        </Text>
      </View>

      {/* Header Info */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{plot?.name || 'Lote'}</Text>
          <View
            style={[
              styles.statusBadge,
              currentStatus === 'optimal'
                ? styles.badgeOptimal
                : currentStatus === 'dry'
                ? styles.badgeDry
                : currentStatus === 'wet'
                ? styles.badgeWet
                : styles.badgeStale,
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {currentStatus === 'optimal'
                ? 'Óptimo'
                : currentStatus === 'dry'
                ? 'Seco'
                : currentStatus === 'wet'
                ? 'Exceso'
                : 'Sin datos'}
            </Text>
          </View>
        </View>
        <Text style={styles.cropText}>Cultivo: {plot?.crop}</Text>

        {/* Umbrales agronómicos y edición (RF-11) */}
        <View style={styles.thresholdContainer}>
          <View style={styles.rowBetween}>
            <Text style={styles.thresholdText}>
              Umbrales: {plot?.threshold_min}% mín. — {plot?.threshold_max}% máx.
            </Text>
            {canEditThreshold && !isEditingThresholds && (
              <TouchableOpacity
                onPress={() => setIsEditingThresholds(true)}
                style={styles.editThresholdBtn}
              >
                <Text style={styles.editThresholdBtnText}>✏️ Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          {!canEditThreshold && (
            <Text style={styles.thresholdNote}>
              🔒 Umbrales configurables únicamente por el Productor.
            </Text>
          )}

          {isEditingThresholds && (
            <View style={styles.editThresholdBox}>
              <Text style={styles.editThresholdTitle}>Configurar Umbrales de Humedad (RF-11)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Mínimo %"
                  keyboardType="numeric"
                  value={thresholdMinInput}
                  onChangeText={setThresholdMinInput}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Máximo %"
                  keyboardType="numeric"
                  value={thresholdMaxInput}
                  onChangeText={setThresholdMaxInput}
                />
              </View>
              <View style={styles.rowEnd}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsEditingThresholds(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveThresholds}
                  disabled={savingThresholds}
                >
                  {savingThresholds ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Actuadores / Válvulas */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Válvulas de Riego (Actuadores)</Text>
          {isAdvisor && (
            <View style={styles.readOnlyBadge}>
              <Text style={styles.readOnlyBadgeText}>Solo Lectura</Text>
            </View>
          )}
        </View>

        {isAdvisor && (
          <Text style={styles.advisorWarning}>
            ⚠️ Por política de perfil (H2), los asesores tienen deshabilitado el accionamiento de válvulas.
          </Text>
        )}

        {valves.length === 0 ? (
          <Text style={styles.emptySubtext}>No hay válvulas asignadas a este lote.</Text>
        ) : (
          valves.map((valve) => {
            const isOpen = valve.status === 'open';
            return (
              <View key={valve.id} style={styles.valveRow}>
                <View>
                  <Text style={styles.valveName}>{valve.name}</Text>
                  <Text style={[styles.valveStatus, isOpen ? styles.statusOpen : styles.statusClosed]}>
                    Estado: {isOpen ? 'ABIERTA (Regando)' : 'CERRADA'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.valveButton,
                    !canCommand
                      ? styles.btnValveDisabled
                      : isOpen
                      ? styles.btnValveClose
                      : styles.btnValveOpen,
                  ]}
                  onPress={() => toggleValve(valve)}
                  activeOpacity={canCommand ? 0.8 : 0.6}
                >
                  <Text
                    style={[
                      styles.btnValveText,
                      !canCommand && styles.btnValveDisabledText,
                    ]}
                  >
                    {!canCommand
                      ? '🔒 Solo Lectura'
                      : isOpen
                      ? 'Cerrar Riego'
                      : 'Abrir Riego'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      {/* Carga Manual de Telemetría */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Registro Manual de Telemetría</Text>
        <Text style={styles.inputHelp}>
          Permite ingresar mediciones a campo con soporte offline e idempotencia.
        </Text>

        {isAdvisor ? (
          <View style={styles.advisorNoticeCard}>
            <Text style={styles.advisorNoticeText}>
              ℹ️ Carga deshabilitada para el perfil Asesor. Solo disponible para Productor y Operador.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Humedad % (ej: 28.5)"
                keyboardType="numeric"
                value={moistureInput}
                onChangeText={setMoistureInput}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Temp °C (ej: 24)"
                keyboardType="numeric"
                value={tempInput}
                onChangeText={setTempInput}
              />
            </View>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleManualReading}
              disabled={submittingReading}
            >
              {submittingReading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Enviar Medición</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Historial de Lecturas */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Últimas Mediciones</Text>
        {readings.length === 0 ? (
          <Text style={styles.emptySubtext}>Aún no hay mediciones registradas.</Text>
        ) : (
          readings.map((r) => (
            <View key={r.id} style={styles.readingRow}>
              <View>
                <Text style={styles.readingValue}>
                  💧 {Number(r.moisture_pct).toFixed(1)}% | 🌡️ {Number(r.temp_c).toFixed(1)}°C
                </Text>
                <Text style={styles.readingSource}>
                  Fuente: {r.source === 'sensor' ? 'Sensor IoT' : 'Manual'}
                </Text>
              </View>
              <Text style={styles.readingTime}>
                {new Date(r.measured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#6B7280' },
  roleBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  roleBannerAdmin: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  roleBannerAdvisor: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  roleBannerText: {
    fontSize: 13,
    color: '#1F2937',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  cropText: { fontSize: 15, color: '#4B5563', marginTop: 4 },
  thresholdContainer: { marginTop: 8 },
  thresholdText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  thresholdNote: { fontSize: 11, color: '#9CA3AF', marginTop: 3, fontStyle: 'italic' },
  editThresholdBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  editThresholdBtnText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  editThresholdBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editThresholdTitle: { fontSize: 13, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: '#E5E7EB' },
  cancelBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: '#10B981' },
  saveBtnText: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeOptimal: { backgroundColor: '#D1FAE5' },
  badgeDry: { backgroundColor: '#FEE2E2' },
  badgeWet: { backgroundColor: '#DBEAFE' },
  badgeStale: { backgroundColor: '#F3F4F6' },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#1F2937' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  readOnlyBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  readOnlyBadgeText: { fontSize: 11, color: '#92400E', fontWeight: '700' },
  advisorWarning: { fontSize: 12, color: '#B45309', marginBottom: 8, fontStyle: 'italic' },
  emptySubtext: { fontSize: 14, color: '#9CA3AF' },
  valveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  valveName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  valveStatus: { fontSize: 13, marginTop: 2 },
  statusOpen: { color: '#059669', fontWeight: '600' },
  statusClosed: { color: '#DC2626', fontWeight: '600' },
  valveButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnValveOpen: { backgroundColor: '#10B981' },
  btnValveClose: { backgroundColor: '#EF4444' },
  btnValveDisabled: { backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB' },
  btnValveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  btnValveDisabledText: { color: '#6B7280' },
  inputHelp: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  advisorNoticeCard: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  advisorNoticeText: { fontSize: 13, color: '#92400E' },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  readingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  readingValue: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  readingSource: { fontSize: 12, color: '#9CA3AF' },
  readingTime: { fontSize: 13, color: '#6B7280' },
});
