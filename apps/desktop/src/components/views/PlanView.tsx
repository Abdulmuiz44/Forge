import { Map, Check, Play, CheckCircle } from 'lucide-react';
import { Button } from '@codra/ui';
import type { ExecutionPlan, PlanStatus } from '@codra/shared';

interface PlanViewProps {
  activePlan: ExecutionPlan | null;
  setPlanApproval: (status: PlanStatus) => void;
  startExecution: () => void;
}

export function PlanView({ activePlan, setPlanApproval, startExecution }: PlanViewProps) {
  if (!activePlan) return null;

  return (
    <div className="p-10 max-w-4xl mx-auto w-full px-8 pb-10">
      <h2 className="text-3xl font-semibold tracking-tight text-white flex items-center mb-8">
        <Map className="w-6 h-6 mr-3 text-blue-500"/> Execution Plan
      </h2>
      
      <div className="mb-8">
        {activePlan.steps.map((step, i) => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 mb-4 hover:border-neutral-700 transition-colors">
            <div className="font-semibold text-neutral-200 text-base">
              <span className="text-neutral-600 font-mono mr-3">{String(i+1).padStart(2,'0')}</span>
              {step.title}
            </div>
            <p className="text-neutral-400 text-sm ml-9 mt-2">{step.objective}</p>
          </div>
        ))}
      </div>

      {activePlan.status === 'ready_for_review' ? (
        <div className="sticky bottom-6 bg-neutral-900/90 backdrop-blur border border-neutral-800 p-5 rounded-2xl flex items-center justify-between shadow-2xl">
          <div className="text-sm font-semibold text-white">Ready for approval</div>
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white font-bold" 
            onClick={() => setPlanApproval('approved')}
          >
            <Check className="w-5 h-5 mr-2"/> Approve Plan
          </Button>
        </div>
      ) : activePlan.status === 'approved' ? (
        <div className="sticky bottom-6 bg-neutral-900/90 backdrop-blur border border-neutral-800 p-5 rounded-2xl flex items-center justify-between shadow-2xl">
          <div className="text-sm font-bold text-green-400 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2"/> Plan Approved
          </div>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold" 
            onClick={startExecution}
          >
            <Play className="w-4 h-4 mr-2"/> Execute
          </Button>
        </div>
      ) : null}
    </div>
  );
}
