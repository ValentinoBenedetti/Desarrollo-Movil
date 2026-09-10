import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email ?? 'Usuario');
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const simulateResetPassword = () => {
    router.push('/(auth)/new-password');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hola,</Text>
            <Text style={styles.emailText}>{email}</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#FFF" />
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Balance Total</Text>
          <Text style={styles.cardBalance}>$ 45,230.00</Text>
          <Text style={styles.cardNumber}>**** **** **** 1234</Text>
        </View>

        {/* Acciones para el TP */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Acciones del TP</Text>

          <TouchableOpacity style={styles.actionItem} onPress={simulateResetPassword}>
            <View style={[styles.iconBox, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="key-outline" size={24} color="#4D38F5" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Simular Recuperación</Text>
              <Text style={styles.actionDesc}>Ir a la pantalla de nueva contraseña</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleSignOut}>
            <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Cerrar Sesión</Text>
              <Text style={styles.actionDesc}>Salir de la cuenta actual</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>
        </View>

        {/* Movimientos Ficticios */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Movimientos recientes</Text>
          <View style={styles.transaction}>
            <View style={styles.transactionLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#E5E7EB' }]}>
                <Ionicons name="cart-outline" size={20} color="#374151" />
              </View>
              <View>
                <Text style={styles.txTitle}>Supermercado</Text>
                <Text style={styles.txDate}>Hoy, 14:32</Text>
              </View>
            </View>
            <Text style={styles.txAmount}>-$ 8,450.00</Text>
          </View>
          <View style={styles.transaction}>
            <View style={styles.transactionLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="arrow-down-outline" size={20} color="#16A34A" />
              </View>
              <View>
                <Text style={styles.txTitle}>Transferencia recibida</Text>
                <Text style={styles.txDate}>Ayer, 09:15</Text>
              </View>
            </View>
            <Text style={[styles.txAmount, { color: '#16A34A' }]}>+$ 12,000.00</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7F9',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Poppins_400Regular',
  },
  emailText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'Poppins_600SemiBold',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4D38F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#4D38F5',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#4D38F5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  cardTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 8,
  },
  cardBalance: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'Poppins_700Bold',
    marginBottom: 24,
  },
  cardNumber: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    letterSpacing: 2,
  },
  actionsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Poppins_500Medium',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Poppins_400Regular',
  },
  transactionsSection: {
    marginBottom: 20,
  },
  transaction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    fontFamily: 'Poppins_500Medium',
  },
  txDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontFamily: 'Poppins_400Regular',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'Poppins_600SemiBold',
  },
});
