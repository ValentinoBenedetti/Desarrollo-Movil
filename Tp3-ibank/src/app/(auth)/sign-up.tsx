import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../lib/supabase';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { AuthContainer } from '../../../components/ui/AuthContainer';

const signUpSchema = z.object({
  name: z.string().min(2, 'Debe ingresar un nombre'),
  email: z.string().email('Formato de email inválido'),
  password: z.string()
    .min(8, 'Debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un símbolo'),
  confirmPassword: z.string(),
  terms: z.boolean().refine(val => val === true, {
    message: 'Debes aceptar los términos y condiciones',
  })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

const ChecklistItem = ({ met, text }: { met: boolean; text: string }) => (
  <View style={styles.checklistItem}>
    <Ionicons name={met ? "checkmark-circle" : "ellipse-outline"} size={16} color={met ? "#00C851" : "#999"} style={styles.checklistIcon} />
    <Text style={[styles.checklistText, met && styles.checklistTextMet]}>
      {text}
    </Text>
  </View>
);

export default function SignUpScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid, isDirty },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', terms: false },
  });

  const password = watch('password') || '';

  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const onSubmit = async (data: SignUpFormValues) => {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
        },
        // emailRedirectTo: Configurado en el entorno o vía Linking (requerido para reset, acá lo manda Supabase directo)
      }
    });

    setLoading(false);

    // Según el PDF, ya sea error de "User already exists" o éxito, navegamos a Confirmación pendiente (anti-enumeración).
    // Si hay otro tipo de error (ej: weak password o red), la UI debería atajarlo antes o mostrarlo, pero la regla general es ir a pendiente.
    // Vamos a ir directamente a pending-confirmation para cumplir la regla 6.2 (y no revelar si existe).
    router.push({ pathname: '/(auth)/pending-confirmation', params: { email: data.email } });
  };

  return (
    <AuthContainer
      title="Sign up"
      headerTitle="Welcome to us,"
      headerSubtitle="Hello there, create New account"
    >
      <View style={styles.centerIllustration}>
        <View style={styles.iconCircle}>
          <Ionicons name="phone-portrait-outline" size={40} color="#FFFFFF" />
        </View>
        <View style={[styles.dot, { backgroundColor: '#FF4267', top: 10, right: 20 }]} />
        <View style={[styles.dot, { backgroundColor: '#FFB110', bottom: 10, left: 20 }]} />
        <View style={[styles.dot, { backgroundColor: '#00C851', top: 30, left: 10, width: 8, height: 8 }]} />
        <View style={[styles.dot, { backgroundColor: '#1C9DFF', bottom: 30, right: 10, width: 8, height: 8 }]} />
      </View>

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="Name"
            autoCapitalize="words"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.name?.message}
            editable={!loading}
          />
        )}
      />

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="Email"
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
            placeholder="Confirm Password"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.confirmPassword?.message}
            editable={!loading}
          />
        )}
      />

      <Controller
        control={control}
        name="terms"
        render={({ field: { onChange, value } }) => (
          <TouchableOpacity 
            style={styles.checkboxContainer} 
            onPress={() => onChange(!value)}
            disabled={loading}
          >
            <View style={[styles.checkbox, value && styles.checkboxChecked]}>
              {value && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.termsText}>
              By creating an account your aggree to our <Text style={styles.termsHighlight}>Term and Condtions</Text>
            </Text>
          </TouchableOpacity>
        )}
      />

      <Button
        title={loading ? "Enviando..." : "Sign up"}
        onPress={handleSubmit(onSubmit)}
        loading={loading}
        disabled={!isValid || loading || !isDirty}
        style={styles.submitBtn}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Have an account?</Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={styles.linkText}> Sign In</Text>
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
    height: 140,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingRight: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#281C9D',
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#281C9D',
  },
  termsText: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#898989',
    lineHeight: 18,
  },
  termsHighlight: {
    color: '#281C9D',
    fontFamily: 'Poppins_600SemiBold',
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
