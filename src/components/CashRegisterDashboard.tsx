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

// interface Order { ... }

export function CashRegisterDashboard() {
  const { user, profile } = useAuth();
  const { t, currentLanguage } = useLanguage();
  const { formatCurrency: formatCurrencyFromContext } = useCurrency();
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    status: 'all' as 'all' | 'open' | 'closed',
    employeeId: 'all' as string,
  });

  const [employees, setEmployees] = useState<Array<{ id: string, full_name: string }>>([]);


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
  const [, setWithdrawals] = useState<CashWithdrawal[]>([]);

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
          query = query.gte('opened_at', filters.startDate + 'T00:00:00');
        }
        if (filters.endDate) {
          query = query.lte('opened_at', filters.endDate + 'T23:59:59');
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
      // 1. GLOBAL VIEW FOR ADMINS
      if (profile?.role === 'admin' || profile?.role === 'super_admin') {
        const todayCommon = new Date().toISOString().split('T')[0];

        // A. Total Openings Today
        const { data: todaySessions } = await supabase
          .from('cash_register_sessions')
          .select('opening_amount, id')
          .gte('opened_at', todayCommon)
          .lte('opened_at', todayCommon + 'T23:59:59');

        const totalOpenings = (todaySessions || []).reduce((sum, s) => sum + Number(s.opening_amount), 0);

        // B. Total Sales Today (Global)
        const { data: todayOrders } = await supabase
          .from('orders')
          .select('total')
          .eq('status', 'completed')
          .gte('created_at', todayCommon)
          .lte('created_at', todayCommon + 'T23:59:59');

        const totalSales = (todayOrders || []).reduce((sum, o) => sum + Number(o.total), 0);

        // C. Total Withdrawals Today (Linked to today's sessions or just globally today?)
        // Ideally linked to sessions opened today, or created_at today. 
        // Let's use created_at for global consistency.
        const { data: todayWithdrawals } = await supabase
          .from('cash_withdrawals')
          .select('amount')
          .gte('created_at', todayCommon)
          .lte('created_at', todayCommon + 'T23:59:59');

        const totalWithdrawals = (todayWithdrawals || []).reduce((sum, w) => sum + Number(w.amount), 0);

        const globalDailyBalance = totalOpenings + totalSales - totalWithdrawals;

        setCurrentCashStatus({
          currentAmount: globalDailyBalance,
          lastSessionStatus: (todaySessions && todaySessions.length > 0) ? 'open' : 'closed', // Simplification
          lastSessionTime: new Date().toISOString(),
        });
        return;
      }

      // 2. PERSONAL VIEW FOR CASHIERS (Existing Logic)
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

        // CHECK IF SESSION IS FROM TODAY
        const sessionDate = new Date(latestSession.opened_at).toDateString();
        const todayDate = new Date().toDateString();

        if (sessionDate !== todayDate) {
          // If the latest session is NOT from today, show 0 (New Day)
          setCurrentCashStatus({
            currentAmount: 0,
            lastSessionStatus: 'closed', // Assume closed if it's a new day
            lastSessionTime: '',
          });
          return;
        }

        // If session is closed, just show closing amount
        if (latestSession.status === 'closed') {
          setCurrentCashStatus({
            currentAmount: latestSession.closing_amount || 0,
            lastSessionStatus: 'closed',
            lastSessionTime: latestSession.closed_at || latestSession.opened_at,
          });
          return;
        }

        // If session is OPEN, calculate real-time balance: Opening + Sales - Withdrawals

        // 1. Fetch sales (orders) since opening
        const { data: orders } = await supabase
          .from('orders')
          .select('total')
          .eq('employee_id', latestSession.employee_id)
          .eq('status', 'completed')
          .gte('created_at', latestSession.opened_at);

        const currentSales = (orders || []).reduce((sum, order) => sum + order.total, 0);

        // 2. Fetch withdrawals for this session
        const { data: withdrawals } = await supabase
          .from('cash_withdrawals')
          .select('amount')
          .eq('session_id', latestSession.id);

        const currentWithdrawals = (withdrawals || []).reduce((sum, w) => sum + w.amount, 0);

        const realTimeBalance = (latestSession.opening_amount || 0) + currentSales - currentWithdrawals;

        setCurrentCashStatus({
          currentAmount: realTimeBalance,
          lastSessionStatus: 'open',
          lastSessionTime: latestSession.opened_at,
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
          payment_method,
          order_items (
            quantity,
            unit_price,
            products!product_id(name)
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

      // Payment breakdown
      const paymentLabel = (method: string | null) => {
        if (currentLanguage === 'fr') {
          switch (method) { case 'cash': return 'Espèces'; case 'card': return 'Carte bancaire'; case 'digital': return 'Paiement digital'; default: return 'Non spécifié'; }
        }
        switch (method) { case 'cash': return 'Efectivo'; case 'card': return 'Tarjeta bancaria'; case 'digital': return 'Pago digital'; default: return 'No especificado'; }
      };
      const payBreak: Record<string, { count: number; total: number }> = {};
      (orders || []).forEach((o: any) => {
        const k = o.payment_method || 'unknown';
        if (!payBreak[k]) payBreak[k] = { count: 0, total: 0 };
        payBreak[k].count++;
        payBreak[k].total += o.total || 0;
      });
      const payBreakHtml = Object.entries(payBreak).map(([method, d]) => `
        <tr>
          <td>${paymentLabel(method)}</td>
          <td style="text-align:center">${d.count}</td>
          <td style="text-align:right; font-weight:bold">${formatCurrency(d.total)}</td>
          <td style="text-align:right">${orderTotal > 0 ? ((d.total / orderTotal) * 100).toFixed(1) + '%' : '0%'}</td>
        </tr>`).join('');

      const locale = currentLanguage === 'fr' ? 'fr-FR' : 'es-ES';

      // Create professional invoice-style print content
      const printContent = `
        <div class="report">
          <div class="header">
            <h1>LIN-Caisse</h1>
            <p>${t('Sistema de Gestión Integral')}</p>
            <p>${t('Reporte Diario de Caja')}</p>
          </div>

          <div class="info-section">
            <div class="info-item">
              <strong>${new Date(day.date).toLocaleDateString(locale)}</strong>
              <span>${t('Fecha del Reporte')}</span>
            </div>
            <div class="info-item">
              <strong>${profile?.role === 'admin' || profile?.role === 'super_admin' ? day.employee_profiles?.full_name || 'N/A' : 'Tú'}</strong>
              <span>${t('Empleado')}</span>
            </div>
            <div class="info-item">
              <strong>${orderCount}</strong>
              <span>${t('Total Pedidos')}</span>
            </div>
            <div class="info-item">
              <strong>${formatCurrency(orderTotal)}</strong>
              <span>${t('Total Ventas')}</span>
            </div>
          </div>

          <div class="section-title">${t('RESUMEN FINANCIERO DEL DÍA')}</div>
          <div class="summary-grid">
            <div class="summary-item">
              <strong>${formatCurrency(day.totalOpening)}</strong>
              <span>${t('Total Inicial')}</span>
            </div>
            <div class="summary-item">
              <strong>${formatCurrency(day.totalClosing)}</strong>
              <span>${t('Total Final')}</span>
            </div>
            <div class="summary-item">
              <strong>${formatCurrency(day.totalClosing - day.totalOpening)}</strong>
              <span>${t('Balance del Día')}</span>
            </div>
            <div class="summary-item">
              <strong>${day.sessions.length}</strong>
              <span>${t('Sesiones de Caja')}</span>
            </div>
          </div>

          <div class="section-title">${currentLanguage === 'fr' ? 'PAIEMENTS PAR MÉTHODE' : 'PAGOS POR MÉTODO DE PAGO'}</div>
          <div class="table-container">
            <table>
              <thead><tr>
                <th>${currentLanguage === 'fr' ? 'Méthode' : 'Método'}</th>
                <th style="text-align:center">${currentLanguage === 'fr' ? 'Nb ventes' : 'N° ventas'}</th>
                <th style="text-align:right">${currentLanguage === 'fr' ? 'Total' : 'Total'}</th>
                <th style="text-align:right">%</th>
              </tr></thead>
              <tbody>${payBreakHtml}</tbody>
            </table>
          </div>

          <div class="section-title">${t('DETALLE DE SESIONES')}</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>${t('Sesión')}</th>
                  <th>${t('Hora Apertura')}</th>
                  <th>${t('Monto Inicial')}</th>
                  <th>${t('Hora Cierre')}</th>
                  <th>${t('Monto Final')}</th>
                  <th>${t('Estado')}</th>
                </tr>
              </thead>
              <tbody>
                ${day.sessions.map((session: CashSession, index: number) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${new Date(session.opened_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${formatCurrency(session.opening_amount)}</td>
                    <td>${session.closed_at ? new Date(session.closed_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td>${session.closing_amount ? formatCurrency(session.closing_amount) : '-'}</td>
                    <td>${session.closed_at ? t('Cerrada') : t('Abierta')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="section-title">${t('DETALLE DE PEDIDOS')}</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>${t('N° Pedido')}</th>
                  <th>${t('Hora')}</th>
                  <th>${currentLanguage === 'fr' ? 'Mode de paiement' : 'Método de pago'}</th>
                  <th>${t('Productos')}</th>
                  <th>${t('Total')}</th>
                </tr>
              </thead>
              <tbody>
                ${(orders || []).map(order => `
                  <tr>
                    <td>${order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(-8)}</td>
                    <td>${new Date(order.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;background:${
                      (order as any).payment_method === 'cash' ? '#dcfce7' :
                      (order as any).payment_method === 'card' ? '#dbeafe' : '#fef9c3'
                    };color:${
                      (order as any).payment_method === 'cash' ? '#166534' :
                      (order as any).payment_method === 'card' ? '#1e40af' : '#713f12'
                    }">${paymentLabel((order as any).payment_method)}</span></td>
                    <td>${order.order_items.map((item: any) => {
                      const prodInfo = item.products || item.products_product_id;
                      const pName = Array.isArray(prodInfo) ? prodInfo[0]?.name : prodInfo?.name;
                      return `${item.quantity}x ${pName || t('Producto')}`;
                    }).join('<br/>')}</td>
                    <td>${formatCurrency(order.total)}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="4" style="text-align: right; font-weight: bold;">${t('TOTAL DEL DÍA')}</td>
                  <td style="font-weight: bold; font-size: 16px;">${formatCurrency(orderTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <p>${t('Firma del Empleado')}</p>
              <p>${profile?.role === 'admin' || profile?.role === 'super_admin' ? day.employee_profiles?.full_name || 'N/A' : profile?.full_name || 'Usuario'}</p>
            </div>
            <div class="signature-box">
              <p>${t('Firma del Administrador')}</p>
            </div>
          </div>

          <div class="footer">
            <p>${t('Este documento es oficial y forma parte del registro contable de LIN-Caisse')}</p>
            <p>${t('Reporte generado el')} ${new Date().toLocaleString(locale)}</p>
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
                      <span className={`px-2 py-1 rounded ${Math.abs(day.difference) < 0.01 ? 'bg-green-100 text-green-700' :
                        day.difference > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {formatCurrency(day.difference || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => printDailyReport(day)}
                          className="flex items-center gap-1 bg-amber-100 text-amber-700 hover:bg-amber-200 hover:text-amber-800 px-3 py-1.5 rounded-md transition-colors text-sm font-medium"
                          title={t('Imprimir reporte diario')}
                        >
                          <Printer className="w-4 h-4" />
                          <span>{t('Reporte')}</span>
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

      {/* HISTORIAL GLOBAL DIARIO (SOLO ADMINS) */}
      {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
        <DailyHistorySection />
      )}
    </div>
  );
}

// Sub-component for Daily History to keep main component clean
function DailyHistorySection() {
  const { t, currentLanguage } = useLanguage(); // Added currentLanguage for date locale
  const { formatCurrency } = useCurrency();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGlobalHistory();
  }, []);

  const fetchGlobalHistory = async () => {
    try {
      setLoading(true);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

      // 1. Fetch Sessions
      const { data: sessions } = await supabase
        .from('cash_register_sessions')
        .select('*')
        .gte('opened_at', dateStr)
        .order('opened_at', { ascending: false });

      // 2. Fetch Orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total, created_at, status')
        .gte('created_at', dateStr)
        .eq('status', 'completed');

      // 3. Fetch Withdrawals
      const { data: withdrawals } = await supabase
        .from('cash_withdrawals')
        .select('id, amount, withdrawn_at')
        .gte('withdrawn_at', dateStr);

      // Aggregate by Date
      const dateMap = new Map();

      // Helper to init date entry
      const getEntry = (date: string) => {
        if (!dateMap.has(date)) {
          dateMap.set(date, {
            date,
            totalOpening: 0,
            totalClosing: 0,
            salesCount: 0,
            totalSales: 0,
            totalWithdrawals: 0,
            sessionsCount: 0
          });
        }
        return dateMap.get(date);
      };

      (sessions || []).forEach(s => {
        const d = new Date(s.opened_at).toLocaleDateString('en-CA'); // YYYY-MM-DD
        const entry = getEntry(d);
        entry.totalOpening += s.opening_amount || 0;
        entry.totalClosing += s.closing_amount || 0;
        entry.sessionsCount++;
      });

      (orders || []).forEach(o => {
        const d = new Date(o.created_at).toLocaleDateString('en-CA');
        const entry = getEntry(d);
        entry.totalSales += o.total || 0;
        entry.salesCount++;
      });

      (withdrawals || []).forEach(w => {
        const d = new Date(w.withdrawn_at).toLocaleDateString('en-CA');
        const entry = getEntry(d);
        entry.totalWithdrawals += w.amount || 0;
      });

      const sortedHistory = Array.from(dateMap.values())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setHistory(sortedHistory);
    } catch (error) {
      console.error('Error fetching global history:', error);
    } finally {
      setLoading(false);
    }
  };

  const printSummary = async (day: any) => {
    const dateLocale = currentLanguage === 'fr' ? 'fr-FR' : 'es-ES';

    const paymentLabel = (method: string | null) => {
      if (currentLanguage === 'fr') {
        switch (method) { case 'cash': return 'Esp\u00e8ces'; case 'card': return 'Carte bancaire'; case 'digital': return 'Paiement digital'; default: return 'Non sp\u00e9cifi\u00e9'; }
      }
      switch (method) { case 'cash': return 'Efectivo'; case 'card': return 'Tarjeta bancaria'; case 'digital': return 'Pago digital'; default: return 'No especificado'; }
    };

    try {
      // Parse the date properly (YYYY-MM-DD stored as en-CA locale)
      const [year, month, dayNum] = day.date.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, dayNum, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, dayNum, 23, 59, 59, 999);

      // Fetch all orders of the day with items and payment method
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id, total, order_number, created_at, employee_id, payment_method,
          order_items (
            quantity,
            unit_price,
            products!product_id(name)
          )
        `)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

      // Fetch employee names
      const empIds = [...new Set((orders || []).map((o: any) => o.employee_id).filter(Boolean))];
      const empMap: Record<string, string> = {};
      if (empIds.length > 0) {
        const { data: emps } = await supabase.from('employee_profiles').select('id, full_name').in('id', empIds);
        (emps || []).forEach((e: any) => { empMap[e.id] = e.full_name; });
      }

      const totalSales = (orders || []).reduce((s: number, o: any) => s + (o.total || 0), 0);

      // Payment breakdown
      const payBreak: Record<string, { count: number; total: number }> = {};
      (orders || []).forEach((o: any) => {
        const k = o.payment_method || 'unknown';
        if (!payBreak[k]) payBreak[k] = { count: 0, total: 0 };
        payBreak[k].count++;
        payBreak[k].total += o.total || 0;
      });

      const payBreakHtml = Object.entries(payBreak).map(([method, d]) => `
        <tr>
          <td>${paymentLabel(method)}</td>
          <td style="text-align:center">${d.count}</td>
          <td style="text-align:right;font-weight:bold">${formatCurrency(d.total)}</td>
          <td style="text-align:right">${totalSales > 0 ? ((d.total / totalSales) * 100).toFixed(1) + '%' : '0%'}</td>
        </tr>`).join('');

      const ordersHtml = (orders || []).map((order: any) => {
        const items = order.order_items?.map((item: any) => {
          const prodInfo = item.products || item.products_product_id;
          const pName = Array.isArray(prodInfo) ? prodInfo[0]?.name : prodInfo?.name;
          return `${item.quantity}x ${pName || t('Producto')}`;
        }).join('<br/>') || '-';
        const badgeColor = order.payment_method === 'cash' ? '#dcfce7:#166534' : order.payment_method === 'card' ? '#dbeafe:#1e40af' : '#fef9c3:#713f12';
        const [bg, fg] = badgeColor.split(':');
        return `<tr>
          <td>${order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(-8)}</td>
          <td>${new Date(order.created_at).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${empMap[order.employee_id] || 'N/A'}</td>
          <td><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;background:${bg};color:${fg}">${paymentLabel(order.payment_method)}</span></td>
          <td>${items}</td>
          <td style="font-weight:bold">${formatCurrency(order.total)}</td>
        </tr>`;
      }).join('');

      const printContent = `
        <div style="font-family:Arial,sans-serif;max-width:210mm;margin:0 auto;padding:20px">
          <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:15px;margin-bottom:20px">
            <h1 style="margin:0;font-size:24px;color:#333">LIN-Caisse</h1>
            <p style="color:#666;margin:4px 0">${currentLanguage === 'fr' ? 'Historique Quotidien Global' : 'Historial Diario Global'}</p>
            <p style="color:#444;font-weight:bold;margin:4px 0">${new Date(day.date + 'T12:00:00').toLocaleDateString(dateLocale, { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
          </div>

          <div style="display:flex;gap:15px;margin-bottom:20px;background:#f8f9fa;padding:15px;border-radius:8px">
            <div style="flex:1;text-align:center">
              <div style="font-size:20px;font-weight:bold;color:#333">${(orders || []).length}</div>
              <div style="font-size:13px;color:#666">${currentLanguage === 'fr' ? 'Commandes' : 'Pedidos'}</div>
            </div>
            <div style="flex:1;text-align:center">
              <div style="font-size:20px;font-weight:bold;color:#166534">${formatCurrency(totalSales)}</div>
              <div style="font-size:13px;color:#666">${currentLanguage === 'fr' ? 'Total ventes' : 'Total ventas'}</div>
            </div>
            <div style="flex:1;text-align:center">
              <div style="font-size:20px;font-weight:bold;color:#dc2626">${formatCurrency(day.totalWithdrawals)}</div>
              <div style="font-size:13px;color:#666">${currentLanguage === 'fr' ? 'Retraits' : 'Retiros'}</div>
            </div>
            <div style="flex:1;text-align:center">
              <div style="font-size:20px;font-weight:bold;color:#1e40af">${formatCurrency(day.totalOpening + totalSales - day.totalWithdrawals)}</div>
              <div style="font-size:13px;color:#666">${currentLanguage === 'fr' ? 'Balance nette' : 'Balance neta'}</div>
            </div>
          </div>

          <h3 style="font-size:14px;font-weight:bold;color:#333;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px">
            ${currentLanguage === 'fr' ? 'PAIEMENTS PAR MÉTHODE' : 'PAGOS POR MÉTODO'}
          </h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #ddd;border-radius:8px;overflow:hidden">
            <thead><tr style="background:#f8f9fa">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#555">${currentLanguage === 'fr' ? 'Méthode' : 'Método'}</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#555">${currentLanguage === 'fr' ? 'Nb ventes' : 'N° ventas'}</th>
              <th style="padding:8px 12px;text-align:right;font-size:12px;color:#555">Total</th>
              <th style="padding:8px 12px;text-align:right;font-size:12px;color:#555">%</th>
            </tr></thead>
            <tbody>${payBreakHtml}</tbody>
          </table>

          <h3 style="font-size:14px;font-weight:bold;color:#333;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px">
            ${currentLanguage === 'fr' ? 'DÉTAIL DES COMMANDES' : 'DETALLE DE PEDIDOS'}
          </h3>
          <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;border-radius:8px;overflow:hidden">
            <thead><tr style="background:#f8f9fa">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#555">${currentLanguage === 'fr' ? 'N° Cmd' : 'N° Ped'}</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#555">${currentLanguage === 'fr' ? 'Heure' : 'Hora'}</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#555">${currentLanguage === 'fr' ? 'Employé' : 'Empleado'}</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#555">${currentLanguage === 'fr' ? 'Paiement' : 'Pago'}</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#555">${currentLanguage === 'fr' ? 'Articles' : 'Artículos'}</th>
              <th style="padding:8px 12px;text-align:right;font-size:12px;color:#555">Total</th>
            </tr></thead>
            <tbody>${ordersHtml}
              <tr style="background:#e9ecef;font-weight:bold">
                <td colspan="5" style="padding:10px 12px;text-align:right">${currentLanguage === 'fr' ? 'TOTAL DU JOUR' : 'TOTAL DEL DÍA'}</td>
                <td style="padding:10px 12px;text-align:right;font-size:15px">${formatCurrency(totalSales)}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top:40px;display:flex;justify-content:space-between">
            <div style="width:200px;text-align:center;border-top:1px solid #333;padding-top:8px">
              <p style="font-size:12px;color:#666">${currentLanguage === 'fr' ? 'Signature Employé' : 'Firma del Empleado'}</p>
            </div>
            <div style="width:200px;text-align:center;border-top:1px solid #333;padding-top:8px">
              <p style="font-size:12px;color:#666">${currentLanguage === 'fr' ? 'Signature Admin' : 'Firma del Administrador'}</p>
            </div>
          </div>

          <div style="margin-top:30px;text-align:center;border-top:1px solid #ddd;padding-top:15px;color:#888;font-size:11px">
            <p>${currentLanguage === 'fr' ? 'Document officiel LIN-Caisse' : 'Documento oficial LIN-Caisse'}</p>
            <p>${currentLanguage === 'fr' ? 'Généré le' : 'Generado el'} ${new Date().toLocaleString(dateLocale)}</p>
          </div>
        </div>`;

      const win = window.open('', '', 'width=900,height=800');
      if (win) {
        win.document.write(`<html><head><title>${currentLanguage === 'fr' ? 'Rapport Journalier' : 'Reporte Diario'}</title><style>@media print{body{-webkit-print-color-adjust:exact}}</style></head><body>${printContent}</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 300);
      }
    } catch (err) {
      console.error('Error generating global daily report:', err);
    }
  };

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-6 h-6 text-gray-700" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('cash.daily_history_title')}</h2>
          <p className="text-sm text-gray-500">{t('cash.daily_history_subtitle')}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Fecha')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('cash.total_openings_sum')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('cash.total_sales_sum')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('cash.total_withdrawals_sum')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('cash.theoretical_balance')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Acciones')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-4">{t('cash.loading_history')}</td></tr>
            ) : history.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-4">{t('cash.no_history_data')}</td></tr>
            ) : (
              history.map(day => (
                <tr key={day.date} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {new Date(day.date).toLocaleDateString(currentLanguage === 'fr' ? 'fr-FR' : 'es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatCurrency(day.totalOpening)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{formatCurrency(day.totalSales)} <span className="text-xs text-gray-400">({day.salesCount})</span></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{formatCurrency(day.totalWithdrawals)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{formatCurrency(day.totalOpening + day.totalSales - day.totalWithdrawals)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => printSummary(day)}
                      className="text-amber-600 hover:text-amber-900 flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
                    >
                      <Printer className="w-4 h-4" /> {t('cash.report_button')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}