import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, ScanBarcode, Package, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { LoadingSpinner } from './LoadingSpinner';
import IndividualUnitsManager from './IndividualUnitsManager';
import { BarcodeScanner } from './BarcodeScanner';


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
  barcode?: string;
  purchase_price?: number;
}

interface ProductSize {
  id: string;
  product_id: string;
  size_name: string;
  price_modifier: number;
  stock: number;
}


interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
}

export function ProductsManager() {
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<{
    name: string;
    description: string;
    category_id: string;
    base_price: number;
    available: boolean;
    brand?: string;
    material?: string;
    gender?: string;
    season?: string;
    stock?: number;
    barcode?: string;
    image_url?: string;
    color?: string;
  }>({
    name: '',
    description: '',
    category_id: '',
    base_price: 0,
    available: true,
  });
  const [newProductSizes, setNewProductSizes] = useState<{ name: string; stock: number; price: number }[]>([]);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeStock, setNewSizeStock] = useState('0');

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [newProductPreviewUrl, setNewProductPreviewUrl] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<File | null>(null);
  const [editingImagePreviewUrl, setEditingImagePreviewUrl] = useState<string | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [updatingProduct, setUpdatingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchingBarcode, setSearchingBarcode] = useState(false);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const analyzeImageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const [selectedProductForUnits, setSelectedProductForUnits] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para galería de imágenes
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [existingGalleryImages, setExistingGalleryImages] = useState<ProductImage[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);


  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchSizes();

    // Suscripción Realtime para Productos y Tallas
    const productsChannel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('🔄 Cambio en Productos recibido:', payload);
          fetchProducts(); // Refetch completo para simplicidad y consistencia
        }
      )
      .subscribe();

    const sizesChannel = supabase
      .channel('sizes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_sizes' },
        (payload) => {
          console.log('🔄 Cambio en Tallas recibido:', payload);
          fetchSizes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(sizesChannel);
    };
  }, []);

  // Vista previa para nueva imagen de producto
  useEffect(() => {
    if (!newProductImage) {
      if (newProduct.image_url) {
        setNewProductPreviewUrl(newProduct.image_url);
      } else {
        setNewProductPreviewUrl(null);
      }
      return;
    }
    const url = URL.createObjectURL(newProductImage);
    setNewProductPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [newProductImage, newProduct.image_url]);

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

  // Vista previa para galería de imágenes
  useEffect(() => {
    if (galleryFiles.length === 0) {
      setGalleryPreviews([]);
      return;
    }

    const newPreviews = galleryFiles.map(file => URL.createObjectURL(file));
    setGalleryPreviews(newPreviews);

    return () => {
      newPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [galleryFiles]);

  const handleGalleryFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setGalleryFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveNewGalleryImage = (index: number) => {
    setGalleryFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingGalleryImage = (id: string) => {
    setExistingGalleryImages(prev => prev.filter(img => img.id !== id));
    setImagesToDelete(prev => [...prev, id]);
  };

  const fetchGalleryImages = async (productId: string) => {
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching gallery images:', error);
    } else {
      setExistingGalleryImages(data || []);
    }
  };

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

  const handleAddSize = () => {
    if (!newSizeName.trim()) {
      toast.error(t('El nombre de la talla es obligatorio'));
      return;
    }
    const stock = parseInt(newSizeStock);
    if (isNaN(stock) || stock < 0) {
      toast.error(t('El stock debe ser un número válido >= 0'));
      return;
    }

    setNewProductSizes([...newProductSizes, { name: newSizeName.trim(), stock, price: 0 }]);
    setNewSizeName('');
    setNewSizeStock('0');
  };

  const handleRemoveSize = (index: number) => {
    setNewProductSizes(newProductSizes.filter((_, i) => i !== index));
  };

  // Función para reparar imágenes rotas usando Google
  const fixProductImage = async (barcode: string, productName: string, brand: string, currentImageUrl: string) => {
    // Evitar bucles infinitos si ya intentamos reparar
    if (currentImageUrl.includes('googleusercontent') || currentImageUrl.includes('gstatic')) {
      return null;
    }

    try {
      console.log(`🔧 Attempting to fix image for: ${productName}`);

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
      return data.image_url;
    } catch (err) {
      console.error('Error fixing image:', err);
      return null;
    }
  };

  const handleBarcodeSearch = async () => {
    const barcode = newProduct.barcode?.trim();
    if (!barcode) {
      toast.error(t('Ingresa un código de barras primero'));
      return;
    }

    setSearchingBarcode(true);
    try {
      // 1. Buscar en PRODUCTOS EXISTENTES primero
      const { data: existingProduct, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();

      if (existingProduct && !productError) {
        setNewProduct({
          ...newProduct,
          name: existingProduct.name || newProduct.name,
          description: existingProduct.description || newProduct.description,
          brand: existingProduct.brand || newProduct.brand,
          image_url: existingProduct.image_url || newProduct.image_url,
          category_id: existingProduct.category_id || newProduct.category_id,
          base_price: existingProduct.base_price || newProduct.base_price
        });
        toast.success(t('✅ Producto ya existente encontrado en tu inventario'));
        return;
      }

      // 2. Buscar en caché local (búsquedas previas de API)
      const { data: cached, error: cacheError } = await supabase
        .from('barcode_cache')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();

      if (cached && !cacheError) {
        // Autocompletar desde caché
        setNewProduct({
          ...newProduct,
          name: cached.product_name || newProduct.name,
          description: cached.description || newProduct.description,
          brand: cached.brand || newProduct.brand,
          image_url: cached.image_url || newProduct.image_url,
        });
        toast.success(t('✅ Información cargada desde caché local'));
        return;
      }

      // 2. Si no está en caché, consultar API externa
      toast.loading(t('Buscando información del producto...'), { id: 'barcode-search' });

      const productInfo = await fetchBarcodeFromAPI(barcode);

      if (productInfo) {
        // 3. Guardar en caché para futuras búsquedas
        await supabase.from('barcode_cache').insert({
          barcode: barcode,
          product_name: productInfo.name,
          brand: productInfo.brand,
          description: productInfo.description,
          category: productInfo.category,
          image_url: productInfo.image,
          api_source: productInfo.source || 'edge-function'
        });

        // 4. Autocompletar formulario
        setNewProduct({
          ...newProduct,
          name: productInfo.name || newProduct.name,
          description: productInfo.description || newProduct.description,
          brand: productInfo.brand || newProduct.brand,
          image_url: productInfo.image || newProduct.image_url,
        });

        // Si hay imagen, mostrar preview (el usuario puede cambiarla)
        if (productInfo.image) {
          toast.success(
            t(`✅ Encontrado vía ${productInfo.source?.toUpperCase() || 'API'}. Imagen disponible.`),
            { id: 'barcode-search', duration: 4000 }
          );
          // Nota: La imagen se guardará cuando el usuario cree el producto
          // Por ahora solo mostramos que hay una imagen disponible en el caché
        } else {
          toast.success(
            t('✅ Información del producto cargada. Puedes editarla antes de guardar.'),
            { id: 'barcode-search' }
          );
        }
      } else {
        // Fallback: Mostrar Modal de "No encontrado"
        setSearchingBarcode(false); // Stop spinner
        setShowNotFoundModal(true);
      }
    } catch (error: any) {
      console.error('Error buscando código de barras:', error);
      toast.error(
        t('Error al buscar información del producto. Completa manualmente.'),
        { id: 'barcode-search' }
      );
    } finally {
      setSearchingBarcode(false);
    }
  };

  // Referencias para inputs de imagen
  // const analyzeImageInputRef = useRef... (moved up)

  const handleImageAnalyze = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    const toastId = toast.loading(t('Analizando imagen...'));

    // Helper para redimensionar imagen
    const resizeImage = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); // JPG calidad 0.7
          };
          img.onerror = reject;
          img.src = event.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    try {
      // 1. Redimensionar y convertir a Base64
      const base64String = await resizeImage(file);

      // 2. Enviar a Edge Function
      const { data, error } = await supabase.functions.invoke('barcode-lookup', {
        body: JSON.stringify({
          action: 'analyze_image',
          image: base64String
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (error || data?.error) {
        console.error('AI Analysis Error:', error, data?.error);
        toast.error(t('No se pudo identificar el producto por imagen'), { id: toastId });
        return;
      }

      // 3. Rellenar formulario
      if (data) {
        console.log('🤖 Datos Recibidos IA:', data); // Log para depurar

        const googleImage = data.image;

        if (googleImage) {
          // Estrategia 1: Si hay imagen de Google, usamos ESA como principal.
          console.log('📸 Usando imagen de Google:', googleImage);
          setNewProductImage(null);
          setGalleryFiles([]);
          setGalleryPreviews([]);

          setNewProductPreviewUrl(googleImage);
          setNewProduct({
            ...newProduct,
            name: data.name || newProduct.name,
            description: data.description || newProduct.description,
            brand: data.brand || newProduct.brand,
            category_id: newProduct.category_id,
            image_url: googleImage,
            color: data.color || newProduct.color,
            material: data.material || newProduct.material,
            gender: data.gender || newProduct.gender,
            season: data.season || newProduct.season
          });

          toast.success(t('✅ ¡Producto identificado + Foto Google!'), { id: toastId });

        } else {
          // Estrategia 2: Fallback a foto subida
          console.log('📸 Usando foto subida (Fallback)');
          setGalleryFiles([file]);
          setGalleryPreviews([base64String]);
          setNewProductImage(file);
          setNewProductPreviewUrl(base64String);

          setNewProduct({
            ...newProduct,
            name: data.name || newProduct.name,
            description: data.description || newProduct.description,
            brand: data.brand || newProduct.brand,
            category_id: newProduct.category_id,
            color: data.color || newProduct.color,
            material: data.material || newProduct.material,
            gender: data.gender || newProduct.gender,
            season: data.season || newProduct.season
          });

          toast.success(t('✅ ¡Producto identificado!'), { id: toastId });
        }
      }

    } catch (error) {
      console.error('Error analyzing image:', error);
      toast.error(t('Error al procesar la imagen'), { id: toastId });
    }
  };

  const fetchBarcodeFromAPI = async (barcode: string) => {
    try {
      console.log('🔍 Buscando vía Supabase Edge Function:', barcode);

      // Llamar a Supabase Edge Function (evita CORS)
      const { data, error } = await supabase.functions.invoke('barcode-lookup', {
        body: JSON.stringify({ barcode }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Respuesta Edge Function:', data, error);

      if (error) {
        // Ignorar 404 (Producto no encontrado es normal en búsqueda)
        // @ts-ignore
        if (error.code === '404' || error.status === 404 || error.message?.includes('FunctionsHttpError')) {
          console.log('ℹ️ Producto no encontrado en API (404 Normal)');
        } else {
          console.warn('⚠️ Error API búsqueda:', error);
        }
        return null;
      }

      if (data?.error) {
        console.warn('⚠️ API Error:', data.error);
        return null;
      }

      console.log('✅ Producto encontrado:', data.name);
      return {
        name: data.name,
        brand: data.brand,
        description: data.description,
        category: data.category,
        image: data.image,
        source: data.source
      };

    } catch (error) {
      console.error('💥 Error:', error);
      return null;
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    setNewProduct(prev => ({ ...prev, barcode: decodedText }));
    setShowScanner(false);
    toast.success(`${t('Código escaneado')}: ${decodedText}`);
  };

  const handleCreateProduct = async () => {
    if (creatingProduct) return;

    // Validar campos requeridos
    if (!newProduct.name.trim()) {
      toast.error(t('El nombre del producto es obligatorio'));
      return;
    }

    if (!newProduct.category_id) {
      toast.error(t('La categoría es obligatoria'));
      return;
    }

    if (newProduct.base_price <= 0) {
      toast.error(t('El precio debe ser mayor a 0'));
      return;
    }

    setCreatingProduct(true);
    try {
      // Preparar datos para insertar (eliminar campos vacíos opcionales)
      let finalDescription = newProduct.description?.trim() || '';
      if (newProduct.color && newProduct.color.trim()) {
        finalDescription = `[Color: ${newProduct.color.trim()}] ${finalDescription}`;
      }

      const productData: any = {
        name: newProduct.name.trim(),
        description: finalDescription,
        category_id: newProduct.category_id,
        base_price: newProduct.base_price,
        purchase_price: newProduct.purchase_price,
        available: newProduct.available ?? true,
      };

      // Solo agregar campos opcionales si tienen valor válido
      console.log('🔍 [PRODUCTS] Validating optional fields:', {
        brand: newProduct.brand,
        material: newProduct.material,
        gender: newProduct.gender,
        season: newProduct.season,
        stock: newProduct.stock,
        barcode: newProduct.barcode
      });

      if (newProduct.barcode && newProduct.barcode.trim()) {
        productData.barcode = newProduct.barcode.trim();
        console.log('✅ Added barcode:', productData.barcode);
      }

      if (newProduct.brand && newProduct.brand.trim()) {
        productData.brand = newProduct.brand.trim();
        console.log('✅ Added brand:', productData.brand);
      }
      if (newProduct.material && newProduct.material.trim()) {
        productData.material = newProduct.material.trim();
        console.log('✅ Added material:', productData.material);
      }
      if (newProduct.gender && newProduct.gender.trim() && newProduct.gender !== '') {
        productData.gender = newProduct.gender.trim();
        console.log('✅ Added gender:', productData.gender);
      }
      if (newProduct.season && newProduct.season.trim() && newProduct.season !== '') {
        productData.season = newProduct.season.trim();
        console.log('✅ Added season:', productData.season);
      }
      // Calculate total stock from sizes if any are defined
      let initialStock = newProduct.stock || 0;
      if (newProductSizes.length > 0) {
        initialStock = newProductSizes.reduce((sum, size) => sum + size.stock, 0);
      }

      if (initialStock > 0) {
        productData.stock = initialStock;
        console.log('✅ Added stock (calculated from sizes or input):', productData.stock);
      }

      // Add image_url if available from barcode search
      if (newProduct.image_url && newProduct.image_url.trim()) {
        productData.image_url = newProduct.image_url.trim();
        console.log('✅ Added image_url:', productData.image_url);
      }

      console.log('📝 [PRODUCTS] Final product data to insert:', JSON.stringify(productData, null, 2));

      // Create product first
      const { data: created, error } = await supabase
        .from('products')
        .insert(productData)
        .select('id')
        .single();

      if (error) {
        console.error('❌ [PRODUCTS] Error creating product:', error);
        if (error.code === '42501') {
          toast.error(t('No tienes permisos para crear productos. Solo admin y super_admin pueden hacerlo.'));
        } else if (error.code === '23505' || error.message.includes('duplicate key value')) {
          toast.error(t('Este código de barras ya existe. Busca el producto en la lista para editarlo.'));
        } else if (error.message.includes('violates check constraint')) {
          toast.error(t('Error: Verifica que los valores de género y temporada sean correctos.'));
        } else {
          toast.error(`${t('Error al crear producto:')} ${error.message}`);
        }
        return;
      }

      console.log('✅ [PRODUCTS] Product created successfully:', created);

      // Insert sizes if any
      if (created && newProductSizes.length > 0) {
        const sizesToInsert = newProductSizes.map(size => ({
          product_id: created.id,
          size_name: size.name,
          stock: size.stock,
          price_modifier: size.price
        }));

        const { error: sizesError } = await supabase
          .from('product_sizes')
          .insert(sizesToInsert);

        if (sizesError) {
          console.error('❌ [PRODUCTS] Error creating sizes:', sizesError);
          toast.error(t('Producto creado pero hubo error al guardar las tallas'));
        } else {
          console.log('✅ [PRODUCTS] Sizes created successfully');
        }
      }

      // Upload gallery images
      if (created && galleryFiles.length > 0) {
        setUploadingImage(true);
        try {
          toast.loading(t('Subiendo galería...'), { id: 'gallery-upload' });
          const uploadPromises = galleryFiles.map(async (file, index) => {
            const fileExt = file.name.split('.').pop();
            const filePath = `products/${created.id}/gallery_${Date.now()}_${index}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('product-images')
              .upload(filePath, file, {
                upsert: true,
                contentType: file.type,
              });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);

            if (publicData?.publicUrl) {
              return {
                product_id: created.id,
                image_url: publicData.publicUrl,
                display_order: index
              };
            }
            return null;
          });

          const results = await Promise.all(uploadPromises);
          const validImages = results.filter(img => img !== null);

          if (validImages.length > 0) {
            await supabase.from('product_images').insert(validImages);
            toast.success(t('Galería subida correctamente'), { id: 'gallery-upload' });
          }
        } catch (galleryErr) {
          console.error('Error uploading gallery:', galleryErr);
          toast.error(t('Error al subir algunas imágenes de la galería'), { id: 'gallery-upload' });
        } finally {
          setUploadingImage(false);
        }
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
            console.error('❌ [PRODUCTS] Error uploading image:', uploadError);

            if (uploadError.message.includes('Bucket not found')) {
              toast.error(
                t('❌ El bucket "product-images" no existe. Ve a Storage en Supabase y créalo como público. Consulta GUIA_CONFIGURAR_STORAGE.md'),
                { id: 'image-upload', duration: 8000 }
              );
            } else if (uploadError.message.includes('policy')) {
              toast.error(
                t('❌ Error de permisos. Verifica las políticas RLS del bucket "product-images".'),
                { id: 'image-upload', duration: 6000 }
              );
            } else {
              toast.error(
                `${t('Error subiendo imagen:')} ${uploadError.message}`,
                { id: 'image-upload', duration: 6000 }
              );
            }
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
      setNewProduct({
        name: '',
        description: '',
        category_id: '',
        base_price: 0,
        purchase_price: 0,
        available: true,
        barcode: '',
      });
      setNewProductSizes([]);
      setNewProductImage(null);
      setNewProductPreviewUrl(null);
      fetchProducts();
      fetchSizes();
      toast.success(t('Producto creado correctamente'));
    } catch (err) {
      console.error('Error creando producto:', err);
      toast.error(t('Error al crear producto'));
    } finally {
      setCreatingProduct(false);
    }

  };

  const startEditingProduct = (product: Product) => {
    // 1. Cargar datos básicos
    setNewProduct({
      name: product.name,
      description: product.description,
      category_id: product.category_id || '',
      base_price: product.base_price,
      purchase_price: product.purchase_price || 0,
      available: product.available,
      barcode: product.barcode || '',
      brand: product.brand || '',
      material: product.material || '',
      gender: product.gender || '',
      season: product.season || '',
      stock: product.stock || 0,
      image_url: product.image_url
    });

    // 2. Cargar tallas
    const productSizesList = sizes.filter(s => s.product_id === product.id).map(s => ({
      name: s.size_name,
      stock: s.stock,
      price: s.price_modifier || 0
    }));
    setNewProductSizes(productSizesList);

    // 3. Configurar estado de edición
    setIsEditing(true);
    setEditingId(product.id);
    setShowNewProduct(true);
    setNewProductPreviewUrl(product.image_url || null);

    // 4. Cargar galería
    fetchGalleryImages(product.id);

    // 5. Scroll al formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFullUpdate = async () => {
    if (!editingId) return;

    setCreatingProduct(true);
    try {
      // 1. Prepare product data
      const productData: any = {
        name: newProduct.name.trim(),
        description: newProduct.description?.trim() || '',
        category_id: newProduct.category_id,
        base_price: newProduct.base_price,
        purchase_price: newProduct.purchase_price,
        available: newProduct.available ?? true,
        barcode: newProduct.barcode?.trim() || null,
        brand: newProduct.brand?.trim() || null,
        material: newProduct.material?.trim() || null,
        gender: newProduct.gender || null,
        season: newProduct.season || null,
      };

      // Handle stock logic
      let totalStock = newProduct.stock || 0;
      if (newProductSizes.length > 0) {
        totalStock = newProductSizes.reduce((sum, s) => sum + s.stock, 0);
      }
      productData.stock = totalStock;

      // 2. Update Product
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingId);

      if (error) throw error;

      // 3. Update Sizes (Delete all and re-insert)
      // First delete existing
      const { error: deleteError } = await supabase
        .from('product_sizes')
        .delete()
        .eq('product_id', editingId);

      if (deleteError) throw deleteError;

      // Then insert new ones
      if (newProductSizes.length > 0) {
        const sizesToInsert = newProductSizes.map(size => ({
          product_id: editingId,
          size_name: size.name,
          stock: size.stock,
          price_modifier: size.price
        }));

        const { error: sizesError } = await supabase
          .from('product_sizes')
          .insert(sizesToInsert);

        if (sizesError) throw sizesError;
      }

      // 4. Handle Deletions of Gallery Images
      if (imagesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('product_images')
          .delete()
          .in('id', imagesToDelete);

        if (deleteError) {
          console.error('Error deleting gallery images:', deleteError);
          toast.error(t('Error al eliminar algunas imágenes de la galería'));
        }
      }

      // 5. Handle New Gallery Images Upload
      if (galleryFiles.length > 0) {
        setUploadingImage(true);
        try {
          toast.loading(t('Subiendo nuevas imágenes...'), { id: 'gallery-update' });
          const currentCount = existingGalleryImages.length;

          const uploadPromises = galleryFiles.map(async (file, index) => {
            const fileExt = file.name.split('.').pop();
            const filePath = `products/${editingId}/gallery_${Date.now()}_${index}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('product-images')
              .upload(filePath, file, {
                upsert: true,
                contentType: file.type,
              });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);

            if (publicData?.publicUrl) {
              return {
                product_id: editingId,
                image_url: publicData.publicUrl,
                display_order: currentCount + index
              };
            }
            return null;
          });

          const results = await Promise.all(uploadPromises);
          const validImages = results.filter(img => img !== null);

          if (validImages.length > 0) {
            await supabase.from('product_images').insert(validImages);
            toast.success(t('Galería actualizada correctamente'), { id: 'gallery-update' });
          }
        } catch (galleryErr) {
          console.error('Error uploading gallery:', galleryErr);
          toast.error(t('Error al subir nuevas imágenes a la galería'), { id: 'gallery-update' });
        } finally {
          setUploadingImage(false);
        }
      }

      // 6. Handle Main Image Upload
      if (newProductImage) {
        setUploadingImage(true);
        const fileExt = newProductImage.name.split('.').pop();
        const filePath = `products/${editingId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, newProductImage, { upsert: true });

        if (!uploadError) {
          const { data: publicData } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

          if (publicData?.publicUrl) {
            await supabase
              .from('products')
              .update({ image_url: publicData.publicUrl })
              .eq('id', editingId);
          }
        }
      }

      toast.success(t('Producto actualizado correctamente'));

      // Cleanup
      setIsEditing(false);
      setEditingId(null);
      setShowNewProduct(false);
      resetForm();
      fetchProducts();
      fetchSizes();

    } catch (err: any) {
      console.error('Error updating product:', err);
      toast.error(t('Error al actualizar producto: ') + err.message);
    } finally {
      setCreatingProduct(false);
      setUploadingImage(false);
    }
  };

  const resetForm = () => {
    setNewProduct({
      name: '',
      description: '',
      category_id: '',
      base_price: 0,
      purchase_price: 0,
      available: true,
      barcode: '',
      stock: 0,
      brand: '',
      material: '',
      gender: '',
      season: ''
    });
    setNewProductSizes([]);
    setNewProductImage(null);
    setNewProductPreviewUrl(null);
    setIsEditing(false);
    setEditingId(null);
    setGalleryFiles([]);
    setGalleryPreviews([]);
    setExistingGalleryImages([]);
    setImagesToDelete([]);
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
          purchase_price: editingProduct.purchase_price,
          available: editingProduct.available,
          barcode: editingProduct.barcode,
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

  const filteredProducts = products.filter(product => {
    const search = searchTerm.toLowerCase();
    if (!search) return true;
    return (
      product.name.toLowerCase().includes(search) ||
      (product.barcode && product.barcode.toLowerCase().includes(search)) ||
      (product.brand && product.brand.toLowerCase().includes(search))
    );
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('Gestión de Productos')}</h2>
        <button
          onClick={() => {
            if (showNewProduct && isEditing) {
              // Cancelar edición
              resetForm();
              setShowNewProduct(false);
            } else {
              setShowNewProduct(!showNewProduct);
              if (!showNewProduct) resetForm();
            }
          }}
          className={`bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${showNewProduct && isEditing ? 'bg-red-600 hover:bg-red-700' : ''
            }`}
        >
          {showNewProduct && isEditing ? (
            <>
              <X className="w-5 h-5" />
              {t('Cancelar Edición')}
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              {t('Nuevo Producto')}
            </>
          )}
        </button>
      </div>

      {showNewProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{isEditing ? t('Editar Producto') : t('Nuevo Producto')}</h3>
            <div className="space-y-4">
              {/* Bloque Imagen Principal (Movido arriba) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Imagen Principal')}</label>
                <div className="flex items-start gap-4">
                  <div className="relative">
                    {(newProductPreviewUrl || newProduct.image_url) ? (
                      <div className="relative">
                        <img
                          src={newProductPreviewUrl || newProduct.image_url}
                          alt={t('Vista previa')}
                          className="h-24 w-24 object-cover rounded-lg border-2 border-gray-200"
                          onError={async (e) => {
                            // Reutilizando lógica de reparación de imagen
                            const img = e.currentTarget;
                            if (img.parentElement) {
                              const loading = document.createElement('div');
                              loading.className = "absolute inset-0 bg-gray-100 flex items-center justify-center text-xs text-amber-600 animate-pulse";
                              loading.innerText = t("Reparando...");
                              img.style.display = 'none';
                              img.parentElement.appendChild(loading);
                            }
                            const currentUrl = newProductPreviewUrl || newProduct.image_url || '';
                            const newUrl = await fixProductImage(newProduct.barcode || '', newProduct.name, newProduct.brand || '', currentUrl);
                            if (newUrl) {
                              setNewProduct({ ...newProduct, image_url: newUrl });
                            } else {
                              if (img.parentElement) {
                                img.parentElement.innerHTML = '';
                                const fallback = document.createElement('div');
                                fallback.className = "h-24 w-24 flex items-center justify-center bg-gray-100 text-gray-400 rounded border text-xs text-center p-1";
                                fallback.innerText = t("Sin Imagen");
                                img.parentElement.appendChild(fallback);
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setNewProductImage(null);
                            setNewProduct({ ...newProduct, image_url: '' });
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm z-10"
                          title={t('Quitar imagen')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-24 w-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                        <Package className="w-8 h-8 opacity-50" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setNewProductImage(e.target.files?.[0] || null)}
                      disabled={uploadingImage}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      {t('Esta es la imagen principal. Aparecerá en listas y ventas.')}
                    </p>
                    {uploadingImage && <div className="text-amber-600 text-xs mt-1 animate-pulse">{t('Subiendo...')}</div>}
                  </div>
                </div>
              </div>

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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Código de barras')}</label>
                <div className="flex gap-2">
                  <div className="space-y-2">

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProduct.barcode || ''}
                        onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder={t('Escanea o ingresa código')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                        title={t('Escanear con cámara')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={handleBarcodeSearch}
                        disabled={!newProduct.barcode || searchingBarcode}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      >
                        {searchingBarcode ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('Buscando...')}
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {t('Buscar')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('Escanea el código o escribe y presiona "Buscar" para autocompletar')}
                </p>
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

              {/* Nuevos Campos IA: Color, Material, Género, Temporada */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Marca')}</label>
                  <input
                    type="text"
                    value={newProduct.brand || ''}
                    onChange={e => setNewProduct({ ...newProduct, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="Adidas, Nike..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Color')}</label>
                  <input
                    type="text"
                    value={newProduct.color || ''}
                    onChange={e => setNewProduct({ ...newProduct, color: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="Rojo, Azul..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Material')}</label>
                  <input
                    type="text"
                    value={newProduct.material || ''}
                    onChange={e => setNewProduct({ ...newProduct, material: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="Algodón, Poliéster..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Género')}</label>
                  <select
                    value={newProduct.gender || ''}
                    onChange={e => setNewProduct({ ...newProduct, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">{t('Seleccionar...')}</option>
                    <option value="Male">{t('Hombre')}</option>
                    <option value="Female">{t('Mujer')}</option>
                    <option value="Unisex">{t('Unisex')}</option>
                    <option value="Kids">{t('Niños')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Temporada')}</label>
                  <select
                    value={newProduct.season || ''}
                    onChange={e => setNewProduct({ ...newProduct, season: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">{t('Seleccionar...')}</option>
                    <option value="Summer">{t('Verano')}</option>
                    <option value="Winter">{t('Invierno')}</option>
                    <option value="Spring">{t('Primavera')}</option>
                    <option value="Autumn">{t('Otoño')}</option>
                    <option value="All Season">{t('Todo el año')}</option>
                  </select>
                </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Costo (Compra)')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.purchase_price || 0}
                    onChange={e => setNewProduct({ ...newProduct, purchase_price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('Precio (Venta)')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.base_price}
                    onChange={e => setNewProduct({ ...newProduct, base_price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Manejo de Tallas y Stock')}</label>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder={t('Nombre Talla (ej: XL, 42)')}
                      value={newSizeName}
                      onChange={e => setNewSizeName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                    <input
                      type="number"
                      placeholder={t('Stock')}
                      value={newSizeStock}
                      onChange={e => setNewSizeStock(e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddSize}
                      className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {newProductSizes.length > 0 ? (
                    <div className="space-y-2 mt-3 p-2 bg-white rounded border border-gray-100">
                      {newProductSizes.map((size, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm p-1 border-b last:border-0 border-gray-100">
                          <span>{size.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">{size.stock} u.</span>
                            <button onClick={() => handleRemoveSize(idx)} className="text-red-500 hover:text-red-700">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 mt-2 border-t border-gray-200 text-right text-xs font-bold text-gray-600">
                        Total Stock: {newProductSizes.reduce((a, b) => a + b.stock, 0)}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-1">{t('O ingresa el stock total si no hay tallas:')}</p>
                      <input
                        type="number"
                        value={newProduct.stock}
                        onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Galería de Imágenes')}</label>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryFilesSelect}
                    disabled={uploadingImage}
                    className="w-full mb-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                  />

                  {(existingGalleryImages.length > 0 || galleryPreviews.length > 0) ? (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {existingGalleryImages.map((img) => (
                        <div key={img.id} className="relative aspect-square border rounded-lg overflow-hidden group">
                          <img src={img.image_url} alt="Gallery" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingGalleryImage(img.id)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {galleryPreviews.map((url, idx) => (
                        <div key={`new-${idx}`} className="relative aspect-square border rounded-lg overflow-hidden group">
                          <img src={url} alt="New Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewGalleryImage(idx)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-center text-gray-400 mt-2">{t('Selecciona múltiples imágenes para la galería')}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={isEditing ? handleFullUpdate : handleCreateProduct}
                  disabled={creatingProduct || uploadingImage}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {creatingProduct || uploadingImage ? (
                    <>
                      <LoadingSpinner size="sm" light />
                      {uploadingImage ? t('Subiendo imagen...') : (isEditing ? t('Actualizando...') : t('Creando...'))}
                    </>
                  ) : (
                    isEditing ? t('Actualizar') : t('Crear')
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

      {showScanner && (
        <BarcodeScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4 bg-gray-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={t('Buscar productos...')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-sm"
            />
          </div>
        </div>
        {/* Vista Móvil (Tarjetas) */}
        <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex gap-4">
              {/* Imagen */}
              <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                      e.currentTarget.parentElement!.innerHTML = '<svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Package className="w-8 h-8 opacity-50" />
                  </div>
                )}
              </div>

              {/* Info y Acciones */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-bold text-amber-600">{formatCurrency(product.base_price)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${(getProductSizes(product.id).length > 0
                        ? getProductSizes(product.id).reduce((sum, s) => sum + s.stock, 0)
                        : (product.stock || 0)) > 0
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }`}>
                      Stock: {getProductSizes(product.id).length > 0
                        ? getProductSizes(product.id).reduce((sum, s) => sum + s.stock, 0)
                        : (product.stock || 0)
                      }
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{product.brand || t('Sin marca')}</p>
                </div>

                <div className="flex justify-end gap-3 mt-2">
                  <button
                    onClick={() => {
                      setSelectedProductForUnits(product);
                      setShowUnitsModal(true);
                    }}
                    className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <Package className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => startEditingProduct(product)}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Vista Desktop (Tabla) */}
        <table className="w-full hidden md:table">
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
            {filteredProducts.map(product => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  {/* Show sizes badge if available */}
                  <div className="flex flex-col">
                    {editingProduct?.id === product.id ? (
                      <div>
                        {/* Edit mode inputs */}
                        <input
                          type="text"
                          value={editingProduct.name}
                          onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                        <input
                          type="text"
                          value={editingProduct.barcode || ''}
                          onChange={e => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-xs mt-1"
                          placeholder="Código de Barras"
                        />

                        {/* Image edit controls... */}
                        <div className="mt-2 flex items-center gap-3">
                          {(editingImagePreviewUrl || product.image_url) && (
                            <div className="relative">
                              <img
                                src={editingImagePreviewUrl || product.image_url || ''}
                                alt={t('Vista previa')}
                                className="h-16 w-16 object-cover rounded border"
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
                                    product.image_url || ''
                                  );

                                  // 3. Resultado
                                  if (newUrl) {
                                    // Actualizar en la lista local para reflejo inmediato
                                    const updatedProducts = products.map(p =>
                                      p.id === product.id ? { ...p, image_url: newUrl } : p
                                    );
                                    setProducts(updatedProducts);

                                    // Actualizar en DB silenciosamente
                                    await supabase.from('products').update({ image_url: newUrl }).eq('id', product.id);
                                  } else {
                                    if (img.parentElement) {
                                      img.parentElement.innerHTML = '';
                                      const fallback = document.createElement('div');
                                      fallback.className = "h-16 w-16 flex items-center justify-center bg-gray-100 text-gray-400 rounded border text-xs text-center p-1";
                                      fallback.innerText = "Sin Imagen";
                                      img.parentElement.appendChild(fallback);
                                    }
                                  }
                                }}
                              />
                              {uploadingImage && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center">
                                  <LoadingSpinner size="sm" light />
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
                                <LoadingSpinner size="sm" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.description}</div>
                        {getProductSizes(product.id).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {getProductSizes(product.id).map(s => (
                              <span key={s.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {s.size_name} ({s.stock})
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
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
                      <option value="hombre">{t('gender.hombre')}</option>
                      <option value="mujer">{t('gender.mujer')}</option>
                      <option value="unisex">{t('gender.unisex')}</option>
                      <option value="niño">{t('gender.niño')}</option>
                      <option value="niña">{t('gender.niña')}</option>
                    </select>
                  ) : (
                    product.gender ? t(`gender.${product.gender}`) : '-'
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
                    <span className={`font-medium ${(getProductSizes(product.id).length > 0
                      ? getProductSizes(product.id).reduce((sum, s) => sum + s.stock, 0)
                      : (product.stock || 0)) < 5 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                      {getProductSizes(product.id).length > 0
                        ? getProductSizes(product.id).reduce((sum, s) => sum + s.stock, 0)
                        : (product.stock || 0)
                      }
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${product.available && (product.stock || 0) > 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                    }`}>
                    {product.available && (product.stock || 0) > 0 ? t('Disponible') : t('No disponible')}
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
                          <LoadingSpinner size="sm" />
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
                        onClick={() => {
                          setSelectedProductForUnits(product);
                          setShowUnitsModal(true);
                        }}
                        className="text-purple-600 hover:text-purple-800"
                        title={t('Gestionar unidades individuales')}
                      >
                        <Package className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => startEditingProduct(product)}
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

      {/* Modal for Individual Units Management */}
      {showUnitsModal && selectedProductForUnits && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('Unidades Individuales')}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedProductForUnits.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUnitsModal(false);
                  setSelectedProductForUnits(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <IndividualUnitsManager
                productId={selectedProductForUnits.id}
                productName={selectedProductForUnits.name}
                totalStock={selectedProductForUnits.stock || 0}
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowUnitsModal(false);
                  setSelectedProductForUnits(null);
                  fetchProducts(); // Refresh products list
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {t('Cerrar')}
              </button>
            </div>
          </div>
        </div>
      )}
      {showNotFoundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl transform transition-all scale-100">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg leading-6 font-bold text-gray-900 mb-2">
                Produit non trouvé
              </h3>
              <p className="text-sm text-gray-500">
                Nous n&apos;avons trouvé aucune information pour ce code. Voulez-vous identifier le produit avec une photo ?
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowNotFoundModal(false);
                  cameraInputRef.current?.click();
                }}
                className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
              >
                <svg className="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Prendre une photo
              </button>

              <button
                onClick={() => {
                  setShowNotFoundModal(false);
                  analyzeImageInputRef.current?.click();
                }}
                className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm"
              >
                <svg className="mr-2 -ml-1 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Charger une photo
              </button>

              <button
                onClick={() => setShowNotFoundModal(false)}
                className="w-full mt-2 flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        type="file"
        ref={analyzeImageInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageAnalyze}
      />
      <input
        type="file"
        ref={cameraInputRef}
        className="hidden"
        accept="image/*"
        capture="environment" // Fuerza cámara trasera
        onChange={handleImageAnalyze}
      />
    </div>
  );
}
