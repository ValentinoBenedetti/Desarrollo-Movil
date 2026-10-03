import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

export type UserRole = 'producer' | 'operator' | 'advisor';

export interface UserRoleState {
  userId: string | null;
  email: string | null;
  role: UserRole | null;
  organizationId: string | null;
  organizationName: string | null;
  canCommand: boolean;
  canEditThreshold: boolean;
  canSubmitManual: boolean;
  isAdvisor: boolean;
  loading: boolean;
  refreshRole: () => Promise<void>;
}

export function useUserRole(): UserRoleState {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRole = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        setUserId(null);
        setEmail(null);
        setRole(null);
        setOrganizationId(null);
        setOrganizationName(null);
        setLoading(false);
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? null);

      const { data: member, error } = await supabase
        .from('memberships')
        .select('role, organization_id, organizations(name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && member) {
        setRole(member.role as UserRole);
        setOrganizationId(member.organization_id);
        setOrganizationName((member.organizations as any)?.name || 'Organización AgroPulse');
      }
    } catch (err) {
      console.warn('Error fetching user role:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRole();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [fetchRole]);

  const canCommand = role === 'producer' || role === 'operator';
  const canEditThreshold = role === 'producer';
  const canSubmitManual = role === 'producer' || role === 'operator';
  const isAdvisor = role === 'advisor';

  return {
    userId,
    email,
    role,
    organizationId,
    organizationName,
    canCommand,
    canEditThreshold,
    canSubmitManual,
    isAdvisor,
    loading,
    refreshRole: fetchRole,
  };
}
