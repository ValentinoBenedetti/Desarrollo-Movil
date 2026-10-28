import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DatabaseService } from '../../services/database/databaseService';
import { ExportService } from '../../services/export/exportService';
import { useNetworkStore } from '../../core/store/useNetworkStore';
import { theme } from '../theme';

export const ExportScreen: React.FC = () => {
  const backendUrl = useNetworkStore((state) => state.backendUrl);
  const setBackendUrl = useNetworkStore((state) => state.setBackendUrl);
  const pingHost = useNetworkStore((state) => state.pingHost);
  const setPingHost = useNetworkStore((state) => state.setPingHost);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      await ExportService.shareExport(format);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al exportar';
      Alert.alert('Exportación Cancelada', message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearDb = () => {
    Alert.alert(
      'Confirmar Eliminación',
      '¿Estás seguro de que deseas borrar todo el historial de mediciones?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar Todo',
          style: 'destructive',
          onPress: async () => {
            await DatabaseService.clearAll();
            Alert.alert('Base de Datos Limpia', 'Se eliminaron todos los registros históricos.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Sección Exportación */}
      <Text style={styles.sectionTitle}>Exportación de Datos (RF-08)</Text>
      <View style={styles.card}>
        <Text style={styles.description}>
          Exporta todas las mediciones de latencia, jitter, throughput y georreferenciación en formatos estándar para análisis en Excel, R o GIS.
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.exportBtn, styles.csvBtn]}
            onPress={() => handleExport('csv')}
            disabled={isExporting}
          >
            <Text style={styles.exportBtnText}>Exportar CSV (RFC 4180)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtn, styles.jsonBtn]}
            onPress={() => handleExport('json')}
            disabled={isExporting}
          >
            <Text style={styles.exportBtnText}>Exportar JSON</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Configuración de Sondas y Servidores */}
      <Text style={styles.sectionTitle}>Configuración de Sondas</Text>
      <View style={styles.card}>
        <Text style={styles.inputLabel}>Backend QoS Throughput URL</Text>
        <TextInput
          style={styles.input}
          value={backendUrl}
          onChangeText={setBackendUrl}
          placeholder="http://10.0.2.2:3000"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
        />

        <Text style={styles.inputLabel}>Host por Defecto para Ping TCP</Text>
        <TextInput
          style={styles.input}
          value={pingHost}
          onChangeText={setPingHost}
          placeholder="8.8.8.8"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
        />
      </View>

      {/* Gestión de Base de Datos */}
      <Text style={styles.sectionTitle}>Mantenimiento de Base de Datos</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleClearDb}>
          <Text style={styles.dangerBtnText}>Vaciar Base de Datos SQLite</Text>
        </TouchableOpacity>
      </View>

      {/* Créditos académicos */}
      <View style={styles.academicFooter}>
        <Text style={styles.footerTitle}>01 Network QoS Monitor</Text>
        <Text style={styles.footerSubtitle}>
          Desarrollo de Aplicaciones Móviles 2026 • FCyT
        </Text>
        <Text style={styles.footerNote}>
          Telemetría: TelephonyManager (Android) / CoreTelephony (iOS) • Sondas TCP: RFC 2544 / RFC 3550
        </Text>
      </View>
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
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exportBtn: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  csvBtn: {
    backgroundColor: theme.colors.primary,
  },
  jsonBtn: {
    backgroundColor: theme.colors.accent,
  },
  exportBtnText: {
    color: '#04101E',
    fontSize: 13,
    fontWeight: '700',
  },
  inputLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: theme.spacing.sm,
    marginBottom: 4,
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.textPrimary,
    fontSize: 13,
  },
  dangerBtn: {
    backgroundColor: theme.colors.dangerMuted,
    borderColor: theme.colors.danger,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  academicFooter: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  footerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  footerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  footerNote: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
});
