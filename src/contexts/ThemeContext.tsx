import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type Theme = 'amber' | 'dark' | 'blue' | 'green' | 'fashion';

export interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Definición de colores para cada tema
const themeColors = {
  amber: {
    primary: '#f59e0b',        // amber-500
    primaryHover: '#d97706',   // amber-600
    primaryLight: '#fef3c7',   // amber-100
    primaryDark: '#b45309',    // amber-700
    secondary: '#f97316',      // orange-500
    secondaryHover: '#ea580c', // orange-600
    accent: '#fb923c',         // orange-400
  },
  dark: {
    primary: '#4b5563',        // gray-600
    primaryHover: '#374151',   // gray-700
    primaryLight: '#f3f4f6',   // gray-100
    primaryDark: '#1f2937',    // gray-800
    secondary: '#6b7280',      // gray-500
    secondaryHover: '#4b5563', // gray-600
    accent: '#9ca3af',         // gray-400
  },
  blue: {
    primary: '#3b82f6',        // blue-500
    primaryHover: '#2563eb',   // blue-600
    primaryLight: '#dbeafe',   // blue-100
    primaryDark: '#1e40af',    // blue-700
    secondary: '#0ea5e9',      // sky-500
    secondaryHover: '#0284c7', // sky-600
    accent: '#38bdf8',         // sky-400
  },
  green: {
    primary: '#10b981',        // emerald-500
    primaryHover: '#059669',   // emerald-600
    primaryLight: '#d1fae5',   // emerald-100
    primaryDark: '#047857',    // emerald-700
    secondary: '#14b8a6',      // teal-500
    secondaryHover: '#0d9488', // teal-600
    accent: '#2dd4bf',         // teal-400
  },
  fashion: {
    primary: '#f9a8d4',        // pink-300 (pastel suave)
    primaryHover: '#f472b6',   // pink-400
    primaryLight: '#fce7f3',   // pink-100
    primaryDark: '#ec4899',    // pink-500
    secondary: '#d8b4fe',      // purple-300 (lavanda suave)
    secondaryHover: '#c084fc', // purple-400
    accent: '#e9d5ff',         // purple-200
  },
};

