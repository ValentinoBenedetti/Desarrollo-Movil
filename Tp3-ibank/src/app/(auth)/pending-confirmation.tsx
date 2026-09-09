import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import { AuthContainer } from '../../../components/ui/AuthContainer';

export default function PendingConfirmationScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60); // Inicia con cooldown por default porque ya se le envió uno

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setLoading(true);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('rate limit')) {
        setCooldown(60);
      }
      Alert.alert('Error', 'No pudimos reenviar el correo. Intentá más tarde.');
    } else {
      setCooldown(60);
      Alert.alert('Enviado', 'Te volvimos a mandar el link de confirmación.');
    }
  };

  return (
    <AuthContainer
      title="Verify Email"
      headerTitle="Check your inbox"
      headerSubtitle="We sent a confirmation link to your email"
      showBackButton={true}
    >
      <View style={styles.centerIllustration}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-unread-outline" size={40} color="#FFFFFF" />
        </View>
        <View style={[styles.dot, { backgroundColor: '#FF4267', top: 10, right: 20 }]} />
        <View style={[styles.dot, { backgroundColor: '#FFB110', bottom: 10, left: 20 }]} />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Enviamos un correo a:
        </Text>
        <Text style={styles.emailText}>
          {email || 'tu correo'}
        </Text>
        <Text style={styles.instructionText}>
          Por favor, hacé click en el enlace que te mandamos para activar tu cuenta. Una vez confirmada, podés volver y la app iniciará sola, o podés Iniciar Sesión.
        </Text>
      </View>

      <Button
        title={loading ? "Enviando..." : cooldown > 0 ? `Reenviar email en ${cooldown}s` : "Reenviar email"}
        onPress={handleResend}
        loading={loading}
        disabled={cooldown > 0 || loading || !email}
        style={styles.submitBtn}
      />
    </AuthContainer>
  );
}

const styles = StyleSheet.create({
  centerIllustration: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    marginBottom: 24,
    position: 'relative',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6E5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  infoText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#898989',
    marginBottom: 4,
  },
  emailText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#281C9D',
    marginBottom: 16,
  },
  instructionText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#343434',
    textAlign: 'center',
    lineHeight: 22,
  },
  submitBtn: {
    marginBottom: 32,
  },
});
