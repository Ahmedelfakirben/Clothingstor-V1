import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';

interface EmployeeProfile {
  id: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'cashier' | 'barista' | 'waiter';
  phone: string | null;
  active: boolean;
  is_online?: boolean;
  last_login?: string;
  last_logout?: string;
}

interface AuthContextType {
  user: User | null;
  profile: EmployeeProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setOnlineStatus: (isOnline: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
        setLoading(false);
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('employee_profiles')
      .select('id, full_name, role, phone, active, email, deleted_at, is_online')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    // Bloquear acceso si usuario está inactivo o eliminado
    if (data && (!data.active || data.deleted_at)) {
      await supabase.auth.signOut();
      setProfile(null);
      toast.error('Tu cuenta está desactivada o eliminada');
      return;
    }

    // Marcar al usuario como conectado
    if (data) {
      const { error: updateError } = await supabase
        .from('employee_profiles')
        .update({
          is_online: true,
          last_login: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating online status:', updateError);
      } else {

      }
    }

    setProfile(data);
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Wait for profile to be fetched and then redirect admin to analytics
    if (data.user) {
      // Small delay to ensure profile is loaded
      setTimeout(async () => {
        const { data: profileData } = await supabase
          .from('employee_profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileData?.role === 'admin' || profileData?.role === 'super_admin') {
          // Force redirect to analytics for admin and super_admin users
          window.location.hash = '#/analytics';
        }
      }, 100);
    }
  };

  const signOut = async () => {
    // Marcar al usuario como desconectado antes de hacer logout
    if (user) {
      const { error: updateError } = await supabase
        .from('employee_profiles')
        .update({
          is_online: false,
          last_logout: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating offline status:', updateError);
      } else {
        console.log('✅ Usuario marcado como desconectado');
      }
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  const setOnlineStatus = async (isOnline: boolean) => {
    if (!user) return;

    const updateData: any = {
      is_online: isOnline
    };

    // Actualizar timestamp apropiado
    if (isOnline) {
      updateData.last_login = new Date().toISOString();
    } else {
      updateData.last_logout = new Date().toISOString();
    }

    const { error } = await supabase
      .from('employee_profiles')
      .update(updateData)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating online status:', error);
      throw error;
    }

    // Actualizar el perfil local
    if (profile) {
      setProfile({ ...profile, is_online: isOnline });
    }

    console.log(`✅ Estado actualizado manualmente: ${isOnline ? 'Conectado' : 'Desconectado'}`);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, setOnlineStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
