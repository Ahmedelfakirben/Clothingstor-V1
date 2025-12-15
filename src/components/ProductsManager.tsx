import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';

interface Category {
  id: string;
  name: string;
  description: string;
}

interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  base_price: number;
  available: boolean;
  image_url?: string;
  brand?: string;
  material?: string;
  gender?: string;
  season?: string;
  stock?: number;
}

interface ProductSize {
  id: string;
  product_id: string;
  size_name: string;
  price_modifier: number;
}

export function ProductsManager() {
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category_id: '',
    base_price: 0,
    available: true,
    brand: '',
    material: '',
    gender: '',
    season: '',
    stock: 0,
  });
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [newProductPreviewUrl, setNewProductPreviewUrl] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<File | null>(null);
  const [editingImagePreviewUrl, setEditingImagePreviewUrl] = useState<string | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [updatingProduct, setUpdatingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchSizes();
  }, []);

  // Vista previa para nueva imagen de producto
  useEffect(() => {
    if (!newProductImage) {
      setNewProductPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(newProductImage);
    setNewProductPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [newProductImage]);

  // Vista previa para imagen en edición
  useEffect(() => {
    if (!editingImage) {
      setEditingImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(editingImage);
    setEditingImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editingImage]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  };

  const fetchSizes = async () => {
    const { data } = await supabase.from('product_sizes').select('*');
    if (data) setSizes(data);
  };

  const handleCreateProduct = async () => {
    if (creatingProduct) return;

    setCreatingProduct(true);
    try {
      // Create product first
      const { data: created, error } = await supabase
        .from('products')
        .insert(newProduct)
        .select('id')
        .single();

      if (error) {
        toast.error(t('Error al crear producto'));
        return;
      }

      // Upload image if provided
      if (created && newProductImage) {
        setUploadingImage(true);
        try {
          const fileExt = newProductImage.name.split('.').pop();
          const filePath = `products/${created.id}/${Date.now()}.${fileExt}`;

          toast.loading(t('Subiendo imagen...'), { id: 'image-upload' });

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, newProductImage, {
              upsert: true,
              contentType: newProductImage.type,
            });

          if (uploadError) {
            console.error('Error subiendo imagen:', uploadError);
            toast.error(`${t('Error subiendo imagen:')} ${uploadError.message || t('Verifica el bucket "product-images" y permisos públicos.')}`, { id: 'image-upload' });
          } else {
            const { data: publicData } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);

            const publicUrl = publicData?.publicUrl;
            if (publicUrl) {
              await supabase
                .from('products')
                .update({ image_url: publicUrl })
                .eq('id', created.id);

              toast.success(t('Imagen subida correctamente'), { id: 'image-upload' });
            } else {
              toast.error(t('No se pudo obtener la URL pública de la imagen.'), { id: 'image-upload' });
            }
          }
        } catch (uploadErr) {
          console.error('Error during image upload:', uploadErr);
          toast.error(t('Error durante la subida de imagen'), { id: 'image-upload' });
        } finally {
          setUploadingImage(false);
        }
      }

      setShowNewProduct(false);
      setNewProduct({ name: '', description: '', category_id: '', base_price: 0, available: true });
      setNewProductImage(null);
      setNewProductPreviewUrl(null);
      fetchProducts();
      toast.success(t('Producto creado correctamente'));
    } catch (err) {
      console.error('Error creando producto:', err);
      toast.error(t('Error al crear producto'));
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || updatingProduct) return;

    setUpdatingProduct(true);
    try {
      // Update product first
      const { error } = await supabase
        .from('products')
        .update({
          name: editingProduct.name,
          description: editingProduct.description,
          category_id: editingProduct.category_id,
          base_price: editingProduct.base_price,
          available: editingProduct.available,
        })
        .eq('id', editingProduct.id);

      if (error) {
        toast.error(t('Error al actualizar producto'));
        return;
      }

      // Upload new image if provided
      if (editingImage && editingProduct) {
        setUploadingImage(true);
        try {
          const fileExt = editingImage.name.split('.').pop();
          const filePath = `products/${editingProduct.id}/${Date.now()}.${fileExt}`;

          toast.loading(t('Subiendo imagen...'), { id: 'image-edit-upload' });

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, editingImage, {
              upsert: true,
              contentType: editingImage.type,
            });

          if (uploadError) {
            console.error('Error subiendo imagen:', uploadError);
            toast.error(`${t('Error subiendo imagen:')} ${uploadError.message || ''}`, { id: 'image-edit-upload' });
          } else {
            const { data: publicData } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);

            if (publicData?.publicUrl) {
              await supabase
                .from('products')
                .update({ image_url: publicData.publicUrl })
                .eq('id', editingProduct.id);

              toast.success(t('Imagen subida correctamente'), { id: 'image-edit-upload' });
            } else {
              toast.error(t('No se pudo obtener la URL pública de la imagen.'), { id: 'image-edit-upload' });
            }
          }
        } catch (uploadErr) {
          console.error('Error during image upload:', uploadErr);
          toast.error(t('Error durante la subida de imagen'), { id: 'image-edit-upload' });
        } finally {
          setUploadingImage(false);
        }
      }

      setEditingImage(null);
      setEditingImagePreviewUrl(null);
      setEditingProduct(null);
      fetchProducts();
      toast.success(t('Producto actualizado correctamente'));
    } catch (err) {
      console.error('Error actualizando producto:', err);
      toast.error(t('Error al actualizar producto'));
    } finally {
      setUpdatingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm(`${t('¿Estás seguro de que deseas eliminar este producto?')}\n\n${t('El producto será eliminado permanentemente de la lista de productos activos. Los pedidos históricos que contengan este producto se mantendrán intactos.')}`)) return;

    try {
      // Check if product is used in any orders (for informational purposes)
      console.log('Checking product usage for ID:', id);
      const { data: orderItems, error: checkError } = await supabase
        .from('order_items')
        .select('id, orders!inner(status)')
        .eq('product_id', id)
        .limit(1);

      if (checkError) {
        console.error('Error checking product usage:', checkError);
        toast.error(t('Error al verificar el uso del producto'));
        return;
      }

      console.log('Order items found:', orderItems);
      if (orderItems && orderItems.length > 0) {
        console.log('Product is used in orders, but will proceed with soft delete');
      }

      console.log('Proceeding with soft delete');

      // Check if product appears in order history (for informational purposes only)
      const { data: historyItems, error: historyError } = await supabase
        .from('order_history')
        .select('id, items')
        .limit(1000); // Get a reasonable number of recent history records

      if (historyError) {
        console.error('Error checking order history:', historyError);
        // Don't block deletion for history check errors
      }

      let productInHistory = false;
      if (historyItems) {
        productInHistory = historyItems.some(record => {
          try {
            const items = Array.isArray(record.items) ? record.items : [];
            return items.some((item: any) => item.product_id === id);
          } catch (err) {
            console.error('Error parsing order history items:', err);
            return false;
          }
        });
      }

      if (productInHistory) {
        console.log('Product found in order history, but proceeding with soft delete');
        toast(t('El producto aparece en el historial de pedidos, pero se eliminará correctamente.'), {
          icon: '⚠️',
          duration: 4000
        });
      }

      // Proceed with direct deletion (constraints now allow this)
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting product:', deleteError);
        toast.error(`${t('Error al eliminar producto:')} ${deleteError.message}`);
        return;
      }

      toast.success(t('Producto eliminado correctamente. El historial de pedidos se mantiene intacto.'));
      fetchProducts();
    } catch (err) {
      console.error('Error in delete operation:', err);
      toast.error(t('Error al eliminar producto'));
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    return categories.find(c => c.id === categoryId)?.name || t('Sin categoría');
  };

  const getProductSizes = (productId: string) => {
    return sizes.filter(s => s.product_id === productId);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('Gestión de Productos')}</h2>
        <button
          onClick={() => setShowNewProduct(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('Nuevo Producto')}
        </button>
      </div>

      {showNewProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">{t('Nuevo Producto')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Nombre')}</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Descripción')}</label>
                <textarea
                  value={newProduct.description}
                  onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Categoría')}</label>
                <select
                  value={newProduct.category_id}
                  onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">{t('Seleccionar categoría')}</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Precio Base')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProduct.base_price}
                  onChange={e => setNewProduct({ ...newProduct, base_price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Stock Inicial')}</label>
                <input
                  type="number"
                  value={newProduct.stock}
                  onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Marca')}</label>
                  <input
                    type="text"
                    value={newProduct.brand}
                    onChange={e => setNewProduct({ ...newProduct, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="Nike, Adidas..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Material')}</label>
                  <input
                    type="text"
                    value={newProduct.material}
                    onChange={e => setNewProduct({ ...newProduct, material: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="Algodón, Poliéster..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Género')}</label>
                  <select
                    value={newProduct.gender}
                    onChange={e => setNewProduct({ ...newProduct, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">{t('Seleccionar')}</option>
                    <option value="hombre">{t('Hombre')}</option>
                    <option value="mujer">{t('Mujer')}</option>
                    <option value="unisex">{t('Unisex')}</option>
                    <option value="niño">{t('Niño')}</option>
                    <option value="niña">{t('Niña')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Temporada')}</label>
                  <select
                    value={newProduct.season}
                    onChange={e => setNewProduct({ ...newProduct, season: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">{t('Seleccionar')}</option>
                    <option value="primavera_verano">{t('Primavera/Verano')}</option>
                    <option value="otoño_invierno">{t('Otoño/Invierno')}</option>
                    <option value="todo_el_año">{t('Todo el año')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Imagen (opcional)')}</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setNewProductImage(e.target.files?.[0] || null)}
                    disabled={uploadingImage}
                    className={`w-full ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  {uploadingImage && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                    </div>
                  )}
                </div>
                {newProductPreviewUrl && (
                  <div className="mt-2 relative">
                    <img src={newProductPreviewUrl} alt={t('Vista previa')} className="h-24 w-24 object-cover rounded border" />
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateProduct}
                  disabled={creatingProduct || uploadingImage}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {creatingProduct || uploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {uploadingImage ? t('Subiendo imagen...') : t('Creando...')}
                    </>
                  ) : (
                    t('Crear')
                  )}
                </button>
                <button
                  onClick={() => setShowNewProduct(false)}
                  disabled={creatingProduct || uploadingImage}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 py-2 rounded-lg transition-colors"
                >
                  {t('Cancelar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Producto')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Categoría')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Marca')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Género')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Precio')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Stock')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Estado')}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Acciones')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.map(product => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  {editingProduct?.id === product.id ? (
                    <div>
                      <input
                        type="text"
                        value={editingProduct.name}
                        onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                      <div className="mt-2 flex items-center gap-3">
                        {(editingImagePreviewUrl || product.image_url) && (
                          <div className="relative">
                            <img
                              src={editingImagePreviewUrl || product.image_url || ''}
                              alt={t('Vista previa')}
                              className="h-16 w-16 object-cover rounded border"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            {uploadingImage && (
                              <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center">
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                              </div>
                            )}
                          </div>
                        )}
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingImage}
                            onChange={e => {
                              const file = e.target.files?.[0] || null;
                              setEditingImage(file);
                            }}
                            className={`text-sm ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                          />
                          {uploadingImage && (
                            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                              <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium text-gray-900">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-500">{product.description}</div>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {editingProduct?.id === product.id ? (
                    <select
                      value={editingProduct.category_id || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, category_id: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  ) : (
                    getCategoryName(product.category_id)
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {editingProduct?.id === product.id ? (
                    <input
                      type="text"
                      value={editingProduct.brand || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                      className="w-28 px-2 py-1 border border-gray-300 rounded"
                      placeholder={t('Marca')}
                    />
                  ) : (
                    product.brand || '-'
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {editingProduct?.id === product.id ? (
                    <select
                      value={editingProduct.gender || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, gender: e.target.value })}
                      className="w-28 px-2 py-1 border border-gray-300 rounded"
                    >
                      <option value="">{t('Seleccionar')}</option>
                      <option value="hombre">{t('Hombre')}</option>
                      <option value="mujer">{t('Mujer')}</option>
                      <option value="unisex">{t('Unisex')}</option>
                      <option value="niño">{t('Niño')}</option>
                      <option value="niña">{t('Niña')}</option>
                    </select>
                  ) : (
                    product.gender ? t(product.gender.charAt(0).toUpperCase() + product.gender.slice(1)) : '-'
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {editingProduct?.id === product.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editingProduct.base_price}
                      onChange={e => setEditingProduct({ ...editingProduct, base_price: parseFloat(e.target.value) })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    formatCurrency(product.base_price)
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {editingProduct?.id === product.id ? (
                    <input
                      type="number"
                      value={editingProduct.stock || 0}
                      onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    <span className={`font-medium ${(product.stock || 0) < 5 ? 'text-red-600' : 'text-gray-900'}`}>
                      {product.stock || 0}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    product.available
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {product.available ? t('Disponible') : t('No disponible')}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {editingProduct?.id === product.id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleUpdateProduct}
                        disabled={updatingProduct || uploadingImage}
                        className={`flex items-center gap-1 ${updatingProduct || uploadingImage ? 'text-green-400 cursor-not-allowed' : 'text-green-600 hover:text-green-800'}`}
                        title={updatingProduct || uploadingImage ? (uploadingImage ? t('Subiendo imagen...') : t('Guardando cambios...')) : t('Guardar cambios')}
                      >
                        {updatingProduct || uploadingImage ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingProduct(null)}
                        disabled={updatingProduct || uploadingImage}
                        className={`flex items-center gap-1 ${updatingProduct || uploadingImage ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:text-gray-800'}`}
                        title={updatingProduct || uploadingImage ? t('Espera a que termine la operación') : t('Cancelar edición')}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="text-blue-600 hover:text-blue-800"
                        title={t('Editar producto')}
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-600 hover:text-red-800"
                        title={t('Eliminar producto permanentemente')}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
