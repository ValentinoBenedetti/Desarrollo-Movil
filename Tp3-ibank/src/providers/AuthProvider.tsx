import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

// Definimos la forma de nuestro contexto
type AuthContextType = {
  session: Session | null | undefined; // undefined significa "cargando inicial"
  event: string | null;
};

// Creamos el contexto con valor por defecto
const AuthContext = createContext<AuthContextType>({ session: undefined, event: null });

// Hook custom para consumir el contexto de autenticación más fácil
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Guardamos la sesión en el estado de React
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [event, setEvent] = useState<string | null>(null);

  useEffect(() => {
    // 1. Obtenemos la sesión inicial al cargar la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 2. Nos suscribimos a cualquier cambio (login, logout, refresh de token, recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (authEvent, session) => {
        setSession(session);
        setEvent(authEvent);
      }
    );

    // Limpiamos la suscripción cuando se desmonta el provider (buenas prácticas)
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, event }}>
      {children}
    </AuthContext.Provider>
  );
}
