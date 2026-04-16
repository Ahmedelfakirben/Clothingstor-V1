import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { TrendingUp, DollarSign, ShoppingBag, Clock, Activity, AlertTriangle, Bell, FileSpreadsheet, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

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
  cogs: number;
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

// --- Period helpers ---
type PeriodType = 'day' | 'week' | 'month';

function getDayRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(dateStr + 'T00:00:00');
  const end = new Date(dateStr + 'T23:59:59');
  return { start, end };
}

function getWeekRange(weekStr: string): { start: Date; end: Date } {
  // weekStr = "YYYY-Www"
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekPart);
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const start = new Date(startOfWeek1);
  start.setDate(startOfWeek1.getDate() + (week - 1) * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange(monthStr: string): { start: Date; end: Date } {
  // monthStr = "YYYY-MM"
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

function formatPeriodLabel(type: PeriodType, dateStr: string, weekStr: string, monthStr: string, lang: string): string {
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : 'es-ES';
  if (type === 'day') {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (type === 'week') {
    const { start, end } = getWeekRange(weekStr);
    return `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function Analytics() {
  const { profile } = useAuth();
  const { t, currentLanguage } = useLanguage();
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
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [profitData, setProfitData] = useState<any[]>([]);

  // --- Dynamic period filter state ---
  const todayStr = new Date().toISOString().split('T')[0];
  const nowDate = new Date();
  const currentWeekStr = (() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
    const startOfYear = new Date(d.getFullYear(), 0, 4);
    startOfYear.setDate(startOfYear.getDate() - ((startOfYear.getDay() + 6) % 7));
    const week = Math.round((d.getTime() - startOfYear.getTime()) / (7 * 86400000)) + 1;
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  })();
  const currentMonthStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;

  const [periodType, setPeriodType] = useState<PeriodType>('day');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [customSummary, setCustomSummary] = useState<FinancialSummary | null>(null);
  const [customLoading, setCustomLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchDailySales();
    fetchTopProducts();
    fetchEmployeeActivity();
    fetchFinancialSummary();
    fetchRecentNotifications();
    fetchCompanySettings();
    fetchChartData();
    fetchDailyProfit();
    setupRealtimeSubscriptions();

    const handleCompanySettingsUpdate = (event: any) => {
      if (event.detail) setCompanySettings(event.detail);
    };
    window.addEventListener('companySettingsUpdated', handleCompanySettingsUpdate);
    return () => window.removeEventListener('companySettingsUpdated', handleCompanySettingsUpdate);
  }, []);

  // Reload custom summary whenever period selection changes
  useEffect(() => {
    let range: { start: Date; end: Date };
    if (periodType === 'day') range = getDayRange(selectedDate);
    else if (periodType === 'week') range = getWeekRange(selectedWeek);
    else range = getMonthRange(selectedMonth);
    fetchCustomSummary(range.start, range.end);
  }, [periodType, selectedDate, selectedWeek, selectedMonth]);

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

  const fetchChartData = async () => {
    try {
      // 1. Category Data
      const { data: catItems } = await supabase
        .from('order_items')
        .select(`
          subtotal,
          products!inner (
            categories!inner (name)
          )
        `)
        .limit(1000); // Recents

      if (catItems) {
        const catMap: Record<string, number> = {};
        catItems.forEach((item: any) => {
          const catName = item.products?.categories?.name || t('analytics.others');
          catMap[catName] = (catMap[catName] || 0) + item.subtotal;
        });
        setCategoryData(Object.entries(catMap).map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
        );
      }

      // 2. Payment Data
      const { data: payOrders } = await supabase
        .from('orders')
        .select('total, payment_method')
        .eq('status', 'completed')
        .limit(500);

      if (payOrders) {
        const payMap: Record<string, number> = {
          cash: 0,
          card: 0,
          digital: 0
        };
        payOrders.forEach((o: any) => {
          const method = o.payment_method || 'cash';
          payMap[method] = (payMap[method] || 0) + o.total;
        });

        const COLORS_MAP: any = {
          cash: { name: t('Efectivo'), color: '#10b981' },
          card: { name: t('Tarjeta'), color: '#3b82f6' },
          digital: { name: t('Digital'), color: '#8b5cf6' }
        };

        setPaymentData(Object.entries(payMap).map(([key, value]) => ({
          name: COLORS_MAP[key]?.name || key,
          value,
          color: COLORS_MAP[key]?.color || '#94a3b8'
        })));
      }
    } catch (err) {
      console.error('Error fetching chart data:', err);
    }
  };

  const fetchDailyProfit = async () => {
    try {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      
      const { data: sales, error } = await supabase
        .from('orders')
        .select(`
          created_at,
          order_items (
            quantity,
            unit_price,
            purchase_price,
            products (purchase_price)
          )
        `)
        .gte('created_at', weekAgo.toISOString())
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const dailyMap: Record<string, number> = {};
      
      // Initialize last 7 days
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        dailyMap[d.toISOString().split('T')[0]] = 0;
      }

      sales?.forEach(order => {
        const date = order.created_at.split('T')[0];
        let orderProfit = 0;
        
        order.order_items?.forEach((item: any) => {
          const sellingPrice = item.unit_price || 0;
          const purchasePrice = item.purchase_price > 0 ? item.purchase_price : (item.products?.purchase_price || 0);
          const profit = (sellingPrice - purchasePrice) * (item.quantity || 0);
          orderProfit += profit;
        });

        if (dailyMap[date] !== undefined) {
          dailyMap[date] += orderProfit;
        }
      });

      const formattedData = Object.entries(dailyMap)
        .map(([date, profit]) => ({ date, profit }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setProfitData(formattedData);
    } catch (err) {
      console.error('Error fetching daily profit:', err);
    }
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
    // Kept for backwards compatibility (used by exportToExcel financial sheet)
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
        const { data: sales } = await supabase
          .from('orders')
          .select(`total, order_items(quantity, purchase_price, products(purchase_price))`)
          .gte('created_at', period.start.toISOString())
          .lte('created_at', period.end.toISOString())
          .eq('status', 'completed');
        const { data: expenses } = await supabase
          .from('expenses').select('amount')
          .gte('created_at', period.start.toISOString())
          .lte('created_at', period.end.toISOString());
        const totalSales = sales?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
        let totalCogs = 0;
        sales?.forEach(order => {
          order.order_items?.forEach((item: any) => {
            const itemCogs = item.purchase_price > 0 ? item.purchase_price : (item.products?.purchase_price || 0);
            totalCogs += itemCogs * (item.quantity || 0);
          });
        });
        const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
        const profit = totalSales - totalCogs - totalExpenses;
        return { period: period.name, sales: totalSales, expenses: totalExpenses, cogs: totalCogs, profit, profit_margin: totalSales > 0 ? (profit / totalSales) * 100 : 0 };
      })
    );
    setFinancialSummary(summaries);
  };

  const fetchCustomSummary = async (start: Date, end: Date) => {
    setCustomLoading(true);
    try {
      const { data: sales } = await supabase
        .from('orders')
        .select(`total, order_items(quantity, purchase_price, products(purchase_price))`)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .eq('status', 'completed');
      const { data: expenses } = await supabase
        .from('expenses').select('amount')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      const totalSales = sales?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
      let totalCogs = 0;
      sales?.forEach(order => {
        order.order_items?.forEach((item: any) => {
          const itemCogs = item.purchase_price > 0 ? item.purchase_price : (item.products?.purchase_price || 0);
          totalCogs += itemCogs * (item.quantity || 0);
        });
      });
      const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
      const profit = totalSales - totalCogs - totalExpenses;
      setCustomSummary({
        period: '',
        sales: totalSales,
        expenses: totalExpenses,
        cogs: totalCogs,
        profit,
        profit_margin: totalSales > 0 ? (profit / totalSales) * 100 : 0,
      });
    } catch (err) {
      console.error('Error fetching custom summary:', err);
    } finally {
      setCustomLoading(false);
    }
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

  const generateDailyReport = async (dayStart?: Date, dayEnd?: Date) => {
    try {
      toast.loading(t('reports.generating_daily'), { id: 'daily-report' });

      const today = new Date();
      if (!dayStart) dayStart = new Date(today.toDateString());
      if (!dayEnd) dayEnd = new Date(today.toDateString() + ' 23:59:59');

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
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          created_at,
          employee_id,
          status,
          order_items (
            quantity,
            unit_price,
            purchase_price,
            products!product_id(name, purchase_price)
          )
        `)
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString())
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

      if (ordersErr) {
        throw new Error(`Error fetching orders: ${ordersErr.message}`);
      }

      // Calculate totals
      const totalSales = (orders || []).reduce((sum, order) => sum + order.total, 0);
      const totalExpenses = (expenses || []).reduce((sum, exp) => sum + exp.amount, 0);

      let totalCogs = 0;
      orders?.forEach(order => {
        order.order_items?.forEach((item: any) => {
          const itemCogs = item.purchase_price > 0 ? item.purchase_price : (item.products?.purchase_price || 0);
          totalCogs += itemCogs * (item.quantity || 0);
        });
      });

      const profit = totalSales - totalCogs - totalExpenses;

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
        [t('reports.report_date'), today.toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })],
        [t('reports.generation_time'), today.toLocaleTimeString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR')],
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
        [t('reports.total_sales'), formatCurrency(totalSales), `${(orders || []).length} ${t('reports.orders_completed')}`],
        [t('reports.total_expenses'), formatCurrency(totalExpenses), `${(expenses || []).length} ${t('reports.expenses_registered')}`],
        [t('Costo de Productos (COGS)'), formatCurrency(totalCogs), t('Costo de compra de los artículos vendidos')],
        [t('reports.net_profit'), formatCurrency(profit), `${((profit / totalSales) * 100 || 0).toFixed(2)}% ${t('reports.margin')}`],
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
            new Date(emp.firstOpen).toLocaleTimeString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }),
            emp.lastClose ? new Date(emp.lastClose).toLocaleTimeString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : t('reports.pending'),
            formatCurrency(emp.totalOpening),
            formatCurrency(emp.totalClosing),
            formatCurrency(emp.totalClosing - emp.totalOpening)
          ])
        ];

        const wsEmployees = XLSX.utils.aoa_to_sheet(employeeData);
        wsEmployees['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsEmployees, t('reports.employees_sheet'));
      }

      // Detailed Operations sheet
      if (orders && orders.length > 0) {
        const operationsFormatted: any[] = [];
        orders.forEach((order: any) => {
          if (order.order_items && order.order_items.length > 0) {
            order.order_items.forEach((item: any) => {
              const prodInfo = item.products || item.products_product_id;
              const pName = Array.isArray(prodInfo) ? prodInfo[0]?.name : prodInfo?.name;
              operationsFormatted.push({
                [t('reports.order_id')]: order.id.slice(-8),
                [t('reports.date')]: new Date(order.created_at).toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR'),
                [t('reports.employee')]: (order.employee_profiles as any)?.full_name || 'N/A',
                [t('Estado')]: order.status,
                [t('Producto')]: pName || t('reports.product'),
                [t('Cantidad')]: item.quantity,
                [t('Precio Unit.')]: formatCurrency(item.unit_price),
                [t('Subtotal')]: formatCurrency(item.quantity * item.unit_price)
              });
            });
          }
        });
        const wsOperations = XLSX.utils.json_to_sheet(operationsFormatted);
        XLSX.utils.book_append_sheet(wb, wsOperations, t('Detalle Operaciones'));
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
      const timestamp = dayStart.toISOString().split('T')[0];
      const filename = `Reporte_Diario_${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success(t('reports.daily_generated_success'), { id: 'daily-report' });
    } catch (error) {
      console.error('Error generating daily report:', error);
      toast.error(t('reports.error_generating_daily'), { id: 'daily-report' });
    }
  };

  const generateWeeklyReport = async (summary: FinancialSummary, weekStart?: Date, weekEnd?: Date) => {
    try {
      toast.loading(t('reports.generating_weekly'), { id: 'weekly-report' });

      const currentDate = new Date();
      if (!weekStart) {
        weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        weekStart.setHours(0, 0, 0, 0);
      }
      if (!weekEnd) {
        weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
      }

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
      // Get all expenses for the week
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())
        .order('created_at', { ascending: true });

      // Get all orders for the week
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          id, total, status, created_at, employee_id,
          order_items (
            quantity,
            unit_price,
            products!product_id(name)
          )
        `)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())
        .order('created_at', { ascending: true });

      if (ordersErr) {
        throw new Error(`Error fetching orders: ${ordersErr.message}`);
      }

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
            expenseDate.toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR'),
            expense.description,
            expense.category,
            formatCurrency(expense.amount),
            expenseDate.toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR', { weekday: 'long' })
          ]);
        });

        const wsExpenses = XLSX.utils.aoa_to_sheet(expensesData);
        wsExpenses['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }
        ];
        XLSX.utils.book_append_sheet(wb, wsExpenses, t('reports.detailed_expenses_sheet'));
      }

      // Detailed Operations sheet
      const operationsFormatted: any[] = [];
      if (orders) {
        orders.forEach((order: any) => {
          if (order.order_items && order.order_items.length > 0) {
            order.order_items.forEach((item: any) => {
              const prodInfo = item.products || item.products_product_id;
              const pName = Array.isArray(prodInfo) ? prodInfo[0]?.name : prodInfo?.name;
              operationsFormatted.push({
                [t('reports.order_id')]: order.id ? order.id.slice(-8) : t('reports.unknown'),
                [t('reports.date')]: order.created_at ? new Date(order.created_at).toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR') : '',
                [t('reports.employee')]: (order.employee_profiles as any)?.full_name || 'N/A',
                [t('Estado')]: order.status || '',
                [t('Producto')]: pName || t('reports.product'),
                [t('Cantidad')]: item.quantity || 0,
                [t('Precio Unit.')]: formatCurrency(item.unit_price || 0),
                [t('Subtotal')]: formatCurrency((item.quantity || 0) * (item.unit_price || 0))
              });
            });
          }
        });
      }

      if (operationsFormatted.length === 0) {
        operationsFormatted.push({
          [t('reports.order_id')]: t('reports.no_data'),
          [t('reports.date')]: '',
          [t('reports.employee')]: '',
          [t('Estado')]: '',
          [t('Producto')]: '',
          [t('Cantidad')]: '',
          [t('Precio Unit.')]: '',
          [t('Subtotal')]: ''
        });
      }
      const wsOperations = XLSX.utils.json_to_sheet(operationsFormatted);
      XLSX.utils.book_append_sheet(wb, wsOperations, t('Detalle Operaciones').slice(0, 31));

      // Generate filename with timestamp
      const weekNumber = Math.ceil((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      const filename = `Reporte_Semanal_Semana_${weekNumber}_${currentDate.getFullYear()}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success(t('reports.weekly_generated_success'), { id: 'weekly-report' });
    } catch (error) {
      console.error('Error generating weekly report:', error);
      toast.error(t('reports.error_generating_weekly'), { id: 'weekly-report' });
    }
  };

  const generateMonthlyReport = async (monthlySummary: FinancialSummary, monthStart?: Date, monthEnd?: Date) => {
    try {
      toast.loading(t('reports.generating_monthly'), { id: 'monthly-report' });

      const currentDate = new Date();
      if (!monthStart) monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      if (!monthEnd) monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

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
          employee_profiles!employee_id(full_name)
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

      // Get all orders for the month — NO employee_profiles join (FK not in schema cache)
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          id, total, status, created_at, employee_id, payment_method,
          order_items (
            quantity,
            unit_price,
            purchase_price,
            products!product_id(name, purchase_price)
          )
        `)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

      if (ordersErr) {
        throw new Error(`Error fetching orders: ${ordersErr.message}`);
      }

      // Fetch employee names separately (avoids FK schema cache issue)
      const employeeIds = [...new Set((orders || []).map((o: any) => o.employee_id).filter(Boolean))];
      const empMap: Record<string, string> = {};
      if (employeeIds.length > 0) {
        const { data: empData } = await supabase
          .from('employee_profiles')
          .select('id, full_name')
          .in('id', employeeIds);
        (empData || []).forEach((e: any) => { empMap[e.id] = e.full_name; });
      }

      const locale = (currentLanguage as string) === 'fr' ? 'fr-FR' : 'es-ES';

      // Payment method label helper
      const paymentLabel = (method: string | null) => {
        switch (method) {
          case 'cash': return (currentLanguage as string) === 'fr' ? 'Espèces' : 'Efectivo';
          case 'card': return (currentLanguage as string) === 'fr' ? 'Carte bancaire' : 'Tarjeta bancaria';
          case 'digital': return (currentLanguage as string) === 'fr' ? 'Paiement digital' : 'Pago digital';
          default: return (currentLanguage as string) === 'fr' ? 'Non spécifié' : 'No especificado';
        }
      };

      // Payment breakdown
      const paymentBreakdown: Record<string, { count: number; total: number }> = {
        cash: { count: 0, total: 0 },
        card: { count: 0, total: 0 },
        digital: { count: 0, total: 0 },
      };
      (orders || []).forEach((order: any) => {
        const method = order.payment_method || 'cash';
        if (!paymentBreakdown[method]) paymentBreakdown[method] = { count: 0, total: 0 };
        paymentBreakdown[method].count += 1;
        paymentBreakdown[method].total += order.total || 0;
      });

      // COGS calculation
      let totalCogsMonth = 0;
      (orders || []).forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          const prodInfo = item.products || item.products_product_id;
          const purchasePrice = Array.isArray(prodInfo) ? prodInfo[0]?.purchase_price : prodInfo?.purchase_price;
          const itemCogs = item.purchase_price > 0 ? item.purchase_price : (purchasePrice || 0);
          totalCogsMonth += itemCogs * (item.quantity || 0);
        });
      });

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
        [t('reports.report_period'), `${monthStart.toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR', { month: 'long', year: 'numeric' })}`],
        [t('reports.month_of_year'), currentDate.toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR', { month: 'long', year: 'numeric' })],
        [t('reports.generation_time'), currentDate.toLocaleTimeString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR')],
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
        [t('reports.total_sales'), formatCurrency(monthlySummary.sales), t('reports.gross_income_month'), '📈'],
        [t('reports.total_expenses'), formatCurrency(monthlySummary.expenses), `${expenses?.length || 0} ${t('reports.expenses_registered')}`, '📉'],
        [(currentLanguage as string) === 'fr' ? 'Coût des Produits (COGS)' : 'Costo de Productos (COGS)', formatCurrency(totalCogsMonth), (currentLanguage as string) === 'fr' ? "Prix d'achat des articles vendus" : 'Precio de compra de artículos vendidos', '🏷️'],
        [t('reports.net_profit'), formatCurrency(monthlySummary.profit), t('reports.sales_minus_expenses'), '🎯'],
        [t('reports.profit_margin'), `${monthlySummary.profit_margin.toFixed(2)}%`, t('reports.monthly_operational_efficiency'), '⭐'],
        [t('reports.operation_days'), new Set(Object.values(dailySessions).map((emp: any) => emp.date)).size, t('reports.days_with_activity'), '🗓️'],
        [t('reports.active_employees'), Object.keys(dailySessions).length, t('reports.with_sessions_this_month'), '👥'],
        [t('reports.total_sessions'), Object.values(dailySessions).reduce((sum: number, emp: any) => sum + emp.sessions.length, 0), t('reports.cash_openings'), '💼'],
        [t('reports.daily_average'), formatCurrency(monthlySummary.sales / new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()), t('reports.average_sales_per_day'), '📅'],
        [''],
        [(currentLanguage as string) === 'fr' ? '━━ PAIEMENTS PAR MÉTHODE ━━' : '━━ PAGOS POR MÉTODO ━━', '', '', ''],
        [(currentLanguage as string) === 'fr' ? 'Méthode' : 'Método', (currentLanguage as string) === 'fr' ? 'Nombre de ventes' : 'N° de ventas', 'Total', '%'],
        ...Object.entries(paymentBreakdown).map(([method, data]) => [
          paymentLabel(method),
          data.count,
          formatCurrency(data.total),
          monthlySummary.sales > 0 ? `${((data.total / monthlySummary.sales) * 100).toFixed(1)}%` : '0%'
        ])
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
          const date = new Date(emp.date).toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR');
          performanceData.push([
            date,
            emp.employee_name,
            emp.sessions.length.toString(),
            new Date(emp.firstOpen).toLocaleTimeString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }),
            emp.lastClose ? new Date(emp.lastClose).toLocaleTimeString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : t('reports.pending'),
            formatCurrency(emp.totalOpening),
            formatCurrency(emp.totalClosing),
            formatCurrency(emp.totalClosing - emp.totalOpening)
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

      // Detailed Operations sheet
      if (orders && orders.length > 0) {
        const operationsFormatted: any[] = [];
        orders.forEach((order: any) => {
          if (order.order_items && order.order_items.length > 0) {
            order.order_items.forEach((item: any) => {
              const prodInfo = item.products || item.products_product_id;
              const pName = Array.isArray(prodInfo) ? prodInfo[0]?.name : prodInfo?.name;
              operationsFormatted.push({
                [t('reports.order_id')]: order.id.slice(-8),
                [t('reports.date')]: new Date(order.created_at).toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR'),
                [t('reports.employee')]: (order.employee_profiles as any)?.full_name || 'N/A',
                [t('Estado')]: order.status,
                [t('Producto')]: pName || t('reports.product'),
                [t('Cantidad')]: item.quantity,
                [t('Precio Unit.')]: formatCurrency(item.unit_price),
                [t('Subtotal')]: formatCurrency(item.quantity * item.unit_price)
              });
            });
          }
        });
        const wsOperations = XLSX.utils.json_to_sheet(operationsFormatted);
        XLSX.utils.book_append_sheet(wb, wsOperations, t('Detalle Operaciones'));
      }

      // ── Payment Method Sheet ──
      const paymentSheetData: any[][] = [
        [(currentLanguage as string) === 'fr' ? 'Analyse des Paiements par Méthode' : 'Análisis de Pagos por Método'],
        [''],
        [
          (currentLanguage as string) === 'fr' ? 'Méthode de paiement' : 'Método de pago',
          (currentLanguage as string) === 'fr' ? 'Nb de commandes' : 'N° pedidos',
          (currentLanguage as string) === 'fr' ? 'Total encaissé' : 'Total cobrado',
          (currentLanguage as string) === 'fr' ? '% des ventes' : '% de ventas'
        ],
        ...Object.entries(paymentBreakdown).map(([method, data]) => [
          paymentLabel(method),
          data.count,
          formatCurrency(data.total),
          monthlySummary.sales > 0 ? `${((data.total / monthlySummary.sales) * 100).toFixed(1)}%` : '0%'
        ]),
        [''],
        [
          (currentLanguage as string) === 'fr' ? 'TOTAL' : 'TOTAL',
          (orders || []).length,
          formatCurrency(monthlySummary.sales),
          '100%'
        ]
      ];
      const wsPayment = XLSX.utils.aoa_to_sheet(paymentSheetData);
      wsPayment['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
      XLSX.utils.book_append_sheet(wb, wsPayment, (currentLanguage as string) === 'fr' ? 'Paiements' : 'Métodos Pago');

      // ── Detailed Operations Sheet (with payment method) ──
      if (orders && orders.length > 0) {
        const operationsFormatted: any[] = [];
        orders.forEach((order: any) => {
          const empName = empMap[order.employee_id] || 'N/A';
          if (order.order_items && order.order_items.length > 0) {
            order.order_items.forEach((item: any) => {
              const prodInfo = item.products || item.products_product_id;
              const pName = Array.isArray(prodInfo) ? prodInfo[0]?.name : prodInfo?.name;
              operationsFormatted.push({
                [t('reports.order_id')]: order.id ? order.id.slice(-8) : t('reports.unknown'),
                [t('reports.date')]: order.created_at ? new Date(order.created_at).toLocaleString(locale) : '',
                [t('reports.employee')]: empName,
                [(currentLanguage as string) === 'fr' ? 'Mode de paiement' : 'Método de pago']: paymentLabel(order.payment_method),
                [t('Producto')]: pName || t('reports.product'),
                [t('Cantidad')]: item.quantity || 0,
                [t('Precio Unit.')]: formatCurrency(item.unit_price || 0),
                [t('Subtotal')]: formatCurrency((item.quantity || 0) * (item.unit_price || 0)),
                [(currentLanguage as string) === 'fr' ? 'Total commande' : 'Total pedido']: formatCurrency(order.total || 0),
              });
            });
          } else {
            operationsFormatted.push({
              [t('reports.order_id')]: order.id ? order.id.slice(-8) : t('reports.unknown'),
              [t('reports.date')]: order.created_at ? new Date(order.created_at).toLocaleString(locale) : '',
              [t('reports.employee')]: empName,
              [(currentLanguage as string) === 'fr' ? 'Mode de paiement' : 'Método de pago']: paymentLabel(order.payment_method),
              [t('Producto')]: (currentLanguage as string) === 'fr' ? 'Sans détail' : 'Sin detalle',
              [t('Cantidad')]: 0,
              [t('Precio Unit.')]: formatCurrency(0),
              [t('Subtotal')]: formatCurrency(0),
              [(currentLanguage as string) === 'fr' ? 'Total commande' : 'Total pedido']: formatCurrency(order.total || 0),
            });
          }
        });
        const wsOperations = XLSX.utils.json_to_sheet(operationsFormatted);
        XLSX.utils.book_append_sheet(wb, wsOperations, (currentLanguage as string) === 'fr' ? 'Détail Opérations' : 'Detalle Operaciones');
      }

      // Generate filename with month and year
      const monthName = monthStart.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      const filename = `Reporte_Mensual_${monthName.replace(/ /g, '_')}.xlsx`;

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
            products!product_id(name)
          ),
          employee_profiles (
            full_name
          )
        `).order('created_at', { ascending: false }),
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
        [t('reports.export_date'), currentDate.toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR')],
        [t('reports.time'), currentDate.toLocaleTimeString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR')],
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

      // Detailed Operations sheet (formerly Orders sheet)
      if (ordersData.data) {
        const operationsFormatted: any[] = [];
        ordersData.data.forEach(order => {
          if (order.order_items && order.order_items.length > 0) {
            order.order_items.forEach((item: any) => {
              const prodInfo = item.products || item.products_product_id;
              const pName = Array.isArray(prodInfo) ? prodInfo[0]?.name : prodInfo?.name;
              operationsFormatted.push({
                [t('reports.order_id')]: order.id.slice(-8), // Corto para que sea legible
                [t('reports.date')]: new Date(order.created_at).toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR'),
                [t('reports.employee')]: (order.employee_profiles as any)?.full_name || 'N/A',
                [t('Estado')]: order.status,
                [t('Producto')]: pName || t('reports.product'),
                [t('Cantidad')]: item.quantity,
                [t('Precio Unit.')]: formatCurrency(item.unit_price),
                [t('Subtotal')]: formatCurrency(item.quantity * item.unit_price)
              });
            });
          } else {
            operationsFormatted.push({
              [t('reports.order_id')]: order.id.slice(-8),
              [t('reports.date')]: new Date(order.created_at).toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR'),
              [t('reports.employee')]: (order.employee_profiles as any)?.full_name || 'N/A',
              [t('Estado')]: order.status,
              [t('Producto')]: t('Sin productos'),
              [t('Cantidad')]: 0,
              [t('Precio Unit.')]: formatCurrency(0),
              [t('Subtotal')]: formatCurrency(order.total)
            });
          }
        });
        const wsOperations = XLSX.utils.json_to_sheet(operationsFormatted);
        XLSX.utils.book_append_sheet(wb, wsOperations, t('Detalle Operaciones'));
      }

      // Cash Sessions sheet
      if (sessionsData.data) {
        const sessionsFormatted = sessionsData.data.map(session => ({
          [t('reports.session_id')]: session.id.slice(-8),
          [t('reports.employee')]: (session.employee_profiles as any)?.full_name || 'N/A',
          [t('reports.initial_amount')]: formatCurrency(session.opening_amount),
          [t('reports.final_amount')]: session.closing_amount ? formatCurrency(session.closing_amount) : '-',
          [t('reports.opening_date')]: new Date(session.opened_at).toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR'),
          [t('reports.closing_date')]: session.closed_at ? new Date(session.closed_at).toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR') : t('reports.open'),
          [t('reports.status')]: session.status,
          [t('reports.balance')]: session.closing_amount ? formatCurrency(session.closing_amount - session.opening_amount) : '-'
        }));
        const wsSessions = XLSX.utils.json_to_sheet(sessionsFormatted);
        XLSX.utils.book_append_sheet(wb, wsSessions, t('reports.cash_sessions_sheet'));
      }

      // Expenses sheet
      if (expensesData.data) {
        const expensesFormatted = expensesData.data.map(expense => ({
          [t('reports.id')]: expense.id.slice(-8),
          [t('reports.description')]: expense.description,
          [t('reports.amount')]: formatCurrency(expense.amount),
          [t('reports.category')]: expense.category,
          [t('reports.date')]: new Date(expense.created_at).toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR')
        }));
        const wsExpenses = XLSX.utils.json_to_sheet(expensesFormatted);
        XLSX.utils.book_append_sheet(wb, wsExpenses, t('reports.expenses_sheet'));
      }

      // Employees sheet
      if (employeesData.data) {
        const employeesFormatted = employeesData.data.map(emp => ({
          [t('reports.id')]: emp.id.slice(-8),
          [t('reports.full_name')]: emp.full_name,
          [t('reports.role')]: emp.role,
          [t('reports.email')]: emp.email || '',
          [t('reports.phone')]: emp.phone || '',
          [t('reports.active')]: emp.active ? t('reports.yes') : t('reports.no'),
          [t('reports.creation_date')]: new Date(emp.created_at).toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR'),
          [t('reports.last_update')]: new Date(emp.updated_at).toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR')
        }));
        const wsEmployees = XLSX.utils.json_to_sheet(employeesFormatted);
        XLSX.utils.book_append_sheet(wb, wsEmployees, t('reports.employees_sheet'));
      }

      // Products sheet
      if (productsData.data) {
        const productsFormatted = productsData.data.map(product => ({
          [t('reports.id')]: product.id.slice(-8),
          [t('reports.name')]: product.name,
          [t('reports.base_price')]: formatCurrency(product.base_price),
          [t('reports.category')]: (product.categories as any)?.name || t('reports.no_category'),
          [t('reports.available')]: product.available ? t('reports.yes') : t('reports.no'),
          [t('reports.creation_date')]: new Date(product.created_at).toLocaleString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR')
        }));
        const wsProducts = XLSX.utils.json_to_sheet(productsFormatted);
        XLSX.utils.book_append_sheet(wb, wsProducts, t('reports.products_sheet'));
      }

      // Financial Summary sheet
      const financialData = [
        {
          [t('reports.period')]: t('Hoy'),
          [t('reports.sales')]: formatCurrency(financialSummary[0]?.sales || 0),
          [t('reports.expenses')]: formatCurrency(financialSummary[0]?.expenses || 0),
          [t('reports.profit')]: formatCurrency(financialSummary[0]?.profit || 0),
          [t('reports.margin_percentage')]: `${(financialSummary[0]?.profit_margin || 0).toFixed(1)}%`
        },
        {
          [t('reports.period')]: t('Esta Semana'),
          [t('reports.sales')]: formatCurrency(financialSummary[1]?.sales || 0),
          [t('reports.expenses')]: formatCurrency(financialSummary[1]?.expenses || 0),
          [t('reports.profit')]: formatCurrency(financialSummary[1]?.profit || 0),
          [t('reports.margin_percentage')]: `${(financialSummary[1]?.profit_margin || 0).toFixed(1)}%`
        },
        {
          [t('reports.period')]: t('Este Mes'),
          [t('reports.sales')]: formatCurrency(financialSummary[2]?.sales || 0),
          [t('reports.expenses')]: formatCurrency(financialSummary[2]?.expenses || 0),
          [t('reports.profit')]: formatCurrency(financialSummary[2]?.profit || 0),
          [t('reports.margin_percentage')]: `${(financialSummary[2]?.profit_margin || 0).toFixed(1)}%`
        }
      ];
      const wsFinancial = XLSX.utils.json_to_sheet(financialData);
      XLSX.utils.book_append_sheet(wb, wsFinancial, t('reports.financial_summary_sheet'));

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Report_${timestamp}.xlsx`;

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
            <span className="text-xs font-medium text-gray-500">{t('analytics.total')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{stats.totalProducts}</p>
          <p className="text-sm text-gray-600">{t('Productos activos')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-pink-50 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-pink-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">{t('analytics.active')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{onlineUsers}</p>
          <p className="text-sm text-gray-600">{t('usuarios conectados')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">{t('analytics.total')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{stats.totalCustomers}</p>
          <p className="text-sm text-gray-600">{t('analytics.registered_customers')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">{t('analytics.now')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{new Date().toLocaleTimeString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-sm text-gray-600">{t('analytics.current_time')}</p>
        </div>
      </div>

      {/* DASHBOARD VISUAL (GRÁFICOS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Gráfico de Ventas (Evolución) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{t('analytics.sales_evolution')}</h3>
              <p className="text-sm text-gray-500">{t('analytics.revenue_7_days')}</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[...dailySales].reverse()}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#9ca3af', fontSize: 12}}
                  tickFormatter={(str) => {
                    const d = new Date(str);
                    return d.toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR', {weekday: 'short'});
                  }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#9ca3af', fontSize: 12}}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(val: any) => [formatCurrency(Number(val)), t('analytics.sales')]}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Métodos de Pago */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900">{t('analytics.payment_methods')}</h3>
            <p className="text-sm text-gray-500">{t('analytics.income_distribution')}</p>
          </div>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: any) => formatCurrency(Number(val))}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend costumizada para Pie */}
            <div className="mt-4 space-y-2">
              {paymentData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}}></div>
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                  <span className="font-bold text-gray-900">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gráfico de Beneficio Real (NUEVO) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{t('analytics.real_profit')}</h3>
              <p className="text-sm text-gray-500">{t('analytics.profit_margin_desc')}</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profitData}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#9ca3af', fontSize: 12}}
                  tickFormatter={(str) => {
                    const d = new Date(str);
                    return d.toLocaleDateString(currentLanguage === 'es' ? 'es-ES' : 'fr-FR', {weekday: 'short'});
                  }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#9ca3af', fontSize: 12}}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(val: any) => [formatCurrency(Number(val)), t('analytics.net_profit')]}
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorProfit)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Categorías (Bar Chart) - Ahora lg:col-span-1 para ajustar la fila */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{t('analytics.category_sales')}</h3>
              <p className="text-sm text-gray-500">{t('analytics.category_comparison')}</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{fill: '#4b5563', fontSize: 11, fontWeight: 500}}
                  width={80}
                />
                <Tooltip 
                  cursor={{fill: '#f9fafb'}}
                  formatter={(val: any) => [formatCurrency(Number(val)), t('analytics.revenue')]}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={25}>
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][index % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Dynamic Period Filter + Summary Card ── */}
      <div className="mb-10">
        {/* Period type selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {(['day', 'week', 'month'] as PeriodType[]).map((type) => {
              const lang = currentLanguage as string;
              const labels: Record<PeriodType, string> = {
                day: lang === 'fr' ? "Aujourd'hui" : lang === 'en' ? 'Day' : 'Día',
                week: lang === 'fr' ? 'Cette Semaine' : lang === 'en' ? 'Week' : 'Semana',
                month: lang === 'fr' ? 'Ce Mois' : lang === 'en' ? 'Month' : 'Mes',
              };
              return (
                <button
                  key={type}
                  onClick={() => setPeriodType(type)}
                  className={`px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    periodType === type
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-inner'
                      : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  {labels[type]}
                </button>
              );
            })}
          </div>

          {/* Date / Week / Month picker */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (periodType === 'day') {
                  const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                } else if (periodType === 'week') {
                  const { start } = getWeekRange(selectedWeek);
                  start.setDate(start.getDate() - 7);
                  const jan4 = new Date(start.getFullYear(), 0, 4);
                  const sw1 = new Date(jan4); sw1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
                  const wk = Math.round((start.getTime() - sw1.getTime()) / (7 * 86400000)) + 1;
                  setSelectedWeek(`${start.getFullYear()}-W${String(wk).padStart(2, '0')}`);
                } else {
                  const [y, m] = selectedMonth.split('-').map(Number);
                  const prev = new Date(y, m - 2, 1);
                  setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
                }
              }}
              className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 pointer-events-none" />
              {periodType === 'day' && (
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 shadow-sm cursor-pointer transition-all"
                />
              )}
              {periodType === 'week' && (
                <input
                  type="week"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 shadow-sm cursor-pointer transition-all"
                />
              )}
              {periodType === 'month' && (
                <input
                  type="month"
                  value={selectedMonth}
                  max={currentMonthStr}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 shadow-sm cursor-pointer transition-all"
                />
              )}
            </div>

            <button
              onClick={() => {
                if (periodType === 'day') {
                  const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() + 1);
                  const next = d.toISOString().split('T')[0];
                  if (next <= todayStr) setSelectedDate(next);
                } else if (periodType === 'week') {
                  const { start } = getWeekRange(selectedWeek);
                  start.setDate(start.getDate() + 7);
                  const jan4 = new Date(start.getFullYear(), 0, 4);
                  const sw1 = new Date(jan4); sw1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
                  const wk = Math.round((start.getTime() - sw1.getTime()) / (7 * 86400000)) + 1;
                  const next = `${start.getFullYear()}-W${String(wk).padStart(2, '0')}`;
                  if (next <= currentWeekStr) setSelectedWeek(next);
                } else {
                  const [y, m] = selectedMonth.split('-').map(Number);
                  const nx = new Date(y, m, 1);
                  const next = `${nx.getFullYear()}-${String(nx.getMonth() + 1).padStart(2, '0')}`;
                  if (next <= currentMonthStr) setSelectedMonth(next);
                }
              }}
              className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-purple-300 transition-all shadow-sm"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Period label */}
          <span className="text-sm text-gray-500 italic hidden md:block">
            {formatPeriodLabel(periodType, selectedDate, selectedWeek, selectedMonth, currentLanguage)}
          </span>
        </div>

        {/* Summary card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-gray-100 hover:border-purple-300 transition-all duration-300 max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              {formatPeriodLabel(periodType, selectedDate, selectedWeek, selectedMonth, currentLanguage)}
            </h3>
            {customLoading && (
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {customSummary ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('Ventas:')}</span>
                <span className="font-semibold text-green-600">{formatCurrency(customSummary.sales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('Gastos:')}</span>
                <span className="font-semibold text-red-600">{formatCurrency(customSummary.expenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('Costo (Productos):')}</span>
                <span className="font-semibold text-amber-600">{formatCurrency(customSummary.cogs)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm font-medium text-gray-900">{t('Beneficio:')}</span>
                <span className={`font-bold ${customSummary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(customSummary.profit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('Margen:')}</span>
                <span className={`font-semibold ${customSummary.profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {customSummary.profit_margin.toFixed(1)}%
                </span>
              </div>
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => {
                    if (periodType === 'day') {
                      const r = getDayRange(selectedDate);
                      generateDailyReport(r.start, r.end);
                    } else if (periodType === 'week') {
                      const r = getWeekRange(selectedWeek);
                      generateWeeklyReport(customSummary, r.start, r.end);
                    } else {
                      const r = getMonthRange(selectedMonth);
                      generateMonthlyReport(customSummary, r.start, r.end);
                    }
                  }}
                  className={`w-full text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    periodType === 'day'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : periodType === 'week'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {periodType === 'day' && t('Generar Reporte Diario')}
                  {periodType === 'week' && t('Generar Reporte Semanal')}
                  {periodType === 'month' && t('Generar Reporte Mensual')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
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
