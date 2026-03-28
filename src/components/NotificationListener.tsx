import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Bell, X } from 'lucide-react';

export function NotificationListener() {
    const { profile } = useAuth();
    const { t } = useLanguage();
    const { formatCurrency } = useCurrency();
    const audioContextRef = useRef<AudioContext | null>(null);
    const [statusColor, setStatusColor] = useState('bg-gray-400'); // Gris por defecto
    const originalTitle = useRef(document.title);
    const blinkInterval = useRef<number | null>(null);

    // Solicitar permisos para notificaciones nativas del sistema
    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    // Función para parpadear el título
    const startTitleBlinking = (text: string) => {
        if (blinkInterval.current) clearInterval(blinkInterval.current);

        let showMessage = true;
        originalTitle.current = document.title;

        blinkInterval.current = window.setInterval(() => {
            document.title = showMessage ? text : originalTitle.current;
            showMessage = !showMessage;
        }, 1000);

        // Detener parpadeo cuando la ventana gana foco
        const stopBlinking = () => {
            if (blinkInterval.current) {
                clearInterval(blinkInterval.current);
                blinkInterval.current = null;
                document.title = originalTitle.current; // Restaurar título original
            }
            window.removeEventListener('focus', stopBlinking);
            window.removeEventListener('click', stopBlinking);
        };

        window.addEventListener('focus', stopBlinking);
        window.addEventListener('click', stopBlinking);
    };

    // Función para enviar notificación nativa (Windows/Android System Notification)
    const sendSystemNotification = async (amount: string) => {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const title = "¡Nueva Venta Realizada!";
        const options: NotificationOptions = {
            body: `Monto: ${amount}\nHaga clic para ver detalles.`,
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            tag: `sale-${Date.now()}`,
            requireInteraction: true,
            renotify: true,
            vibrate: [200, 100, 200, 100, 400],
        } as any;

        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                if (registration) {
                    await registration.showNotification(title, options);
                    return;
                }
            }

            const notification = new Notification(title, options);
            notification.onclick = function () {
                window.focus();
                this.close();
            };
        } catch (e) {
            console.error("Error mostrando notificación de sistema:", e);
        }
    };

    // Función para reproducir sonido usando Web Audio API
    const playNotificationSound = () => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            const ctx = audioContextRef.current;

            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            // Crear oscilador para sonido "Elegante y Suave" (Ding!)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine'; // Senoidal, la más suave y limpia

            const now = ctx.currentTime;

            // Arpegio Rápido Ascendente (C5 -> E5 -> G5)
            // Simula una campanilla de "éxito"
            osc.frequency.setValueAtTime(523.25, now);       // Do
            osc.frequency.setValueAtTime(659.25, now + 0.1); // Mi
            osc.frequency.setValueAtTime(783.99, now + 0.2); // Sol

            // Envolvente de volumen (Fade in muy rápido y Fade out largo)
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

            osc.start(now);
            osc.stop(now + 1.2);

        } catch (error) {
            console.error('Error playing sound:', error);
        }
    };

    const triggerVibration = () => {
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 400]);
        }
    };

    useEffect(() => {
        console.log('🔄 NotificationListener: Montado');
        setStatusColor('bg-yellow-400'); // Amarillo: Cargando

        // Solo activar para admins o super_admins
        if (!profile) return;

        if (profile.role !== 'admin' && profile.role !== 'super_admin') {
            console.log('🔕 NotificationListener: Usuario no es admin, desactivado.');
            setStatusColor('bg-red-200'); // Rojo claro: No autorizado
            return;
        }

        console.log('🔔 NotificationListener: Inicializando para:', profile.role);

        const channel = supabase
            .channel('admin-sales-notifications')
            .on(
                'postgres_changes',
                {
                    event: '*', // Escuchar TODOS los eventos (INSERT, UPDATE, etc) para debug
                    schema: 'public',
                    table: 'orders',
                    // filter: 'status=eq.completed' // ELIMINADO TEMPORALMENTE PARA DEBUG
                },
                async (payload) => {
                    console.log('🔔 ¡EVENTO REALTIME RECIBIDO (SIN FILTRO)!', payload);

                    // Filtrar manualmente aquí por ahora
                    if (payload.eventType === 'INSERT' && (payload.new as any).status === 'completed') {
                        const newOrder = payload.new as any;

                        // IGNORE OWN SALES (Already notified via local event)
                        if (profile && newOrder.employee_id === profile.id) {
                            console.log('👤 Venta propia detectada en Realtime, ignorando notificación duplicada.');
                            return;
                        }

                        const amount = formatCurrency(newOrder.total);

                        // 1. Sonido
                        playNotificationSound();

                        // 2. Vibración
                        triggerVibration();

                        // 3. Notificación nativa (Windows/Android)
                        sendSystemNotification(amount);

                        // 4. Parpadeo de título
                        startTitleBlinking(`💰 Venta: ${amount}`);

                        // 5. Toast
                        toast.custom((t) => (
                            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 border-green-500`} onClick={() => window.focus()}>
                                <div className="flex-1 w-0 p-4">
                                    <div className="flex items-start">
                                        <div className="flex-shrink-0 pt-0.5">
                                            <Bell className="h-6 w-6 text-green-600 animate-bounce" />
                                        </div>
                                        <div className="ml-3 flex-1">
                                            <p className="text-sm font-bold text-gray-900">¡Nueva Venta Realizada!</p>
                                            <p className="mt-1 text-sm text-gray-500">
                                                Monto: <span className="font-bold text-green-600">{amount}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex border-l border-gray-200">
                                    <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-400 hover:text-gray-500 focus:outline-none">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ), { duration: 8000, position: 'top-right' });
                    }
                    else {
                        console.log('ℹ️ Evento recibido pero ignorado por estado/tipo:', payload.eventType, (payload.new as any)?.status);
                    }
                }
            )
            .subscribe((status) => {
                console.log(`📡 Estado suscripción Ventas: ${status}`);
                if (status === 'SUBSCRIBED') {
                    setStatusColor('bg-green-500'); // Verde: Conectado
                    // toast.success('🔔 Monitor de ventas activo', { duration: 2000, position: 'bottom-left', style: { fontSize: '12px' } });
                    if (Notification.permission !== 'granted') {
                        Notification.requestPermission();
                    }
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Error Canal Realtime');
                    setStatusColor('bg-red-600 animate-pulse'); // Rojo parpadeante: Error
                    toast.error('Error conexión notificaciones', { position: 'bottom-left' });
                }
            });

        return () => {
            supabase.removeChannel(channel);
            if (blinkInterval.current) clearInterval(blinkInterval.current);
        };
    }, [profile, t]);

    // Escuchar evento local (para feedback inmediato en el mismo dispositivo)
    useEffect(() => {
        const handleLocalSale = (e: any) => {
            // Verificar rol explícitamente para el evento local también
            if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
                console.log('🔕 Evento local ignorado: Usuario no autorizado');
                return;
            }

            console.log('🔔 Evento local de venta recibido');
            const amount = e.detail?.amount || '0.00';

            playNotificationSound();
            triggerVibration();
            sendSystemNotification(amount);
            startTitleBlinking(`💰 Venta: ${amount}`);

            toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 border-green-500`} onClick={() => window.focus()}>
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <Bell className="h-6 w-6 text-green-600 animate-bounce" />
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-bold text-gray-900">¡Nueva Venta Realizada!</p>
                                <p className="mt-1 text-sm text-gray-500">
                                    Monto: <span className="font-bold text-green-600">{amount}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex border-l border-gray-200">
                        <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-400 hover:text-gray-500 focus:outline-none">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ), { duration: 8000, position: 'top-right' });
        };

        window.addEventListener('dispatch-sale-notification', handleLocalSale);
        return () => window.removeEventListener('dispatch-sale-notification', handleLocalSale);
    }, [profile]);

    // Desbloquear audio
    useEffect(() => {
        const unlockAudio = () => {
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
        };
        window.addEventListener('click', unlockAudio);
        return () => window.removeEventListener('click', unlockAudio);
    }, []);

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) return null;

    // Indicador visual solo para admins (sin botón)
    return (
        <div
            className={`fixed bottom-2 left-2 w-3 h-3 rounded-full ${statusColor} z-[9999] shadow-sm transition-all duration-500 border border-white`}
            title={`Estado Notificaciones: ${statusColor.includes('green') ? 'Activo' : 'Conectando/Error'}`}
        />
    );
}