// Aplicar tema al documento
const applyTheme = (theme: Theme) => {
  const colors = themeColors[theme];
  const root = document.documentElement;

  // Aplicar variables CSS
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-primary-hover', colors.primaryHover);
  root.style.setProperty('--color-primary-light', colors.primaryLight);
  root.style.setProperty('--color-primary-dark', colors.primaryDark);
  root.style.setProperty('--color-secondary', colors.secondary);
  root.style.setProperty('--color-secondary-hover', colors.secondaryHover);
  root.style.setProperty('--color-accent', colors.accent);

  // Guardar el tema en el atributo data-theme
  root.setAttribute('data-theme', theme);

  console.log(`🎨 [THEME] Applied theme: ${theme}`);
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>('fashion');
  const [isLoading, setIsLoading] = useState(true);

  // Cargar tema desde la base de datos al iniciar
  useEffect(() => {
    const loadThemeFromDB = async () => {
      try {

        const { data, error } = await supabase
          .from('company_settings')
          .select('id, theme')
          .single();

        console.log('📦 [THEME] Database response:', { data, error });

        if (error) {
          console.error('❌ [THEME] Error loading theme from DB:', error);
          console.log('📝 [THEME] Error code:', error.code);
          console.log('📝 [THEME] Error message:', error.message);

          // Si hay error, intentar crear un registro con tema por defecto
          console.log('🔨 [THEME] Attempting to create default company_settings...');
          const { data: insertData, error: insertError } = await supabase
            .from('company_settings')
            .insert({
              company_name: 'LIN-Fashion',
              theme: 'fashion',
              language: 'es'
            })
            .select()
            .single();

          if (insertError) {
            console.error('❌ [THEME] Error creating default settings:', insertError);
            setCurrentTheme('fashion');
            applyTheme('fashion');
            console.log('⚠️ [THEME] Using default theme: fashion (without DB)');
          } else {
            console.log('✅ [THEME] Created default settings:', insertData);
            setCurrentTheme('fashion');
            applyTheme('fashion');
          }
        } else if (data && data.theme) {
          console.log(`✅ [THEME] Loaded theme from DB: ${data.theme}`);
          setCurrentTheme(data.theme as Theme);
          applyTheme(data.theme as Theme);
        } else {
          // Si no hay tema configurado, actualizar con fashion por defecto
          console.log('⚠️ [THEME] No theme configured in DB');
          console.log('🔨 [THEME] Updating to default theme: fashion');

          const { error: updateError } = await supabase
            .from('company_settings')
            .update({ theme: 'fashion' })
            .eq('id', data.id);

          if (updateError) {
            console.error('❌ [THEME] Error updating theme:', updateError);
          } else {
            console.log('✅ [THEME] Theme updated to fashion in DB');
          }

          setCurrentTheme('fashion');
          applyTheme('fashion');
        }
      } catch (error) {
        console.error('💥 [THEME] Unexpected error loading theme:', error);
        setCurrentTheme('fashion');
        applyTheme('fashion');
      } finally {
        setIsLoading(false);
      }
    };

    loadThemeFromDB();

    // Suscribirse a cambios en tiempo real en company_settings
    console.log('📡 [THEME] Setting up Realtime subscription...');
    const channel = supabase
      .channel('company-settings-theme')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'company_settings'
        },
        (payload) => {
          console.log('🔔 [THEME] Realtime change detected!', payload);
          if (payload.new && (payload.new as any).theme) {
            const newTheme = (payload.new as any).theme as Theme;
            console.log(`🎨 [THEME] Updating theme to: ${newTheme} (from Realtime)`);
            setCurrentTheme(newTheme);
            applyTheme(newTheme);
            console.log(`✅ [THEME] Theme updated successfully to: ${newTheme}`);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 [THEME] Realtime subscription status: ${status}`);
      });

    return () => {
      console.log('🔌 [THEME] Disconnecting Realtime subscription...');
      supabase.removeChannel(channel);
    };
  }, []);

  const setTheme = async (theme: Theme) => {
    try {
      console.log(`🎨 [THEME] Attempting to change theme to: ${theme}`);

      // Primero obtener el ID de company_settings
      const { data: settingsData, error: fetchError } = await supabase
        .from('company_settings')
        .select('id')
        .single();

      if (fetchError) {
        console.error('❌ [THEME] Error fetching company_settings ID:', fetchError);
        throw fetchError;
      }

      if (!settingsData) {
        console.error('❌ [THEME] No company_settings record found');
        throw new Error('No company_settings record found');
      }

      console.log(`📝 [THEME] Updating company_settings (ID: ${settingsData.id}) to theme: ${theme}`);

      // Actualizar en la base de datos (esto notificará a todos los clientes conectados)
      const { error: updateError } = await supabase
        .from('company_settings')
        .update({ theme: theme })
        .eq('id', settingsData.id);

      if (updateError) {
        console.error('❌ [THEME] Error updating theme in DB:', updateError);
        throw updateError;
      }

      console.log(`✅ [THEME] Theme updated to ${theme} in database`);

      // Actualizar inmediatamente en el cliente
      setCurrentTheme(theme);
      applyTheme(theme);

      console.log(`✅ [THEME] Theme updated to ${theme} in local state`);
    } catch (error) {
      console.error('💥 [THEME] Error setting theme:', error);
      // Revertir el cambio cargando desde la base de datos
      const { data } = await supabase.from('company_settings').select('theme').single();
      if (data && data.theme) {
        setCurrentTheme(data.theme as Theme);
        applyTheme(data.theme as Theme);
      }
      throw error; // Re-lanzar el error para que AppSettings pueda manejarlo
    }
  };

  // Mostrar un loader mientras se carga el tema
  if (isLoading) {
    return null; // o un spinner si prefieres
  }

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
