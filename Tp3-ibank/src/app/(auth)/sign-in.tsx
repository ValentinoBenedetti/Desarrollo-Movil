import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../lib/supabase';
import { mapSupabaseError } from '../../../lib/supabase-errors';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { AuthContainer } from '../../../components/ui/AuthContainer';

const loginSchema = z.object({
  email: z.string().email('Formato de email inválido'),
  password: z.string().min(1, 'La contraseña no puede estar vacía'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function SignInScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isDirty },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  // Cooldown effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = async (data: LoginFormValues) => {
    if (cooldown > 0) return;
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    setLoading(false);

    if (error) {
      const mappedError = mapSupabaseError(error);
      
      // Regla de negocio: si no está confirmado, mandar a la pantalla de confirmación pendiente
      if (mappedError.includes('confirmar tu email')) {
        router.push({ pathname: '/(auth)/pending-confirmation', params: { email: data.email } });
      } 
      // Regla de negocio: Rate limit
      else if (mappedError.includes('Demasiados intentos')) {
        setCooldown(60);
        Alert.alert('Error', mappedError);
      } 
      // Regla de negocio: Anti-enumeración (ya manejado por mapSupabaseError)
      else {
        Alert.alert('Error', mappedError);
      }
    } else {
      // El AuthProvider va a atrapar la sesión y redirigirnos a /(tabs) automáticamente
    }
  };

  return (
    <AuthContainer
      title="Sign in"
      headerTitle="Welcome Back"
      headerSubtitle="Hello there, sign in to continue"
      showBackButton={false} // En Figma, SignIn tiene flecha atrás, pero es la inicial. Vamos a dejarla en false o true según gusto. Ponemos true por el Figma.
    >
      <View style={styles.centerIllustration}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed-outline" size={40} color="#FFFFFF" />
        </View>
        {/* Adornos visuales simplificados del Figma */}
        <View style={[styles.dot, { backgroundColor: '#FF4267', top: 10, right: 20 }]} />
        <View style={[styles.dot, { backgroundColor: '#FFB110', bottom: 10, left: 20 }]} />
      </View>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="Text input"
            autoCapitalize="none"
            keyboardType="email-address"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.email?.message}
            editable={!loading}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="Password"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.password?.message}
            editable={!loading}
          />
        )}
      />

      <View style={styles.forgotContainer}>
        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={styles.forgotText}>Forgot your password ?</Text>
        </TouchableOpacity>
      </View>

      <Button
        title={loading ? "Iniciando..." : cooldown > 0 ? `Esperá ${cooldown}s` : "Sign in"}
        onPress={handleSubmit(onSubmit)}
        loading={loading}
        disabled={!isValid || loading || cooldown > 0 || !isDirty}
        style={styles.submitBtn}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account?</Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
          <Text style={styles.linkText}> Sign Up</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#E6E5FF', // Azul clarito
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  forgotContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#898989',
  },
  submitBtn: {
    marginBottom: 32,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#898989',
  },
  linkText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#281C9D',
  },
});
