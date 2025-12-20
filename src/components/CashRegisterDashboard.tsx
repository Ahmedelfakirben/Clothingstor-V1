import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Calendar, DollarSign, Filter, RefreshCw, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from './LoadingSpinner';

interface CashSession {
  id: string;
  employee_id: string;
  opening_amount: number;
  opened_at: string;
  closing_amount: number | null;
  closed_at: string | null;
  status: 'open' | 'closed';
  notes: string | null;
  employee_profiles?: { full_name: string };
}

interface CashWithdrawal {
  id: string;
  session_id: string;
  amount: number;
  reason: string;
  withdrawn_by: string;
  withdrawn_at: string;
  notes: string | null;
}

interface Order {
  id: string;
  total: number;
  created_at: string;
  status: string;
  order_items: Array<{
    quantity: number;
    unit_price: number;
    products: { name: string }[];
  }>;
}

export function CashRegisterDashboard() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency: formatCurrencyFromContext } = useCurrency();
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all' as 'all' | 'open' | 'closed',
    employeeId: 'all' as string,
  });

  const [employees, setEmployees] = useState<Array<{id: string, full_name: string}>>([]);

  const [totals, setTotals] = useState({
    totalOpening: 0,
    totalClosing: 0,
    balance: 0,
  });

  const [currentCashStatus, setCurrentCashStatus] = useState({
    currentAmount: 0,
    lastSessionStatus: 'closed' as 'open' | 'closed',
    lastSessionTime: '',
  });

  const [dailySessions, setDailySessions] = useState<any[]>([]);

  // Estados para retiros de caja
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedSessionForWithdrawal, setSelectedSessionForWithdrawal] = useState<string | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [withdrawalNotes, setWithdrawalNotes] = useState('');
  const [withdrawals, setWithdrawals] = useState<CashWithdrawal[]>([]);

  useEffect(() => {
    fetchSessions();
    fetchCurrentCashStatus();
    fetchWithdrawals();
  }, [filters, profile]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      groupSessionsByDay();
    }
  }, [sessions]);

  const fetchSessions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('cash_register_sessions')
        .select(`
          *,
          employee_profiles!inner(full_name, role)
        `)
        .neq('employee_profiles.role', 'super_admin') // Ocultar sesiones de super_admin
        .order('opened_at', { ascending: false });

      // Para cajeros: solo sus sesiones y solo del día actual
      if (profile?.role === 'cashier') {
        const today = new Date().toISOString().split('T')[0];
        query = query
          .eq('employee_id', user.id)
          .gte('opened_at', today)
          .lte('opened_at', today + 'T23:59:59');
      } else {
        // Para administradores: aplicar filtros
        if (filters.startDate) {
          query = query.gte('opened_at', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('opened_at', filters.endDate);
        }
        if (filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        if (filters.employeeId !== 'all') {
          query = query.eq('employee_id', filters.employeeId);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      setSessions(data || []);

      // Calcular totales
      const totalOpening = (data || []).reduce((sum, s) => sum + (s.opening_amount || 0), 0);
      const totalClosing = (data || []).reduce((sum, s) => sum + (s.closing_amount || 0), 0);
      setTotals({
        totalOpening,
        totalClosing,
        balance: totalClosing - totalOpening,
      });
    } catch (err) {
      console.error('Error fetching cash sessions:', err);
      toast.error(t('Error al cargar sesiones de caja'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Usar formatCurrency del contexto global
  const formatCurrency = formatCurrencyFromContext;

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('id, full_name')
        .neq('role', 'super_admin') // Ocultar super_admin
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_withdrawals')
        .select('*')
        .order('withdrawn_at', { ascending: false });

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (err) {
      console.error('Error fetching withdrawals:', err);
    }
  };

  const registerWithdrawal = async () => {
    if (!selectedSessionForWithdrawal || !withdrawalAmount || !withdrawalReason) {
      toast.error(t('Por favor completa todos los campos obligatorios'));
      return;
    }

    try {
      const { error } = await supabase
        .from('cash_withdrawals')
        .insert({
          session_id: selectedSessionForWithdrawal,
          amount: parseFloat(withdrawalAmount),
          reason: withdrawalReason,
          withdrawn_by: user!.id,
          notes: withdrawalNotes || null
        });

      if (error) throw error;

      toast.success(t('Retiro registrado exitosamente'));
      setShowWithdrawalModal(false);
      setWithdrawalAmount('');
      setWithdrawalReason('');
      setWithdrawalNotes('');
      setSelectedSessionForWithdrawal(null);

      // Recargar datos
      fetchWithdrawals();
      fetchSessions();
    } catch (err) {
      console.error('Error registering withdrawal:', err);
      toast.error(t('Error al registrar el retiro'));
    }
  };

  const fetchCurrentCashStatus = async () => {
    try {
      // Get the most recent session for the current user (or all for admin)
      let query = supabase
        .from('cash_register_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(1);

      if (profile?.role === 'cashier' && user) {
        query = query.eq('employee_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const latestSession = data[0];
        setCurrentCashStatus({
          currentAmount: latestSession.closing_amount || latestSession.opening_amount,
          lastSessionStatus: latestSession.status,
          lastSessionTime: latestSession.status === 'open' ? latestSession.opened_at : (latestSession.closed_at || latestSession.opened_at),
        });
      } else {
        // No sessions found
        setCurrentCashStatus({
          currentAmount: 0,
          lastSessionStatus: 'closed',
          lastSessionTime: '',
        });
      }
    } catch (err) {
      console.error('Error fetching current cash status:', err);
      setCurrentCashStatus({
        currentAmount: 0,
        lastSessionStatus: 'closed',
        lastSessionTime: '',
      });
    }
  };

  const groupSessionsByDay = async () => {
    const grouped = sessions.reduce((acc: any, session) => {
      const date = new Date(session.opened_at).toDateString();
      const employeeKey = `${date}-${session.employee_id}`;

      if (!acc[employeeKey]) {
        acc[employeeKey] = {
          date,
          employee_id: session.employee_id,
          employee_profiles: session.employee_profiles,
          sessions: [],
          totalOpening: 0,
          totalClosing: 0,
          totalSales: 0,
          totalWithdrawals: 0,
          expectedClosing: 0,
          difference: 0,
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

    // Calcular ventas y retiros para cada día
    for (const employeeKey of Object.keys(grouped)) {
      const dayData = grouped[employeeKey];
      const startOfDay = new Date(dayData.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dayData.date);
      endOfDay.setHours(23, 59, 59, 999);

      // Obtener ventas del día (pedidos confirmados)
      const { data: orders } = await supabase
        .from('orders')
        .select('total')
        .eq('employee_id', dayData.employee_id)
        .eq('status', 'completed')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      dayData.totalSales = (orders || []).reduce((sum, order) => sum + order.total, 0);

      // Obtener retiros del día
      const sessionIds = dayData.sessions.map((s: CashSession) => s.id);
      const { data: dayWithdrawals } = await supabase
        .from('cash_withdrawals')
        .select('amount')
        .in('session_id', sessionIds);

      dayData.totalWithdrawals = (dayWithdrawals || []).reduce((sum, w) => sum + w.amount, 0);

      // Calcular cierre esperado y diferencia
      // Cierre esperado = Apertura + Ventas - Retiros
      dayData.expectedClosing = dayData.totalOpening + dayData.totalSales - dayData.totalWithdrawals;
      // Diferencia = Cierre Real - Cierre Esperado
      dayData.difference = dayData.totalClosing - dayData.expectedClosing;
    }

    const dailyArray = Object.values(grouped).sort((a: any, b: any) => {
      // Sort by date desc, then by employee name
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return (a.employee_profiles?.full_name || '').localeCompare(b.employee_profiles?.full_name || '');
    });
    setDailySessions(dailyArray);
  };

  const printDailyReport = async (day: any) => {
    try {
      // Fetch orders for the entire day
      const startOfDay = new Date(day.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day.date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          order_number,
          created_at,
          status,
          order_items (
            quantity,
            unit_price,
            products (name)
          )
        `)
        .eq('employee_id', day.employee_id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .eq('status', 'completed');

      if (error) throw error;

      // Calculate order totals
      const orderTotal = (orders || []).reduce((sum, order) => sum + order.total, 0);
      const orderCount = orders?.length || 0;

      // Create professional invoice-style print content
      const printContent = `
        <div class="report">
          <div class="header">
            <h1>LIN-Caisse</h1>
            <p>Sistema de Gestión Integral</p>
            <p>Reporte Diario de Caja</p>
          </div>

          <div class="info-section">
            <div class="info-item">
              <strong>${new Date(day.date).toLocaleDateString('es-ES')}</strong>
              <span>Fecha del Reporte</span>
            </div>
            <div class="info-item">
              <strong>${profile?.role === 'admin' || profile?.role === 'super_admin' ? day.employee_profiles?.full_name || 'N/A' : 'Tú'}</strong>
              <span>Empleado</span>
            </div>
            <div class="info-item">
              <strong>${orderCount}</strong>
              <span>Total Pedidos</span>
            </div>
            <div class="info-item">
              <strong>${formatCurrency(orderTotal)}</strong>
              <span>Total Ventas</span>
            </div>
          </div>

          <div class="section-title">RESUMEN FINANCIERO DEL DÍA</div>
          <div class="summary-grid">
            <div class="summary-item">
              <strong>${formatCurrency(day.totalOpening)}</strong>
              <span>Total Inicial</span>
            </div>
            <div class="summary-item">
              <strong>${formatCurrency(day.totalClosing)}</strong>
              <span>Total Final</span>
            </div>
            <div class="summary-item">
              <strong>${formatCurrency(day.totalClosing - day.totalOpening)}</strong>
              <span>Balance del Día</span>
            </div>
            <div class="summary-item">
              <strong>${day.sessions.length}</strong>
              <span>Sesiones de Caja</span>
            </div>
          </div>

          <div class="section-title">DETALLE DE SESIONES</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Sesión</th>
                  <th>Hora Apertura</th>
                  <th>Monto Inicial</th>
                  <th>Hora Cierre</th>
                  <th>Monto Final</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${day.sessions.map((session: CashSession, index: number) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${new Date(session.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${formatCurrency(session.opening_amount)}</td>
                    <td>${session.closed_at ? new Date(session.closed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td>${session.closing_amount ? formatCurrency(session.closing_amount) : '-'}</td>
                    <td>${session.closed_at ? 'Cerrada' : 'Abierta'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="section-title">DETALLE DE PEDIDOS</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>N° Pedido</th>
                  <th>Hora</th>
                  <th>Productos</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${(orders || []).map(order => `
                  <tr>
                    <td>${order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(-8)}</td>
                    <td>${new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${order.order_items.map(item => `${item.quantity}x ${item.products[0]?.name || 'Producto'}`).join(', ')}</td>
                    <td>${formatCurrency(order.total)}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="3" style="text-align: right; font-weight: bold;">TOTAL DEL DÍA</td>
                  <td style="font-weight: bold; font-size: 16px;">${formatCurrency(orderTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <p>Firma del Empleado</p>
              <p>${profile?.role === 'admin' || profile?.role === 'super_admin' ? day.employee_profiles?.full_name || 'N/A' : profile?.full_name || 'Usuario'}</p>
            </div>
            <div class="signature-box">
              <p>Firma del Administrador</p>
            </div>
          </div>

          <div class="footer">
            <p>Este documento es oficial y forma parte del registro contable de LIN-Caisse</p>
            <p>Reporte generado el ${new Date().toLocaleString('es-ES')}</p>
          </div>
        </div>
      `;

      // Print in professional invoice format
      const printWindow = window.open('', '', 'height=800,width=1000');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Reporte Diario de Caja</title>
              <style>
                body {
                  font-family: 'Arial', sans-serif;
                  margin: 0;
                  padding: 20px;
                  background: white;
                }
                .report {
                  max-width: 210mm;
                  margin: 0 auto;
                  padding: 20px;
                  background: white;
                  box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                .header {
                  text-align: center;
                  border-bottom: 2px solid #333;
                  padding-bottom: 20px;
                  margin-bottom: 30px;
                }
                .header h1 {
                  color: #333;
                  margin: 0;
                  font-size: 28px;
                }
                .header p {
                  color: #666;
                  margin: 5px 0;
                  font-size: 14px;
                }
                .info-section {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 30px;
                  padding: 15px;
                  background: #f8f9fa;
                  border-radius: 8px;
                }
                .info-item {
                  flex: 1;
                  text-align: center;
                }
                .info-item strong {
                  display: block;
                  font-size: 18px;
                  color: #333;
                  margin-bottom: 5px;
                }
                .info-item span {
                  color: #666;
                  font-size: 14px;
                }
                .section-title {
                  font-size: 16px;
                  font-weight: bold;
                  color: #333;
                  margin: 20px 0 10px 0;
                  padding-bottom: 5px;
                  border-bottom: 1px solid #ddd;
                }
                .summary-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                  gap: 15px;
                  margin: 20px 0;
                }
                .summary-item {
                  padding: 15px;
                  background: #f8f9fa;
                  border-radius: 8px;
                  text-align: center;
                }
                .summary-item strong {
                  display: block;
                  font-size: 20px;
                  color: #333;
                  margin-bottom: 5px;
                }
                .summary-item span {
                  color: #666;
                  font-size: 14px;
                }
                .table-container {
                  margin: 20px 0;
                  border: 1px solid #ddd;
                  border-radius: 8px;
                  overflow: hidden;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                }
                th, td {
                  padding: 10px 12px;
                  text-align: left;
                  border-bottom: 1px solid #ddd;
                }
                th {
                  background: #f8f9fa;
                  font-weight: bold;
                  color: #333;
                }
                .total-row {
                  background: #e9ecef;
                  font-weight: bold;
                }
                .footer {
                  margin-top: 40px;
                  text-align: center;
                  padding-top: 20px;
                  border-top: 1px solid #ddd;
                  color: #666;
                  font-size: 12px;
                }
                .signature-section {
                  margin-top: 40px;
                  display: flex;
                  justify-content: space-between;
                }
                .signature-box {
                  width: 200px;
                  text-align: center;
                  border-top: 1px solid #333;
                  padding-top: 10px;
                }
                @media print {
                  body {
                    background: white !important;
                    -webkit-print-color-adjust: exact;
                  }
                  .report {
                    box-shadow: none;
                    margin: 0;
                    padding: 15mm;
                  }
                }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    } catch (err) {
      console.error('Error generating daily report:', err);
      toast.error(t('Error al generar el reporte diario'));
    }
  };

  const printSessionReport = async (session: CashSession) => {
    try {
      // Fetch orders for this session's date range
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          created_at,
          status,
          order_items (
            quantity,
            unit_price,
            products (name)
          )
        `)
        .eq('employee_id', session.employee_id)
        .gte('created_at', session.opened_at)
        .lte('created_at', session.closed_at || new Date().toISOString())
        .eq('status', 'completed');

      if (error) throw error;

      // Calculate order totals
      const orderTotal = (orders || []).reduce((sum, order) => sum + order.total, 0);
      const orderCount = orders?.length || 0;

      // Create print content
      const printContent = `
        <div style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 10px;">
          <h2 style="text-align: center; margin-bottom: 10px;">REPORTE DE CAJA</h2>
          <div style="border-bottom: 1px solid #000; margin-bottom: 10px;"></div>

          <div style="margin-bottom: 10px;">
            <strong>Empleado:</strong> ${profile?.role === 'admin' || profile?.role === 'super_admin' ? session.employee_profiles?.full_name || 'N/A' : 'Tú'}
          </div>

          <div style="margin-bottom: 10px;">
            <strong>Fecha de Apertura:</strong> ${formatDate(session.opened_at)}
          </div>

          ${session.closed_at ? `<div style="margin-bottom: 10px;">
            <strong>Fecha de Cierre:</strong> ${formatDate(session.closed_at)}
          </div>` : ''}

          <div style="margin-bottom: 10px;">
            <strong>Monto Inicial:</strong> ${formatCurrency(session.opening_amount)}
          </div>

          ${session.closing_amount ? `<div style="margin-bottom: 10px;">
            <strong>Monto Final:</strong> ${formatCurrency(session.closing_amount)}
          </div>` : ''}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>RESUMEN DE PEDIDOS</strong>
          </div>

          <div style="margin-bottom: 5px;">
            <strong>Total Pedidos:</strong> ${orderCount}
          </div>

          <div style="margin-bottom: 10px;">
            <strong>Total Ventas:</strong> ${formatCurrency(orderTotal)}
          </div>

          ${session.closing_amount ? `<div style="margin-bottom: 10px;">
            <strong>Balance:</strong> ${formatCurrency(session.closing_amount - session.opening_amount)}
          </div>` : ''}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="margin-bottom: 10px;">
            <strong>DETALLE DE PEDIDOS</strong>
          </div>

          ${(orders || []).map(order => `
            <div style="margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
              <div><strong>Pedido #${order.id.slice(-8)}</strong></div>
              <div>Hora: ${new Date(order.created_at).toLocaleTimeString('es-ES')}</div>
              <div>Total: ${formatCurrency(order.total)}</div>
              <div style="font-size: 12px; margin-top: 3px;">
                ${order.order_items.map(item => `${item.quantity}x ${item.products[0]?.name || 'Producto'}`).join(', ')}
              </div>
            </div>
          `).join('')}

          <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>

          <div style="text-align: center; margin-top: 20px; font-size: 12px;">
            Generado el ${new Date().toLocaleString('es-ES')}
          </div>
        </div>
      `;

      // Print directly without opening new window
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Reporte de Caja</title>
              <style>
                @media print {
                  body { margin: 0; }
                  @page { size: auto; margin: 5mm; }
                }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        // Close window after printing
        printWindow.onafterprint = () => printWindow.close();
      }
    } catch (err) {
      console.error('Error generating report:', err);
      toast.error(t('Error al generar el reporte'));
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('Gestión de Caja')}</h1>
        <p className="text-gray-600">{t('Historial de aperturas y cierres de caja')}</p>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">{t('Total Aperturas')}</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalOpening)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">{t('Total Cierres')}</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totals.totalClosing)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-medium text-gray-700">{t('Balance')}</span>
          </div>
          <p className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totals.balance)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">{t('Estado Actual')}</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(currentCashStatus.currentAmount)}</p>
          <p className="text-xs text-gray-500">
            {currentCashStatus.lastSessionStatus === 'open' ? t('Caja Abierta') : t('Caja Cerrada')}
            {currentCashStatus.lastSessionTime && (
              <span className="block">
                {new Date(currentCashStatus.lastSessionTime).toLocaleString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filtros */}
      {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">{t('Filtros')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Fecha Inicio')}</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Fecha Fin')}</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Estado')}</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="all">{t('Todos')}</option>
                <option value="open">{t('Abiertas')}</option>
                <option value="closed">{t('Cerradas')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Empleado')}</label>
              <select
                value={filters.employeeId}
                onChange={(e) => setFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="all">{t('Todos los empleados')}</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchSessions}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t('Actualizar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Para cajeros: mostrar solo el día actual */}
      {profile?.role === 'cashier' && (
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">{t('Sesiones de Hoy')}</span>
          </div>
          <div className="text-sm text-gray-600">
            {t('Mostrando todas tus sesiones de caja del día actual')}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
            <p className="text-gray-600">{t('Cargando sesiones...')}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('No hay sesiones de caja para mostrar')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('Empleado')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('Fecha')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('Primera Apertura')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('Último Cierre')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('Apertura')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('Ventas')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('Retiros')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('Cierre Esperado')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('Cierre Real')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('Diferencia')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('Acciones')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailySessions.map((day: any) => (
                  <tr key={day.date} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {profile?.role === 'admin' || profile?.role === 'super_admin' ? day.employee_profiles?.full_name || 'N/A' : t('Tú')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(day.date).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(day.firstOpen).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {day.lastClose ? new Date(day.lastClose).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                      {formatCurrency(day.totalOpening)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(day.totalSales || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                      {formatCurrency(day.totalWithdrawals || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {formatCurrency(day.expectedClosing || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                      {formatCurrency(day.totalClosing || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                      <span className={`px-2 py-1 rounded ${
                        Math.abs(day.difference) < 0.01 ? 'bg-green-100 text-green-700' :
                        day.difference > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {formatCurrency(day.difference || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => printDailyReport(day)}
                          className="text-amber-600 hover:text-amber-900 p-1 rounded-md hover:bg-amber-50 transition-colors"
                          title={t('Imprimir reporte diario')}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {(profile?.role === 'admin' || profile?.role === 'super_admin') && day.sessions.length > 0 && (
                          <button
                            onClick={() => {
                              setSelectedSessionForWithdrawal(day.sessions[0].id);
                              setShowWithdrawalModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors text-xs"
                            title={t('Registrar retiro de caja')}
                          >
                            {t('Retiro')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para registrar retiros de caja */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full m-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">{t('Registrar Retiro de Caja')}</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Monto a retirar')} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Motivo del retiro')} *
                  </label>
                  <select
                    value={withdrawalReason}
                    onChange={(e) => setWithdrawalReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{t('Seleccionar motivo')}</option>
                    <option value="Depósito bancario">{t('Depósito bancario')}</option>
                    <option value="Pago a proveedor">{t('Pago a proveedor')}</option>
                    <option value="Gastos operativos">{t('Gastos operativos')}</option>
                    <option value="Cambio de billetes">{t('Cambio de billetes')}</option>
                    <option value="Otros">{t('Otros')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('Notas adicionales')} ({t('opcional')})
                  </label>
                  <textarea
                    value={withdrawalNotes}
                    onChange={(e) => setWithdrawalNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder={t('Detalles adicionales sobre el retiro...')}
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    <strong>ℹ️ {t('Importante')}:</strong> {t('Este retiro se restará del cálculo del cierre de caja esperado.')}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowWithdrawalModal(false);
                    setWithdrawalAmount('');
                    setWithdrawalReason('');
                    setWithdrawalNotes('');
                    setSelectedSessionForWithdrawal(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('Cancelar')}
                </button>
                <button
                  onClick={registerWithdrawal}
                  disabled={!withdrawalAmount || !withdrawalReason}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('Registrar Retiro')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}