import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { X, Calendar, ShoppingCart, Info, TrendingUp } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface ProductHistoryModalProps {
  productId: string;
  productName: string;
  currentStock: number;
  onClose: () => void;
}

interface HistoryEvent {
  id: string;
  type: 'creation' | 'sale' | 'validation' | 'return' | 'manual_add' | 'manual_deduct';
  date: string;
  quantity: number;
  price?: number;
  employeeName?: string;
  sizeName?: string;
  reason?: string;
}

export default function ProductHistoryModal({ productId, productName, currentStock, onClose }: ProductHistoryModalProps) {
  const { currentLanguage } = useLanguage();
  const isFr = currentLanguage === 'fr';
  const tf = (es: string, fr: string) => isFr ? fr : es;
  const { formatCurrency } = useCurrency();
  
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [totalSold, setTotalSold] = useState(0);

  useEffect(() => {
    fetchHistory();
  }, [productId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let timeline: HistoryEvent[] = [];

      // 1. Obtener datos de creación y validación del producto
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select(`
          created_at, 
          created_by, 
          validated_by,
          stock,
          product_sizes (
            size_name,
            stock
          )
        `)
        .eq('id', productId)
        .single();

      // 2. Obtener perfiles de empleados para el cruce
      const { data: profiles } = await supabase.from('employee_profiles').select('id, full_name');
      const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
        
      if (productData && !productError) {
        // Evento de Creación
        const sizesInfo = (productData.product_sizes as any[])?.length > 0
          ? (productData.product_sizes as any[]).map(s => `${s.size_name}: ${s.stock}`).join(', ')
          : `Stock: ${productData.stock || 0}`;

        timeline.push({
          id: 'creation',
          type: 'creation',
          date: productData.created_at,
          quantity: productData.stock || 0,
          sizeName: sizesInfo,
          employeeName: productData.created_by ? profileMap.get(productData.created_by) || tf('Sistema', 'Système') : tf('Administrador', 'Administrateur')
        });

        // Evento de Validación (si existe)
        if (productData.validated_by) {
            timeline.push({
              id: 'validation',
              type: 'validation',
              date: productData.created_at, // Nota: No tenemos fecha de validación exacta, usamos la de creación o asumimos que se validó
              quantity: 0,
              employeeName: profileMap.get(productData.validated_by) || tf('Administrador', 'Administrateur')
            });
        }
      }

      // 3. Obtener ventas confirmadas
      const { data: salesData, error: salesError } = await callSafeSalesQuery(productId);
      
      let soldUnits = 0;

      if (!salesError && salesData) {
        salesData.forEach((item: any) => {
          if (item.orders && item.orders.status === 'completed') {
            soldUnits += item.quantity;
            timeline.push({
              id: item.id,
              type: 'sale',
              date: item.orders.created_at,
              quantity: item.quantity,
              price: item.unit_price,
              sizeName: item.product_sizes?.size_name,
              employeeName: item.orders.employee_id ? profileMap.get(item.orders.employee_id) || tf('Vendedor Desconocido', 'Vendeur Inconnu') : tf('Sin Asignar', 'Non Assigné')
            });
          }
        });
      }

      // 4. Obtener devoluciones
      const { data: returnsData } = await supabase
        .from('order_returns')
        .select(`
          id,
          created_at,
          quantity_returned,
          unit_price,
          reason,
          returned_by,
          product_sizes(size_name)
        `)
        .eq('product_id', productId);

      if (returnsData) {
        returnsData.forEach((ret: any) => {
          soldUnits -= ret.quantity_returned; // Restar devoluciones de las unidades vendidas
          timeline.push({
            id: ret.id,
            type: 'return',
            date: ret.created_at,
            quantity: ret.quantity_returned,
            price: ret.unit_price,
            sizeName: ret.product_sizes?.size_name,
            reason: ret.reason,
            employeeName: profileMap.get(ret.returned_by) || tf('Empleado Desconocido', 'Employé Inconnu')
          });
        });
      }

      // 5. Obtener movimientos manuales de stock
      const { data: movementsData } = await supabase
        .from('stock_movements')
        .select(`
          id,
          created_at,
          quantity,
          type,
          reason,
          employee_id,
          product_sizes(size_name)
        `)
        .eq('product_id', productId);

      if (movementsData) {
        movementsData.forEach((mov: any) => {
          timeline.push({
            id: mov.id,
            type: mov.type as any, // manual_add o manual_deduct
            date: mov.created_at,
            quantity: mov.quantity,
            sizeName: mov.product_sizes?.size_name,
            reason: mov.reason,
            employeeName: profileMap.get(mov.employee_id) || tf('Sistema', 'Système')
          });
        });
      }

      setTotalSold(soldUnits);

      // Ordenar cronológicamente descendente (más recientes primero)
      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setEvents(timeline);
    } catch (err) {
      console.error('Error fetching product history:', err);
    } finally {
      setLoading(false);
    }
  };

  const callSafeSalesQuery = async (pId: string) => {
     // Utiliza un select() básico que asume foreign key directa
     return await supabase
        .from('order_items')
        .select(`
          id,
          quantity,
          unit_price,
          product_sizes(size_name),
          orders!inner (
            status,
            created_at,
            employee_id
          )
        `)
        .eq('product_id', pId);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {tf('Historial del Producto', 'Historique du Produit')}
            </h3>
            <p className="text-blue-100 text-sm mt-1">{productName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-blue-100 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <LoadingSpinner size="lg" />
              <p className="text-gray-500 font-medium animate-pulse">{tf('Analizando registros históricos...', 'Analyse des dossiers historiques...')}</p>
            </div>
          ) : (
            <div className="space-y-6 flex flex-col h-full">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                    <Info className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">{tf('Stock Actual en Tienda', 'Stock Actuel en Magasin')}</p>
                    <p className="text-2xl font-bold text-gray-900">{currentStock}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="bg-green-100 p-3 rounded-lg text-green-600">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">{tf('Total de Unidades Vendidas', 'Total des Unités Vendues')}</p>
                    <p className="text-2xl font-bold text-gray-900">{totalSold}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <h4 className="font-semibold text-gray-700">{tf('Línea de Tiempo de Movimientos', 'Chronologie des Mouvements')}</h4>
                </div>
                
                <div className="p-5 max-h-[50vh] overflow-y-auto">
                  {events.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p>{tf('No hay registros disponibles para este producto.', 'Aucun enregistrement disponible pour ce produit.')}</p>
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                      {events.map((ev, idx) => (
                        <div key={ev.id + idx} className="relative pl-6">
                          {/* Dot */}
                          <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-sm
                            ${ev.type === 'creation' ? 'bg-blue-500' : 
                              ev.type === 'validation' ? 'bg-purple-500' : 
                              ev.type === 'manual_add' ? 'bg-cyan-500' :
                              ev.type === 'manual_deduct' ? 'bg-red-400' :
                              ev.type === 'return' ? 'bg-orange-500' : 'bg-green-500'}
                          `} />
                          
                          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-1">
                              <h5 className={`font-bold flex items-center gap-2 ${
                                ev.type === 'creation' ? 'text-blue-700' : 
                                ev.type === 'validation' ? 'text-purple-700' : 
                                ev.type === 'manual_add' ? 'text-cyan-700' :
                                ev.type === 'return' ? 'text-orange-700' : 'text-green-700'}`}>
                                {ev.type === 'creation' ? tf('Producto Registrado', 'Produit Enregistré') : 
                                 ev.type === 'validation' ? tf('Producto Validado', 'Produit Validé') : 
                                 ev.type === 'manual_add' ? tf('Stock Añadido', 'Stock Ajouté') :
                                 ev.type === 'manual_deduct' ? tf('Stock Retirado', 'Stock Retiré') :
                                 ev.type === 'return' ? tf('Devolución Realizada', 'Retour Réalisé') :
                                 tf('Venta Completada', 'Vente Réalisée')}
                              </h5>
                              <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                {new Date(ev.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            </div>
                            
                            <div className="text-sm text-gray-600 mt-2 space-y-1">
                              {ev.type === 'creation' ? (
                                <>
                                  <p>
                                    {tf('El producto fue ingresado a la base de datos por:', 'Le produit a été saisi dans la base de données par :')} <span className="font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded">{ev.employeeName}</span>
                                  </p>
                                  <p className="mt-2"><span className="font-medium text-gray-700">{tf('Stock inicial y tallas:', 'Stock initial et tailles :')}</span></p>
                                  <p className="text-xs text-blue-600 font-bold">{ev.sizeName}</p>
                                </>
                              ) : ev.type === 'validation' ? (
                                <p>
                                  {tf('El producto ha sido aprobado para su venta por:', 'Le produit a été approuvé pour la vente par :')} <span className="font-bold text-purple-700 bg-purple-50 px-1 py-0.5 rounded">{ev.employeeName}</span>
                                </p>
                              ) : ev.type === 'return' ? (
                                <>
                                  <p><span className="font-medium text-gray-700">{tf('Cantidad devuelta:', 'Quantité retournée :')}</span> <span className="text-orange-600 font-bold">-{ev.quantity}</span> unid.</p>
                                  {ev.sizeName && <p><span className="font-medium text-gray-700">{tf('Talla:', 'Taille :')}</span> <span className="text-orange-600 font-bold">{ev.sizeName}</span></p>}
                                  <p><span className="font-medium text-gray-700">{tf('Motivo:', 'Motif :')}</span> {ev.reason || '—'}</p>
                                  <p><span className="font-medium text-gray-700">{tf('Procesado por:', 'Traité par :')}</span> <span className="font-bold text-orange-700 bg-orange-50 px-1 py-0.5 rounded">{ev.employeeName}</span></p>
                                </>
                              ) : ev.type === 'manual_add' || ev.type === 'manual_deduct' ? (
                                <>
                                  <p><span className="font-medium text-gray-700">{ev.type === 'manual_add' ? tf('Cantidad añadida:', 'Quantité ajoutée :') : tf('Cantidad retirada:', 'Quantité retirée :')}</span> <span className={`${ev.type === 'manual_add' ? 'text-cyan-600' : 'text-red-600'} font-bold`}>{ev.quantity > 0 ? (ev.type === 'manual_add' ? '+' : '-') : ''}{ev.quantity}</span> unid.</p>
                                  {ev.sizeName && <p><span className="font-medium text-gray-700">{tf('Talla:', 'Taille :')}</span> <span className={`${ev.type === 'manual_add' ? 'text-cyan-600' : 'text-red-600'} font-bold`}>{ev.sizeName}</span></p>}
                                  <p><span className="font-medium text-gray-700">{tf('Motivo:', 'Motif :')}</span> {ev.reason || tf('Ajuste manual de stock', 'Ajustement manuel du stock')}</p>
                                  <p><span className="font-medium text-gray-700">{tf('Responsable:', 'Responsable :')}</span> <span className={`font-bold ${ev.type === 'manual_add' ? 'text-cyan-700 bg-cyan-50' : 'text-red-700 bg-red-50'} px-1 py-0.5 rounded`}>{ev.employeeName}</span></p>
                                </>
                              ) : (
                                <>
                                  <p><span className="font-medium text-gray-700">{tf('Cantidad vendida:', 'Quantité vendue :')}</span> {ev.quantity} unid.</p>
                                  {ev.sizeName && <p><span className="font-medium text-gray-700">{tf('Talla:', 'Taille :')}</span> <span className="text-green-600 font-bold">{ev.sizeName}</span></p>}
                                  <p><span className="font-medium text-gray-700">{tf('Precio de venta unitario:', 'Prix de vente unitaire :')}</span> {formatCurrency(ev.price || 0)}</p>
                                  <p><span className="font-medium text-gray-700">{tf('Atendido por:', 'Servi par :')}</span> <span className="font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded">{ev.employeeName}</span></p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            {tf('Cerrar', 'Fermer')}
          </button>
        </div>
      </div>
    </div>
  );
}
