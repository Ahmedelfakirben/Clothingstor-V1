
import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';

export function InstallPWA({ variant = 'button' }: { variant?: 'button' | 'menu-item' }) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if running in standalone mode (already installed)
        const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone
            || document.referrer.includes('android-app://');

        setIsStandalone(isRunningStandalone);

        // Check if device is iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(iOS);

        // Listen for install prompt logic for Android/Desktop
        const handleBeforeInstallPrompt = (e: Event) => {
            console.log('UsePWA: beforeinstallprompt triggered');
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        console.log('UsePWA: Event listener added. isStandalone:', isStandalone, 'isIOS:', iOS);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again, discard it
        setDeferredPrompt(null);
    };

    if (isStandalone) {
        return null; // Don't show anything if already installed
    }

    // Handle iOS instructions
    if (isIOS) {
        if (variant === 'menu-item') {
            return (
                <div className="flex items-center gap-3 w-full px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium cursor-help" title="Para instalar en iOS: Presiona Compartir y luego 'Agregar a Inicio'">
                    <Share className="w-4 h-4" />
                    <span>Instalar App (iOS)</span>
                </div>
            );
        }
        return (
            <div className="hidden md:flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-help" title="Para instalar en iOS: Presiona Compartir y luego 'Agregar a Inicio'">
                <Share className="w-4 h-4" />
                <span>Instalar App</span>
            </div>
        );
    }

    // Handle Android/Desktop button
    if (!deferredPrompt) {
        return null;
    }

    if (variant === 'menu-item') {
        return (
            <button
                onClick={handleInstallClick}
                className="flex items-center gap-3 w-full px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium text-left"
            >
                <Download className="w-4 h-4 text-pink-500" />
                <span>Instalar App</span>
            </button>
        );
    }

    return (
        <button
            onClick={handleInstallClick}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all transform hover:scale-105"
        >
            <Download className="w-4 h-4" />
            <span>Instalar App</span>
        </button>
    );
}
