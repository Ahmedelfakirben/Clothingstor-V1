import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { LoginForm } from './components/LoginForm';
import { Navigation } from './components/Navigation';
const POS = lazy(() => import('./components/POS').then(module => ({ default: module.POS })));
const OrdersDashboard = lazy(() => import('./components/OrdersDashboard').then(module => ({ default: module.OrdersDashboard })));
const ProductsManager = lazy(() => import('./components/ProductsManager').then(module => ({ default: module.ProductsManager })));
const CategoryManager = lazy(() => import('./components/CategoryManager').then(module => ({ default: module.CategoryManager })));
const UserManager = lazy(() => import('./components/UserManager').then(module => ({ default: module.UserManager })));
const SupplierManager = lazy(() => import('./components/SupplierManager').then(module => ({ default: module.SupplierManager })));
const ExpenseManager = lazy(() => import('./components/ExpenseManager').then(module => ({ default: module.ExpenseManager })));
const Analytics = lazy(() => import('./components/Analytics').then(module => ({ default: module.Analytics })));
const CashRegisterDashboard = lazy(() => import('./components/CashRegisterDashboard').then(module => ({ default: module.CashRegisterDashboard })));
const EmployeeTimeTracking = lazy(() => import('./components/EmployeeTimeTracking').then(module => ({ default: module.EmployeeTimeTracking })));
const RoleManagement = lazy(() => import('./components/RoleManagement').then(module => ({ default: module.RoleManagement })));
const CompanySettings = lazy(() => import('./components/CompanySettings').then(module => ({ default: module.CompanySettings })));
const AppSettings = lazy(() => import('./components/AppSettings').then(module => ({ default: module.AppSettings })));
const ServerManager = lazy(() => import('./components/ServerManager').then(module => ({ default: module.ServerManager })));
const BackupManager = lazy(() => import('./components/BackupManager').then(module => ({ default: module.BackupManager })));
const ClientsManager = lazy(() => import('./components/ClientsManager').then(module => ({ default: module.ClientsManager })));
const StockAnalytics = lazy(() => import('./components/StockAnalytics').then(module => ({ default: module.StockAnalytics })));
const OnlineStoreManager = lazy(() => import('./components/OnlineStoreManager').then(module => ({ default: module.OnlineStoreManager })));
import { NotificationListener } from './components/NotificationListener';
import { supabase } from './lib/supabase';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState('pos');
  const [userPermissions, setUserPermissions] = useState<{ [key: string]: boolean }>({});
  const hasRedirectedRef = useRef(false);

  // Sistema de control de versiones para forzar limpieza de caché en despliegue
  useEffect(() => {
    const APP_VERSION = '1.1.3'; // Incrementar esto para forzar recarga en clientes (Soft Delete Update)
    const savedVersion = localStorage.getItem('app_version');
    
    if (savedVersion !== APP_VERSION) {
      console.log(`Nueva versión detectada: ${APP_VERSION}. Limpiando caché...`);
      localStorage.setItem('app_version', APP_VERSION);
      
      // Si ya había una versión anterior, forzamos recarga dura
      if (savedVersion) {
        // Limpiar cachés del navegador si es posible
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
        window.location.reload();
      }
    }
  }, []);

  // Cargar permisos del usuario desde la base de datos
  useEffect(() => {
    const fetchUserPermissions = async () => {
      if (!profile?.role) return;

      try {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('page_id, can_access')
          .eq('role', profile.role)
          .eq('can_access', true);

        if (error) {
          console.error('Error fetching permissions:', error);
          return;
        }

        // Crear un mapa de permisos por page_id
        const permissionsMap: { [key: string]: boolean } = {};
        data?.forEach(perm => {
          permissionsMap[perm.page_id] = perm.can_access;
        });

        setUserPermissions(permissionsMap);
      } catch (err) {
        console.error('Error loading permissions:', err);
      }
    };

    fetchUserPermissions();

    // Suscribirse a cambios en permisos
    const channel = supabase
      .channel('app-role-permissions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'role_permissions',
          filter: `role=eq.${profile?.role}`
        },
        () => {
          fetchUserPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.role]);

  // Redirigir a página apropiada según el rol SOLO en el login inicial
  useEffect(() => {
    // Si no hay perfil, resetear el flag para el próximo login
    if (!profile) {
      hasRedirectedRef.current = false;
      return;
    }

    // Solo redirigir si NO se ha redirigido antes en esta sesión y la vista actual es la por defecto
    if (!hasRedirectedRef.current && currentView === 'pos') {
      let defaultView = 'pos'; // Default fallback

      // Determinar página por defecto según el rol
      switch (profile.role) {
        case 'cashier':
          defaultView = userPermissions['pos'] ? 'pos' :
            userPermissions['orders'] ? 'orders' :
              userPermissions['cash'] ? 'cash' : 'pos';
          break;
        case 'barista':
          defaultView = userPermissions['pos'] ? 'pos' :
            userPermissions['orders'] ? 'orders' : 'pos';
          break;
        case 'waiter':
          defaultView = userPermissions['orders'] ? 'orders' :
            userPermissions['pos'] ? 'pos' : 'orders';
          break;
        case 'admin':
        case 'super_admin':
          // Para admin y super_admin, mantener lógica existente pero más inteligente
          if (userPermissions['analytics']) {
            defaultView = 'analytics';
          } else if (userPermissions['pos']) {
            defaultView = 'pos';
          } else if (userPermissions['orders']) {
            defaultView = 'orders';
          } else if (userPermissions['products']) {
            defaultView = 'products';
          } else {
            // Encontrar la primera página disponible
            const availablePages = ['pos', 'orders', 'products', 'categories', 'users', 'suppliers', 'expenses', 'time-tracking', 'cash', 'analytics'];
            defaultView = availablePages.find(page => userPermissions[page]) || 'pos';
          }
          break;
        default:
          defaultView = 'pos';
      }

      setCurrentView(defaultView);
      hasRedirectedRef.current = true;
    }
  }, [profile, userPermissions, currentView]);





  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginForm />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Navigation currentView={currentView} onViewChange={setCurrentView} />
      <div className="flex-1 overflow-auto p-6">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          {currentView === 'pos' && userPermissions['pos'] && <POS />}
          {currentView === 'orders' && userPermissions['orders'] && <OrdersDashboard />}
          {currentView === 'products' && userPermissions['products'] && <ProductsManager />}
          {currentView === 'categories' && userPermissions['categories'] && <CategoryManager />}
          {currentView === 'users' && userPermissions['users'] && <UserManager />}
          {currentView === 'suppliers' && userPermissions['suppliers'] && <SupplierManager />}
          {currentView === 'expenses' && userPermissions['expenses'] && <ExpenseManager />}
          {currentView === 'time-tracking' && userPermissions['time-tracking'] && <EmployeeTimeTracking />}
          {currentView === 'analytics' && userPermissions['analytics'] && <Analytics />}
          {currentView === 'cash' && userPermissions['cash'] && <CashRegisterDashboard />}
          {currentView === 'role-management' && userPermissions['role-management'] && <RoleManagement />}
          {currentView === 'company-settings' && userPermissions['company-settings'] && <CompanySettings />}
          {currentView === 'app-settings' && userPermissions['app-settings'] && <AppSettings />}
          {currentView === 'server' && userPermissions['server'] && <ServerManager />}
          {currentView === 'backup' && userPermissions['backup'] && <BackupManager />}
          {currentView === 'clients' && userPermissions['clients'] && <ClientsManager />}
          {currentView === 'stock-analytics' && userPermissions['stock-analytics'] && <StockAnalytics />}
          {currentView === 'online-store' && <OnlineStoreManager />}
        </Suspense>
      </div>



      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <NotificationListener />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <LanguageProvider>
          <ThemeProvider>
            <CurrencyProvider>
              <AppContent />
            </CurrencyProvider>
          </ThemeProvider>
        </LanguageProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
