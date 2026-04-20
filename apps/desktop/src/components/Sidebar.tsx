import { cloneElement } from 'react';
import { Folder, Map, Activity, CheckCircle, Globe, Cpu, Rocket } from 'lucide-react';

interface SidebarProps {
  viewMode: string;
  setViewMode: (mode: any) => void;
  prepareDeployment: () => void;
}

export function Sidebar({ viewMode, setViewMode, prepareDeployment }: SidebarProps) {
  const renderSidebarItem = (label: string, icon: any, currentMode: string, trigger?: () => void) => {
    const active = viewMode === currentMode;
    return (
      <div 
        onClick={() => trigger ? trigger() : setViewMode(currentMode)}
        className={`flex items-center px-4 py-2.5 cursor-pointer text-xs font-semibold tracking-wide transition-all ${
          active 
            ? 'border-l-2 border-blue-500 bg-neutral-900/80 text-blue-400' 
            : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
        }`}
      >
        {cloneElement(icon, { className: "w-4 h-4 mr-3" })}
        {label}
      </div>
    );
  };

  return (
    <aside className="w-56 border-r border-neutral-800 bg-black flex flex-col pt-4 shrink-0">
      <div className="px-4 pb-2 text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Navigation</div>
      {renderSidebarItem("File Explorer", <Folder />, 'editor')}
      {renderSidebarItem("Execution Plan", <Map />, 'plan')}
      {renderSidebarItem("Active Context", <Activity />, 'executor')}
      {renderSidebarItem("Verifications", <CheckCircle />, 'verifier')}
      {renderSidebarItem("Browser Runtime", <Globe />, 'browser')}

      <div className="px-4 pt-6 pb-2 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">System</div>
      {renderSidebarItem("AI Provider", <Cpu />, 'settings')}
      {renderSidebarItem("Deploy Target", <Rocket />, 'deploy', prepareDeployment)}
    </aside>
  );
}
