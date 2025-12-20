export function LoadingSpinner({
  size = 'md',
  className = '',
  light = false
}: {
  size?: 'sm' | 'md' | 'lg',
  className?: string,
  light?: boolean
}) {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  };

  const dotSize = sizeClasses[size];
  const dotColors = light
    ? 'bg-white/80 bg-white bg-white/90'
    : 'bg-pink-400 bg-pink-500 bg-pink-600';

  const colors = light
    ? ['bg-white/70', 'bg-white', 'bg-white/80']
    : ['bg-pink-400', 'bg-pink-500', 'bg-pink-600'];

  return (
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      <div className={`${dotSize} ${colors[0]} rounded-full animate-bounce`} style={{ animationDelay: '0ms', animationDuration: '1s' }}></div>
      <div className={`${dotSize} ${colors[1]} rounded-full animate-bounce`} style={{ animationDelay: '150ms', animationDuration: '1s' }}></div>
      <div className={`${dotSize} ${colors[2]} rounded-full animate-bounce`} style={{ animationDelay: '300ms', animationDuration: '1s' }}></div>
    </div>
  );
}

export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
      <LoadingSpinner size="lg" />
      {message && (
        <p className="mt-4 text-gray-600 text-sm font-medium">{message}</p>
      )}
    </div>
  );
}

export function LoadingPage({ message }: { message?: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <LoadingSpinner size="lg" />
      {message && (
        <p className="mt-4 text-gray-600 text-sm font-medium">{message}</p>
      )}
    </div>
  );
}
