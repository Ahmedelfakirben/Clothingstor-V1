import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import { Trash2, Plus, ScanBarcode, Save, X } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';

interface ProductSize {
    id: string;
    product_id: string;
    size_name: string;
    stock: number;
    barcode?: string;
    price_modifier: number;
}

interface IndividualUnitsManagerProps {
    productId: string;
    productName: string;
    totalStock?: number; // Kept for interface compatibility but recalculated locally
    onClose?: () => void; // Optional close callback
}

export default function IndividualUnitsManager({ productId, productName }: IndividualUnitsManagerProps) {
    const { t } = useLanguage();
    const [sizes, setSizes] = useState<ProductSize[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // New Size State
    const [newSizeName, setNewSizeName] = useState('');
    const [newSizeStock, setNewSizeStock] = useState('0');
    const [newSizeBarcode, setNewSizeBarcode] = useState('');

    // Scanner State
    const [showScanner, setShowScanner] = useState(false);
    const [scanTargetField, setScanTargetField] = useState<'new' | string>('new'); // 'new' or sizeId

    useEffect(() => {
        fetchSizes();
    }, [productId]);

    const fetchSizes = async () => {
        try {
            const { data, error } = await supabase
                .from('product_sizes')
                .select('*')
                .eq('product_id', productId)
                .order('size_name'); // Or custom order if available

            if (error) throw error;
            setSizes(data || []);
        } catch (error: any) {
            console.error('Error fetching sizes:', error);
            toast.error(t('Error al cargar tallas'));
        } finally {
            setLoading(false);
        }
    };

    const handleAddSize = async () => {
        if (!newSizeName.trim()) {
            toast.error(t('Nombre de talla obligatorio'));
            return;
        }

        const stockVal = parseInt(newSizeStock);
        if (isNaN(stockVal) || stockVal < 0) {
            toast.error(t('Stock inválido'));
            return;
        }

        setProcessing(true);
        try {
            // Check duplications locally for name
            if (sizes.some(s => s.size_name.toLowerCase() === newSizeName.trim().toLowerCase())) {
                toast.error(t('Ya existe una talla con ese nombre'));
                setProcessing(false);
                return;
            }

            const { data, error } = await supabase
                .from('product_sizes')
                .insert({
                    product_id: productId,
                    size_name: newSizeName.trim(),
                    stock: stockVal,
                    barcode: newSizeBarcode.trim() || null,
                    price_modifier: 0
                })
                .select()
                .single();

            if (error) throw error;

            setSizes([...sizes, data]);
            // Reset form
            setNewSizeName('');
            setNewSizeStock('0');
            setNewSizeBarcode('');
            toast.success(t('Talla agregada'));
        } catch (error: any) {
            console.error('Error adding size:', error);
            toast.error(t('Error al agregar talla'));
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteSize = async (sizeId: string) => {
        if (!confirm(t('¿Estás seguro de eliminar esta talla?'))) return;

        try {
            const { error } = await supabase
                .from('product_sizes')
                .delete()
                .eq('id', sizeId);

            if (error) throw error;

            setSizes(sizes.filter(s => s.id !== sizeId));
            toast.success(t('Talla eliminada'));
        } catch (error) {
            console.error('Error deleting size:', error);
            toast.error(t('Error al eliminar talla'));
        }
    };

    const handleUpdateSize = async (sizeId: string, updates: Partial<ProductSize>) => {
        try {
            const { error } = await supabase
                .from('product_sizes')
                .update(updates)
                .eq('id', sizeId);

            if (error) throw error;

            setSizes(sizes.map(s => s.id === sizeId ? { ...s, ...updates } : s));
            toast.success(t('Actualizado'));
        } catch (err) {
            console.error('Error updating size:', err);
            toast.error(t('Error al actualizar'));
            fetchSizes(); // Revert on error
        }
    };

    const handleScanSuccess = (code: string) => {
        setShowScanner(false);
        if (scanTargetField === 'new') {
            setNewSizeBarcode(code);
        } else {
            // Update existing size
            handleUpdateSize(scanTargetField, { barcode: code });
        }
        toast.success(t('Código escaneado: ') + code);
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-xl mb-4">
                <h3 className="font-bold text-blue-900">{productName}</h3>
                <p className="text-sm text-blue-700">{t('Gestión Rápida de Stock y Códigos')}</p>
            </div>

            {/* Add New Size Form */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <h4 className="font-semibold mb-3 text-gray-800">{t('Agregar Nueva Talla')}</h4>
                <div className="flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('Nombre (ej: XL)')}</label>
                        <input
                            type="text"
                            value={newSizeName}
                            onChange={e => setNewSizeName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="XL"
                        />
                    </div>
                    <div className="w-24">
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('Stock')}</label>
                        <input
                            type="number"
                            value={newSizeStock}
                            onChange={e => setNewSizeStock(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            min="0"
                        />
                    </div>
                    <div className="flex-1 w-full relative">
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('Código de Barras')}</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newSizeBarcode}
                                onChange={e => setNewSizeBarcode(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                placeholder={t('Opcional')}
                            />
                            <button
                                onClick={() => {
                                    setScanTargetField('new');
                                    setShowScanner(true);
                                }}
                                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600"
                                title={t('Escanear')}
                            >
                                <ScanBarcode className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={handleAddSize}
                        disabled={processing || !newSizeName}
                        className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-[42px]"
                    >
                        <Plus className="w-4 h-4" />
                        {t('Agregar')}
                    </button>
                </div>
            </div>

            {/* Sizes List */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                    <h4 className="font-semibold text-gray-700">{t('Tallas Existentes')}</h4>
                    <span className="text-sm bg-gray-200 px-2 py-1 rounded-full text-gray-600">{sizes.length}</span>
                </div>

                {sizes.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 italic">{t('No hay tallas registradas para este producto')}</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {sizes.map(size => (
                            <div key={size.id} className="p-4 flex flex-col md:flex-row items-center gap-4 hover:bg-gray-50 transition-colors">
                                {/* Name */}
                                <div className="w-20 font-bold text-center md:text-left bg-gray-100 rounded px-2 py-1">
                                    {size.size_name}
                                </div>

                                {/* Stock Control */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 uppercase font-bold">{t('Stock')}:</span>
                                    <input
                                        type="number"
                                        defaultValue={size.stock}
                                        onBlur={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val) && val !== size.stock) {
                                                handleUpdateSize(size.id, { stock: val });
                                            }
                                        }}
                                        className="w-20 px-2 py-1 border rounded text-center font-mono"
                                    />
                                </div>

                                {/* Barcode Control */}
                                <div className="flex-1 w-full flex items-center gap-2">
                                    <span className="text-xs text-gray-500 uppercase font-bold whitespace-nowrap">{t('Código')}:</span>
                                    <div className="flex-1 flex gap-1 items-center">
                                        <input
                                            type="text"
                                            defaultValue={size.barcode || ''}
                                            onBlur={(e) => {
                                                const val = e.target.value.trim() || null;
                                                if (val !== size.barcode) {
                                                    handleUpdateSize(size.id, { barcode: val as string }); // cast to fix strict type if needed
                                                }
                                            }}
                                            placeholder={t('Sin código')}
                                            className="w-full px-2 py-1 border rounded font-mono text-sm text-gray-600 focus:text-black"
                                        />
                                        <button
                                            onClick={() => {
                                                setScanTargetField(size.id);
                                                setShowScanner(true);
                                            }}
                                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            title={t('Escanear')}
                                        >
                                            <ScanBarcode className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Delete */}
                                <button
                                    onClick={() => handleDeleteSize(size.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title={t('Eliminar')}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showScanner && (
                <BarcodeScanner
                    onScanSuccess={handleScanSuccess}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    );
}
