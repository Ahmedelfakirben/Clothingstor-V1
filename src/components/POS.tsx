import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Category, Product, ProductSize } from '../types/supabase';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, CheckCircle, ShoppingBag } from 'lucide-react';
import { TicketPrinter } from './TicketPrinter';
import { LoadingSpinner, LoadingPage } from './LoadingSpinner';
import { toast } from 'react-hot-toast';

const ITEMS_PER_PAGE = 12;

export function POS() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const {
    items: cart,
    total,
    addItem,
    updateQuantity,
    removeItem,
    setPaymentMethod,
    clearCart,
    setServiceType,
    setTableId,
    activeOrderId,
    setActiveOrderId
  } = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<{
    orderDate: Date;
    orderNumber: string;
    items: Array<{ name: string; size?: string; quantity: number; price: number }>;
    total: number;
    paymentMethod: string;
    cashierName: string;
  } | null>(null);
  const [existingItems, setExistingItems] = useState<Array<{ name: string; size?: string; quantity: number; price: number; subtotal: number }>>([]);
  const [existingOrderTotal, setExistingOrderTotal] = useState<number>(0);
  const [existingOrderNumber, setExistingOrderNumber] = useState<number | null>(null);
  const [canConfirmOrder, setCanConfirmOrder] = useState(true);
  const [ticket, setTicket] = useState<{
    orderDate: Date;
    orderNumber: string;
    items: Array<{ name: string; size?: string; quantity: number; price: number }>;
    total: number;
    paymentMethod: string;
    cashierName: string;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetchCategories(),
      fetchInitialProducts(),
      fetchSizes()
    ]).finally(() => setDataLoading(false));
  }, []);

  // Cargar permisos granulares para POS
  useEffect(() => {
    const fetchPOSPermissions = async () => {
      if (!profile?.role) return;

      try {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('can_confirm_order, can_validate_order')
          .eq('role', profile.role)
          .eq('page_id', 'pos')
          .single();

        if (error) {
          console.error('Error fetching POS permissions:', error);
          return;
        }

        if (data) {
          setCanConfirmOrder(data.can_confirm_order ?? true);
        }
      } catch (err) {
        console.error('Error loading POS permissions:', err);
      }
    };

    fetchPOSPermissions();
  }, [profile?.role]);

  // Limpiar ticket después de imprimir
  useEffect(() => {
    if (ticket) {
      console.log('🎫 POS: Ticket establecido, esperando impresión...', new Date().toISOString());

      let cleaned = false;

      // Escuchar evento de impresión completada
      const handleTicketPrinted = () => {
        if (!cleaned) {
          console.log('🎫 POS: Evento ticketPrinted recibido, limpiando ticket', new Date().toISOString());
          cleaned = true;
          setTicket(null);
        }
      };

      // Timeout de fallback de 10 segundos por si el evento no se dispara
      const timer = setTimeout(() => {
        if (!cleaned) {
          console.log('🎫 POS: Timeout alcanzado, limpiando ticket (fallback)', new Date().toISOString());
          cleaned = true;
          setTicket(null);
        }
      }, 10000);

      window.addEventListener('ticketPrinted', handleTicketPrinted);

      return () => {
        console.log('🎫 POS: Cleanup - removiendo listener y timer');
        window.removeEventListener('ticketPrinted', handleTicketPrinted);
        clearTimeout(timer);
      };
    }
  }, [ticket]);

  // Cargar contenido de pedido activo si existe
  useEffect(() => {
    const loadActiveOrderContent = async () => {
      if (!activeOrderId) {
        setExistingItems([]);
        setExistingOrderTotal(0);
        setExistingOrderNumber(null);
        return;
      }
      try {
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .select('id, total, order_number')
          .eq('id', activeOrderId)
          .single();
        if (orderErr) throw orderErr;
        const currentTotal = typeof order.total === 'string' ? parseFloat(order.total) : (order.total || 0);
        setExistingOrderTotal(currentTotal);
        setExistingOrderNumber(order.order_number || null);

        const { data: items, error: itemsErr } = await supabase
          .from('order_items')
          .select('quantity, unit_price, subtotal, size_id, product_id, products(name), product_sizes(size_name)')
          .eq('order_id', activeOrderId);
        if (itemsErr) throw itemsErr;
        const mapped = (items || []).map((it: any) => ({
          name: it.products?.name || 'Producto',
          size: it.product_sizes?.size_name || undefined,
          quantity: it.quantity,
          price: typeof it.unit_price === 'string' ? parseFloat(it.unit_price) : (it.unit_price || 0),
          subtotal: typeof it.subtotal === 'string' ? parseFloat(it.subtotal) : (it.subtotal || 0),
        }));
        setExistingItems(mapped);
      } catch (err) {
        console.error('Error cargando contenido de pedido activo:', err);
        toast.error('No se pudo cargar el contenido del pedido activo');
      }
    };
    loadActiveOrderContent();
  }, [activeOrderId]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      toast.error('Error al cargar categorías');
      setError('No se pudieron cargar las categorías');
    }
  };

  const fetchInitialProducts = async () => {
    setPage(1);
    await fetchProducts(true);
  };

  const fetchProducts = async (reset = false) => {
    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('available', true)
        .order('name');

      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      query = query
        .range((reset ? 0 : (page - 1) * ITEMS_PER_PAGE),
          (reset ? ITEMS_PER_PAGE - 1 : page * ITEMS_PER_PAGE - 1));

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        setProducts(prev => reset ? data : [...prev, ...data]);
        setHasMore(data.length === ITEMS_PER_PAGE);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      toast.error('Error al cargar productos');
      setError('No se pudieron cargar los productos');
    }
  };

  const fetchSizes = async () => {
    try {
      const { data, error } = await supabase
        .from('product_sizes')
        .select('*');

      if (error) throw error;
      setSizes(data || []);
    } catch (err) {
      console.error('Error fetching sizes:', err);
      toast.error('Error al cargar tamaños');
      setError('No se pudieron cargar los tamaños de productos');
    }
  };

  useEffect(() => {
    fetchInitialProducts();
  }, [selectedCategory]);

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    fetchProducts();
  };

  const productSizes = (productId: string) => sizes.filter(s => s.product_id === productId);



  const handleCheckout = async () => {
    if (cart.length === 0 || !user) {
      console.log('Carrito vacío o usuario no autenticado:', { cartLength: cart.length, userId: user?.id });
      return;
    }

    // Verificar permisos granulares
    if (!canConfirmOrder) {
      toast.error('No tienes permiso para confirmar pedidos');
      return;
    }

    console.log('✅ Preparando orden (SIN crear en BD aún):', {
      employeeId: user.id,
      total,
      cartItems: cart.length,
    });

    // SOLO preparar los datos, NO crear en BD aún
    const ticketItems = cart.map(ci => ({
      name: ci.product.name,
      size: ci.size?.size_name,
      quantity: ci.quantity,
      price: ci.product.base_price + (ci.size?.price_modifier || 0),
    }));

    const ticketData = {
      orderDate: new Date(),
      orderNumber: 'PENDING', // Temporal hasta que se cree en BD
      items: ticketItems,
      total,
      paymentMethod: 'Pendiente',
      cashierName: (user.user_metadata as any)?.full_name || user.email || 'Usuario',
    };

    setPendingOrderData(ticketData);
    setShowPaymentModal(true); // Mostrar modal de método de pago

    console.log('📋 Datos preparados, esperando selección de método de pago...');
  };

  const handlePaymentMethodSelection = async (selectedPaymentMethod: string) => {
    if (!pendingOrderData) {
      console.error('No hay orden pendiente');
      return;
    }

    console.log('Método de pago seleccionado:', selectedPaymentMethod);

    // Actualizar los datos pendientes con el método de pago seleccionado
    const updatedTicketData = {
      ...pendingOrderData,
      paymentMethod: selectedPaymentMethod === 'cash' ? 'Efectivo' :
        selectedPaymentMethod === 'card' ? 'Tarjeta' : 'Digital'
    };

    setPendingOrderData(updatedTicketData);

    // Cerrar modal de pago y mostrar modal de validación
    setShowPaymentModal(false);
    setShowValidationModal(true);
  };

  const handleValidateAndPrint = async () => {
    if (!pendingOrderData || !user) {
      console.error('No hay orden pendiente o usuario no autenticado');
      return;
    }

    try {
      setLoading(true);
      console.log('🔥 AHORA SÍ creando orden en BD con método de pago:', pendingOrderData.paymentMethod);

      // Convertir el método de pago al formato de la BD
      const paymentMethodDB = pendingOrderData.paymentMethod === 'Efectivo' ? 'cash' :
        pendingOrderData.paymentMethod === 'Tarjeta' ? 'card' : 'digital';

      // Preparar items para la BD
      const orderItemsPayload = cart.map(item => ({
        product_id: item.product.id,
        size_id: item.size?.id || null,
        quantity: item.quantity,
        unit_price: Number(item.product.base_price) + Number(item.size?.price_modifier || 0),
        subtotal: (Number(item.product.base_price) + Number(item.size?.price_modifier || 0)) * item.quantity,
        notes: item.notes,
      }));

      // CREAR la orden en la base de datos (SOLO AQUÍ)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          employee_id: user.id,
          status: 'completed',
          total: pendingOrderData.total,
          payment_method: paymentMethodDB,
          service_type: 'takeaway',
          table_id: null,
        })
        .select('id,total,created_at,order_number')
        .single();

      if (orderError) {
        console.error('❌ Error creating order:', orderError);
        throw orderError;
      }

      console.log('✅ Orden creada en BD:', order.id);

      // Insertar los items de la orden
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsPayload.map(item => ({
          ...item,
          order_id: order.id
        })));

      if (itemsError) {
        console.error('❌ Error insertando items:', itemsError);
        throw itemsError;
      }

      console.log('✅ Items insertados correctamente');

      // Actualizar datos del ticket con el número de orden real
      const finalTicketData = {
        ...pendingOrderData,
        orderNumber: order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(-8),
        orderDate: new Date(order.created_at),
      };

      // Imprimir ticket
      console.log('🖨️ Imprimiendo ticket:', finalTicketData);
      setTicket(finalTicketData);
      setShowValidationModal(false);
      setPendingOrderData(null);

      // Reset states after successful validation
      setActiveOrderId(null);
      setTableId(null);
      setServiceType('takeaway');
      setPaymentMethod(null);
      clearCart();

      toast.success('¡Orden creada, validada e impresa correctamente!');
    } catch (error) {
      console.error('💥 Error creando orden:', error);
      toast.error('Error al crear la orden. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return <LoadingPage message={t('Cargando productos...')} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full gradient-primary hover:gradient-primary-hover text-white font-bold py-2 px-4 rounded transition-colors"
          >
            {t('Reintentar')}
          </button>
        </div>
      </div>
    );
  }

  // Vista móvil
  const renderMobileView = () => (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-gray-50">
      {/* Filtros de categoría móvil */}
      {/* Sección de Categorías Móvil - Diseño Minimalista */}
      <div className="bg-white border-b border-gray-200 px-3 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${selectedCategory === 'all'
              ? 'gradient-primary text-white shadow-md scale-105'
              : 'bg-gray-50 text-gray-700 border border-gray-200'
              }`}
          >
            {t('Todos')}
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${selectedCategory === cat.id
                ? 'gradient-primary text-white shadow-md scale-105'
                : 'bg-gray-50 text-gray-700 border border-gray-200'
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de productos móvil */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {products.map(product => {
            const productSizesList = productSizes(product.id);
            return (
              <div key={product.id} className="bg-white rounded-lg p-3 shadow-sm border">
                <div className="flex gap-3">
                  {product.image_url && (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                    <p className="text-xs text-gray-500 truncate">{product.description}</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(product.base_price)}</p>
                  </div>
                </div>

                {productSizesList.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {productSizesList.map(size => {
                      const currentInCart = cart.find(item => item.product.id === product.id && item.size?.id === size.id)?.quantity || 0;
                      const stockAvailable = size.stock - currentInCart;

                      return (
                        <button
                          key={size.id}
                          disabled={stockAvailable <= 0}
                          onClick={() => {
                            if (stockAvailable > 0) {
                              addItem(product, size);
                            } else {
                              toast.error(t('No hay suficiente stock para esta talla'));
                            }
                          }}
                          className={`w-full py-2 px-3 rounded-lg text-sm font-medium flex justify-between items-center border border-gray-200 transition-colors
                          ${stockAvailable <= 0
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
                            }`}
                        >
                          <div className="flex flex-col items-start">
                            <span>{size.size_name}</span>
                            <span className="text-xs text-gray-500">{t('Stock')}: {size.stock}</span>
                          </div>
                          <span className="font-bold">+{formatCurrency(size.price_modifier)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    disabled={(product.stock || 0) <= (cart.find(item => item.product.id === product.id && !item.size)?.quantity || 0)}
                    onClick={() => {
                      const currentInCart = cart.find(item => item.product.id === product.id && !item.size)?.quantity || 0;
                      if ((product.stock || 0) > currentInCart) {
                        addItem(product);
                      } else {
                        toast.error(t('No hay suficiente stock'));
                      }
                    }}
                    className={`w-full py-2 px-4 rounded-lg font-semibold mt-2 text-sm transition-colors
                      ${(product.stock || 0) <= (cart.find(item => item.product.id === product.id && !item.size)?.quantity || 0)
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'gradient-primary hover:gradient-primary-hover text-white'
                      }`}
                  >
                    {t('Agregar')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumen del pedido móvil (fixed en la parte inferior) */}
      <div className="bg-white border-t shadow-lg p-4 space-y-3">
        {/* Total y cantidad de items */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-600">Total del pedido</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Items</p>
            <p className="text-xl font-bold text-gray-900">{cart.length}</p>
          </div>
        </div>

        {/* Opciones de servicio eliminadas - siempre para llevar */}




        {/* Botón confirmar */}
        <button
          onClick={handleCheckout}
          disabled={cart.length === 0 || loading}
          className="w-full gradient-primary hover:gradient-primary-hover text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Procesando...' : 'Confirmar Pedido'}
        </button>

        {/* Ver carrito */}
        {cart.length > 0 && (
          <button
            onClick={() => {
              // Create cart details modal using React approach instead of innerHTML
              const modal = document.createElement('div');
              modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-end';
              modal.onclick = () => modal.remove();

              const modalContent = document.createElement('div');
              modalContent.className = 'bg-white w-full max-h-[70vh] rounded-t-2xl p-4 overflow-y-auto';
              modalContent.onclick = (e) => e.stopPropagation();

              // Header
              const header = document.createElement('h3');
              header.className = 'text-lg font-bold mb-4';
              header.textContent = `Carrito (${cart.length} items)`;

              // Cart items
              cart.forEach((item) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'flex justify-between items-center py-2 border-b';

                const itemInfo = document.createElement('div');
                itemInfo.className = 'flex-1';

                const itemName = document.createElement('p');
                itemName.className = 'font-medium text-sm';
                itemName.textContent = `${item.quantity}x ${item.product.name}${item.size ? ` (${item.size.size_name})` : ''}`;

                const itemPrice = document.createElement('p');
                itemPrice.className = 'text-xs text-gray-500';
                itemPrice.textContent = `${formatCurrency(item.product.base_price + (item.size?.price_modifier || 0))} c/u`;

                const itemTotal = document.createElement('p');
                itemTotal.className = 'font-bold text-gray-900';
                itemTotal.textContent = formatCurrency((item.product.base_price + (item.size?.price_modifier || 0)) * item.quantity);

                itemInfo.appendChild(itemName);
                itemInfo.appendChild(itemPrice);
                itemDiv.appendChild(itemInfo);
                itemDiv.appendChild(itemTotal);

                modalContent.appendChild(itemDiv);
              });

              // Total section
              const totalDiv = document.createElement('div');
              totalDiv.className = 'mt-4 pt-4 border-t flex justify-between';

              const totalLabel = document.createElement('span');
              totalLabel.className = 'font-bold';
              totalLabel.textContent = 'Total:';

              const totalAmount = document.createElement('span');
              totalAmount.className = 'font-bold text-gray-900 text-xl';
              totalAmount.textContent = formatCurrency(total);

              totalDiv.appendChild(totalLabel);
              totalDiv.appendChild(totalAmount);

              // Close button
              const closeButton = document.createElement('button');
              closeButton.className = 'w-full mt-4 bg-gray-200 py-2 rounded-lg';
              closeButton.textContent = 'Cerrar';
              closeButton.onclick = () => modal.remove();

              modalContent.appendChild(header);
              modalContent.appendChild(totalDiv);
              modalContent.appendChild(closeButton);
              modal.appendChild(modalContent);
              document.body.appendChild(modal);
            }}
            className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium"
          >
            Ver Carrito Detallado
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Vista Móvil */}
      <div className="md:hidden">
        {renderMobileView()}
      </div>

      {/* Ticket Auto-Print */}
      {ticket && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <TicketPrinter
            orderDate={ticket.orderDate}
            orderNumber={ticket.orderNumber}
            items={ticket.items}
            total={ticket.total}
            paymentMethod={ticket.paymentMethod}
            cashierName={ticket.cashierName}
            autoPrint={true}
            hideButton={true}
          />
        </div>
      )}

      {/* Vista Desktop */}
      <div className="hidden md:flex h-[calc(100vh-5rem)] bg-gray-50 overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Sección de Categorías - Diseño Minimalista Moderno */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-8 py-6">
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-8 py-3 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300 ${selectedCategory === 'all'
                    ? 'gradient-primary text-white shadow-md scale-105'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md border border-gray-200'
                    }`}
                >
                  Todos
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-8 py-3 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300 ${selectedCategory === cat.id
                      ? 'gradient-primary text-white shadow-md scale-105'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:shadow-md border border-gray-200'
                      }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map(product => {
                const productSizesList = productSizes(product.id);

                return (
                  <div key={product.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 overflow-hidden flex flex-col h-full group">
                    <div className="relative h-48 bg-gray-50 flex-shrink-0">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ShoppingBag className="w-12 h-12" />
                        </div>
                      )}

                      {/* Stock Badge */}
                      <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
                        <div className={`w-2 h-2 rounded-full ${(!product.stock || product.stock > 10) ? 'bg-green-500' : product.stock > 0 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs font-semibold text-gray-700">{product.stock || 0}</span>
                      </div>
                    </div>

                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{product.name}</h3>
                          <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5em]">{product.description}</p>
                        </div>

                        {/* Product Details Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          {product.brand && (
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-gray-400">{t('Marca')}</span>
                              <span className="font-medium truncate" title={product.brand}>{product.brand}</span>
                            </div>
                          )}
                          {product.gender && (
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-gray-400">{t('Género')}</span>
                              <span className="font-medium truncate capitalize">{t(`gender.${product.gender}`)}</span>
                            </div>
                          )}
                          {product.material && (
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-gray-400">{t('Material')}</span>
                              <span className="font-medium truncate" title={product.material}>{product.material}</span>
                            </div>
                          )}
                          {product.season && (
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase tracking-wider text-gray-400">{t('Temp.')}</span>
                              <span className="font-medium truncate capitalize">{t(`season.${product.season}`)}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex items-end justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-400">Precio</span>
                            <span className="text-xl font-bold text-gray-900">{formatCurrency(product.base_price)}</span>
                          </div>
                        </div>
                      </div>

                      {productSizesList.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          {/* Dropdown-like or list for sizes if too many, but buttons are fine for POS */}
                          <div className="grid grid-cols-2 gap-2">
                            {productSizesList.map(size => (
                              <button
                                key={size.id}
                                onClick={() => addItem(product, size)}
                                className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg border border-gray-200 transition-colors flex items-center justify-between group/size text-left"
                              >
                                <span className="truncate">{size.size_name}</span>
                                <span className="text-gray-900 bg-white px-1.5 py-0.5 rounded shadow-sm">+{formatCurrency(size.price_modifier)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => addItem(product)}
                          className="w-full mt-4 gradient-primary hover:gradient-primary-hover text-white font-medium py-2.5 px-4 rounded-lg shadow-sm hover:shadow transition-all active:transform active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{t('Agregar')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={handleLoadMore}
                  className="bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-6 rounded-lg shadow-sm transition-colors border border-gray-200"
                >
                  {t('Cargar más productos')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="w-[450px] bg-white border-l border-gray-200 flex flex-col shadow-lg h-full">
          <div className="p-5 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center shadow-sm">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">{t('Carrito de Compras')}</h2>
                <p className="text-sm text-gray-500">{cart.length} {cart.length === 1 ? 'producto' : 'productos'}</p>
              </div>
            </div>
          </div>

          {activeOrderId && (
            <div className="px-3 pt-3 pb-2 border-b bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Pedido activo #{activeOrderId}</h3>
                  <p className="text-xs text-gray-600">Total actual: <span className="font-semibold">{formatCurrency(existingOrderTotal)}</span></p>
                  <p className="text-xs text-pink-600 font-medium">Pendiente de validación</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Show validation modal for pending order
                      const ticketData = {
                        orderDate: new Date(),
                        orderNumber: existingOrderNumber ? existingOrderNumber.toString().padStart(3, '0') : activeOrderId.slice(-8),
                        items: existingItems,
                        total: existingOrderTotal,
                        paymentMethod: 'Pendiente',
                        cashierName: user ? ((user.user_metadata as any)?.full_name || user.email || 'Usuario') : 'Usuario',
                      };
                      setPendingOrderData(ticketData);
                      setShowValidationModal(true);
                    }}
                    className="px-3 py-2 rounded-lg border text-xs gradient-primary text-white transition-colors hover:gradient-primary-hover"
                  >
                    Validar
                  </button>
                  <button
                    onClick={() => {
                      setActiveOrderId(null);
                      setTableId(null);
                      setServiceType('takeaway');
                      toast.success('Pedido finalizado');
                    }}
                    className="px-3 py-2 rounded-lg border text-xs bg-white transition-colors hover:bg-gray-50 border-pink-300 text-pink-700"
                  >
                    Finalizar
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-2 max-h-32 overflow-auto">
                {existingItems.length === 0 ? (
                  <p className="text-xs text-gray-500">Sin productos registrados en el pedido.</p>
                ) : (
                  existingItems.map((it, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="text-xs text-gray-900 font-medium">
                          {it.quantity}x {it.name}{it.size ? ` (${it.size})` : ''}
                        </div>
                        <div className="text-xs font-semibold text-gray-900">{formatCurrency(it.subtotal)}</div>
                      </div>
                      <div className="text-[11px] text-gray-600">c/u {formatCurrency(it.price)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto p-4 bg-gray-50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-gray-200">
                  <ShoppingCart className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-700 text-base font-semibold">{t('El carrito está vacío')}</p>
                <p className="text-gray-400 text-sm mt-2">{t('Selecciona productos para comenzar')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.slice().reverse().map((item, index) => (
                  <div key={cart.length - 1 - index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all duration-200">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-sm leading-tight">
                          {item.quantity}x {item.product.name}
                          {item.size && ` (${item.size.size_name})`}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          c/u {formatCurrency(item.product.base_price + (item.size?.price_modifier || 0))}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(cart.length - 1 - index)}
                        className="text-gray-400 hover:text-white hover:bg-red-500 p-2 rounded-lg transition-all duration-200"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1.5 border border-gray-200">
                        <button
                          onClick={() => updateQuantity(cart.length - 1 - index, -1)}
                          className="w-7 h-7 rounded-md bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 hover:border-gray-300 transition-all"
                        >
                          <Minus className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <span className="w-9 text-center font-bold text-base text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(cart.length - 1 - index, 1)}
                          className="w-7 h-7 rounded-md bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 hover:border-gray-300 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                      </div>
                      <span className="font-bold text-gray-900 text-base bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-300">
                        {formatCurrency((item.product.base_price + (item.size?.price_modifier || 0)) * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-gray-200 bg-white space-y-4">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <div className="flex justify-between items-center text-2xl font-bold">
                <span className="text-gray-800">{activeOrderId ? 'Añadir:' : 'Total:'}</span>
                <span className="text-gray-900">{formatCurrency(total)}</span>
              </div>

              {activeOrderId && (
                <div className="mt-3 space-y-2 pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Total pedido actual:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(existingOrderTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Total después de añadir:</span>
                    <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">{formatCurrency(existingOrderTotal + total)}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || loading}
              className="w-full gradient-primary hover:gradient-primary-hover text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-base shadow-elegant hover:shadow-elegant-hover transform hover:-translate-y-1 disabled:transform-none"
            >
              <span className="flex items-center justify-center gap-3">
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" light />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>{t('Confirmar Pedido')}</span>
                  </>
                )}
              </span>
            </button>

          </div>
        </div>

        {/* Payment Method Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 transform scale-100 transition-all">
              <div className="text-center mb-8">
                <div className="inline-block p-4 bg-gray-100 rounded-2xl mb-4">
                  <CreditCard className="w-12 h-12 text-gray-700" />
                </div>
                <h2 className="text-3xl font-black text-gray-900">
                  {t('Seleccionar Método de Pago')}
                </h2>
                <p className="text-sm text-gray-600 mt-2">{t('Elija cómo se realizará el pago')}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 mb-8">
                <button
                  onClick={() => handlePaymentMethodSelection('cash')}
                  className="group flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <Banknote className="w-6 h-6 text-green-700" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-gray-900">{t('Efectivo')}</div>
                    <div className="text-xs text-gray-500">{t('Pago en efectivo')}</div>
                  </div>
                </button>

                <button
                  onClick={() => handlePaymentMethodSelection('card')}
                  className="group flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <CreditCard className="w-6 h-6 text-blue-700" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-gray-900">{t('Tarjeta')}</div>
                    <div className="text-xs text-gray-500">{t('Pago con tarjeta')}</div>
                  </div>
                </button>

                <button
                  onClick={() => handlePaymentMethodSelection('digital')}
                  className="group flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <Smartphone className="w-6 h-6 text-purple-700" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-gray-900">{t('Digital')}</div>
                    <div className="text-xs text-gray-500">{t('Pago digital')}</div>
                  </div>
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-bold text-gray-700 shadow-md hover:shadow-lg"
                >
                  {t('Cancelar')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation Modal */}
        {showValidationModal && pendingOrderData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 transform scale-100 transition-all">
              <div className="text-center mb-6">
                <div className="inline-block p-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl mb-4">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-3xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                  {t('Confirmar Pedido')}
                </h2>
                <p className="text-sm text-gray-600">{t('Pedido creado exitosamente')}</p>
              </div>

              <div className="mb-6">
                <div className="bg-gray-50 border-2 border-gray-300 rounded-2xl p-6 mb-4 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-gray-800 text-sm">{t('Total del Pedido:')}</span>
                    <span className="font-black text-3xl text-gray-900">
                      {formatCurrency(pendingOrderData.total)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                    <span className="font-bold text-gray-800 text-sm">{t('Método de Pago:')}</span>
                    <span className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-300">
                      {pendingOrderData.paymentMethod}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <span className="font-bold text-blue-800">ℹ️ {t('Información:')}</span><br />
                  {t('El pedido se ha procesado correctamente. ¿Desea validar e imprimir el ticket ahora?')}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    console.log('Order left pending - will be validated later');
                    setShowValidationModal(false);
                    setPendingOrderData(null);

                    // Reset states after leaving order pending
                    setActiveOrderId(null);
                    setTableId(null);
                    setServiceType('takeaway');
                    setPaymentMethod(null);
                    clearCart();

                    toast.success('Pedido pendiente de validación');
                  }}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-bold text-gray-700 shadow-md hover:shadow-lg"
                >
                  {t('Después')}
                </button>
                <button
                  onClick={handleValidateAndPrint}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl transition-all font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5"
                >
                  {t('Validar e Imprimir')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
