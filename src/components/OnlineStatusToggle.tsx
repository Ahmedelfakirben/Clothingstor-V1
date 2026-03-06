import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Wifi, WifiOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function OnlineStatusToggle() {
  const { profile, setOnlineStatus } = useAuth();
  const { t } = useLanguage();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    if (!profile) return;

    const newStatus = !profile.is_online;
    setIsUpdating(true);

    try {
      await setOnlineStatus(newStatus);
      toast.success(
        newStatus
          ? t('Status changed to: Available')
          : t('Status changed to: Not available')
      );
    } catch (error) {
      console.error('Error toggling online status:', error);
      toast.error(t('common.error'));
    } finally {
      setIsUpdating(false);
    }
  };

  if (!profile) return null;

  const isOnline = profile.is_online;

  return (
    <button
      onClick={handleToggle}
      disabled={isUpdating}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
        ${isOnline
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }
        ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={isOnline ? t('Click to mark yourself as unavailable') : t('Click to mark yourself as available')}
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>{t('Available')}</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>{t('Not available')}</span>
        </>
      )}
    </button>
  );
}
