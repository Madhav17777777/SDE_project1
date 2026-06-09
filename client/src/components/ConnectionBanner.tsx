import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionBannerProps {
  isConnected: boolean;
  isReconnecting: boolean;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  isConnected,
  isReconnecting
}) => {
  if (isConnected) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-full bg-rose-600 border border-rose-500 text-white shadow-2xl animate-bounce">
      <WifiOff className="w-5 h-5 flex-shrink-0" />
      <div className="text-sm font-medium">
        {isReconnecting ? (
          <span className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Connection lost. Reconnecting...
          </span>
        ) : (
          <span>Offline. Attempting to connect...</span>
        )}
      </div>
    </div>
  );
};
