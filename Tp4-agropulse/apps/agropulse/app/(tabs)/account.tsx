import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { supabase } from '../../src/utils/supabase';
import { useUserRole } from '../../src/utils/useUserRole';

export default function AccountScreen() {
  const { email, role, organizationName, canCommand, canEditThreshold, canSubmitManual, isAdvisor } =
    useUserRole();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
    }
  };

  const roleTitle =
    role === 'producer'
      ? 'Productor (Dueño)'
      : role === 'operator'
      ? 'Operador de Riego'
      : role === 'advisor'
      ? 'Asesor Agrónomo'
      : 'Cargando...';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{email ? email.charAt(0).toUpperCase() : 'U'}</Text>
        </View>
        <Text style={styles.emailText}>{email || 'Cargando...'}</Text>
        <View style={[styles.badge, isAdvisor ? styles.badgeAdvisor : styles.badgeAdmin]}>
          <Text style={[styles.badgeText, isAdvisor ? styles.badgeTextAdvisor : styles.badgeTextAdmin]}>
            Rol: {roleTitle}
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Organización</Text>
        <Text style={styles.orgName}>{organizationName || 'Estancia Didáctica Concordia'}</Text>
        <Text style={styles.subtext}>Región: Entre Ríos, Argentina</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Permisos del Perfil (Matriz PRD §05 / RLS §09)</Text>
        <View style={styles.permissionRow}>
          <Text style={styles.permIcon}>{canCommand ? '✅' : '❌'}</Text>
          <Text style={styles.permText}>Comandar válvulas de riego</Text>
        </View>
        <View style={styles.permissionRow}>
          <Text style={styles.permIcon}>{canEditThreshold ? '✅' : '❌'}</Text>
          <Text style={styles.permText}>Configurar umbrales de lote</Text>
        </View>
        <View style={styles.permissionRow}>
          <Text style={styles.permIcon}>{canSubmitManual ? '✅' : '❌'}</Text>
          <Text style={styles.permText}>Registrar mediciones manuales</Text>
        </View>
        <View style={styles.permissionRow}>
          <Text style={styles.permIcon}>✅</Text>
          <Text style={styles.permText}>Consultar mapa, lecturas y gráficos (Todos)</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>

      <Text style={styles.footerNote}>AgroPulse • Seguridad con PostgreSQL RLS</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  contentContainer: { padding: 20 },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, color: '#FFFFFF', fontWeight: 'bold' },
  emailText: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  badgeAdmin: { backgroundColor: '#ECFDF5' },
  badgeAdvisor: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  badgeTextAdmin: { color: '#059669' },
  badgeTextAdvisor: { color: '#92400E' },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  orgName: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  subtext: { fontSize: 14, color: '#4B5563', marginTop: 4 },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  permIcon: { fontSize: 14, marginRight: 10 },
  permText: { fontSize: 14, color: '#374151' },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 16,
  },
  logoutText: { color: '#DC2626', fontSize: 16, fontWeight: '700' },
  footerNote: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 8 },
});
