import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '../providers/AuthProvider';

SplashScreen.preventAutoHideAsync();

// Componente interno para tener acceso a los hooks de Router y Auth
function RootLayoutNav() {
  const { session, event } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Si la sesión es undefined, Supabase todavía está chequeando el token local, esperamos.
    if (session === undefined) return;

    // Verificamos si la ruta actual está dentro del grupo "(auth)"
    const inAuthGroup = segments[0] === '(auth)';

    if (session && inAuthGroup) {
      // Si el evento es recuperación de contraseña, dejamos que pase a new-password
      if (event === 'PASSWORD_RECOVERY') {
        if (segments[1] !== 'new-password') {
          router.replace('/(auth)/new-password');
        }
      } else {
        // Si el usuario tiene sesión abierta pero está en Login/Registro, lo mandamos al Home
        router.replace('/(tabs)');
      }
    } else if (!session && !inAuthGroup) {
      // Si NO hay sesión y está intentando entrar a cualquier lado que no sea Auth, lo mandamos al Login
      router.replace('/(auth)/sign-in');
    }
  }, [session, event, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
