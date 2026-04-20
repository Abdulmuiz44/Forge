import { useNotify } from '../context/NotificationContext';
import { AlertTriangle, CheckCircle, Activity, X, Info } from 'lucide-react';

export function Toaster() {
  const { notifications, removeNotification } = useNotify();

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center space-y-3 pointer-events-none w-full max-w-md">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`px-6 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center animate-in slide-in-from-top-4 duration-300 pointer-events-auto w-full ${
            n.type === 'error' ? 'bg-red-950/40 border-red-900/50 text-red-200' :
            n.type === 'success' ? 'bg-green-950/40 border-green-900/50 text-green-200' :
            n.type === 'warning' ? 'bg-yellow-950/40 border-yellow-900/50 text-yellow-200' :
            'bg-blue-950/40 border-blue-900/50 text-blue-200'
          }`}
        >
          {n.type === 'error' ? <AlertTriangle className="w-4 h-4 mr-3 text-red-400 shrink-0"/> :
           n.type === 'success' ? <CheckCircle className="w-4 h-4 mr-3 text-green-400 shrink-0"/> :
           n.type === 'warning' ? <Info className="w-4 h-4 mr-3 text-yellow-400 shrink-0"/> :
           <Activity className="w-4 h-4 mr-3 text-blue-400 shrink-0"/>}
          
          <span className="text-sm font-medium flex-1 break-words">{n.message}</span>
          
          <button 
            onClick={() => removeNotification(n.id)} 
            className="ml-4 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4"/>
          </button>
        </div>
      ))}
    </div>
  );
}
