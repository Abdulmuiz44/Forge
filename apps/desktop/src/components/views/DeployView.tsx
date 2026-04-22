import { Rocket, Terminal, Play, ShieldAlert } from 'lucide-react';
import { Button } from '@codra/ui';
import type { DeployPrepSummary } from '@codra/shared';

interface DeployViewProps {
  deployState: DeployPrepSummary | null;
}

export function DeployView({ deployState }: DeployViewProps) {
  if (!deployState) return null;

  return (
    <div className="flex-1 flex flex-col pt-10 max-w-4xl mx-auto w-full px-8 pb-10">
      <h2 className="text-3xl font-semibold mb-8 flex items-center border-b border-neutral-900 pb-4">
        <Rocket className="w-8 h-8 mr-4 text-purple-500"/> Deployment Setup
      </h2>
      
      <div className="grid gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">Detected Architecture</h3>
            <span className="bg-purple-900/20 text-purple-400 border border-purple-900/40 px-3 py-1 rounded text-xs uppercase font-bold tracking-wider">
              {deployState.targetKind.replace(/_/g, ' ')}
            </span>
          </div>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            {deployState.detectedRoots.map((d, i) => (
              <li key={i} className="text-blue-300 font-mono text-xs">{d}</li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-6 items-start">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Proposed Commands</h3>
            {deployState.proposedCommands.map((c, i) => (
              <div key={i} className="bg-black border border-neutral-800 px-3 py-2 text-xs font-mono text-green-400 rounded flex items-center mb-2">
                <Terminal className="w-3 h-3 text-neutral-600 mr-2"/> {c}
              </div>
            ))}
            <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold">
              <Play className="w-4 h-4 mr-2"/> Execute Deploy Chain
            </Button>
          </div>
          
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4 flex items-center">
              <ShieldAlert className="w-4 h-4 text-yellow-500 mr-2"/> Known Risks
            </h3>
            <ul className="space-y-3">
              {deployState.risks.map((c, i) => (
                <li key={i} className="text-xs text-neutral-400 bg-neutral-950 p-2 rounded">{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
