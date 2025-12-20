import { Settings, Globe, Palette, Check, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { useCurrency, Currency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';

export function AppSettings() {
  const { currentLanguage, setLanguage, t } = useLanguage();
  const { currentTheme, setTheme } = useTheme();
  const { currentCurrency, setCurrency, availableCurrencies } = useCurrency();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const handleLanguageChange = async (newLanguage: 'es' | 'fr') => {
    try {
      await setLanguage(newLanguage);
      toast.success(t('messages.language-changed'));
    } catch (error) {
      console.error('Error changing language:', error);
      toast.error(t('common.error'));
    }
  };

  const handleThemeChange = async (newTheme: Theme) => {
    try {
      await setTheme(newTheme);
      toast.success(t('Tema cambiado correctamente'));
    } catch (error) {
      console.error('Error changing theme:', error);
      toast.error(t('common.error'));
    }
  };

  const handleCurrencyChange = async (newCurrency: Currency) => {
    try {
      await setCurrency(newCurrency);
      toast.success(t('Divisa cambiada correctamente'));
    } catch (error) {
      console.error('Error changing currency:', error);
      toast.error(t('common.error'));
    }
  };

  const themeOptions = [
    { value: 'fashion' as Theme, label: 'Tema Fashion (Recomendado)', color: 'bg-pink-300', description: 'Rosa pastel suave - Tienda de ropa' },
    { value: 'amber' as Theme, label: 'Tema Ámbar', color: 'bg-amber-500', description: 'Cálido y acogedor' },
    { value: 'dark' as Theme, label: 'Tema Oscuro', color: 'bg-gray-700', description: 'Elegante y profesional' },
    { value: 'blue' as Theme, label: 'Tema Azul', color: 'bg-blue-500', description: 'Fresco y confiable' },
    { value: 'green' as Theme, label: 'Tema Verde', color: 'bg-emerald-500', description: 'Natural y tranquilo' },
  ];

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center shadow-sm">
            <Settings className="w-7 h-7 text-purple-600" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-800">{t('nav.app-settings')}</h2>
            <p className="text-sm text-gray-600">{t('settings.general.description')}</p>
          </div>
        </div>
      </div>

      {/* Información sobre cambios */}
      <div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Check className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">{t('Configuración de la aplicación')}</p>
            <p>{t('Personaliza el idioma y la apariencia de la aplicación. Los cambios se aplican inmediatamente.')}</p>
          </div>
        </div>
      </div>

      {/* Configuración de idioma - Solo para Super Admin */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{t('settings.language')}</h3>
            <span className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded">
              {t('Super Administrador')}
            </span>
          </div>

          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ {t('Información')}:</strong> {t('El cambio de idioma se aplicará a todos los usuarios del sistema de forma inmediata.')}
            </p>
          </div>

          <p className="text-sm text-gray-600 mb-4">{t('settings.language.description')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => handleLanguageChange('es')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                currentLanguage === 'es'
                  ? 'border-pink-300 bg-pink-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                currentLanguage === 'es' ? 'border-pink-500 bg-pink-100' : 'border-gray-300'
              }`}>
                {currentLanguage === 'es' && <div className="w-2.5 h-2.5 rounded-full bg-pink-500"></div>}
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-base">{t('settings.language.es')}</p>
                <p className="text-xs text-gray-600">{t('Español')}</p>
              </div>
            </button>

            <button
              onClick={() => handleLanguageChange('fr')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                currentLanguage === 'fr'
                  ? 'border-pink-300 bg-pink-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                currentLanguage === 'fr' ? 'border-pink-500 bg-pink-100' : 'border-gray-300'
              }`}>
                {currentLanguage === 'fr' && <div className="w-2.5 h-2.5 rounded-full bg-pink-500"></div>}
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-base">{t('settings.language.fr')}</p>
                <p className="text-xs text-gray-600">{t('Français')}</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Configuración de tema - Solo para Super Admin */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Palette className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{t('settings.theme')}</h3>
            <span className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded">
              {t('Super Administrador')}
            </span>
          </div>

          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ {t('Información')}:</strong> {t('El cambio de tema se aplicará a todos los usuarios del sistema de forma inmediata.')}
            </p>
          </div>

          <p className="text-sm text-gray-600 mb-4">{t('Selecciona el tema de color de la aplicación')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {themeOptions.map((theme) => (
              <button
                key={theme.value}
                onClick={() => handleThemeChange(theme.value)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  currentTheme === theme.value
                    ? 'border-pink-300 bg-pink-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  currentTheme === theme.value ? 'border-pink-500 bg-pink-100' : 'border-gray-300'
                }`}>
                  {currentTheme === theme.value && <div className="w-2.5 h-2.5 rounded-full bg-pink-500"></div>}
                </div>
                <div className={`w-8 h-8 rounded-lg ${theme.color}`}></div>
                <div className="text-left flex-1">
                  <p className="font-bold text-base">{theme.label}</p>
                  <p className="text-xs text-gray-600">{theme.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Configuración de divisa - Solo para Super Admin */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{t('Configuración de Divisa')}</h3>
            <span className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded">
              {t('Super Administrador')}
            </span>
          </div>

          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ {t('Información')}:</strong> {t('El cambio de divisa se aplicará a todos los usuarios del sistema de forma inmediata.')}
            </p>
          </div>

          <p className="text-sm text-gray-600 mb-4">{t('Selecciona la divisa que se utilizará en toda la aplicación')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {availableCurrencies.map((currency) => (
              <button
                key={currency.code}
                onClick={() => handleCurrencyChange(currency)}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                  currentCurrency.code === currency.code
                    ? 'border-pink-300 bg-pink-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  currentCurrency.code === currency.code ? 'border-pink-500 bg-pink-100' : 'border-gray-300'
                }`}>
                  {currentCurrency.code === currency.code && <div className="w-2 h-2 rounded-full bg-pink-500"></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{currency.symbol}</span>
                    <span className="font-medium text-sm">{currency.code}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{currency.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('Información')}</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>• {t('Los cambios de idioma se aplican inmediatamente a toda la aplicación')}</p>
          <p>• {t('Los cambios de tema se aplican inmediatamente a todos los usuarios')}</p>
          <p>• {t('Los cambios de divisa se aplican inmediatamente a todos los usuarios')}</p>
          <p>• {t('Solo el Super Administrador puede cambiar estos ajustes')}</p>
          <p>• {t('Los cambios se sincronizan en tiempo real')}</p>
        </div>
      </div>
    </div>
  );
}
