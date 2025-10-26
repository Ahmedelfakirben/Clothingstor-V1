import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Clock, Calendar, DollarSign, TrendingUp, Download, User, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Employee {
  id: string;
  full_name: string;
  role: string;
  email: string;
  phone: string;
  active: boolean;
  created_at: string;
}

interface CompanySettings {
  id: string;
  company_name: string;
  address: string;
  phone: string;
}

interface WorkSession {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  status: string;
  hours_worked: number;
}

interface DayStats {
  date: string;
  sessions: WorkSession[];
  total_hours: number;
  total_sales: number;
  orders_count: number;
  first_check_in: string;
  last_check_out: string | null;
}

interface MonthStats {
  total_days_worked: number;
  total_hours_worked: number;
  average_hours_per_day: number;
  total_sales: number;
  total_orders: number;
}

export function EmployeeTimeTracking() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [dayStats, setDayStats] = useState<DayStats[]>([]);
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    fetchEmployees();
    fetchCompanySettings();

    // Listen for company settings updates
    const handleCompanySettingsUpdate = (event: any) => {
      console.log('Company settings updated in EmployeeTimeTracking:', event.detail);
      if (event.detail) {
        setCompanySettings(event.detail);
      }
    };

    window.addEventListener('companySettingsUpdated', handleCompanySettingsUpdate);

    return () => {
      window.removeEventListener('companySettingsUpdated', handleCompanySettingsUpdate);
    };
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeStats();
    }
  }, [selectedEmployee, selectedMonth]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_profiles')
        .select('*')
        .eq('active', true)
        .is('deleted_at', null)
        .neq('role', 'super_admin') // Ocultar super_admin
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error(t('Error al cargar empleados'));
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
      // Don't show error toast for company settings as it's not critical for the main functionality
    }
  };

  const fetchEmployeeStats = async () => {
    if (!selectedEmployee) return;

    setLoading(true);
    try {
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(selectedMonth + '-01');
      endDate.setMonth(endDate.getMonth() + 1);
      const endDateStr = endDate.toISOString().split('T')[0];

      // Obtener sesiones de caja del mes
      const { data: sessions, error: sessionsError } = await supabase
        .from('cash_register_sessions')
        .select('*')
        .eq('employee_id', selectedEmployee.id)
        .gte('opened_at', startDate)
        .lt('opened_at', endDateStr)
        .order('opened_at', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Obtener órdenes del mes
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total, created_at, status')
        .eq('employee_id', selectedEmployee.id)
        .gte('created_at', startDate)
        .lt('created_at', endDateStr)
        .eq('status', 'completed');

      if (ordersError) throw ordersError;

      // Agrupar sesiones por día
      const dayStatsMap = new Map<string, DayStats>();

      sessions?.forEach((session) => {
        const date = session.opened_at.split('T')[0];

        if (!dayStatsMap.has(date)) {
          dayStatsMap.set(date, {
            date,
            sessions: [],
            total_hours: 0,
            total_sales: 0,
            orders_count: 0,
            first_check_in: session.opened_at,
            last_check_out: session.closed_at,
          });
        }

        const dayData = dayStatsMap.get(date)!;

        // Calcular horas trabajadas
        let hoursWorked = 0;
        if (session.closed_at) {
          const opened = new Date(session.opened_at);
          const closed = new Date(session.closed_at);
          hoursWorked = (closed.getTime() - opened.getTime()) / (1000 * 60 * 60);
        }

        dayData.sessions.push({
          ...session,
          hours_worked: hoursWorked,
        });

        dayData.total_hours += hoursWorked;

        // Actualizar primera entrada y última salida
        if (new Date(session.opened_at) < new Date(dayData.first_check_in)) {
          dayData.first_check_in = session.opened_at;
        }
        if (session.closed_at && (!dayData.last_check_out || new Date(session.closed_at) > new Date(dayData.last_check_out))) {
          dayData.last_check_out = session.closed_at;
        }
      });

      // Agregar ventas por día
      // Para empleados sin sesiones de caja (camareros, baristas), crear entradas basadas en órdenes
      orders?.forEach((order) => {
        const date = order.created_at.split('T')[0];

        // Si no existe un día para este empleado, créalo (para camareros/baristas sin sesión de caja)
        if (!dayStatsMap.has(date)) {
          dayStatsMap.set(date, {
            date,
            sessions: [],
            total_hours: 0, // Sin sesiones de caja, horas = 0
            total_sales: 0,
            orders_count: 0,
            first_check_in: order.created_at,
            last_check_out: null,
          });
        }

        const dayData = dayStatsMap.get(date)!;
        dayData.total_sales += order.total;
        dayData.orders_count += 1;
      });

      const dayStatsArray = Array.from(dayStatsMap.values()).sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Calcular estadísticas del mes
      const totalHours = dayStatsArray.reduce((sum, day) => sum + day.total_hours, 0);
      const totalSales = dayStatsArray.reduce((sum, day) => sum + day.total_sales, 0);
      const totalOrders = dayStatsArray.reduce((sum, day) => sum + day.orders_count, 0);

      setDayStats(dayStatsArray);
      setMonthStats({
        total_days_worked: dayStatsArray.length,
        total_hours_worked: totalHours,
        average_hours_per_day: dayStatsArray.length > 0 ? totalHours / dayStatsArray.length : 0,
        total_sales: totalSales,
        total_orders: totalOrders,
      });
    } catch (error) {
      console.error('Error fetching employee stats:', error);
      toast.error(t('Error al cargar estadísticas'));
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!selectedEmployee || !monthStats || dayStats.length === 0) {
      toast.error(t('No hay datos para exportar'));
      return;
    }

    toast.loading(t('reports.generating'), { id: 'export' });

    try {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen
      const summaryData = [
        [t('reports.company_info')],
        [''],
        ...(companySettings ? [
          [t('reports.company'), companySettings.company_name],
          [t('Dirección'), companySettings.address || t('No especificada')],
          [t('reports.phone'), companySettings.phone || t('No especificado')],
          [''],
        ] : [
          [t('reports.company'), t('No configurada')],
          [''],
        ]),
        [t('reports.time_performance_report')],
        [''],
        [t('Empleado'), selectedEmployee.full_name],
        [t('reports.role'), selectedEmployee.role],
        [t('reports.email'), selectedEmployee.email],
        [t('reports.period'), new Date(selectedMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })],
        [t('reports.generation_date'), new Date().toLocaleDateString('es-ES')],
        [''],
        ['═'.repeat(60)],
        [t('reports.month_summary')],
        ['═'.repeat(60)],
        [''],
        [t('reports.metric'), t('reports.value')],
        [t('reports.days_worked'), monthStats.total_days_worked],
        [t('reports.total_hours'), `${monthStats.total_hours_worked.toFixed(2)} ${t('reports.hours_abbr')}`],
        [t('reports.average_hours_per_day'), `${monthStats.average_hours_per_day.toFixed(2)} ${t('reports.hours_abbr')}`],
        [t('reports.generated_sales'), `${formatCurrency(monthStats.total_sales)}`],
        [t('reports.completed_orders'), monthStats.total_orders],
        [t('reports.sales_per_hour'), monthStats.total_hours_worked > 0 ? `${formatCurrency(monthStats.total_sales / monthStats.total_hours_worked)}` : formatCurrency(0)],
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 1 } },
        { s: { r: 10, c: 0 }, e: { r: 10, c: 1 } },
      ];
      XLSX.utils.book_append_sheet(wb, wsSummary, t('reports.summary_sheet'));

      // Hoja 2: Desglose Diario
      const dailyData = [
        [t('reports.company_info')],
        [''],
        ...(companySettings ? [
          [t('reports.company'), companySettings.company_name],
          [t('Dirección'), companySettings.address || t('No especificada')],
          [t('reports.phone'), companySettings.phone || t('No especificado')],
          [''],
        ] : [
          [t('reports.company'), t('No configurada')],
          [''],
        ]),
        [t('reports.daily_work_breakdown')],
        [''],
        [t('Empleado'), selectedEmployee.full_name],
        [t('reports.period'), new Date(selectedMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })],
        [''],
        [t('Fecha'), t('reports.day'), t('Entrada'), t('Salida'), t('reports.hours'), t('reports.sessions'), t('Ventas'), t('Pedidos'), t('reports.sales_per_hour')],
      ];

      dayStats.forEach((day) => {
        const date = new Date(day.date);
        const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
        const entry = day.first_check_in ? new Date(day.first_check_in).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-';
        const exit = day.last_check_out ? new Date(day.last_check_out).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : t('En curso');
        const salesPerHour = day.total_hours > 0 ? day.total_sales / day.total_hours : 0;

        dailyData.push([
          date.toLocaleDateString('es-ES'),
          dayName.charAt(0).toUpperCase() + dayName.slice(1),
          entry,
          exit,
          `${day.total_hours.toFixed(2)} ${t('reports.hours_abbr')}`,
          day.sessions.length,
          `${formatCurrency(day.total_sales)}`,
          day.orders_count,
          `${formatCurrency(salesPerHour)}/hr`,
        ]);
      });

      const wsDaily = XLSX.utils.aoa_to_sheet(dailyData);
      wsDaily['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      ];
      XLSX.utils.book_append_sheet(wb, wsDaily, t('reports.daily_breakdown_sheet'));

      // Hoja 3: Detalle de Sesiones
      const sessionsData = [
        [t('reports.company_info')],
        [''],
        ...(companySettings ? [
          [t('reports.company'), companySettings.company_name],
          [t('Dirección'), companySettings.address || t('No especificada')],
          [t('reports.phone'), companySettings.phone || t('No especificado')],
          [''],
        ] : [
          [t('reports.company'), t('No configurada')],
          [''],
        ]),
        [t('reports.work_sessions_detail')],
        [''],
        [t('Empleado'), selectedEmployee.full_name],
        [t('reports.period'), new Date(selectedMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })],
        [''],
        [t('Fecha'), t('reports.opening'), t('reports.closing'), t('reports.duration'), t('reports.initial_amount'), t('reports.final_amount'), t('reports.difference'), t('Estado')],
      ];

      dayStats.forEach((day) => {
        day.sessions.forEach((session) => {
          const date = new Date(session.opened_at).toLocaleDateString('es-ES');
          const opened = new Date(session.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          const closed = session.closed_at ? new Date(session.closed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : t('Abierta');
          const duration = `${session.hours_worked.toFixed(2)} ${t('reports.hours_abbr')}`;
          const difference = session.closing_amount ? session.closing_amount - session.opening_amount : 0;

          sessionsData.push([
            date,
            opened,
            closed,
            duration,
            `${formatCurrency(session.opening_amount)}`,
            session.closing_amount ? `${formatCurrency(session.closing_amount)}` : 'N/A',
            `${formatCurrency(difference)}`,
            session.status === 'closed' ? t('Cerrada') : t('Abierta'),
          ]);
        });
      });

      const wsSessions = XLSX.utils.aoa_to_sheet(sessionsData);
      wsSessions['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      ];
      XLSX.utils.book_append_sheet(wb, wsSessions, t('Sesiones'));

      // Generar nombre de archivo
      const monthName = new Date(selectedMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const filename = `${t('reports.filename_time')}${selectedEmployee.full_name.replace(/\s+/g, '_')}_${monthName.replace(/\s+/g, '_')}.xlsx`;

      // Descargar archivo
      XLSX.writeFile(wb, filename);

      toast.success(t('Reporte generado exitosamente'), { id: 'export' });
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error(t('Error al generar reporte'), { id: 'export' });
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{t('Gestión de Tiempo de Empleados')}</h2>
          {selectedEmployee && dayStats.length > 0 && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-md"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>{t('analytics.export_excel')}</span>
            </button>
          )}
        </div>

        {/* Selector de Empleado y Mes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('Seleccionar Empleado')}
            </label>
            <select
              value={selectedEmployee?.id || ''}
              onChange={(e) => {
                const emp = employees.find(employee => employee.id === e.target.value);
                setSelectedEmployee(emp || null);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="">-- {t('Seleccione un empleado')} --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('time_tracking.month')}
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              max={new Date().toISOString().slice(0, 7)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">{t('time_tracking.loading_stats')}</p>
          </div>
        </div>
      ) : selectedEmployee ? (
        <>
          {/* Estadísticas del Mes */}
          {monthStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-8 h-8 opacity-80" />
                  <span className="text-xs font-medium opacity-90">{t('time_tracking.days')}</span>
                </div>
                <p className="text-3xl font-bold mb-1">{monthStats.total_days_worked}</p>
                <p className="text-sm opacity-90">{t('Días trabajados')}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-8 h-8 opacity-80" />
                  <span className="text-xs font-medium opacity-90">{t('Total')}</span>
                </div>
                <p className="text-3xl font-bold mb-1">{monthStats.total_hours_worked.toFixed(1)}</p>
                <p className="text-sm opacity-90">{t('Horas trabajadas')}</p>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-8 h-8 opacity-80" />
                  <span className="text-xs font-medium opacity-90">{t('time_tracking.average')}</span>
                </div>
                <p className="text-3xl font-bold mb-1">{monthStats.average_hours_per_day.toFixed(1)}</p>
                <p className="text-sm opacity-90">{t('Horas por día')}</p>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-8 h-8 opacity-80" />
                  <span className="text-xs font-medium opacity-90">{t('Ventas')}</span>
                </div>
                <p className="text-3xl font-bold mb-1">${monthStats.total_sales.toFixed(0)}</p>
                <p className="text-sm opacity-90">{t('time_tracking.generated')}</p>
              </div>
            </div>
          )}

          {/* Tabla de Días */}
          {dayStats.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-500">
                <h3 className="text-lg font-bold text-white">{t('time_tracking.daily_breakdown')}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Fecha')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Entrada')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Salida')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('time_tracking.hours')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Sesiones')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Ventas')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('Pedidos')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dayStats.map((day) => (
                      <tr key={day.date} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(day.date).toLocaleDateString('es-ES', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(day.first_check_in).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.last_check_out
                            ? new Date(day.last_check_out).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : t('En curso')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            {day.total_hours.toFixed(2)} {t('reports.hours_abbr')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.sessions.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          {formatCurrency(day.total_sales)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.orders_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {t('time_tracking.no_records')}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">{t('time_tracking.select_employee')}</p>
        </div>
      )}
    </div>
  );
}
