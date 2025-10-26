import { Coffee, ShoppingCart, Package, BarChart3, ClipboardList, LogOut, Users, Tag, DollarSign, Truck, ChevronDown, Calculator, Menu, X, Clock, Shield, Building2, Settings, Server, Database, Grid3x3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import OnlineStatusToggle from './OnlineStatusToggle';

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const { user, profile, signOut } = useAuth();
  const { t } = useLanguage();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [closingAmount, setClosingAmount] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState<{ [key: string]: boolean }>({});
  const [cashBreakdown, setCashBreakdown] = useState({
    openingAmount: 0,
    totalSales: 0,
    totalWithdrawals: 0,
    expectedClosing: 0,
    sessionIds: [] as string[]
  });
  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingLoading, setOpeningLoading] = useState(false);

  const navGroups: NavGroup[] = [
    {
      name: t('nav.sales'),
      items: [
        { id: 'floor', label: t('nav.floor'), icon: Users, roles: ['super_admin', 'admin', 'cashier', 'barista', 'waiter'] },
        { id: 'pos', label: t('nav.pos'), icon: ShoppingCart, roles: ['super_admin', 'admin', 'cashier', 'barista'] },
        { id: 'orders', label: t('nav.orders'), icon: ClipboardList, roles: ['super_admin', 'admin', 'cashier', 'barista', 'waiter'] },
      ]
    },
    {
      name: t('nav.inventory'),
      items: [
        { id: 'products', label: t('nav.products'), icon: Package, roles: ['super_admin', 'admin'] },
        { id: 'categories', label: t('nav.categories'), icon: Tag, roles: ['super_admin', 'admin'] },
        { id: 'users', label: t('nav.users'), icon: Users, roles: ['super_admin', 'admin'] },
      ]
    },
    {
      name: t('nav.finance'),
      items: [
        { id: 'cash', label: t('nav.cash'), icon: Calculator, roles: ['super_admin', 'admin', 'cashier'] },
        { id: 'time-tracking', label: t('nav.time-tracking'), icon: Clock, roles: ['super_admin', 'admin'] },
        { id: 'suppliers', label: t('nav.suppliers'), icon: Truck, roles: ['super_admin', 'admin'] },
        { id: 'expenses', label: t('nav.expenses'), icon: DollarSign, roles: ['super_admin', 'admin'] },
        { id: 'analytics', label: t('nav.analytics'), icon: BarChart3, roles: ['super_admin', 'admin'] },
      ]
    },
    {
      name: t('nav.system'),
      items: [
        { id: 'role-management', label: t('nav.role-management'), icon: Shield, roles: ['super_admin'] },
        { id: 'company-settings', label: t('nav.company-settings'), icon: Building2, roles: ['super_admin'] },
        { id: 'app-settings', label: t('nav.app-settings'), icon: Settings, roles: ['super_admin'] },
        { id: 'tables', label: t('nav.tables'), icon: Grid3x3, roles: ['super_admin'] },
        { id: 'server', label: t('nav.server'), icon: Server, roles: ['super_admin'] },
        { id: 'backup', label: t('nav.backup'), icon: Database, roles: ['super_admin'] },
      ]
    }
  ];

  // Verificar si el cajero debe abrir caja al iniciar sesión
  useEffect(() => {
    const checkCashSession = async () => {
      if (!user || profile?.role !== 'cashier') return;

      try {
        // Calcular el inicio del día laboral (02:00 AM)
        const now = new Date();
        const currentHour = now.getHours();

        // Si es antes de las 02:00 AM, el día laboral comenzó ayer a las 02:00 AM
        // Si es después de las 02:00 AM, el día laboral comenzó hoy a las 02:00 AM
        const workdayStart = new Date(now);
        if (currentHour < 2) {
          // Es madrugada antes de las 02:00, restar un día
          workdayStart.setDate(workdayStart.getDate() - 1);
        }
        workdayStart.setHours(2, 0, 0, 0); // Establecer a las 02:00:00

        // Verificar si ya tiene CUALQUIER sesión (abierta o cerrada) desde las 02:00 AM del día laboral
        const { data: sessions, error } = await supabase
          .from('cash_register_sessions')
          .select('id, status')
          .eq('employee_id', user.id)
          .gte('opened_at', workdayStart.toISOString());

        if (error) {
          console.error('Error checking cash session:', error);
          return;
        }

        console.log(`🕐 Verificación de caja - Día laboral desde: ${workdayStart.toLocaleString('es-ES')}`);
        console.log(`📊 Sesiones encontradas en este período: ${sessions?.length || 0}`);

        // Si no tiene ninguna sesión en el período actual, mostrar modal de apertura
        if (!sessions || sessions.length === 0) {
          setShowOpenCashModal(true);
        }
      } catch (err) {
        console.error('Error checking cash session:', err);
      }
    };

    checkCashSession();
  }, [user, profile?.role]);

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

    // Suscribirse a cambios en permisos para actualizar en tiempo real
    const channel = supabase
      .channel('role-permissions-changes')
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenu) {
        const dropdownRef = dropdownRefs.current[openMenu];
        const target = event.target as Node;
        if (dropdownRef && !dropdownRef.contains(target) && !target.parentElement?.closest('.nav-dropdown')) {
          setOpenMenu(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  const handleMenuClick = (groupName: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (openMenu === groupName) {
      setOpenMenu(null);
    } else {
      setOpenMenu(groupName);
    }
  };

  const renderMenuItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = currentView === item.id;

    return (
      <button
        key={item.id}
        onClick={() => {
          onViewChange(item.id);
          setOpenMenu(null);
        }}
        className={`flex items-center gap-3 w-full px-4 py-3 text-sm transition-all duration-200 rounded-xl mx-2 ${
          isActive
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-md'
            : 'text-gray-700 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 font-medium'
        }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-amber-600'}`} />
        <span>{item.label}</span>
        {isActive && (
          <div className="w-2 h-2 rounded-full bg-white ml-auto animate-pulse" />
        )}
      </button>
    );
  };

  const renderGroup = (group: NavGroup, isMobile: boolean = false) => {
    // Filtrar items basándose en permisos de la base de datos
    const visibleItems = group.items.filter(item =>
      userPermissions[item.id] === true
    );

    if (visibleItems.length === 0) return null;

    // For cashier, barista, and waiter users, show Sales items as individual buttons instead of dropdown
    const isNonAdminRole = profile?.role === 'cashier' || profile?.role === 'barista' || profile?.role === 'waiter';
    const isSalesGroup = group.name === t('nav.sales'); // Compare with translated name

    if (isNonAdminRole && isSalesGroup) {
      return (
        <div key={group.name} className="flex items-center gap-2">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all duration-200 shadow-sm ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 hover:shadow-md'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      );
    }

    const isActive = visibleItems.some(item => currentView === item.id);

    return (
      <div 
        key={group.name}
        className={`relative ${isMobile ? 'flex-shrink-0' : ''}`}
        ref={el => dropdownRefs.current[group.name] = el}
      >
        <button
          onClick={(e) => handleMenuClick(group.name, e)}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all duration-200 shadow-sm ${
            isActive
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
              : 'text-gray-700 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 hover:shadow-md'
          }`}
        >
          <span>{group.name}</span>
          <ChevronDown 
            className={`w-4 h-4 transition-transform ${
              openMenu === group.name ? 'transform rotate-180' : ''
            }`}
          />
        </button>

        {openMenu === group.name && (
          <div
            className={`absolute top-full left-0 mt-2 ${
              isMobile ? 'w-44' : 'w-52'
            } py-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 z-50 nav-dropdown animate-fadeIn`}
            onClick={(e) => e.stopPropagation()}
          >
            {visibleItems.map(renderMenuItem)}
          </div>
        )}
      </div>
    );
  };

  const handleOpenCashSubmit = async () => {
    if (!user) return;

    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error(t('Ingrese un monto de apertura válido (>= 0)'));
      return;
    }

    setOpeningLoading(true);

    try {
      // Crear nueva sesión de caja
      const { error } = await supabase
        .from('cash_register_sessions')
        .insert({
          employee_id: user.id,
          opening_amount: amount,
          opened_at: new Date().toISOString(),
          status: 'open'
        });

      if (error) throw error;

      toast.success(t('Caja abierta exitosamente'));
      setShowOpenCashModal(false);
      setOpeningAmount('');
    } catch (err: any) {
      console.error('Error al abrir caja:', err);
      toast.error(`${t('No se pudo abrir la caja:')} ${err.message || err}`);
    } finally {
      setOpeningLoading(false);
    }
  };

  const fetchCashBreakdown = async () => {
    if (!user) return;

    try {
      // Calcular el inicio del día laboral (02:00 AM)
      const now = new Date();
      const currentHour = now.getHours();

      const workdayStart = new Date(now);
      if (currentHour < 2) {
        workdayStart.setDate(workdayStart.getDate() - 1);
      }
      workdayStart.setHours(2, 0, 0, 0);

      const workdayEnd = new Date(workdayStart);
      workdayEnd.setDate(workdayEnd.getDate() + 1); // Siguiente día a las 02:00 AM

      // Get all open sessions for the current workday
      const { data: sessions, error: sessionsErr } = await supabase
        .from('cash_register_sessions')
        .select('id, opened_at, opening_amount')
        .eq('employee_id', user.id)
        .eq('status', 'open')
        .is('closed_at', null)
        .gte('opened_at', workdayStart.toISOString())
        .lt('opened_at', workdayEnd.toISOString())
        .order('opened_at', { ascending: true });

      if (sessionsErr) throw sessionsErr;

      if (!sessions || sessions.length === 0) {
        setCashBreakdown({
          openingAmount: 0,
          totalSales: 0,
          totalWithdrawals: 0,
          expectedClosing: 0,
          sessionIds: []
        });
        return;
      }

      const sessionIds = sessions.map(s => s.id);
      const openingAmount = sessions[0].opening_amount;

      // Get total sales from completed orders during the workday
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('total')
        .eq('employee_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', workdayStart.toISOString())
        .lt('created_at', workdayEnd.toISOString());

      if (ordersErr) throw ordersErr;

      const totalSales = (orders || []).reduce((sum, order) => sum + order.total, 0);

      // Get total withdrawals
      const { data: withdrawals, error: withdrawalsErr } = await supabase
        .from('cash_withdrawals')
        .select('amount')
        .in('session_id', sessionIds);

      if (withdrawalsErr) throw withdrawalsErr;

      const totalWithdrawals = (withdrawals || []).reduce((sum, w) => sum + w.amount, 0);

      // Calculate expected closing
      const expectedClosing = openingAmount + totalSales - totalWithdrawals;

      setCashBreakdown({
        openingAmount,
        totalSales,
        totalWithdrawals,
        expectedClosing,
        sessionIds
      });
    } catch (err) {
      console.error('Error fetching cash breakdown:', err);
      toast.error(t('Error al cargar información de caja'));
    }
  };

  const handleCloseCashSubmit = async () => {
    if (!user) return;
    const amount = parseFloat(closingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error(t('Ingrese un monto de cierre válido (>= 0)'));
      return;
    }
    setClosingLoading(true);
    try {
      // Calcular el inicio del día laboral (02:00 AM)
      const now = new Date();
      const currentHour = now.getHours();

      const workdayStart = new Date(now);
      if (currentHour < 2) {
        workdayStart.setDate(workdayStart.getDate() - 1);
      }
      workdayStart.setHours(2, 0, 0, 0);

      const workdayEnd = new Date(workdayStart);
      workdayEnd.setDate(workdayEnd.getDate() + 1); // Siguiente día a las 02:00 AM

      // Obtener todas las sesiones abiertas del día laboral actual
      const { data: sessions, error: fetchErr } = await supabase
        .from('cash_register_sessions')
        .select('id, opened_at, opening_amount')
        .eq('employee_id', user.id)
        .eq('status', 'open')
        .is('closed_at', null)
        .gte('opened_at', workdayStart.toISOString())
        .lt('opened_at', workdayEnd.toISOString())
        .order('opened_at', { ascending: true });
      if (fetchErr) throw fetchErr;

      if (!sessions || sessions.length === 0) {
        toast(t('No hay sesión de caja abierta para cerrar. Se cerrará la sesión de usuario.'));
        setShowCloseCashModal(false);
        await signOut();
        return;
      }

      // Calcular el resultado del día: primera apertura - monto actual + todas las aperturas intermedias
      const firstOpening = sessions[0].opening_amount;
      const totalOpenings = sessions.reduce((sum, session) => sum + session.opening_amount, 0);
      const dailyResult = amount - firstOpening; // Resultado = cierre final - primera apertura

      // Cerrar todas las sesiones abiertas
      const sessionIds = sessions.map(s => s.id);
      const { error: updateErr } = await supabase
        .from('cash_register_sessions')
        .update({
          closing_amount: amount,
          closed_at: new Date().toISOString(),
          status: 'closed',
        })
        .in('id', sessionIds);
      if (updateErr) throw updateErr;

      // Obtener pedidos del día laboral para el ticket
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          created_at,
          order_items (
            quantity,
            unit_price,
            products (name)
          )
        `)
        .eq('employee_id', user.id)
        .gte('created_at', workdayStart.toISOString())
        .lt('created_at', workdayEnd.toISOString())
        .eq('status', 'completed');

      if (ordersErr) throw ordersErr;

      // Obtener retiros del día para el ticket
      const { data: withdrawals, error: withdrawalsErr } = await supabase
        .from('cash_withdrawals')
        .select('amount, reason, withdrawn_at, notes')
        .in('session_id', sessionIds);

      if (withdrawalsErr) throw withdrawalsErr;

      // Calcular totales para el ticket
      const totalSales = (orders || []).reduce((sum, order) => sum + order.total, 0);
      const totalWithdrawals = (withdrawals || []).reduce((sum, w) => sum + w.amount, 0);
      const expectedClosing = firstOpening + totalSales - totalWithdrawals;
      const difference = amount - expectedClosing;

      // Generar ticket de cierre
      const ticketContent = `
        <div style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 10px;">
          <h2 style="text-align: center; margin-bottom: 10px;">${t('CIERRE DE CAJA')}</h2>
          <div style="border-bottom: 1px solid #000; margin-bottom: 10px;"></div>

          <div style="margin-bottom: 10px;">
            <strong>${t('Empleado:')}</strong> ${profile?.full_name || user.email}
          </div>

          <div style="margin-bottom: 10px;">
            <strong>${t('Fecha:')}</strong> ${new Date().toLocaleDateString('es-ES')}
          </div>

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>${t('RESUMEN FINANCIERO')}</strong>
          </div>

          <div style="margin-bottom: 5px;">
            <strong>${t('Apertura')}:</strong> ${formatCurrency(firstOpening)}
          </div>

          <div style="margin-bottom: 5px; color: green;">
            <strong>${t('Ventas')} (+):</strong> ${formatCurrency(totalSales)}
          </div>

          <div style="margin-bottom: 5px; color: orange;">
            <strong>${t('Retiros')} (-):</strong> ${formatCurrency(totalWithdrawals)}
          </div>

          <div style="margin-bottom: 5px; padding: 5px; background-color: #e3f2fd; border: 1px solid #2196f3;">
            <strong>${t('Cierre Esperado')}:</strong> ${formatCurrency(expectedClosing)}
          </div>

          <div style="margin-bottom: 5px;">
            <strong>${t('Cierre Real')}:</strong> ${formatCurrency(amount)}
          </div>

          <div style="margin-bottom: 5px; padding: 5px; background-color: ${
            difference === 0 ? '#e8f5e9' : difference > 0 ? '#e3f2fd' : '#ffebee'
          }; border: 1px solid ${
            difference === 0 ? '#4caf50' : difference > 0 ? '#2196f3' : '#f44336'
          };">
            <strong>${t('Diferencia')}:</strong> ${formatCurrency(difference)} ${difference === 0 ? '✓' : ''}
          </div>

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>${t('PEDIDOS DEL DÍA')} (${(orders || []).length})</strong>
          </div>

          ${(orders || []).length > 0 ? (orders || []).map(order => `
            <div style="margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
              <div><strong>${t('Pedido #')}${order.id.slice(-8)}</strong></div>
              <div>${t('Hora:')} ${new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
              <div>Total: ${formatCurrency(order.total)}</div>
              <div style="font-size: 12px; margin-top: 3px;">
                ${order.order_items.map(item => `${item.quantity}x ${item.products[0]?.name || t('Producto')}`).join(', ')}
              </div>
            </div>
          `).join('') : `<div style="text-align: center; color: #666; padding: 10px;">${t('Sin pedidos')}</div>`}

          ${(withdrawals || []).length > 0 ? `
            <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

            <div style="margin-bottom: 10px;">
              <strong>${t('RETIROS DE CAJA')} (${(withdrawals || []).length})</strong>
            </div>

            ${(withdrawals || []).map(withdrawal => `
              <div style="margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                <div><strong>${formatCurrency(withdrawal.amount)}</strong></div>
                <div style="font-size: 12px;">${t('Motivo')}: ${withdrawal.reason}</div>
                <div style="font-size: 12px;">${t('Hora:')} ${new Date(withdrawal.withdrawn_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                ${withdrawal.notes ? `<div style="font-size: 11px; color: #666;">${t('Nota')}: ${withdrawal.notes}</div>` : ''}
              </div>
            `).join('')}
          ` : ''}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="text-align: center; margin-top: 20px; font-size: 12px;">
            ${t('Generado el')} ${new Date().toLocaleString('es-ES')}
          </div>
        </div>
      `;

      // Imprimir ticket directamente
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Cierre de Caja</title>
              <style>
                @media print {
                  body { margin: 0; }
                  @page { size: auto; margin: 5mm; }
                }
              </style>
            </head>
            <body>
              ${ticketContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        // Cerrar ventana después de imprimir
        printWindow.onafterprint = () => printWindow.close();
      }

      toast.success(t('Cierre de caja registrado e impreso.'));
      setShowCloseCashModal(false);
      await signOut();
    } catch (err: any) {
      console.error('Error en cierre de caja:', err);
      toast.error(`${t('No se pudo cerrar la caja:')} ${err.message || err}`);
    } finally {
      setClosingLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleLogoutClick = async () => {
    if (profile?.role === 'cashier') {
      await fetchCashBreakdown();
      setShowCloseCashModal(true);
    } else if (profile?.role === 'admin' || profile?.role === 'super_admin') {
      // Para administradores, mostrar opción de cerrar caja o salir directamente
      const confirmClose = window.confirm(t('¿Desea cerrar la sesión de caja antes de salir?'));
      if (confirmClose) {
        await fetchCashBreakdown();
        setShowCloseCashModal(true);
      } else {
        signOut();
      }
    } else {
      signOut();
    }
  };

  return (
    <>
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            <div className="flex-shrink-0 flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <Coffee className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">LIN-Caisse</h1>
                <p className="text-sm text-gray-600 font-medium">{t('Sistema de Gestión')}</p>
              </div>
            </div>

            <div className="hidden lg:flex flex-1 justify-center">
              <div className="flex items-center space-x-4">
                {navGroups.map(group => renderGroup(group))}
              </div>
            </div>

            <div className="flex items-center gap-6">
              {profile && (
                <div className="text-right bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-2 rounded-xl border border-amber-100 shadow-sm">
                  <p className="text-sm font-bold text-gray-900">{profile.full_name}</p>
                  <p className="text-xs text-amber-600 capitalize font-semibold">{profile.role}</p>
                </div>
              )}
              <OnlineStatusToggle />
              <button
                onClick={handleLogoutClick}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
              >
                <LogOut className="w-5 h-5" />
                <span>{t('Salir')}</span>
              </button>
            </div>

          </div>
        </div>

        {/* Navegación móvil simplificada */}
        <div className="lg:hidden border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-around px-4 py-2">
            {profile?.role === 'cashier' || profile?.role === 'barista' || profile?.role === 'waiter' ? (
              // Vista simplificada para cajeros, baristas y camareros - basado en permisos
              <>
                {userPermissions['pos'] && (
                  <button
                    onClick={() => onViewChange('pos')}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                      currentView === 'pos'
                        ? 'bg-amber-100 text-amber-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span className="text-xs font-medium">{t('Punto de Venta')}</span>
                  </button>
                )}
                {userPermissions['floor'] && (
                  <button
                    onClick={() => onViewChange('floor')}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                      currentView === 'floor'
                        ? 'bg-amber-100 text-amber-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-xs font-medium">{t('Sala')}</span>
                  </button>
                )}
                {userPermissions['orders'] && (
                  <button
                    onClick={() => onViewChange('orders')}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                      currentView === 'orders'
                        ? 'bg-amber-100 text-amber-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ClipboardList className="w-5 h-5" />
                    <span className="text-xs font-medium">{t('Pedidos')}</span>
                  </button>
                )}
              </>
            ) : (
              // Vista para admin - Botón de menú hamburguesa centrado
              <div className="w-full flex justify-center">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-md"
                >
                  <Menu className="w-5 h-5" />
                  <span className="font-medium">{t('Menú de Navegación')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Menú lateral móvil para admin y super_admin */}
      {mobileMenuOpen && (profile?.role === 'admin' || profile?.role === 'super_admin') && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-[60] lg:hidden animate-fadeIn"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-[70] lg:hidden animate-slideInLeft">
            <div className="flex flex-col h-full">
              {/* Header del menú */}
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-amber-500 to-orange-500">
                <div className="flex items-center gap-2 text-white">
                  <Coffee className="w-6 h-6" />
                  <span className="font-bold text-lg">{t('Menú Admin')}</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Contenido del menú */}
              <div className="flex-1 overflow-y-auto p-4">
                {navGroups.map(group => {
                  const visibleItems = group.items.filter(item =>
                    userPermissions[item.id] === true
                  );

                  if (visibleItems.length === 0) return null;

                  return (
                    <div key={group.name} className="mb-6">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                        {group.name}
                      </h3>
                      <div className="space-y-1">
                        {visibleItems.map(item => {
                          const Icon = item.icon;
                          const isActive = currentView === item.id;

                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                onViewChange(item.id);
                                setMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                                isActive
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                              <span>{item.label}</span>
                              {isActive && (
                                <div className="w-2 h-2 rounded-full bg-amber-500 ml-auto" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer del menú */}
              <div className="p-4 border-t bg-gray-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {profile?.full_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{profile?.full_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
                  </div>
                </div>
                <div className="mb-3">
                  <OnlineStatusToggle />
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogoutClick();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  <span>{t('Cerrar Sesión')}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showCloseCashModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-xl font-bold">{t('Cierre de Caja')}</h2>
              <p className="text-sm text-white/90 mt-1">
                {t('Revise el resumen y confirme el cierre')}
              </p>
            </div>

            {/* Breakdown Summary */}
            <div className="px-6 py-5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                {t('Resumen del Día')}
              </h3>

              <div className="space-y-2">
                {/* Opening Amount */}
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">{t('Apertura')}:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatCurrency(cashBreakdown.openingAmount)}
                  </span>
                </div>

                {/* Sales */}
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-green-700">{t('Ventas')}:</span>
                  <span className="text-sm font-bold text-green-700">
                    + {formatCurrency(cashBreakdown.totalSales)}
                  </span>
                </div>

                {/* Withdrawals */}
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-orange-700">{t('Retiros')}:</span>
                  <span className="text-sm font-bold text-orange-700">
                    - {formatCurrency(cashBreakdown.totalWithdrawals)}
                  </span>
                </div>

                {/* Expected Closing */}
                <div className="flex justify-between items-center py-3 bg-blue-50 -mx-3 px-3 rounded-lg mt-3">
                  <span className="text-sm font-semibold text-blue-900">{t('Cierre Esperado')}:</span>
                  <span className="text-lg font-bold text-blue-900">
                    {formatCurrency(cashBreakdown.expectedClosing)}
                  </span>
                </div>
              </div>
            </div>

            {/* Input Section */}
            <div className="px-6 py-5">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                {t('Monto Real en Caja')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-bold focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                placeholder="0.00"
                autoFocus
              />

              {/* Difference Display */}
              {closingAmount && !isNaN(parseFloat(closingAmount)) && (
                <div className={`mt-4 p-3 rounded-lg ${
                  parseFloat(closingAmount) - cashBreakdown.expectedClosing === 0
                    ? 'bg-green-50 border border-green-200'
                    : parseFloat(closingAmount) - cashBreakdown.expectedClosing > 0
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-semibold ${
                      parseFloat(closingAmount) - cashBreakdown.expectedClosing === 0
                        ? 'text-green-900'
                        : parseFloat(closingAmount) - cashBreakdown.expectedClosing > 0
                        ? 'text-blue-900'
                        : 'text-red-900'
                    }`}>
                      {t('Diferencia')}:
                    </span>
                    <span className={`text-lg font-bold ${
                      parseFloat(closingAmount) - cashBreakdown.expectedClosing === 0
                        ? 'text-green-900'
                        : parseFloat(closingAmount) - cashBreakdown.expectedClosing > 0
                        ? 'text-blue-900'
                        : 'text-red-900'
                    }`}>
                      {formatCurrency(parseFloat(closingAmount) - cashBreakdown.expectedClosing)}
                      {parseFloat(closingAmount) - cashBreakdown.expectedClosing === 0 && ' ✓'}
                    </span>
                  </div>
                  {parseFloat(closingAmount) - cashBreakdown.expectedClosing !== 0 && (
                    <p className={`text-xs mt-1 ${
                      parseFloat(closingAmount) - cashBreakdown.expectedClosing > 0
                        ? 'text-blue-700'
                        : 'text-red-700'
                    }`}>
                      {parseFloat(closingAmount) - cashBreakdown.expectedClosing > 0
                        ? t('Hay más dinero del esperado')
                        : t('Hay menos dinero del esperado')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3 border-t border-gray-200">
              <button
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                onClick={() => setShowCloseCashModal(false)}
              >
                {t('Cancelar')}
              </button>
              {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
                <button
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  onClick={async () => {
                    setShowCloseCashModal(false);
                    await signOut();
                  }}
                >
                  {t('Salir Sin Cambios')}
                </button>
              )}
              <button
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCloseCashSubmit}
                disabled={closingLoading}
              >
                {closingLoading ? t('Guardando...') : t('Cerrar Caja y Salir')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOpenCashModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-xl font-bold">{t('Apertura de Caja')}</h2>
              <p className="text-sm text-white/90 mt-1">
                {t('Bienvenido! Ingrese el monto inicial en caja')}
              </p>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>{t('Importante')}:</strong> {t('Este monto será el punto de partida para el control de caja del día.')}
                </p>
              </div>

              <label className="block text-sm font-semibold text-gray-900 mb-2">
                {t('Monto de Apertura')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-bold focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                placeholder="0.00"
                autoFocus
              />

              {openingAmount && !isNaN(parseFloat(openingAmount)) && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-green-900">
                      {t('Monto inicial en caja')}:
                    </span>
                    <span className="text-lg font-bold text-green-900">
                      {formatCurrency(parseFloat(openingAmount))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3 border-t border-gray-200">
              <button
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleOpenCashSubmit}
                disabled={openingLoading || !openingAmount || parseFloat(openingAmount) < 0}
              >
                {openingLoading ? t('Abriendo...') : t('Abrir Caja')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}