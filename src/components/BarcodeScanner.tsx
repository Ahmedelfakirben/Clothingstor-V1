import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string, decodedResult: any) => void;
    onClose: () => void;
}

export const BarcodeScanner = ({ onScanSuccess, onClose }: BarcodeScannerProps) => {
    const { t } = useLanguage();
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const startScanner = async () => {
            try {
                setLoading(true);
                // Obtener cámaras disponibles
                const devices = await Html5Qrcode.getCameras();

                if (devices && devices.length) {
                    // const cameraId = devices[0].id;

                    const scanner = new Html5Qrcode("reader");
                    scannerRef.current = scanner;

                    await scanner.start(
                        // Intentar usar cámara trasera ('environment') si es posible, si no la primera disponible
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0
                        },
                        (decodedText, decodedResult) => {
                            // Éxito
                            if (isMounted) {
                                // Detener scanner antes de llamar al callback para evitar múltiples lecturas
                                scanner.stop().then(() => {
                                    scanner.clear();
                                    onScanSuccess(decodedText, decodedResult);
                                }).catch(err => console.error("Error stopping scanner", err));
                            }
                        },
                        () => {
                            // Error de lectura (frame vacío), ignorar
                        }
                    );
                } else {
                    setError(t("No se detectaron cámaras."));
                }
            } catch (err: any) {
                console.error("Error starting scanner:", err);
                if (isMounted) setError(`${t('Error al iniciar cámara:')} ${err?.message || t('Permisos denegados o error desconocido')}`);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        startScanner();

        return () => {
            isMounted = false;
            if (scannerRef.current) {
                if (scannerRef.current.isScanning) {
                    // Detener asíncronamente y luego limpiar
                    scannerRef.current.stop()
                        .then(() => {
                            // Verifica si scannerRef.current aún existe antes de limpiar
                            scannerRef.current?.clear();
                        })
                        .catch(err => {
                            console.error("Error stopping scanner during cleanup:", err);
                        });
                } else {
                    try {
                        scannerRef.current.clear();
                    } catch (e) {
                        console.error("Error clearing scanner:", e);
                    }
                }
            }
        };
    }, []); // onScanSuccess y onClose no deben ser dependencias para evitar reinicios

    return (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-xl overflow-hidden shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 z-10 bg-white/80 hover:bg-white rounded-full p-2 transition-colors shadow-sm"
                >
                    <X className="w-6 h-6 text-gray-700" />
                </button>

                <div className="p-4 bg-gray-50 border-b">
                    <h3 className="text-lg font-semibold text-center text-gray-800">{t('Escáner de Cámara')}</h3>
                    <p className="text-xs text-center text-gray-500 mt-1">{t('Apunta la cámara al código de barras o QR')}</p>
                </div>

                <div className="relative bg-black aspect-square max-h-[400px]">
                    {/* Contenedor específico para html5-qrcode. 
                       Estilos inline para asegurar que el video ocupe todo el espacio correctamente 
                   */}
                    <style>{`
                    #reader video {
                      object-fit: cover !important;
                      width: 100% !important;
                      height: 100% !important;
                      border-radius: 0 0 0.75rem 0.75rem; 
                    }
                  `}</style>
                    <div id="reader" className="w-full h-full"></div>

                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/50 z-20">
                            <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                            <span className="text-sm">{t('Iniciando cámara...')}</span>
                            <span className="text-xs text-gray-300 mt-1">{t('(Permite el acceso si se solicita)')}</span>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="p-4 bg-red-50 text-red-600 text-sm text-center border-t border-red-100">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <div className="p-2 bg-gray-100 text-center text-xs text-gray-500">
                        {t('Cámara activa. Escaneando...')}
                    </div>
                )}
            </div>
        </div>
    );
};
