import type { Dispatch, SetStateAction, RefObject } from 'react';
import { Activity, CheckCircle, ShieldAlert, X, Check } from 'lucide-react';
import { Button } from '@forge/ui';
import type { ExecutionState, PatchProposal, RepairAttempt } from '@forge/shared';

interface ExecutorViewProps {
  execState: ExecutionState | null;
  activePatch: PatchProposal | null;
  repairState: RepairAttempt | null;
  handlePatchDecision: (approved: boolean) => void;
  startVerification: () => void;
  timeline: { timestamp: string, message: string, source: string }[];
  setTimeline: Dispatch<SetStateAction<{ timestamp: string, message: string, source: 'system' | 'browser' | 'verifier' }[]>>;
  journalEndRef: RefObject<HTMLDivElement | null>;
}

export function ExecutorView({
  execState,
  activePatch,
  repairState,
  handlePatchDecision,
  startVerification,
  timeline,
  setTimeline,
  journalEndRef,
}: ExecutorViewProps) {
  return (
    <div className="flex-1 flex flex-col pt-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between px-8 mb-6">
        <h2 className="text-2xl font-semibold flex items-center">
          <Activity className="w-6 h-6 mr-3 text-blue-500"/> Execution
        </h2>
        {execState && execState.status === 'ready' && !activePatch && (
          <Button className="bg-purple-600 hover:bg-purple-700 font-medium" onClick={startVerification}>
            <CheckCircle className="w-4 h-4 mr-2"/> Verify
          </Button>
        )}
      </div>

      {activePatch ? (
        <div className="px-8 flex-1">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden mt-4">
            <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center text-yellow-500 font-semibold text-sm">
                <ShieldAlert className="w-4 h-4 mr-2"/> Patch Proposal
              </div>
              <span className="text-xs text-neutral-400 font-mono">{activePatch.targetFile}</span>
            </div>
            {repairState && (
              <div className="px-4 py-2 bg-yellow-900/20 text-yellow-300 text-xs font-mono font-bold border-b border-yellow-900/40">
                REPAIR ATTEMPT #{repairState.attemptNumber}
              </div>
            )}
            <div className="p-4 border-b border-neutral-800 text-sm text-neutral-300">
              <strong>Rationale:</strong> {activePatch.rationale}
            </div>
            <div className="p-4 bg-black overflow-x-auto text-xs font-mono text-green-400 leading-relaxed">
              <pre>{activePatch.diffContent}</pre>
            </div>
            <div className="p-4 flex justify-end space-x-3 bg-neutral-900 border-t border-neutral-800">
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => handlePatchDecision(false)}>
                <X className="w-4 h-4 mr-2"/> Reject
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20" 
                onClick={() => handlePatchDecision(true)}
              >
                <Check className="w-4 h-4 mr-2"/> Approve
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 px-8">
          {execState && execState.status === 'ready' ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center max-w-lg mx-auto mt-12">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Step Applied</h3>
              <p className="text-sm text-neutral-400 mb-6">Patch applied successfully. Run verification to confirm.</p>
              <Button className="bg-purple-600 w-full justify-center" onClick={startVerification}>Verify Step</Button>
            </div>
          ) : (
            <div className="flex justify-center mt-20 animate-pulse">
              <div className="text-center">
                <Activity className="w-10 h-10 mx-auto text-blue-500/50 mb-4"/>
                <p className="text-neutral-500 text-xs uppercase">Processing...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Timeline Section - Shared with Verifier but often viewed here */}
      <div className="h-64 border-t border-neutral-800 bg-[#0a0a0a] flex flex-col shrink-0 mt-8">
        <div className="flex h-8 items-center bg-neutral-900 border-b border-neutral-800 px-4 text-[10px] font-bold uppercase tracking-widest text-neutral-600 justify-between">
          <div className="flex items-center"><Activity className="w-3 h-3 mr-2 text-blue-500"/> Activity Timeline</div>
          <button onClick={() => setTimeline([])} className="hover:text-neutral-300 transition-colors">Clear</button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed">
          {timeline.map((item, i) => (
            <div key={i} className="mb-1.5 flex gap-3">
              <span className="text-neutral-700 shrink-0">{item.timestamp}</span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-tighter ${
                item.source === 'browser' ? 'bg-purple-900/30 text-purple-400 border border-purple-800/50' : 
                item.source === 'verifier' ? 'bg-orange-900/30 text-orange-400 border border-orange-800/50' : 
                'bg-blue-900/30 text-blue-400 border border-blue-800/50'
              }`}>{item.source}</span>
              <span className="text-neutral-300">{item.message}</span>
            </div>
          ))}
          <div ref={journalEndRef} />
        </div>
      </div>
    </div>
  );
}
