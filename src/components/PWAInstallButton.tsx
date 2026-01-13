import { useState, useEffect } from 'react';
import { Download, MonitorCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallButton() {
    const { t } = useLanguage();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Escuchar el evento de instalación
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Chequear si ya está instalada
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsInstalled(true);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('Usuario aceptó la instalación');
            setDeferredPrompt(null);
        }
    };

    if (isInstalled) {
        return (
            <div className="mt-6 flex justify-center animate-fadeIn">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700 text-sm font-bold border border-green-200 shadow-sm cursor-default">
                    <MonitorCheck className="w-4 h-4" />
                    {t('install.installed')}
                </span>
            </div>
        );
    }

    // Fallback visual si el navegador no dispara el evento automticamente (común en primera carga o si ya se cerró)
    // Muestra instrucciones de cómo instalar manualmente
    if (!deferredPrompt) {
        return (
            <div className="mt-8 flex justify-center animate-fadeIn opacity-80 hover:opacity-100 transition-opacity">
                <div className="text-center p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                    <p className="text-xs text-gray-500 font-medium mb-2">{t('install.title')}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Download className="w-3 h-3" />
                        <span>{t('install.instruction')}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-8 flex justify-center animate-fadeIn">
            <button
                onClick={handleInstallClick}
                className="group relative inline-flex items-center justify-center gap-3 px-6 py-3 rounded-2xl bg-white border-2 border-amber-200 shadow-md hover:shadow-xl hover:border-amber-400 transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0"
            >
                <div className="p-2 bg-gradient-to-br from-amber-400 to-pink-500 rounded-xl text-white shadow-sm group-hover:scale-110 transition-transform">
                    <Download className="w-5 h-5" />
                </div>
                <div className="text-left">
                    <p className="text-xs text-gray-500 font-medium">{t('install.available_pc')}</p>
                    <p className="text-sm font-extrabold text-gray-800 group-hover:text-amber-600 transition-colors">
                        {t('install.button')}
                    </p>
                </div>
            </button>
        </div>
    );
}
