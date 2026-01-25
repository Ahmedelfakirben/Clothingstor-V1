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
    const isHandlingClose = useRef(false);

    useEffect(() => {
        let isMounted = true;
        const elementId = "reader";

        const startScanner = async () => {
            try {
                // Pequeña pausa para asegurar que el DOM esté listo
                await new Promise(resolve => setTimeout(resolve, 100));

                if (!document.getElementById(elementId)) {
                    console.warn("Scanner element not found");
                    return;
                }

                setLoading(true);
                const devices = await Html5Qrcode.getCameras().catch(err => {
                    console.warn("Error getting cameras:", err);
                    return [];
                });

                if (isMounted) {
                    // Instanciamos siempre, incluso si no hay cámaras detectadas por getCameras (a veces falla pero start funciona)
                    // Usamos verbose false para menos ruido
                    const scanner = new Html5Qrcode(elementId, { verbose: false });
                    scannerRef.current = scanner;

                    await scanner.start(
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0,
                            disableFlip: false // A veces ayuda con la orientación
                        },
                        (decodedText, decodedResult) => {
                            if (isMounted && !isHandlingClose.current) {
                                isHandlingClose.current = true;
                                // Detener y luego notificar éxito
                                scanner.stop()
                                    .then(() => {
                                        scanner.clear();
                                        onScanSuccess(decodedText, decodedResult);
                                    })
                                    .catch(err => {
                                        console.error("Error al detener tras escaneo:", err);
                                        // Aún así intentamos notificar éxito
                                        onScanSuccess(decodedText, decodedResult);
                                    });
                            }
                        },
                        () => { } // Ignorar errores de frame vacío
                    );
                }
            } catch (err: any) {
                console.error("Error general iniciando scanner:", err);
                if (isMounted) {
                    // No mostramos error bloqueante inmediato para no asustar, solo log
                    setError(t('No se pudo acceder a la cámara. Verifique permisos.'));
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        startScanner();

        return () => {
            isMounted = false;
            // Limpieza robusta al desmontar
            if (scannerRef.current) {
                const scanner = scannerRef.current;
                try {
                    if (scanner.isScanning) {
                        scanner.stop()
                            .then(() => scanner.clear())
                            .catch(e => console.warn("Error in cleanup stop:", e));
                    } else {
                        scanner.clear();
                    }
                } catch (e) {
                    console.warn("Error in cleanup catch:", e);
                }
            }
        };
    }, []);

    const handleClose = async () => {
        if (isHandlingClose.current) return;
        isHandlingClose.current = true;

        // Intentar detener limpiamente antes de llamar a onClose (que desmontará el componente)
        if (scannerRef.current && scannerRef.current.isScanning) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (e) {
                console.warn("Error manual stop:", e);
            }
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-xl overflow-hidden shadow-2xl relative">
                <button
                    onClick={handleClose}
                    className="absolute top-2 right-2 z-10 bg-white/80 hover:bg-white rounded-full p-2 transition-colors shadow-sm"
                    disabled={loading} // Evitar cerrar mientras inicia para prevenir condiciones de carrera
                >
                    <X className="w-6 h-6 text-gray-700" />
                </button>

                <div className="p-4 bg-gray-50 border-b">
                    <h3 className="text-lg font-semibold text-center text-gray-800">{t('Escáner de Cámara')}</h3>
                    <p className="text-xs text-center text-gray-500 mt-1">{t('Apunta la cámara al código de barras o QR')}</p>
                </div>

                <div className="relative bg-black aspect-square max-h-[400px]">
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
