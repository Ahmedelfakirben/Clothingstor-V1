import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Shirt, Eye, EyeOff } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

export function LoginForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Basic input validation
    if (!email.trim()) {
      setError(t('El correo electrónico es obligatorio.'));
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError(t('La contraseña es obligatoria.'));
      setLoading(false);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('Por favor ingresa un correo electrónico válido.'));
      setLoading(false);
      return;
    }

    // Password strength check (minimum 6 characters)
    if (password.length < 6) {
      setError(t('La contraseña debe tener al menos 6 caracteres.'));
      setLoading(false);
      return;
    }

    try {
      await signIn(email, password);
    } catch (err: any) {
      let message = t('Credenciales inválidas. Por favor intenta de nuevo.');

      // Handle specific Supabase errors
      if (err?.message?.includes('Invalid login credentials')) {
        message = t('Correo electrónico o contraseña incorrectos.');
      } else if (err?.message?.includes('Email not confirmed')) {
        message = t('Por favor confirma tu correo electrónico antes de iniciar sesión.');
      } else if (err?.message?.includes('Too many requests')) {
        message = t('Demasiados intentos. Por favor espera unos minutos.');
      } else if (err?.message) {
        message = err.message;
      }

      setError(message);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Circles - Ultra Subtle */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-pink-50/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 right-20 w-[500px] h-[500px] bg-purple-50/8 rounded-full blur-3xl animate-float" style={{animationDelay: '1.5s'}}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gray-50/15 rounded-full blur-3xl"></div>

      <div className="glass rounded-3xl shadow-elegant w-full max-w-md p-10 relative z-10 animate-fadeIn border-2 border-white/40">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 gradient-primary rounded-3xl mb-6 shadow-elegant transform hover:scale-105 transition-all duration-300 hover:shadow-elegant-hover animate-float">
            <Shirt className="w-12 h-12 text-white drop-shadow-lg" />
          </div>
          <h1 className="text-5xl font-black text-gradient-vibrant mb-3 tracking-tight">
            LIN-Fashion
          </h1>
          <p className="text-gray-600 font-semibold text-lg">{t('Sistema de Gestión')}</p>
          <div className="mt-3 h-1 w-24 mx-auto gradient-primary rounded-full"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium shadow-sm animate-shake">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              {t('Correo Electrónico')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3.5 border-2 border-gray-200 rounded-2xl focus:border-pink-400 focus:ring-4 focus:ring-pink-100 transition-all duration-200 outline-none bg-white shadow-sm hover:shadow-md hover:border-gray-300"
              placeholder={t('empleado@cafeteria.com')}
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              {t('Contraseña')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 pr-14 border-2 border-gray-200 rounded-2xl focus:border-pink-400 focus:ring-4 focus:ring-pink-100 transition-all duration-200 outline-none bg-white shadow-sm hover:shadow-md hover:border-gray-300"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                minLength={6}
                maxLength={128}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pink-500 transition-colors p-2 rounded-xl hover:bg-pink-50"
                aria-label={showPassword ? t("Ocultar contraseña") : t("Mostrar contraseña")}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary hover:gradient-primary-hover text-white font-bold py-4 px-6 rounded-2xl shadow-elegant hover:shadow-elegant-hover transform hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:ring-4 focus:ring-pink-200 relative overflow-hidden group"
          >
            <span className="relative z-10">
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <LoadingSpinner size="sm" light />
                  {t('Iniciando sesión...')}
                </span>
              ) : (
                t('Iniciar Sesión')
              )}
            </span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </button>
        </form>

      </div>
    </div>
  );
}
