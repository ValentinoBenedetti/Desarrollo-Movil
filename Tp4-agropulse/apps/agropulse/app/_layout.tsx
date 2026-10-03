import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../src/utils/supabase';
import { Session } from '@supabase/supabase-js';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (!session) {
      router.replace('/login');
    } else {
      router.replace('/(tabs)');
    }
  }, [session, initialized]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="plot/[id]" options={{ headerShown: true, title: 'Detalle del Lote' }} />
    </Stack>
  );
}
