import { Rocket, Code, ShieldAlert, Zap, ArrowRight, Cpu, Activity } from 'lucide-react';
import { Button } from '@forge/ui';
import type { WorkspaceSummary } from '@forge/shared';

interface WelcomeViewProps {
  workspace: WorkspaceSummary | null;
  wsInputPath: string;
  setWsInputPath: (val: string) => void;
  openWorkspace: () => void;
  setTaskIntent: (val: string) => void;
}

export function WelcomeView({
  workspace,
  wsInputPath,
  setWsInputPath,
  openWorkspace,
  setTaskIntent,
}: WelcomeViewProps) {
  if (workspace) return null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-gradient-to-b from-transparent to-blue-900/5">
      <div className="max-w-xl w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="relative inline-block">
          <div className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
          <Rocket className="w-20 h-20 mx-auto text-blue-500 relative" />
        </div>
        <div>
          <h1 className="text-5xl font-bold tracking-tighter text-white mb-4 italic">FORGE</h1>
          <p className="text-neutral-400 text-lg leading-relaxed">
            Local-first, native AI software engineering agent. Deep workspace integration without cloud boundaries.
          </p>
        </div>
        
        <div className="bg-neutral-900/50 backdrop-blur border border-neutral-800 rounded-2xl p-8 space-y-6 shadow-2xl">
           <div className="flex flex-col space-y-3">
             <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 text-left">Connect Workspace</label>
             <div className="flex gap-2">
               <input 
                 className="flex-1 bg-black/50 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 outline-none focus:border-blue-500 font-mono"
                 placeholder="C:\Users\Name\Projects\..."
                 value={wsInputPath}
                 onChange={e => setWsInputPath(e.target.value)}
               />
               <Button onClick={openWorkspace} className="px-6 font-bold bg-blue-600 hover:bg-blue-500" disabled={!wsInputPath}>
                 Initialize
               </Button>
             </div>
           </div>

           <div className="border-t border-neutral-800 pt-6">
             <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 text-left block mb-4">Quick Start Demo Path</label>
             <div className="grid grid-cols-1 gap-2 text-left">
               {[
                 { title: "Refactor existing logic", icon: <Code className="w-3.5 h-3.5 mr-2"/> },
                 { title: "Fix identified security bugs", icon: <ShieldAlert className="w-3.5 h-3.5 mr-2"/> },
                 { title: "Optimize build performance", icon: <Zap className="w-3.5 h-3.5 mr-2"/> }
               ].map((item, i) => (
                 <button 
                  key={i} 
                  onClick={() => setTaskIntent(item.title)} 
                  className="flex items-center p-3 rounded-lg bg-neutral-950 border border-neutral-900 hover:border-blue-500/50 hover:bg-blue-950/10 text-neutral-400 hover:text-blue-300 transition-all text-sm group"
                >
                   {item.icon} {item.title}
                   <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"/>
                 </button>
               ))}
             </div>
           </div>
        </div>

        <div className="flex items-center justify-center gap-8 pt-8 opacity-40">
          <div className="flex items-center text-xs font-mono text-neutral-400"><Cpu className="w-4 h-4 mr-2"/> Local Models</div>
          <div className="flex items-center text-xs font-mono text-neutral-400"><ShieldAlert className="w-4 h-4 mr-2"/> Private Loop</div>
          <div className="flex items-center text-xs font-mono text-neutral-400"><Activity className="w-4 h-4 mr-2"/> Deterministic</div>
        </div>
      </div>
    </div>
  );
}
