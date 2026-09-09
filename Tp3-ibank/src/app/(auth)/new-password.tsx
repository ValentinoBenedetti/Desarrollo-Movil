import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../lib/supabase';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { AuthContainer } from '../../../components/ui/AuthContainer';

const newPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un símbolo'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type NewPasswordFormValues = z.infer<typeof newPasswordSchema>;

const ChecklistItem = ({ met, text }: { met: boolean; text: string }) => (
  <View style={styles.checklistItem}>
    <Ionicons name={met ? "checkmark-circle" : "ellipse-outline"} size={16} color={met ? "#00C851" : "#999"} style={styles.checklistIcon} />
    <Text style={[styles.checklistText, met && styles.checklistTextMet]}>
      {text}
    </Text>
  </View>
);

export default function NewPasswordScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid, isDirty },
  } = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordSchema),
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = watch('password') || '';

  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const onSubmit = async (data: NewPasswordFormValues) => {
    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', 'No se pudo cambiar la contraseña. Es posible que el enlace haya expirado.');
    } else {
      // Éxito: Matamos la sesión temporal de recuperación para que no quede logueado por error
      await supabase.auth.signOut();
      
      Alert.alert(
        'Contraseña actualizada',
        'Cambiaste tu contraseña exitosamente. Ya podés iniciar sesión.',
        [
          { text: 'Ir al Login', onPress: () => router.replace('/(auth)/sign-in') }
        ]
      );
    }
  };

  return (
    <AuthContainer
      title="Change password"
      headerTitle=""
      headerSubtitle=""
      showBackButton={true}
    >
      <View style={styles.form}>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Type your new password"
              placeholder="********"
              secureTextEntry
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.password?.message && !Object.values(criteria).every(Boolean) ? "Revisá los requisitos" : undefined}
              editable={!loading}
            />
          )}
        />

        <View style={styles.checklistContainer}>
          <ChecklistItem met={criteria.length} text="Mínimo 8 caracteres" />
          <ChecklistItem met={criteria.uppercase} text="Al menos una mayúscula" />
          <ChecklistItem met={criteria.lowercase} text="Al menos una minúscula" />
          <ChecklistItem met={criteria.number} text="Al menos un número" />
          <ChecklistItem met={criteria.special} text="Al menos un símbolo" />
        </View>

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Confirm password"
              placeholder="********"
              secureTextEntry
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              error={errors.confirmPassword?.message}
              editable={!loading}
            />
          )}
        />

        <Button
          title={loading ? "Guardando..." : "Change password"}
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          disabled={!isValid || loading || !isDirty}
          style={styles.submitBtn}
        />
      </View>
    </AuthContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: -20,
  },
  checklistContainer: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    marginTop: -8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  checklistIcon: {
    marginRight: 8,
  },
  checklistText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#999',
  },
  checklistTextMet: {
    color: '#00C851',
  },
  submitBtn: {
    marginTop: 16,
    marginBottom: 32,
  },
});
