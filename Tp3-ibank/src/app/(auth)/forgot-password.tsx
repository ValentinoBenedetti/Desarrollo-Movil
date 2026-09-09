import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as Linking from 'expo-linking';

import { supabase } from '../../../lib/supabase';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { AuthContainer } from '../../../components/ui/AuthContainer';

const forgotPasswordSchema = z.object({
  email: z.string().email('Formato de email inválido'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [successMsg, setSuccessMsg] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
    defaultValues: { email: '' },
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    if (cooldown > 0) return;
    setLoading(true);
    setSuccessMsg(false);

    // Creamos el deeplink que Supabase nos tiene que devolver por mail
    const redirectTo = Linking.createURL('new-password');

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo,
    });

    setLoading(false);

    // Si hay error de rate limit lo atajamos visualmente
    if (error && error.message.includes('rate limit')) {
      setCooldown(60);
      Alert.alert('Error', 'Demasiados intentos. Esperá 60 segundos.');
      return;
    }

    // Regla anti-enumeración de negocio estricta: Mostrar SIEMPRE éxito neutro exista o no la cuenta.
    setCooldown(60);
    setSuccessMsg(true);
  };

  return (
    <AuthContainer
      title="Forgot password"
      headerTitle=""
      headerSubtitle="" // En Figma la pantalla de Forgot Password no tiene título grande adentro, arranca directo con el input
      showBackButton={true}
    >
      <View style={{ marginTop: -20 }}>
        {successMsg ? (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>
              Si el email existe en nuestro sistema, vas a recibir instrucciones para cambiar tu contraseña.
            </Text>
          </View>
        ) : (
          <Text style={styles.instructionText}>
            Escribí el correo asociado a tu cuenta. Te vamos a enviar un enlace para cambiar tu contraseña.
          </Text>
        )}
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Type your email"
              placeholder="ejemplo@correo.com"
              autoCapitalize="none"
              keyboardType="email-address"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.email?.message}
              editable={!loading && !successMsg}
            />
          )}
        />

        <Button
          title={loading ? "Enviando..." : cooldown > 0 ? `Reenviar en ${cooldown}s` : "Send"}
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          disabled={!isValid || loading || cooldown > 0}
          style={styles.submitBtn}
        />
      </View>
    </AuthContainer>
  );
}

const styles = StyleSheet.create({
  instructionText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#343434',
    marginBottom: 24,
    lineHeight: 22,
  },
  successContainer: {
    backgroundColor: '#E6E5FF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  successText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: '#281C9D',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    marginTop: 8,
  },
  submitBtn: {
    marginTop: 16,
  },
});
