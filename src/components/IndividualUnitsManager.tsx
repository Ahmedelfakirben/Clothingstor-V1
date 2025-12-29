import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import { Trash2, Plus, Check, X } from 'lucide-react';

interface ProductUnit {
    id: string;
    individual_barcode: string;
    status: 'available' | 'sold' | 'reserved';
    sold_at: string | null;
    created_at: string;
}

interface IndividualUnitsManagerProps {
    productId: string;
    productName: string; // Keep in interface for future use
    totalStock: number;
}

export default function IndividualUnitsManager({ productId, totalStock }: IndividualUnitsManagerProps) {
    const { t } = useLanguage();
    const [units, setUnits] = useState<ProductUnit[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [newBarcode, setNewBarcode] = useState('');

    useEffect(() => {
        fetchUnits();
    }, [productId]);

    const fetchUnits = async () => {
        try {
            const { data, error } = await supabase
                .from('product_units')
                .select('*')
                .eq('product_id', productId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUnits(data || []);
        } catch (error: any) {
            console.error('Error fetching units:', error);
            toast.error(t('Error al cargar unidades'));
        } finally {
            setLoading(false);
        }
    };

    const handleAddUnit = async () => {
        if (!newBarcode.trim()) {
            toast.error(t('Ingresa un código de barras'));
            return;
        }

        // Check if barcode already exists
        const exists = units.some(u => u.individual_barcode === newBarcode.trim());
        if (exists) {
            toast.error(t('Este código ya está registrado'));
            return;
        }

        setAdding(true);
        try {
            const { data, error } = await supabase
                .from('product_units')
                .insert({
                    product_id: productId,
                    individual_barcode: newBarcode.trim(),
                    status: 'available'
                })
                .select()
                .single();

            if (error) throw error;

            setUnits([data, ...units]);
            setNewBarcode('');
            toast.success(t('Código agregado correctamente'));
        } catch (error: any) {
            console.error('Error adding unit:', error);
            if (error.code === '23505') {
                toast.error(t('Este código ya existe en otro producto'));
            } else {
                toast.error(t('Error al agregar código'));
            }
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteUnit = async (unitId: string, barcode: string) => {
        if (!confirm(t(`¿Eliminar código ${barcode}?`))) return;

        try {
            const { error } = await supabase
                .from('product_units')
                .delete()
                .eq('id', unitId);

            if (error) throw error;

            setUnits(units.filter(u => u.id !== unitId));
            toast.success(t('Código eliminado'));
        } catch (error: any) {
            console.error('Error deleting unit:', error);
            toast.error(t('Error al eliminar código'));
        }
    };

    const availableUnits = units.filter(u => u.status === 'available').length;
    const soldUnits = units.filter(u => u.status === 'sold').length;

    if (loading) {
        return (
            <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">{t('Stock Total')}</div>
                    <div className="text-2xl font-bold text-blue-600">{totalStock}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">{t('Disponibles')}</div>
                    <div className="text-2xl font-bold text-green-600">{availableUnits}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">{t('Vendidas')}</div>
                    <div className="text-2xl font-bold text-gray-600">{soldUnits}</div>
                </div>
            </div>

            {/* Add new unit */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium mb-3">{t('Agregar Código Individual')}</h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newBarcode}
                        onChange={(e) => setNewBarcode(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddUnit()}
                        placeholder={t('Escanea o escribe el código...')}
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        disabled={adding}
                    />
                    <button
                        onClick={handleAddUnit}
                        disabled={adding || !newBarcode.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        {adding ? t('Agregando...') : t('Agregar')}
                    </button>
                </div>
            </div>

            {/* Units list */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-medium">{t('Unidades Registradas')} ({units.length})</h4>
                </div>

                {units.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        {t('No hay unidades registradas')}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                        {units.map((unit) => (
                            <div key={unit.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    {unit.status === 'available' ? (
                                        <Check className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <X className="w-5 h-5 text-gray-400" />
                                    )}
                                    <div>
                                        <div className="font-mono font-medium">{unit.individual_barcode}</div>
                                        <div className="text-sm text-gray-500">
                                            {unit.status === 'available' ? (
                                                <span className="text-green-600">{t('Disponible')}</span>
                                            ) : (
                                                <span className="text-gray-500">
                                                    {t('Vendido')} - {new Date(unit.sold_at!).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {unit.status === 'available' && (
                                    <button
                                        onClick={() => handleDeleteUnit(unit.id, unit.individual_barcode)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        title={t('Eliminar')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
