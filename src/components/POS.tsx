import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Category, Product, ProductSize } from '../types/supabase';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone, ChevronRight, Search, ScanBarcode, ShoppingBag, Users, CheckCircle } from 'lucide-react';
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
    setActiveOrderId,
    customerId,
    setCustomerId
  } = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>(''); // For partial payments
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [scannedProductForSizeSelection, setScannedProductForSizeSelection] = useState<Product | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
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

  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
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
      fetchSizes(),
      fetchCustomers()
    ]).finally(() => setDataLoading(false));
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

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
        .eq('available', true)
        // .gt('stock', 0) // ELIMINADO para ver productos con stock en tallas
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

  // Cargar productos y categorías iniciales
  useEffect(() => {
    fetchCategories();
    fetchSizes(); // Asegurar carga de tallas para calcular stock correcto
    fetchInitialProducts();
  }, [selectedCategory]);

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    fetchProducts();
  };

  const productSizes = (productId: string) => sizes.filter(s => s.product_id === productId);

  // ... (handleCheckout logic remains) - RESTORING
  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error(t('El carrito está vacío'));
      return;
    }

    // FINAL STOCK VALIDATION before Payment
    for (const item of cart) {
      if (!checkStock(item.product, item.size, 0)) {  // quantityToAdd=0 means check CURRENT state
        return; // Stop checkout if any stock issue
      }
    }

    // Default payment amount to total
    setPaymentAmount(total.toString());
    setShowPaymentModal(true);
  };

  const handlePaymentMethodSelection = (method: 'cash' | 'card' | 'digital') => {
    // Validate amount
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('Ingrese un monto válido'));
      return;
    }

    if (amount > total) {
      toast.error(t('El monto no puede ser mayor al total'));
      return;
    }

    setPaymentMethod(method);
    setShowPaymentModal(false);

    // Prepare ticket data immediately for validation
    // Calculate final payment status
    const isPartial = amount < total;
    const status = isPartial ? 'partial' : 'paid';

    const ticketData = {
      orderDate: new Date(),
      orderNumber: activeOrderId ? activeOrderId.slice(-8) : undefined, // Will be assigned by DB if new
      items: cart.map(item => ({
        name: item.product.name,
        size: item.size?.size_name,
        quantity: item.quantity,
        price: item.product.base_price + (item.size?.price_modifier || 0)
      })),
      total: total,
      amountPaid: amount,
      paymentStatus: status,
      paymentMethod: method === 'cash' ? 'Efectivo' : method === 'card' ? 'Tarjeta' : 'Digital',
      cashierName: profile?.full_name || user?.email || 'Usuario',
      customerName: customerId ? customers.find(c => c.id === customerId)?.name : undefined
    };

    setPendingOrderData(ticketData as any);

    setShowValidationModal(true);
  };

  // Función para reparar imágenes rotas usando Google (POS version)
  const fixProductImage = async (barcode: string, productName: string, brand: string, currentImageUrl: string, productId: string) => {
    // Evitar bucles infinitos
    if (currentImageUrl.includes('googleusercontent') || currentImageUrl.includes('gstatic')) {
      return null;
    }

    try {
      console.log(`🔧 POS: Attempting to fix image for: ${productName}`);

      const { data, error } = await supabase.functions.invoke('barcode-lookup', {
        body: {
          action: 'fix_image',
          barcode: barcode,
          productName: productName,
          brand: brand
        }
      });

      if (error || !data || !data.image_url) {
        console.error('Failed to fix image:', error);
        return null;
      }

      console.log('✅ Image fixed:', data.image_url);

      // Actualizar estado local inmediatamente
      setProducts(prevProducts =>
        prevProducts.map(p => p.id === productId ? { ...p, image_url: data.image_url } : p)
      );

      // Actualizar en DB silenciosamente
      await supabase.from('products').update({ image_url: data.image_url }).eq('id', productId);

      return data.image_url;
    } catch (err) {
      console.error('Error fixing image:', err);
      return null;
    }
  };

  const checkStock = (product: Product, size?: ProductSize | null, quantityToAdd: number = 1): boolean => {
    let limit = 0;
    if (size) {
      limit = size.stock;
    } else {
      limit = product.stock || 0;
    }

    // Find current quantity in cart for this specific item (product + size)
    const currentItem = cart.find(item =>
      item.product.id === product.id &&
      (size ? item.size?.id === size.id : !item.size)
    );

    const currentQty = currentItem?.quantity || 0;

    if (currentQty + quantityToAdd > limit) {
      toast.error(t('No hay suficiente stock. Disponible: ') + limit);
      return false;
    }
    return true;
  };

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const scannedCode = barcodeInput.trim();
    // Search exact match for barcode
    const foundProduct = products.find(p => p.barcode === scannedCode);

    if (foundProduct) {
      // Check if size selection is needed
      const sizes = productSizes(foundProduct.id);
      if (sizes.length > 0) {
        setScannedProductForSizeSelection(foundProduct);
        setBarcodeInput('');
      } else {
        // Check stock logic
        if (checkStock(foundProduct, undefined, 1)) {
          addItem(foundProduct);
          setBarcodeInput('');
          toast.success(`${foundProduct.name} ${t('agregado')}`);
        }
      }
    } else {
      toast.error(t('Producto no encontrado'));
    }
  };

  const isProcessingRef = useRef(false);

  const processOrder = async (targetStatus: 'completed' | 'preparing' = 'completed', shouldPrint: boolean = true) => {
    if (loading || isProcessingRef.current) return; // Strict double execution guard

    isProcessingRef.current = true;
    setLoading(true);

    if (!pendingOrderData || !user) {
      console.error('No hay orden pendiente o usuario no autenticado');
      isProcessingRef.current = false;
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔥 Procesando orden:', { targetStatus, shouldPrint, paymentMethod: pendingOrderData.paymentMethod });

      // Convertir el método de pago al formato de la BD
      const paymentMethodDB = pendingOrderData.paymentMethod === 'Efectivo' ? 'cash' :
        pendingOrderData.paymentMethod === 'Tarjeta' ? 'card' : 'digital';

      // Access extra properties from ticketData that might be "hidden" by the type
      const pData = pendingOrderData as any;
      const amountPaid = pData.amountPaid !== undefined ? pData.amountPaid : pData.total;
      const paymentStatus = pData.paymentStatus || 'paid';

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
          status: targetStatus,
          payment_status: paymentStatus,
          amount_paid: amountPaid,
          customer_id: customerId, // Save the customer connection!
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

      // ---------------------------------------------------------
      // ACTUALIZAR STOCK DE PRODUCTOS
      // ---------------------------------------------------------
      console.log('🔄 Actualizando stock...');
      const stockUpdatePromises = cart.map(async (item) => {
        try {
          if (item.size) {
            // --- LÓGICA CON TALLAS (SOLO RPC) ---
            const { error: sizeError } = await supabase.rpc('decrement_product_size_stock', {
              p_size_id: item.size.id,
              p_quantity: item.quantity
            });

            if (sizeError) {
              console.error(`❌ RPC talla falló (${sizeError.code}):`, sizeError.message);
              toast.error(`Error actualizando stock (Talla): ${sizeError.message}`);
              // No fallback manual para evitar doble descuento
            } else {
              console.log(`✅ Stock Talla actualizado via RPC: ${item.size.size_name}`);
            }
          } else {
            // --- LÓGICA SIN TALLAS (SOLO RPC) ---
            const { error: productError } = await supabase.rpc('decrement_product_stock', {
              p_product_id: item.product.id,
              p_quantity: item.quantity
            });

            if (productError) {
              console.error(`❌ RPC producto falló (${productError.code}):`, productError.message);
              toast.error(`Error actualizando stock (Producto): ${productError.message}`);
              // No fallback manual para evitar doble descuento
            } else {
              console.log(`✅ Stock Producto actualizado via RPC: ${item.product.name}`);
            }
          }
        } catch (err) {
          console.error('💥 Excepción en actualización de stock:', err);
        }
      });

      await Promise.all(stockUpdatePromises);
      console.log('🏁 Proceso de actualización de stock finalizado');

      // Notificar localmente (para feedback inmediato)
      const formattedAmount = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(order.total);
      window.dispatchEvent(new CustomEvent('dispatch-sale-notification', {
        detail: { amount: formattedAmount }
      }));

      // Actualizar datos del ticket con el número de orden real
      const finalTicketData = {
        ...pendingOrderData,
        orderNumber: order.order_number ? order.order_number.toString().padStart(3, '0') : order.id.slice(-8),
        orderDate: new Date(order.created_at),
      };

      if (shouldPrint) {
        // Imprimir ticket
        console.log('🖨️ Imprimiendo ticket:', finalTicketData);
        setTicket(finalTicketData);
        toast.success(t('pos.order_created_printed'));
      } else {
        toast.success(targetStatus === 'preparing' ? t('pos.order_saved_pending') : t('pos.order_created_success'));
      }

      setShowValidationModal(false);
      setPendingOrderData(null);

      // Reset states after successful processing
      setActiveOrderId(null);
      setTableId(null);
      setServiceType('takeaway');
      setPaymentMethod(null);
      setCustomerId(null); // Clear customer too
      clearCart();

      // Refresh products and sizes to reflect new stock
      await fetchInitialProducts();
      await fetchSizes();

    } catch (error: any) {
      console.error('💥 Error creando orden:', error);
      toast.error(`${t('pos.order_creation_error')}: ${error.message || t('Reintentar')}.`);
    } finally {
      setLoading(false);
      // Small delay to release the lock to prevent immediate re-clicks if UI hasn't updated
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 500);
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

            const displayStock = productSizesList.length > 0
              ? productSizesList.reduce((acc, s) => acc + s.stock, 0)
              : (product.stock || 0);

            if (displayStock <= 0) return null;

            return (
              <div key={product.id} className="bg-white rounded-lg p-3 shadow-sm border">
                <div className="flex gap-3">
                  {product.image_url && (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={async (e) => {
                          const img = e.currentTarget;
                          if (img.parentElement) {
                            const loading = document.createElement('div');
                            loading.className = "absolute inset-0 bg-gray-100 flex items-center justify-center text-xs text-amber-600 animate-pulse";
                            loading.innerText = "Fixing...";
                            img.style.display = 'none';
                            img.parentElement.appendChild(loading);
                          }

                          const newUrl = await fixProductImage(
                            product.barcode || '',
                            product.name,
                            product.brand || '',
                            product.image_url || '',
                            product.id
                          );

                          if (!newUrl && img.parentElement) {
                            img.parentElement.innerHTML = '';
                            const fallbackIcon = document.createElement('div');
                            fallbackIcon.className = "w-full h-full flex items-center justify-center text-gray-300";
                            fallbackIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-bag"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
                            img.parentElement.appendChild(fallbackIcon);
                          }
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                    <p className="text-xs text-gray-500 truncate">{product.description}</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(product.base_price)}</p>
                  </div>
                </div>

                <div className="mt-2">
                  <button
                    onClick={() => {
                      if (productSizesList.length > 0) {
                        setScannedProductForSizeSelection(product);
                      } else {
                        const currentQty = cart.find(item => item.product.id === product.id && !item.size)?.quantity || 0;
                        if ((product.stock || 0) > currentQty) {
                          if (checkStock(product, null, 1)) {
                            addItem(product);
                          }
                        }
                      }
                    }}
                    disabled={productSizesList.length === 0 && (product.stock || 0) <= (cart.find(item => item.product.id === product.id && !item.size)?.quantity || 0)}
                    className={`w-full py-2.5 px-3 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-colors
                      ${(productSizesList.length > 0 || (product.stock || 0) > 0)
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 active:bg-amber-300'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    <Plus className="w-4 h-4" />
                    {productSizesList.length > 0 ? t('Seleccionar Talla') : t('Agregar')}
                  </button>
                </div>

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
          {/* Search / Scan Bar */}
          <div className="p-4 bg-white border-b border-gray-200">
            <form onSubmit={handleBarcodeScan} className="flex gap-2 relative">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder={t('Escanear código de barras o escribir...')}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </form>
          </div>
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

                const displayStock = productSizesList.length > 0
                  ? productSizesList.reduce((acc, s) => acc + s.stock, 0)
                  : (product.stock || 0);

                if (displayStock <= 0) return null;

                return (
                  <div key={product.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 overflow-hidden flex flex-col h-full group">
                    <div className="relative h-48 bg-gray-50 flex-shrink-0">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={async (e) => {
                            const img = e.currentTarget;
                            // 1. Mostrar estado "Reparando..."
                            if (img.parentElement) {
                              const loading = document.createElement('div');
                              loading.className = "absolute inset-0 bg-gray-100 flex items-center justify-center text-xs text-amber-600 animate-pulse";
                              loading.innerText = "Reparando...";
                              img.style.display = 'none';
                              img.parentElement.appendChild(loading);
                            }

                            // 2. Intentar reparar
                            const newUrl = await fixProductImage(
                              product.barcode || '',
                              product.name,
                              product.brand || '',
                              product.image_url || '',
                              product.id
                            );

                            // 3. Resultado
                            if (newUrl) {
                              // Estado actualizado por la función, no necesitamos hacer nada aquí
                            } else {
                              if (img.parentElement) {
                                img.parentElement.innerHTML = '';
                                const fallbackIcon = document.createElement('div');
                                fallbackIcon.className = "w-full h-full flex items-center justify-center text-gray-300";
                                // Usamos innerHTML para el icono SVG simple
                                fallbackIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-bag"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
                                img.parentElement.appendChild(fallbackIcon);
                              }
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ShoppingBag className="w-12 h-12" />
                        </div>
                      )}

                      {/* Stock Badge */}
                      <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
                        <div className={`w-2 h-2 rounded-full ${(!displayStock || displayStock > 10) ? 'bg-green-500' : displayStock > 0 ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs font-semibold text-gray-700">{displayStock}</span>
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
                            <span className="text-xs text-gray-400">{t('Precio')}</span>
                            <span className="text-xl font-bold text-gray-900">{formatCurrency(product.base_price)}</span>
                          </div>
                        </div>
                      </div>

                      {productSizesList.length > 0 ? (
                        <div className="mt-4">
                          <button
                            onClick={() => setScannedProductForSizeSelection(product)}
                            className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg border border-gray-200 transition-colors flex items-center justify-center gap-2"
                          >
                            <span>{t('pos.select_size')}</span>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (checkStock(product, undefined, 1)) {
                              addItem(product);
                            }
                          }}
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

                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500">{cart.length} {cart.length === 1 ? 'producto' : 'productos'}</p>
                </div>
              </div>
            </div>

            {/* Customer Selector in Cart Sidebar */}
            <div className="px-5 py-2 border-b border-gray-100">
              <button
                onClick={() => setShowCustomerModal(true)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border ${customerId ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-gray-50 border-gray-200 text-gray-600'} hover:border-amber-300 transition-colors`}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="font-medium truncate max-w-[150px]">
                    {customerId ? customers.find(c => c.id === customerId)?.name || t('pos.customer_selected') : t('pos.assign_customer')}
                  </span>
                </span>
                <span className="text-xs font-bold text-amber-600">
                  {customerId ? t('common.edit') : '+'}
                </span>
              </button>
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
                          onClick={() => {
                            if (checkStock(item.product, item.size, 1)) {
                              updateQuantity(cart.length - 1 - index, 1);
                            }
                          }}
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


      </div>

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 transform scale-100 transition-all flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('Seleccionar Cliente')}</h2>
                <p className="text-sm text-gray-500">{t('Asigne un cliente a este pedido')}</p>
              </div>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <div className="w-6 h-6 text-gray-400">✕</div>
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder={t('Buscar cliente por nombre o teléfono...')}
                value={customerSearchTerm}
                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
              {customers
                .filter(c =>
                  c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                  (c.phone && c.phone.includes(customerSearchTerm))
                )
                .map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setCustomerId(customer.id);
                      setShowCustomerModal(false);
                      toast.success(t('Cliente asignado correctamente'));
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-md ${customerId === customer.id
                      ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
                      }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-900">{customer.name}</p>
                        {customer.phone && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Smartphone className="w-3 h-3" /> {customer.phone}
                          </p>
                        )}
                      </div>
                      {customerId === customer.id && (
                        <CheckCircle className="w-5 h-5 text-amber-600" />
                      )}
                    </div>
                  </button>
                ))}

              {customers.filter(c =>
                c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                (c.phone && c.phone.includes(customerSearchTerm))
              ).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>{t('No se encontraron clientes')}</p>
                  </div>
                )}
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setCustomerId(null);
                  setShowCustomerModal(false);
                  toast.success(t('Cliente desasignado'));
                }}
                className="text-red-500 hover:text-red-700 text-sm font-medium px-4 py-2"
              >
                {t('Desasignar Cliente')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Size Selection Modal */}
      {scannedProductForSizeSelection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 transform scale-100 transition-all">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('pos.select_size')}</h2>
                <p className="text-sm text-gray-500">{scannedProductForSizeSelection.name}</p>
              </div>
              <button
                onClick={() => setScannedProductForSizeSelection(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <div className="w-6 h-6 text-gray-400">✕</div>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {productSizes(scannedProductForSizeSelection.id).map(size => {
                const currentInCart = cart.find(item => item.product.id === scannedProductForSizeSelection.id && item.size?.id === size.id)?.quantity || 0;
                const stockAvailable = size.stock - currentInCart;

                return (
                  <button
                    key={size.id}
                    disabled={stockAvailable <= 0}
                    onClick={() => {
                      if (checkStock(scannedProductForSizeSelection, size, 1)) {
                        addItem(scannedProductForSizeSelection, size);
                        setScannedProductForSizeSelection(null);
                        setBarcodeInput(''); // Clear if it came from scanner
                        toast.success(`${scannedProductForSizeSelection.name} (${size.size_name}) ${t('agregado')}`);
                      }
                    }}
                    className={`w-full p-4 rounded-xl border-2 transition-all flex justify-between items-center group
                      ${stockAvailable <= 0
                        ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                        : 'bg-white border-gray-200 hover:border-amber-500 hover:bg-amber-50 shadow-sm hover:shadow-md'
                      }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-lg text-gray-800 group-hover:text-amber-700 transition-colors">{size.size_name}</span>
                      <span className={`text-xs font-medium ${stockAvailable <= 5 ? 'text-orange-500' : 'text-green-600'}`}>
                        {stockAvailable <= 0 ? t('Agotado') : `${t('Stock')}: ${stockAvailable}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 group-hover:text-amber-700 text-lg">
                        +{formatCurrency(size.price_modifier)}
                      </span>
                      {stockAvailable > 0 && <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-amber-500" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('Monto a Pagar (Anticipo)')}
              </label>
              <div className="relative">
                {/* Currency symbol can be part of formatCurrency, but inside input we often just show number. 
                      Ideally we show the symbol outside or use a specialized input. 
                      For now, I will remove the hardcoded '$' and rely on placeholder or use currency context if available. 
                      The user mentioned currency is selectable in system. 
                      I will replace the hardcoded $ span with a dynamic one from useCurrency hook if possible, or just remove it if it conflicts.
                  */}
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">{formatCurrency(0).replace(/\d|[.,]/g, '').trim() || '$'}</span>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full pl-16 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none font-bold text-lg"
                  placeholder="0.00"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                  <button
                    onClick={() => setPaymentAmount(total.toString())}
                    className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded-md font-bold text-gray-700 transition"
                  >
                    Total
                  </button>
                  <button
                    onClick={() => setPaymentAmount((total / 2).toFixed(2))}
                    className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded-md font-bold text-gray-700 transition"
                  >
                    50%
                  </button>
                </div>
              </div>
              {parseFloat(paymentAmount) < total && parseFloat(paymentAmount) > 0 && (
                <p className="text-sm text-orange-600 font-bold mt-2 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  Pendiente: {formatCurrency(total - parseFloat(paymentAmount || '0'))}
                </p>
              )}
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
                <span className="font-bold text-blue-800">ℹ️ {t('Información')}:</span><br />
                {t('pos.validation_prompt')}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => processOrder('preparing', false)}
                disabled={loading}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-bold text-gray-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '...' : t('Después')}
              </button>
              <button
                onClick={() => processOrder('completed', true)}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl transition-all font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" light />
                    {t('Procesando...')}
                  </span>
                ) : t('Validar e Imprimir')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
