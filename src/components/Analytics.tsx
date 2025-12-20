import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { TrendingUp, DollarSign, ShoppingBag, Clock, Activity, AlertTriangle, Bell, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

// --- Interfaces ---

interface Product {
  name: string;
}

interface OrderItem {
  quantity: number;
  unit_price: number;
  products: Product | Product[] | null;
}

interface Order {
  id: string;
  total: number;
  status: string;
  created_at: string;
  employee_id: string;
  order_number?: number;
  order_items?: OrderItem[];
  employee_profiles?: { full_name: string; role?: string } | null;
}

interface Session {
  id: string;
  employee_id: string;
  opening_amount: number;
  closing_amount: number | null;
  opened_at: string;
  closed_at: string | null;
  status: string;
  employee_profiles?: { full_name: string; role?: string } | null;
}



interface DailySales {
  date: string;
  total: number;
  order_count: number;
}

interface TopProduct {
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

interface EmployeeActivity {
  id: string;
  full_name: string;
  role: string;
  last_login: string;
  total_sessions_today: number;
  total_orders_today: number;
  total_sales_today: number;
  is_online: boolean;
}

interface FinancialSummary {
  period: string;
  sales: number;
  expenses: number;
  profit: number;
  profit_margin: number;
}

interface CompanySettings {
  id: string;
  company_name: string;
  address: string;
  phone: string;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  icon: string | JSX.Element;
  note?: string;
  total?: number;
}

export function Analytics() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [stats, setStats] = useState({
    todaySales: 0,
    todayOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
  });
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [employeeActivity, setEmployeeActivity] = useState<EmployeeActivity[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);

  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    fetchStats();
    fetchDailySales();
    fetchTopProducts();
    fetchEmployeeActivity();
    fetchFinancialSummary();
    fetchRecentNotifications();
    fetchCompanySettings();
    setupRealtimeSubscriptions();

    // Listen for company settings updates
    const handleCompanySettingsUpdate = (event: any) => {
      if (event.detail) {
        setCompanySettings(event.detail);
      }
    };

    window.addEventListener('companySettingsUpdated', handleCompanySettingsUpdate);

    return () => {
      window.removeEventListener('companySettingsUpdated', handleCompanySettingsUpdate);
    };
  }, []);

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data: todayOrders } = await supabase
      .from('orders')
      .select('total')
      .gte('created_at', today)
      .eq('status', 'completed');

    const { count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { count: customersCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    const todaySales = todayOrders?.reduce((sum, order) => sum + order.total, 0) || 0;

    setStats({
      todaySales,
      todayOrders: todayOrders?.length || 0,
      totalProducts: productsCount || 0,
      totalCustomers: customersCount || 0,
    });
  };

  const fetchEmployeeActivity = async () => {
    try {
      const { data: employees, error } = await supabase
        .from('employee_profiles')
        .select(`
          id,
          full_name,
          role,
          active,
          deleted_at,
          created_at,
          is_online,
          last_login
        `)
        .eq('active', true)
        .is('deleted_at', null)
        .neq('role', 'super_admin');

      if (error) {
        console.error('Error fetching employees:', error);
        setEmployeeActivity([]);
        setOnlineUsers(0);
        return;
      }

      if (employees && employees.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const INACTIVITY_THRESHOLD = 40 * 60 * 1000; // 40 minutes

        const activityData = await Promise.all(
          employees.map(async (emp) => {
            try {
              // Get sessions today
              const { data: sessions, error: sessionsError } = await supabase
                .from('cash_register_sessions')
                .select('id, opened_at, closed_at')
                .eq('employee_id', emp.id)
                .gte('opened_at', today);

              if (sessionsError) {
                console.error('Error fetching sessions for employee:', emp.id, sessionsError);
              }

              // Get orders today (all statuses to show real activity)
              const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('total, status, created_at')
                .eq('employee_id', emp.id)
                .gte('created_at', today);

              if (ordersError) {
                console.error('Error fetching orders for employee:', emp.id, ordersError);
              }

              // Calculate total sales from completed orders only
              const totalSales = orders
                ?.filter(order => order.status === 'completed')
                .reduce((sum, order) => sum + order.total, 0) || 0;

              // --- INACTIVITY CHECK LOGIC ---
              const now = new Date().getTime();
              let lastActivityTime = new Date(emp.last_login || emp.created_at).getTime();

              // Check latest session activity
              if (sessions && sessions.length > 0) {
                sessions.forEach(session => {
                  const openTime = new Date(session.opened_at).getTime();
                  if (openTime > lastActivityTime) lastActivityTime = openTime;

                  if (session.closed_at) {
                    const closeTime = new Date(session.closed_at).getTime();
                    if (closeTime > lastActivityTime) lastActivityTime = closeTime;
                  }
                });
              }

              // Check latest order activity
              if (orders && orders.length > 0) {
                orders.forEach(order => {
                  const orderTime = new Date(order.created_at).getTime();
                  if (orderTime > lastActivityTime) lastActivityTime = orderTime;
                });
              }

              // Determine online status based on inactivity
              const timeDiff = now - lastActivityTime;
              const isInactive = timeDiff > INACTIVITY_THRESHOLD;

              // If user is marked online in DB but inactive locally, show as offline
              const isOnline = (emp.is_online && !isInactive) ?? false;

              return {
                id: emp.id,
                full_name: emp.full_name,
                role: emp.role,
                last_login: emp.last_login || emp.created_at,
                total_sessions_today: sessions?.length || 0,
                total_orders_today: orders?.length || 0,
                total_sales_today: totalSales,
                is_online: isOnline,
              };
            } catch (empError) {
              console.error('Error processing employee:', emp.id, empError);
              return {
                id: emp.id,
                full_name: emp.full_name,
                role: emp.role,
                last_login: emp.last_login || emp.created_at,
                total_sessions_today: 0,
                total_orders_today: 0,
                total_sales_today: 0,
                is_online: emp.is_online ?? false,
              };
            }
          })
        );

        const onlineCount = activityData.filter(emp => emp.is_online).length;
        setEmployeeActivity(activityData);
        setOnlineUsers(onlineCount);
      } else {
        setEmployeeActivity([]);
        setOnlineUsers(0);
      }
    } catch (error) {
      console.error('Error fetching employee activity:', error);
      setEmployeeActivity([]);
      setOnlineUsers(0);
    }
  };

  const fetchDailySales = async () => {
    try {
      // Get last 7 days manually since RPC might not exist
      const sales = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const { data: orders } = await supabase
          .from('orders')
          .select('total')
          .gte('created_at', dateStr)
          .lt('created_at', dateStr + 'T23:59:59')
          .eq('status', 'completed');

        const total = orders?.reduce((sum, order) => sum + order.total, 0) || 0;
        const order_count = orders?.length || 0;

        sales.push({
          date: dateStr,
          total,
          order_count
        });
      }

      setDailySales(sales.filter(day => day.total > 0 || day.order_count > 0));
    } catch (error) {
      console.error('Error fetching daily sales:', error);
      setDailySales([]);
    }
  };

  const fetchTopProducts = async () => {
    const { data } = await supabase
      .from('order_items')
      .select(`
        quantity,
        subtotal,
        products!inner(name)
      `);

    if (data) {
      const aggregated = data.reduce((acc: Record<string, TopProduct>, item) => {
        const products = item.products as unknown as Product | Product[];
        const name = Array.isArray(products) ? products[0]?.name : products?.name || 'Unknown';
        if (!acc[name]) {
          acc[name] = { product_name: name, quantity_sold: 0, revenue: 0 };
        }
        acc[name].quantity_sold += item.quantity;
        acc[name].revenue += item.subtotal;
        return acc;
      }, {});

      const sorted = Object.values(aggregated)
        .sort((a, b) => b.quantity_sold - a.quantity_sold)
        .slice(0, 5);

      setTopProducts(sorted);
    }
  };


  const fetchFinancialSummary = async () => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    const periods = [
      { name: t('Hoy'), start: new Date(today.toDateString()), end: new Date(today.toDateString() + ' 23:59:59') },
      { name: t('Esta Semana'), start: weekAgo, end: today },
      { name: t('Este Mes'), start: monthAgo, end: today },
    ];

    const summaries = await Promise.all(
      periods.map(async (period) => {
        // Get sales
        const { data: sales } = await supabase
          .from('orders')
          .select('total')
          .gte('created_at', period.start.toISOString())
          .lte('created_at', period.end.toISOString())
          .eq('status', 'completed');

        // Get expenses
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .gte('created_at', period.start.toISOString())
          .lte('created_at', period.end.toISOString());

        const totalSales = sales?.reduce((sum, order) => sum + order.total, 0) || 0;
        const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
        const profit = totalSales - totalExpenses;
        const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;

        return {
          period: period.name,
          sales: totalSales,
          expenses: totalExpenses,
          profit,
          profit_margin: profitMargin,
        };
      })
    );

    setFinancialSummary(summaries);
  };

  const fetchRecentNotifications = async () => {
    try {
      // Get recent cash register sessions (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // Get start of today for deleted orders
      const todayStart = new Date().toISOString().split('T')[0];

      const { data: sessions, error: sessionsError } = await supabase
        .from('cash_register_sessions')
        .select(`
          id,
          opened_at,
          closed_at,
          status,
          employee_profiles!inner(full_name, role)
        `)
        .neq('employee_profiles.role', 'super_admin') // Ocultar super_admin
        .gte('opened_at', yesterday.toISOString())
        .order('opened_at', { ascending: false })
        .limit(10);

      if (sessionsError) {
        console.error('Error fetching session notifications:', sessionsError);
      }

      // Get deleted orders from today
      const { data: deletedOrders, error: deletedOrdersError } = await supabase
        .from('deleted_orders')
        .select(`
          id,
          order_number,
          total,
          deletion_note,
          deleted_at,
          employee_profiles!deleted_orders_deleted_by_fkey(full_name, role)
        `)
        .neq('employee_profiles.role', 'super_admin') // Ocultar super_admin
        .gte('deleted_at', todayStart)
        .order('deleted_at', { ascending: false })
        .limit(20);

      if (deletedOrdersError) {
        console.error('Error fetching deleted order notifications:', deletedOrdersError);
      }

      // Get recent completed orders (last 2 hours)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const { data: recentOrders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          status,
          created_at,
          employee_id
        `)
        .eq('status', 'completed')
        .gte('created_at', twoHoursAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(15);

      if (ordersError) {
        console.error('Error fetching recent orders:', ordersError);
      }

      // Obtener información de empleados para las órdenes
      let ordersWithEmployees: Order[] = [];
      if (recentOrders && recentOrders.length > 0) {
        const employeeIds = [...new Set(recentOrders.map(o => o.employee_id))];
        const { data: employeesData } = await supabase
          .from('employee_profiles')
          .select('id, full_name, role')
          .in('id', employeeIds);

        ordersWithEmployees = recentOrders.map(order => ({
          ...order,
          employee_profiles: employeesData?.find(e => e.id === order.employee_id)
        })).filter(order =>
          // Filtrar órdenes de super_admin
          order.employee_profiles?.role !== 'super_admin'
        );
      }

      const sessionNotifications: Notification[] = (sessions || []).map(session => ({
        id: session.id,
        type: session.closed_at ? 'session_closed' : 'session_opened',
        message: session.closed_at
          ? `${(session.employee_profiles as any)?.full_name || 'Empleado'} ${t('cerró caja')}`
          : `${(session.employee_profiles as any)?.full_name || 'Empleado'} ${t('abrió caja')}`,
        timestamp: session.closed_at || session.opened_at,
        icon: session.closed_at ? '🔒' : '🔓',
      }));

      const deletedOrderNotifications: Notification[] = (deletedOrders || []).map(order => ({
        id: `deleted-${order.id}`,
        type: 'order_deleted',
        message: `${t('Pedido')} #${order.order_number?.toString().padStart(3, '0') || 'N/A'} ${t('eliminado por')} ${(order.employee_profiles as any)?.full_name || 'Admin'}`,
        note: order.deletion_note,
        total: order.total,
        timestamp: order.deleted_at,
        icon: '🗑️',
      }));

      const orderNotifications: Notification[] = ordersWithEmployees.map(order => ({
        id: `order-${order.id}`,
        type: 'order_completed',
        message: `${t('Pedido')} #${order.order_number?.toString().padStart(3, '0') || 'N/A'} ${t('completado por')} ${order.employee_profiles?.full_name || 'Empleado'}`,
        total: order.total,
        timestamp: order.created_at,
        icon: '✅',
      }));

      // Combinar y ordenar todas las notificaciones por timestamp
      const allNotifications = [...sessionNotifications, ...deletedOrderNotifications, ...orderNotifications]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20); // Limitar a 20 notificaciones totales

      console.log('📢 Notificaciones cargadas:', allNotifications.length);
      setRecentNotifications(allNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setRecentNotifications([]);
    }
  };

  const generateDailyReport = async () => {
    try {
      toast.loading(t('reports.generating_daily'), { id: 'daily-report' });

      const today = new Date();
      const dayStart = new Date(today.toDateString());
      const dayEnd = new Date(today.toDateString() + ' 23:59:59');

      // Get all sessions for today
      const { data: sessions } = await supabase
        .from('cash_register_sessions')
        .select(`
          id,
          employee_id,
          opening_amount,
          closing_amount,
          opened_at,
          closed_at,
          status,
          employee_profiles!inner(full_name)
        `)
        .gte('opened_at', dayStart.toISOString())
        .lte('opened_at', dayEnd.toISOString())
        .order('opened_at', { ascending: true });

      // Get all expenses for today
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString())
        .order('created_at', { ascending: true });

      // Get orders for today
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          created_at,
          employee_id,
          order_items (
            quantity,
            unit_price,
            products (name)
          ),
          employee_profiles!inner(full_name)
        `)
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString())
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

      // Calculate totals
      const totalSales = (orders || []).reduce((sum, order) => sum + order.total, 0);
      const totalExpenses = (expenses || []).reduce((sum, exp) => sum + exp.amount, 0);
      const profit = totalSales - totalExpenses;

      // Group sessions by employee
      const employeeSessions = (sessions || []).reduce((acc: Record<string, {
        employee_name: string;
        sessions: Session[];
        totalOpening: number;
        totalClosing: number;
        firstOpen: string;
        lastClose: string | null;
      }>, session: any) => {
        const empId = session.employee_id;
        if (!acc[empId]) {
          acc[empId] = {
            employee_name: session.employee_profiles?.full_name || 'N/A',
            sessions: [],
            totalOpening: 0,
            totalClosing: 0,
            firstOpen: session.opened_at,
            lastClose: session.closed_at,
          };
        }
        acc[empId].sessions.push(session);
        acc[empId].totalOpening += session.opening_amount;
        if (session.closing_amount) {
          acc[empId].totalClosing += session.closing_amount;
        }
        if (new Date(session.opened_at) < new Date(acc[empId].firstOpen)) {
          acc[empId].firstOpen = session.opened_at;
        }
        if (session.closed_at && (!acc[empId].lastClose || new Date(session.closed_at) > new Date(acc[empId].lastClose))) {
          acc[empId].lastClose = session.closed_at;
        }
        return acc;
      }, {});

      // Create Excel workbook
      const wb = XLSX.utils.book_new();

      // Company Header Sheet
      const headerData = [
        [t('reports.company_info')],
        [''],
        ...(companySettings ? [
          [t('reports.company'), companySettings.company_name],
          [t('Dirección'), companySettings.address || t('reports.not_specified')],
          [t('reports.phone'), companySettings.phone || t('reports.not_specified')],
          [''],
        ] : [
          [t('reports.company'), t('reports.not_configured')],
          [''],
        ]),
        [t('reports.daily_operations')],
        [''],
        [t('reports.report_date'), today.toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })],
        [t('reports.generation_time'), today.toLocaleTimeString('es-ES')],
        [t('reports.generated_by'), profile?.full_name || t('reports.system')],
        [''],
        ['═'.repeat(50)],
        [t('reports.executive_summary')],
        ['═'.repeat(50)]
      ];

      const wsHeader = XLSX.utils.aoa_to_sheet(headerData);
      wsHeader['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
        { s: { r: 8, c: 0 }, e: { r: 8, c: 3 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 3 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsHeader, t('reports.cover_sheet'));

      // Summary Sheet
      const summaryData = [
        [t('reports.daily_financial_summary')],
        [''],
        [t('reports.indicator'), t('reports.value'), t('reports.detail')],
        [t('reports.total_sales'), `$${totalSales.toFixed(2)}`, `${(orders || []).length} ${t('reports.orders_completed')}`],
        [t('reports.total_expenses'), `$${totalExpenses.toFixed(2)}`, `${(expenses || []).length} ${t('reports.expenses_registered')}`],
        [t('reports.net_profit'), `$${profit.toFixed(2)}`, `${((profit / totalSales) * 100 || 0).toFixed(2)}% ${t('reports.margin')}`],
        [t('reports.products_sold'), orders?.reduce((sum, order) =>
          sum + (order.order_items?.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0) || 0), 0) || 0, t('reports.units')],
        [t('reports.active_employees'), Object.keys(employeeSessions).length, t('reports.with_cash_sessions')],
        [t('reports.cash_sessions'), (sessions || []).length, t('reports.openings_registered')]
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, t('reports.summary_sheet'));

      // Employee Sessions Sheet
      if (Object.keys(employeeSessions).length > 0) {
        const employeeData = [
          [t('reports.sessions_by_employee')],
          [''],
          [t('reports.employee'), t('reports.sessions'), t('reports.first_opening'), t('reports.last_closing'), t('reports.initial_amount'), t('reports.final_amount'), t('reports.difference')],
          ...Object.values(employeeSessions).map((emp) => [
            emp.employee_name,
            emp.sessions.length,
            new Date(emp.firstOpen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            emp.lastClose ? new Date(emp.lastClose).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : t('reports.pending'),
            `$${emp.totalOpening.toFixed(2)}`,
            `$${emp.totalClosing.toFixed(2)}`,
            `$${(emp.totalClosing - emp.totalOpening).toFixed(2)}`
          ])
        ];

        const wsEmployees = XLSX.utils.aoa_to_sheet(employeeData);
        wsEmployees['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsEmployees, t('reports.employees_sheet'));
      }

      // Orders Detail Sheet
      if (orders && orders.length > 0) {
        const ordersData = [
          [t('reports.detailed_orders_breakdown')],
          [''],
          [t('reports.time'), t('reports.order'), t('reports.employee'), t('reports.products'), t('reports.total')],
          ...orders.map((order: any) => [
            new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            `#${order.id.slice(-8)}`,
            order.employee_profiles?.full_name || 'N/A',
            order.order_items?.map((item: any) => {
              const productName = Array.isArray(item.products)
                ? item.products[0]?.name
                : (item.products as any)?.name;
              return `${item.quantity}x ${productName || t('reports.product')}`;
            }).join(', ') || t('reports.no_products'),
            `$${order.total.toFixed(2)}`
          ])
        ];

        const wsOrders = XLSX.utils.aoa_to_sheet(ordersData);
        wsOrders['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsOrders, t('reports.orders_sheet'));
      }

      // Expenses Detail Sheet
      if (expenses && expenses.length > 0) {
        const expensesData = [
          [t('reports.detailed_expenses_breakdown')],
          [''],
          [t('reports.time'), t('reports.description'), t('reports.category'), t('reports.amount')],
          ...expenses.map(expense => [
            new Date(expense.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            expense.description,
            expense.category,
            `$${expense.amount.toFixed(2)}`
          ])
        ];

        const wsExpenses = XLSX.utils.aoa_to_sheet(expensesData);
        wsExpenses['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsExpenses, t('reports.expenses_sheet'));
      }

      // Generate filename with timestamp
      const timestamp = today.toISOString().split('T')[0];
      const filename = `Reporte_Diario_CoffeeShop_${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success(t('reports.daily_generated_success'), { id: 'daily-report' });
    } catch (error) {
      console.error('Error generating daily report:', error);
      toast.error(t('reports.error_generating_daily'), { id: 'daily-report' });
    }
  };

  const generateWeeklyReport = async (summary: FinancialSummary) => {
    try {
      toast.loading(t('reports.generating_weekly'), { id: 'weekly-report' });

      const currentDate = new Date();
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
      weekEnd.setHours(23, 59, 59, 999);

      // Get all sessions for the week
      const { data: sessions } = await supabase
        .from('cash_register_sessions')
        .select(`
          id,
          employee_id,
          opening_amount,
          closing_amount,
          opened_at,
          closed_at,
          status,
          employee_profiles!inner(full_name)
        `)
        .gte('opened_at', weekStart.toISOString())
        .lte('opened_at', weekEnd.toISOString())
        .order('opened_at', { ascending: true });

      // Get all expenses for the week
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())
        .order('created_at', { ascending: true });

      // Group sessions by day
      const dailySessions = (sessions || []).reduce((acc: Record<string, {
        date: string;
        employee_id: string;
        employee_profiles: { full_name: string } | null;
        employee_name: string;
        sessions: Session[];
        totalOpening: number;
        totalClosing: number;
        firstOpen: string;
        lastClose: string | null;
      }>, session: any) => {
        const date = new Date(session.opened_at).toDateString();
        const employeeKey = `${date}-${session.employee_id}`;

        if (!acc[employeeKey]) {
          acc[employeeKey] = {
            date,
            employee_id: session.employee_id,
            employee_profiles: session.employee_profiles,
            employee_name: (session.employee_profiles as any)?.full_name || 'N/A',
            sessions: [],
            totalOpening: 0,
            totalClosing: 0,
            firstOpen: session.opened_at,
            lastClose: session.closed_at,
          };
        }
        acc[employeeKey].sessions.push(session);
        acc[employeeKey].totalOpening += session.opening_amount;
        if (session.closing_amount) {
          acc[employeeKey].totalClosing += session.closing_amount;
        }
        if (new Date(session.opened_at) < new Date(acc[employeeKey].firstOpen)) {
          acc[employeeKey].firstOpen = session.opened_at;
        }
        if (session.closed_at && (!acc[employeeKey].lastClose || new Date(session.closed_at) > new Date(acc[employeeKey].lastClose))) {
          acc[employeeKey].lastClose = session.closed_at;
        }
        return acc;
      }, {});

      // Create Excel workbook
      const wb = XLSX.utils.book_new();

      // Company Header Sheet
      const headerData = [
        [t('reports.company_info')],
        [''],
        ...(companySettings ? [
          [t('reports.company'), companySettings.company_name],
          [t('Dirección'), companySettings.address || t('reports.not_specified')],
          [t('reports.phone'), companySettings.phone || t('reports.not_specified')],
          [''],
        ] : [
          [t('reports.company'), t('reports.not_configured')],
          [''],
        ]),
        [t('reports.weekly_operations')],
        [''],
        [t('reports.report_period'), `${weekStart.toLocaleDateString('es-ES')} - ${weekEnd.toLocaleDateString('es-ES')}`],
        [t('reports.week_of_year'), `${t('reports.week')} ${Math.ceil((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`],
        [t('reports.generation_time'), currentDate.toLocaleTimeString('es-ES')],
        [t('reports.generated_by'), profile?.full_name || t('reports.system')],
        [''],
        ['═'.repeat(60)],
        [t('reports.weekly_executive_summary')],
        ['═'.repeat(60)]
      ];

      const wsHeader = XLSX.utils.aoa_to_sheet(headerData);
      wsHeader['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 4 } },
        { s: { r: 10, c: 0 }, e: { r: 10, c: 4 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsHeader, t('reports.cover_sheet'));

      // Summary Sheet
      const summaryData = [
        [t('reports.weekly_financial_summary')],
        [''],
        [t('reports.indicator'), t('reports.value'), t('reports.detail'), t('reports.comparison')],
        [t('reports.total_sales'), `$${summary.sales.toFixed(2)}`, t('reports.gross_income_week'), '📈'],
        [t('reports.total_expenses'), `$${summary.expenses.toFixed(2)}`, `${expenses?.length || 0} ${t('reports.expenses_registered')}`, '📉'],
        [t('reports.net_profit'), `$${summary.profit.toFixed(2)}`, t('reports.sales_minus_expenses'), '🎯'],
        [t('reports.profit_margin'), `${summary.profit_margin.toFixed(2)}%`, t('reports.operational_efficiency'), '⭐'],
        [t('reports.active_employees'), Object.keys(dailySessions).length, t('reports.with_activity_week'), '👥'],
        [t('reports.cash_sessions'), Object.values(dailySessions).reduce((sum: number, emp: any) => sum + emp.sessions.length, 0), t('reports.total_cash_openings'), '💼'],
        [t('reports.daily_average'), `$${(summary.sales / 7).toFixed(2)}`, t('reports.average_sales_per_day'), '📅']
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, t('reports.summary_sheet'));

      // Daily Breakdown Sheet
      if (Object.keys(dailySessions).length > 0) {
        const dailyBreakdown = [
          [t('reports.daily_summary_by_employee')],
          [''],
          [t('reports.date'), t('reports.employee'), t('reports.sessions'), t('reports.opening'), t('reports.closing'), t('reports.income'), t('reports.expenses'), t('reports.balance')]
        ];

        // Group by date and calculate daily totals
        const dailyTotals: any = {};
        Object.values(dailySessions).forEach((emp: any) => {
          const date = new Date(emp.date).toLocaleDateString('es-ES');
          if (!dailyTotals[date]) {
            dailyTotals[date] = { sales: 0, expenses: 0, sessions: 0 };
          }
          dailyTotals[date].sessions += emp.sessions.length;
        });

        Object.values(dailySessions).forEach((emp) => {
          const date = new Date(emp.date).toLocaleDateString('es-ES');
          dailyBreakdown.push([
            date,
            emp.employee_name,
            emp.sessions.length.toString(),
            new Date(emp.firstOpen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            emp.lastClose ? new Date(emp.lastClose).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : t('reports.pending'),
            `$${emp.totalOpening.toFixed(2)}`,
            `$${emp.totalClosing.toFixed(2)}`,
            `$${(emp.totalClosing - emp.totalOpening).toFixed(2)}`
          ]);
        });

        const wsDaily = XLSX.utils.aoa_to_sheet(dailyBreakdown);
        wsDaily['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsDaily, t('reports.daily_breakdown_sheet'));
      }

      // Expenses Detail Sheet
      if (expenses && expenses.length > 0) {
        const expensesData = [
          [t('reports.weekly_expenses_breakdown')],
          [''],
          [t('reports.date'), t('reports.description'), t('reports.category'), t('reports.amount'), t('reports.day_of_week')]
        ];

        expenses.forEach(expense => {
          const expenseDate = new Date(expense.created_at);
          expensesData.push([
            expenseDate.toLocaleDateString('es-ES'),
            expense.description,
            expense.category,
            `$${expense.amount.toFixed(2)}`,
            expenseDate.toLocaleDateString('es-ES', { weekday: 'long' })
          ]);
        });

        const wsExpenses = XLSX.utils.aoa_to_sheet(expensesData);
        wsExpenses['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsExpenses, t('reports.detailed_expenses_sheet'));
      }

      // Generate filename with timestamp
      const weekNumber = Math.ceil((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      const filename = `Reporte_Semanal_CoffeeShop_Semana_${weekNumber}_${currentDate.getFullYear()}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success(t('reports.weekly_generated_success'), { id: 'weekly-report' });
    } catch (error) {
      console.error('Error generating weekly report:', error);
      toast.error(t('reports.error_generating_weekly'), { id: 'weekly-report' });
    }
  };

  const generateMonthlyReport = async (monthlySummary: FinancialSummary) => {
    try {
      toast.loading(t('reports.generating_monthly'), { id: 'monthly-report' });

      const currentDate = new Date();
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      // Get all daily sessions for the month
      const { data: sessions } = await supabase
        .from('cash_register_sessions')
        .select(`
          id,
          employee_id,
          opening_amount,
          closing_amount,
          opened_at,
          closed_at,
          status,
          employee_profiles!inner(full_name)
        `)
        .gte('opened_at', monthStart.toISOString())
        .lte('opened_at', monthEnd.toISOString())
        .order('opened_at', { ascending: true });

      // Get all expenses for the month
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .order('created_at', { ascending: true });

      // Group sessions by day
      const dailySessions = (sessions || []).reduce((acc: Record<string, {
        date: string;
        employee_id: string;
        employee_profiles: { full_name: string } | null;
        employee_name: string;
        sessions: Session[];
        totalOpening: number;
        totalClosing: number;
        firstOpen: string;
        lastClose: string | null;
      }>, session: any) => {
        const date = new Date(session.opened_at).toDateString();
        const employeeKey = `${date}-${session.employee_id}`;

        if (!acc[employeeKey]) {
          acc[employeeKey] = {
            date,
            employee_id: session.employee_id,
            employee_profiles: session.employee_profiles,
            employee_name: (session.employee_profiles as any)?.full_name || 'N/A',
            sessions: [],
            totalOpening: 0,
            totalClosing: 0,
            firstOpen: session.opened_at,
            lastClose: session.closed_at,
          };
        }
        acc[employeeKey].sessions.push(session);
        acc[employeeKey].totalOpening += session.opening_amount;
        if (session.closing_amount) {
          acc[employeeKey].totalClosing += session.closing_amount;
        }
        if (new Date(session.opened_at) < new Date(acc[employeeKey].firstOpen)) {
          acc[employeeKey].firstOpen = session.opened_at;
        }
        if (session.closed_at && (!acc[employeeKey].lastClose || new Date(session.closed_at) > new Date(acc[employeeKey].lastClose))) {
          acc[employeeKey].lastClose = session.closed_at;
        }
        return acc;
      }, {});

      // Create Excel workbook
      const wb = XLSX.utils.book_new();

      // Company Header Sheet
      const headerData = [
        [t('reports.company_info')],
        [''],
        ...(companySettings ? [
          [t('reports.company'), companySettings.company_name],
          [t('Dirección'), companySettings.address || t('reports.not_specified')],
          [t('reports.phone'), companySettings.phone || t('reports.not_specified')],
          [''],
        ] : [
          [t('reports.company'), t('reports.not_configured')],
          [''],
        ]),
        [t('reports.monthly_operations')],
        [''],
        [t('reports.report_period'), `${monthStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`],
        [t('reports.month_of_year'), currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })],
        [t('reports.generation_time'), currentDate.toLocaleTimeString('es-ES')],
        [t('reports.generated_by'), profile?.full_name || t('reports.system')],
        [''],
        ['═'.repeat(60)],
        [t('reports.monthly_executive_summary')],
        ['═'.repeat(60)]
      ];

      const wsHeader = XLSX.utils.aoa_to_sheet(headerData);
      wsHeader['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 4 } },
        { s: { r: 10, c: 0 }, e: { r: 10, c: 4 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsHeader, t('reports.cover_sheet'));

      // Summary Sheet
      const summaryData = [
        [t('reports.monthly_financial_summary')],
        [''],
        [t('reports.indicator'), t('reports.value'), t('reports.detail'), t('reports.trend')],
        [t('reports.total_sales'), `$${monthlySummary.sales.toFixed(2)}`, t('reports.gross_income_month'), '📈'],
        [t('reports.total_expenses'), `$${monthlySummary.expenses.toFixed(2)}`, `${expenses?.length || 0} ${t('reports.expenses_registered')}`, '📉'],
        [t('reports.net_profit'), `$${monthlySummary.profit.toFixed(2)}`, t('reports.sales_minus_expenses'), '🎯'],
        [t('reports.profit_margin'), `${monthlySummary.profit_margin.toFixed(2)}%`, t('reports.monthly_operational_efficiency'), '⭐'],
        [t('reports.operation_days'), new Set(Object.values(dailySessions).map((emp: any) => emp.date)).size, t('reports.days_with_activity'), '🗓️'],
        [t('reports.active_employees'), Object.keys(dailySessions).length, t('reports.with_sessions_this_month'), '👥'],
        [t('reports.total_sessions'), Object.values(dailySessions).reduce((sum: number, emp: any) => sum + emp.sessions.length, 0), t('reports.cash_openings'), '💼'],
        [t('reports.daily_average'), `$${(monthlySummary.sales / new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()).toFixed(2)}`, t('reports.average_sales_per_day'), '📅']
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, t('reports.summary_sheet'));

      // Daily Performance Sheet
      if (Object.keys(dailySessions).length > 0) {
        const performanceData = [
          [t('reports.daily_performance_by_employee')],
          [''],
          [t('reports.date'), t('reports.employee'), t('reports.sessions'), t('reports.opening'), t('reports.closing'), t('reports.income'), t('reports.expenses'), t('reports.daily_balance')]
        ];

        // Group by date for daily totals
        const dailyTotals: any = {};
        Object.values(dailySessions).forEach((emp: any) => {
          const date = new Date(emp.date).toLocaleDateString('es-ES');
          if (!dailyTotals[date]) {
            dailyTotals[date] = { totalOpening: 0, totalClosing: 0, employees: 0 };
          }
          dailyTotals[date].totalOpening += emp.totalOpening;
          dailyTotals[date].totalClosing += emp.totalClosing;
          dailyTotals[date].employees += 1;
        });

        Object.values(dailySessions).forEach((emp) => {
          const date = new Date(emp.date).toLocaleDateString('es-ES');
          performanceData.push([
            date,
            emp.employee_name,
            emp.sessions.length.toString(),
            new Date(emp.firstOpen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            emp.lastClose ? new Date(emp.lastClose).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : t('reports.pending'),
            `$${emp.totalOpening.toFixed(2)}`,
            `$${emp.totalClosing.toFixed(2)}`,
            `$${(emp.totalClosing - emp.totalOpening).toFixed(2)}`
          ]);
        });

        // Add daily totals row
        performanceData.push([''], [t('reports.daily_totals')]);
        Object.entries(dailyTotals).forEach(([date, totals]: [string, any]) => {
          performanceData.push([
            date,
            `${totals.employees} ${t('reports.employees')}`,
            '-',
            '-',
            '-',
            `$${totals.totalOpening.toFixed(2)}`,
            `$${totals.totalClosing.toFixed(2)}`,
            `$${(totals.totalClosing - totals.totalOpening).toFixed(2)}`
          ]);
        });

        const wsPerformance = XLSX.utils.aoa_to_sheet(performanceData);
        wsPerformance['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsPerformance, t('reports.daily_performance_sheet'));
      }

      // Monthly Expenses Breakdown
      if (expenses && expenses.length > 0) {
        // Group expenses by category
        const expensesByCategory: any = {};
        expenses.forEach(expense => {
          if (!expensesByCategory[expense.category]) {
            expensesByCategory[expense.category] = { total: 0, count: 0, items: [] };
          }
          expensesByCategory[expense.category].total += expense.amount;
          expensesByCategory[expense.category].count += 1;
          expensesByCategory[expense.category].items.push(expense);
        });

        const expensesData = [
          [t('reports.expenses_analysis_by_category')],
          [''],
          [t('reports.category'), t('reports.total'), t('reports.number_of_expenses'), t('reports.percentage_of_total')]
        ];

        const totalExpensesAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        Object.values(expensesByCategory).forEach((data: any) => {
          expensesData.push([
            data.items[0].category,
            `$${data.total.toFixed(2)}`,
            data.count,
            `${((data.total / totalExpensesAmount) * 100).toFixed(2)}%`
          ]);
        });

        const wsExpenses = XLSX.utils.aoa_to_sheet(expensesData);
        wsExpenses['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsExpenses, t('reports.expenses_category_sheet'));
      }

      // Generate filename with month and year
      const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const filename = `Reporte_Mensual_CoffeeShop_${monthName.replace(/ /g, '_')}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success(t('reports.monthly_generated_success'), { id: 'monthly-report' });
    } catch (error) {
      console.error('Error generating monthly report:', error);
      toast.error(t('reports.error_generating_monthly'), { id: 'monthly-report' });
    }
  };

  const exportToExcel = async () => {
    try {
      toast.loading(t('reports.generating_excel'), { id: 'export' });

      // Fetch all data
      const [ordersData, sessionsData, expensesData, employeesData, productsData] = await Promise.all([
        supabase.from('orders').select(`
          id, total, status, created_at, employee_id,
          order_items (
            quantity,
            unit_price,
            products (name)
          ),
          employee_profiles!inner(full_name, role)
        `).neq('employee_profiles.role', 'super_admin').order('created_at', { ascending: false }),
        supabase.from('cash_register_sessions').select(`
          id, opening_amount, closing_amount, opened_at, closed_at, status, employee_id,
          employee_profiles!inner(full_name, role)
        `).neq('employee_profiles.role', 'super_admin').order('opened_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('employee_profiles').select('*').neq('role', 'super_admin'),
        supabase.from('products').select(`
          id, name, base_price, available, created_at,
          categories!inner(name)
        `)
      ]);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Company Header Sheet
      const currentDate = new Date();
      const headerData = [
        [t('reports.company_info')],
        [''],
        ...(companySettings ? [
          [t('reports.company'), companySettings.company_name],
          [t('Dirección'), companySettings.address || t('reports.not_specified')],
          [t('reports.phone'), companySettings.phone || t('reports.not_specified')],
          [''],
        ] : [
          [t('reports.company'), t('reports.not_configured')],
          [''],
        ]),
        [t('reports.complete_data_export')],
        [''],
        [t('reports.export_date'), currentDate.toLocaleDateString('es-ES')],
        [t('reports.time'), currentDate.toLocaleTimeString('es-ES')],
        [t('reports.generated_by'), profile?.full_name || t('reports.system')],
        [''],
        ['═'.repeat(60)],
        [t('reports.general_information')],
        ['═'.repeat(60)],
        [''],
        [t('reports.file_contains_all_data')],
        [t('reports.sheets_included')]
      ];

      const wsHeader = XLSX.utils.aoa_to_sheet(headerData);
      wsHeader['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      ];
      XLSX.utils.book_append_sheet(wb, wsHeader, t('reports.information_sheet'));

      // Orders sheet
      if (ordersData.data) {
        const ordersFormatted = ordersData.data.map(order => ({
          [t('reports.order_id')]: order.id,
          [t('reports.date')]: new Date(order.created_at).toLocaleString('es-ES'),
          [t('reports.status')]: order.status,
          [t('reports.total')]: order.total,
          [t('reports.employee')]: (order.employee_profiles as any)?.full_name || 'N/A',
          [t('reports.items')]: order.order_items?.map(item =>
            `${item.quantity}x ${(item.products as any)?.name || t('reports.product')}`
          ).join('; ') || ''
        }));
        const wsOrders = XLSX.utils.json_to_sheet(ordersFormatted);
        XLSX.utils.book_append_sheet(wb, wsOrders, t('reports.orders_sheet'));
      }

      // Cash Sessions sheet
      if (sessionsData.data) {
        const sessionsFormatted = sessionsData.data.map(session => ({
          [t('reports.session_id')]: session.id,
          [t('reports.employee')]: (session.employee_profiles as any)?.full_name || 'N/A',
          [t('reports.initial_amount')]: session.opening_amount,
          [t('reports.final_amount')]: session.closing_amount || 0,
          [t('reports.opening_date')]: new Date(session.opened_at).toLocaleString('es-ES'),
          [t('reports.closing_date')]: session.closed_at ? new Date(session.closed_at).toLocaleString('es-ES') : t('reports.open'),
          [t('reports.status')]: session.status,
          [t('reports.balance')]: (session.closing_amount || 0) - session.opening_amount
        }));
        const wsSessions = XLSX.utils.json_to_sheet(sessionsFormatted);
        XLSX.utils.book_append_sheet(wb, wsSessions, t('reports.cash_sessions_sheet'));
      }

      // Expenses sheet
      if (expensesData.data) {
        const expensesFormatted = expensesData.data.map(expense => ({
          [t('reports.id')]: expense.id,
          [t('reports.description')]: expense.description,
          [t('reports.amount')]: expense.amount,
          [t('reports.category')]: expense.category,
          [t('reports.date')]: new Date(expense.created_at).toLocaleString('es-ES')
        }));
        const wsExpenses = XLSX.utils.json_to_sheet(expensesFormatted);
        XLSX.utils.book_append_sheet(wb, wsExpenses, t('reports.expenses_sheet'));
      }

      // Employees sheet
      if (employeesData.data) {
        const employeesFormatted = employeesData.data.map(emp => ({
          [t('reports.id')]: emp.id,
          [t('reports.full_name')]: emp.full_name,
          [t('reports.role')]: emp.role,
          [t('reports.email')]: emp.email || '',
          [t('reports.phone')]: emp.phone || '',
          [t('reports.active')]: emp.active ? t('reports.yes') : t('reports.no'),
          [t('reports.creation_date')]: new Date(emp.created_at).toLocaleString('es-ES'),
          [t('reports.last_update')]: new Date(emp.updated_at).toLocaleString('es-ES')
        }));
        const wsEmployees = XLSX.utils.json_to_sheet(employeesFormatted);
        XLSX.utils.book_append_sheet(wb, wsEmployees, t('reports.employees_sheet'));
      }

      // Products sheet
      if (productsData.data) {
        const productsFormatted = productsData.data.map(product => ({
          [t('reports.id')]: product.id,
          [t('reports.name')]: product.name,
          [t('reports.base_price')]: product.base_price,
          [t('reports.category')]: (product.categories as any)?.name || t('reports.no_category'),
          [t('reports.available')]: product.available ? t('reports.yes') : t('reports.no'),
          [t('reports.creation_date')]: new Date(product.created_at).toLocaleString('es-ES')
        }));
        const wsProducts = XLSX.utils.json_to_sheet(productsFormatted);
        XLSX.utils.book_append_sheet(wb, wsProducts, t('reports.products_sheet'));
      }

      // Financial Summary sheet
      const financialData = [
        {
          [t('reports.period')]: t('Hoy'),
          [t('reports.sales')]: financialSummary[0]?.sales || 0,
          [t('reports.expenses')]: financialSummary[0]?.expenses || 0,
          [t('reports.profit')]: financialSummary[0]?.profit || 0,
          [t('reports.margin_percentage')]: financialSummary[0]?.profit_margin || 0
        },
        {
          [t('reports.period')]: t('Esta Semana'),
          [t('reports.sales')]: financialSummary[1]?.sales || 0,
          [t('reports.expenses')]: financialSummary[1]?.expenses || 0,
          [t('reports.profit')]: financialSummary[1]?.profit || 0,
          [t('reports.margin_percentage')]: financialSummary[1]?.profit_margin || 0
        },
        {
          [t('reports.period')]: t('Este Mes'),
          [t('reports.sales')]: financialSummary[2]?.sales || 0,
          [t('reports.expenses')]: financialSummary[2]?.expenses || 0,
          [t('reports.profit')]: financialSummary[2]?.profit || 0,
          [t('reports.margin_percentage')]: financialSummary[2]?.profit_margin || 0
        }
      ];
      const wsFinancial = XLSX.utils.json_to_sheet(financialData);
      XLSX.utils.book_append_sheet(wb, wsFinancial, t('reports.financial_summary_sheet'));

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `CoffeeShop_Report_${timestamp}.xlsx`;

      // Save file directly without opening new window
      XLSX.writeFile(wb, filename);

      toast.success(t('reports.excel_generated_success'), { id: 'export' });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error(t('reports.error_generating_excel'), { id: 'export' });
    }
  };



  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setCompanySettings(data);
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Subscribe to employee status changes (online/offline)
    const employeeSubscription = supabase
      .channel('employee_status_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'employee_profiles'
      }, (payload) => {
        console.log('🔔 Employee status changed:', payload);
        const updatedEmployee = payload.new as any;
        const oldEmployee = payload.old as any;

        // Refrescar la actividad de empleados
        fetchEmployeeActivity();

        // Si es admin/super_admin y el estado de conexión cambió, mostrar notificación
        if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
          // Verificar que no sea el super_admin y que el estado cambió
          if (updatedEmployee.role !== 'super_admin' &&
            updatedEmployee.is_online !== undefined &&
            oldEmployee.is_online !== undefined &&
            updatedEmployee.is_online !== oldEmployee.is_online) {
            const statusText = updatedEmployee.is_online ? t('connected') : t('disconnected');
            toast(`${updatedEmployee.full_name} ${statusText}`, {
              icon: updatedEmployee.is_online ? '🟢' : '🔴',
              duration: 3000,
            });
          }
        }
      })
      .subscribe((status) => {
        console.log('📡 Employee status subscription:', status);
      });

    // Subscribe to cash register sessions
    const sessionSubscription = supabase
      .channel('cash_sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cash_register_sessions'
      }, (payload) => {
        console.log('Cash session change:', payload);
        fetchEmployeeActivity();
        fetchRecentNotifications();

        // Show toast notification
        if (payload.eventType === 'INSERT') {
          toast.success('Nueva sesión de caja abierta', { icon: '🔓' });
        } else if (payload.eventType === 'UPDATE' && payload.new.status === 'closed') {
          toast.success('Sesión de caja cerrada', { icon: '🔒' });
        }
      })
      .subscribe();

    // Subscribe to orders
    const orderSubscription = supabase
      .channel('orders')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders'
      }, () => {
        fetchStats();
        fetchEmployeeActivity();
      })
      .subscribe();



    return () => {
      employeeSubscription.unsubscribe();
      sessionSubscription.unsubscribe();
      orderSubscription.unsubscribe();

    };
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-800">{t('Analíticas y Reportes')}</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-700">{onlineUsers} {t('usuarios conectados')}</span>
          </div>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 gradient-primary hover:gradient-primary-hover text-white rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t('Exportar Excel')}</span>
          </button>
          <div className="w-9 h-9 bg-white border border-gray-200 rounded-lg flex items-center justify-center shadow-sm">
            <Bell className="w-4 h-4 text-gray-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">{t('Hoy')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(stats.todaySales)}</p>
          <p className="text-sm text-gray-600">{t('Ventas del día')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">{t('Hoy')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{stats.todayOrders}</p>
          <p className="text-sm text-gray-600">{t('Órdenes completadas')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">{t('Total')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{stats.totalProducts}</p>
          <p className="text-sm text-gray-600">{t('Productos activos')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-pink-50 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-pink-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">{t('Activos')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{onlineUsers}</p>
          <p className="text-sm text-gray-600">{t('Usuarios conectados')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">{t('Ahora')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-sm text-gray-600">{t('Hora actual')}</p>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {financialSummary.map((summary, index) => (
          <div key={index} className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-gray-100 hover:border-purple-300 transition-all duration-300 transform hover:-translate-y-1">
            <h3 className="text-2xl font-black text-gray-900 mb-6 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">{summary.period}</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('Ventas:')}</span>
                <span className="font-semibold text-green-600">{formatCurrency(summary.sales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('Gastos:')}</span>
                <span className="font-semibold text-red-600">{formatCurrency(summary.expenses)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm font-medium text-gray-900">{t('Beneficio:')}</span>
                <span className={`font-bold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.profit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('Margen:')}</span>
                <span className={`font-semibold ${summary.profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.profit_margin.toFixed(1)}%
                </span>
              </div>
              <div className="mt-4 pt-4 border-t">
                {summary.period === t('Hoy') && (
                  <button
                    onClick={() => generateDailyReport()}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {t('Generar Reporte Diario')}
                  </button>
                )}
                {summary.period === t('Esta Semana') && (
                  <button
                    onClick={() => generateWeeklyReport(summary)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {t('Generar Reporte Semanal')}
                  </button>
                )}
                {summary.period === t('Este Mes') && (
                  <button
                    onClick={() => generateMonthlyReport(summary)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {t('Generar Reporte Mensual')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Activity */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{t('Actividad de Empleados')}</h3>
          {employeeActivity.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {employeeActivity.map((emp) => (
                <div key={emp.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${emp.is_online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{emp.full_name}</p>
                    <p className="text-xs text-gray-500">{emp.role}</p>
                    <div className="flex gap-4 text-xs text-gray-600 mt-1">
                      <span>{emp.total_sessions_today} {t('sesiones')}</span>
                      <span>{emp.total_orders_today} {t('pedidos')}</span>
                      <span>{formatCurrency(emp.total_sales_today)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              {t('No hay datos de empleados disponibles')}
            </p>
          )}
        </div>

        {/* Recent Notifications */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{t('Notificaciones Recientes')}</h3>
          {recentNotifications.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentNotifications.map((notif: any) => (
                <div key={notif.id} className={`flex items-start gap-3 p-3 rounded-lg ${notif.type === 'order_deleted' ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                  }`}>
                  <span className="text-lg">{notif.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">{notif.message}</p>
                    {notif.type === 'order_deleted' && notif.note && (
                      <div className="mt-2 p-2 bg-white rounded border border-red-100">
                        <p className="text-xs font-semibold text-red-600 mb-1">{t('Motivo:')}</p>
                        <p className="text-xs text-gray-700">{notif.note}</p>
                        {notif.total && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            {t('Total')}: {formatCurrency(notif.total)}
                          </p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(notif.timestamp).toLocaleString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: 'numeric',
                        month: 'short'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              {t('No hay notificaciones recientes')}
            </p>
          )}
        </div>

        {/* Sales and Products */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('Ventas Diarias (Últimos 7 días)')}</h3>
            {dailySales.length > 0 ? (
              <div className="space-y-3">
                {dailySales.map((day, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {new Date(day.date).toLocaleDateString('es-ES', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(day.total)}</p>
                      <p className="text-xs text-gray-500">{day.order_count} {t('órdenes')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                {t('No hay datos de ventas disponibles')}
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('Productos Más Vendidos')}</h3>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                      <span className="text-amber-600 font-bold text-sm">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.product_name}</p>
                      <p className="text-sm text-gray-500">{product.quantity_sold} {t('unidades')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-600">{formatCurrency(product.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                {t('No hay datos de productos disponibles')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          {t('Insights de Rendimiento')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {financialSummary.length > 0 && (
            <>
              {financialSummary[0].profit_margin < 20 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>{t('Margen bajo hoy:')}</strong> {financialSummary[0].profit_margin.toFixed(1)}%.
                    {t('Considera revisar precios o reducir gastos.')}
                  </p>
                </div>
              )}
              {financialSummary[1].sales < financialSummary[1].expenses && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>{t('Pérdidas esta semana.')}</strong> {t('Los gastos superan las ventas. Revisa el control de inventario y gastos operativos.')}
                  </p>
                </div>
              )}
              {employeeActivity.filter(e => e.total_orders_today === 0 && e.is_online).length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>{t('Empleados inactivos.')}</strong> {t('Algunos empleados conectados no han procesado pedidos hoy.')}
                  </p>
                </div>
              )}
            </>
          )}
          {onlineUsers === 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-800">
                <strong>{t('Ningún empleado conectado.')}</strong> {t('Verifica la conectividad y horarios de trabajo.')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
