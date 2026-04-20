import { CheckCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@forge/ui';
import type { VerificationState, RetryRequest } from '@forge/shared';

interface VerifierViewProps {
  verState: VerificationState | null;
  retryReq: RetryRequest | null;
  loadRepairState: () => void;
  prepareDeployment: () => void;
}

export function VerifierView({
  verState,
  retryReq,
  loadRepairState,
  prepareDeployment,
}: VerifierViewProps) {
  if (!verState) return null;

  return (
    <div className="flex-1 flex flex-col pt-10 max-w-4xl mx-auto w-full px-8 pb-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold flex items-center">
          <CheckCircle className="w-6 h-6 mr-3 text-purple-500"/> Verification Report
        </h2>
      </div>
      
      <div className="grid grid-cols-[1fr_380px] gap-6 flex-1 items-start">
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Command Output</h3>
            <div className="bg-black border border-neutral-800 rounded p-4 font-mono text-[11px] leading-relaxed text-neutral-400 whitespace-pre-wrap overflow-x-auto h-[300px]">
              {verState.stdout}
            </div>
          </div>
          
          {verState.findings.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Findings</h3>
              {verState.findings.map((f, i) => (
                <div key={i} className="bg-red-950/20 border border-red-900/30 p-4 rounded mb-2">
                  <span className="font-semibold text-red-400">
                    {f.classification.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <p className="text-neutral-300 text-sm mt-1 font-mono">{f.message}</p>
                </div>
              ))}
            </div>
          )}
          
          {verState.findings.length === 0 && (
            <div className="bg-green-950/20 border border-green-900/30 p-6 rounded text-center text-green-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-2" /> All checks passed.
            </div>
          )}
        </div>

        <div className="sticky top-6">
          {retryReq && (
            <div className="bg-neutral-900/90 border border-neutral-800 p-5 rounded-xl shadow-2xl relative">
              <h3 className="font-bold text-yellow-500 uppercase text-sm mb-4">Repair Available</h3>
              <div className="bg-black/50 p-3 rounded border border-neutral-800 font-mono text-xs text-blue-300 mb-4">
                {retryReq.suggestedScope}
              </div>
              <Button 
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-neutral-950 font-bold justify-center" 
                onClick={loadRepairState}
              >
                <RefreshCw className="w-4 h-4 mr-2"/> Begin Repair
              </Button>
            </div>
          )}
          
          {!retryReq && verState.status === 'passed' && (
            <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
              <h3 className="font-bold text-green-500 uppercase text-sm mb-4">Continue</h3>
              <Button className="w-full justify-center bg-blue-600 font-bold text-white" onClick={prepareDeployment}>
                Next Stage <ArrowRight className="w-4 h-4 ml-2"/>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
