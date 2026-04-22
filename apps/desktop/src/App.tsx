import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@codra/ui';
import { 
  Folder, Rocket, Zap, WifiOff, AlertTriangle, Terminal, Activity
} from 'lucide-react';
import type { 
  WorkspaceSummary, ExecutionPlan, 
  TaskRequest, PlanStatus, ExecutionState, StepExecutionRecord, PatchProposal, 
  VerificationState, RetryRequest, RepairAttempt, DeployPrepSummary, 
  BrowserActionRequest, BrowserActionResult, BrowserActionKind, BrowserSessionState, 
  ProviderConfig, ProviderHealthResult, ProviderKind, ModelDescriptor, 
  GenerationResponse, AppBootData
} from '@codra/shared';

import { useNotify } from './context/NotificationContext';
import { Sidebar } from './components/Sidebar';
import { WelcomeView } from './components/views/WelcomeView';
import { SettingsView } from './components/views/SettingsView';
import { DeployView } from './components/views/DeployView';
import { BrowserView } from './components/views/BrowserView';
import { VerifierView } from './components/views/VerifierView';
import { ExecutorView } from './components/views/ExecutorView';
import { PlanView } from './components/views/PlanView';

function App() {
  const { notify } = useNotify();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [wsInputPath, setWsInputPath] = useState("");
  const [activeFile] = useState<{ path: string, content: string } | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'plan' | 'executor' | 'verifier' | 'deploy' | 'browser' | 'settings'>('editor');
  const [taskIntent, setTaskIntent] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [activePlan, setActivePlan] = useState<ExecutionPlan | null>(null);
  const [execState, setExecState] = useState<ExecutionState | null>(null);
  const [activePatch, setActivePatch] = useState<PatchProposal | null>(null);
  const [verState, setVerState] = useState<VerificationState | null>(null);
  const [retryReq, setRetryReq] = useState<RetryRequest | null>(null);
  const [repairState, setRepairState] = useState<RepairAttempt | null>(null);
  const [deployState, setDeployState] = useState<DeployPrepSummary | null>(null);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<{ timestamp: string, message: string, source: 'system' | 'browser' | 'verifier' }[]>([]);
  const journalEndRef = useRef<HTMLDivElement>(null);
  const [browserAction, setBrowserAction] = useState("");
  const [browserSession, setBrowserSession] = useState<BrowserSessionState | null>(null);

  // Provider state
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealthResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelDescriptor[]>([]);
  const [settingsForm, setSettingsForm] = useState({ kind: 'ollama' as ProviderKind, baseUrl: 'http://localhost:11434', modelId: 'llama3.2', apiKey: '' });
  const [testPrompt, setTestPrompt] = useState("");
  const [testResponse, setTestResponse] = useState("");

  useEffect(() => { journalEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [timeline]);

  useEffect(() => {
    // App Boot Recovery
    invoke<AppBootData>("get_app_boot_data").then(boot => {
      if (boot.lastWorkspace) {
        setWorkspace(boot.lastWorkspace);
        setWsInputPath(boot.lastWorkspace.rootPath);
      }
      if (boot.providerConfig) {
        setProviderConfig(boot.providerConfig);
        setSettingsForm({ kind: boot.providerConfig.kind, baseUrl: boot.providerConfig.baseUrl, modelId: boot.providerConfig.modelId, apiKey: '' });
      }
      if (boot.activePlan) {
        setActivePlan(boot.activePlan);
        if (boot.activeExecution) {
          setExecState(boot.activeExecution);
          setViewMode('executor');
        } else {
          setViewMode('plan');
        }
      }
      invoke<ProviderHealthResult>("check_provider_health").then(setProviderHealth).catch(() => {});
    }).catch(e => {
       console.error("Boot error", e);
       invoke<ProviderConfig>("get_provider_config").then(cfg => {
         setProviderConfig(cfg);
         setSettingsForm({ kind: cfg.kind, baseUrl: cfg.baseUrl, modelId: cfg.modelId, apiKey: '' });
       }).catch(() => {});
    });
  }, []);

  const openWorkspace = async () => {
    if (!wsInputPath) return;
    try {
      const summary = await invoke<WorkspaceSummary>("open_workspace", { path: wsInputPath });
      setWorkspace(summary);
      const cfg = await invoke<ProviderConfig>("get_provider_config");
      setProviderConfig(cfg);
      setSettingsForm({ kind: cfg.kind, baseUrl: cfg.baseUrl, modelId: cfg.modelId, apiKey: '' });
      try {
        const health = await invoke<ProviderHealthResult>("check_provider_health");
        setProviderHealth(health);
      } catch {}
      notify("Workspace connected", "success");
    } catch (e) { notify(`Failed to open workspace: ${e}`, 'error'); }
  };

  const submitTask = async () => {
    if (!taskIntent) return;
    setIsPlanning(true); setViewMode('plan');
    try {
      const req: TaskRequest = { id: crypto.randomUUID(), intent: taskIntent, mode: 'auto' };
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `Planning task: ${taskIntent}`, source: 'system' }]);
      const plan = await invoke<ExecutionPlan>("submit_task_for_planning", { request: req });
      const reviewPlan = await invoke<ExecutionPlan>("update_plan_status", { planId: plan.id, status: 'ready_for_review' });
      setActivePlan(reviewPlan);
    } catch (e) { notify(`Planning failed: ${e}`, 'error'); }
    finally { setIsPlanning(false); setTaskIntent(""); }
  };

  const setPlanApproval = async (status: PlanStatus) => {
    if (!activePlan) return;
    try { 
      const updatedPlan = await invoke<ExecutionPlan>("update_plan_status", { planId: activePlan.id, status }); 
      setActivePlan(updatedPlan);
      if (status === 'approved') notify("Plan approved", "success");
    } catch (e) { notify(`Update failed: ${e}`, 'error'); }
  };

  const startExecution = async () => {
    if (!activePlan || activePlan.status !== 'approved') return;
    try {
      setTimeline([{ timestamp: new Date().toLocaleTimeString(), message: "Bootstrapping execution context...", source: 'system' }]); 
      setViewMode('executor');
      const st = await invoke<ExecutionState>("start_execution", { plan: activePlan });
      setExecState(st); runStep(st, activePlan);
    } catch (e) { notify(`Execution start error: ${e}`, 'error'); }
  };

  const runStep = async (currentState: ExecutionState, plan: ExecutionPlan) => {
    try {
      const rec = await invoke<StepExecutionRecord>("execute_step", { execState: currentState, plan });
      setTimeline(prev => [...prev, ...rec.observations.map(o => ({ timestamp: o.timestamp, message: o.message, source: 'system' as const }))]);
      if (rec.status === 'awaiting_patch_review' && rec.pendingPatch) { setActivePatch(rec.pendingPatch); }
      else if (rec.status === 'applied') { 
        setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Step completed. Ready for Verification.", source: 'system' }]); 
      }
    } catch (e) { setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `Action failed: ${e}`, source: 'system' }]); }
  };

  const handlePatchDecision = async (approved: boolean) => {
    if (!execState || !activePatch) return;
    try {
      const updatedSt = await invoke<ExecutionState>("submit_patch_decision", { execState, patchId: activePatch.id, approved });
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `Patch ${approved ? 'approved & applied' : 'rejected'}`, source: 'system' }]);
      setActivePatch(null); setExecState(updatedSt);
      if (approved) notify("Patch applied", "success");
    } catch(e) { 
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `Error: ${e}`, source: 'system' }]);
    }
  };

  const startVerification = async () => {
    if (!execState || !execState.currentStepId) return;
    try {
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Running verification checks...", source: 'verifier' }]);
      setViewMode('verifier');
      const ver = await invoke<VerificationState>("start_verification", { executionId: execState.id, stepId: execState.currentStepId });
      setVerState(ver);
      if (ver.status === 'failed') {
        const proposal = await invoke<RetryRequest>("generate_retry_proposal", { verificationState: ver });
        setRetryReq(proposal); 
        setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Tests failed. Technical debt identified.", source: 'verifier' }]);
      } else { 
        setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "All checks passed successfully.", source: 'verifier' }]); 
        notify("Verification passed", "success");
      }
    } catch (e) { notify(`Verification Error: ${e}`, 'error'); }
  };

  const loadRepairState = async () => {
    if (!retryReq) return;
    try {
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Generating repair plan with AI context...", source: 'system' }]);
      setViewMode('executor');
      const attempt = await invoke<RepairAttempt>("start_repair_attempt", { retryRequest: retryReq });
      setRepairState(attempt);
      if (attempt.proposedPatch) { setActivePatch(attempt.proposedPatch); }
    } catch (e) { notify(`Repair Init Error: ${e}`, 'error'); }
  };

  const prepareDeployment = async () => {
    try {
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Evaluating workspace for deployment readiness...", source: 'system' }]);
      setViewMode('deploy');
      const deployReq = await invoke<DeployPrepSummary>("prepare_deployment");
      setDeployState(deployReq);
    } catch (e) { notify(`Deploy Error: ${e}`, 'error'); }
  };

  const triggerBrowserAction = async (kind: BrowserActionKind = 'open_url', overrideValue?: string) => {
    try {
      setViewMode('browser');
      const actionId = crypto.randomUUID();
      const val = overrideValue || browserAction || 'https://google.com';
      const req: BrowserActionRequest = { id: actionId, kind, value: val };
      
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `Browser Action dispatched: ${kind} (${val})`, source: 'browser' }]);
      const result = await invoke<BrowserActionResult>("execute_browser_action", { action: req });
      
      if (result.success) {
        setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `OK: ${result.message}`, source: 'browser' }]);
        if (result.screenshotBase64) setLastScreenshot(result.screenshotBase64);
      } else {
        setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `ERROR: ${result.message}`, source: 'browser' }]);
      }
      setBrowserAction("");
      const state = await invoke<BrowserSessionState>("browser_get_session_state");
      setBrowserSession(state);
    } catch (e) { notify(`Browser error: ${e}`, 'error'); }
  };

  const launchBrowserSession = async () => {
    try {
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Launching browser session...", source: 'browser' }]);
      const state = await invoke<BrowserSessionState>("browser_launch_session");
      setBrowserSession(state);
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Browser ready.", source: 'browser' }]);
      notify("Browser session ready", "success");
    } catch (e) { notify(`Launch failed: ${e}`, 'error'); }
  };

  const closeBrowserSession = async () => {
    try {
      const state = await invoke<BrowserSessionState>("browser_close_session");
      setBrowserSession(state);
      setLastScreenshot(null);
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Browser session closed.", source: 'browser' }]);
    } catch (e) { notify(`Close failed: ${e}`, 'error'); }
  };

  const saveProviderSettings = async () => {
    try {
      const cfg = await invoke<ProviderConfig>("save_provider_config", {
        config: { kind: settingsForm.kind, baseUrl: settingsForm.baseUrl, modelId: settingsForm.modelId, apiKeySet: settingsForm.apiKey.length > 0 },
        apiKey: settingsForm.apiKey || null,
      });
      setProviderConfig(cfg);
      setSettingsForm(prev => ({ ...prev, apiKey: '' }));
      runHealthCheck();
      notify("Settings saved", "success");
    } catch (e) { notify(`Save failed: ${e}`, 'error'); }
  };

  const runHealthCheck = async () => {
    setIsCheckingHealth(true);
    try {
      const health = await invoke<ProviderHealthResult>("check_provider_health");
      setProviderHealth(health);
      if (health.reachable) {
        try { const models = await invoke<ModelDescriptor[]>("list_provider_models"); setAvailableModels(models); } catch {}
      }
    } catch (e) { setProviderHealth({ reachable: false, modelAvailable: false, status: 'failed', message: String(e) }); }
    finally { setIsCheckingHealth(false); }
  };

  const runTestGeneration = async () => {
    if (!testPrompt) return;
    setTestResponse("Generating...");
    try {
      const resp = await invoke<GenerationResponse>("test_generation", { prompt: testPrompt });
      setTestResponse(resp.content);
    } catch (e) { setTestResponse(`Error: ${e}`); }
  };

  const providerBadge = providerHealth?.reachable
    ? (providerHealth.modelAvailable 
        ? <span className="flex items-center text-[10px] font-bold text-green-500 bg-green-900/20 px-2 py-1 rounded-full border border-green-900/30"><Zap className="w-3 h-3 mr-1"/>{providerConfig?.modelId}</span>
        : <span className="flex items-center text-[10px] font-bold text-yellow-500 bg-yellow-900/20 px-2 py-1 rounded-full border border-yellow-900/30"><AlertTriangle className="w-3 h-3 mr-1"/>No Model</span>)
    : <span className="flex items-center text-[10px] font-bold text-red-500 bg-red-900/20 px-2 py-1 rounded-full border border-red-900/30 animate-pulse"><WifiOff className="w-3 h-3 mr-1"/>Disconnected</span>;

  return (
    <div className="flex h-screen w-full flex-col bg-neutral-950 text-neutral-50 overflow-hidden text-sm">
      <header className="flex h-12 w-full items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 shrink-0">
        <div className="flex items-center space-x-2 font-semibold tracking-tight text-neutral-300">
          <Zap className="w-4 h-4 text-blue-500" />
          <span className="text-white">Codra</span> <span className="text-neutral-500 font-normal">Desktop</span>
        </div>
        <div className="flex items-center space-x-3">
          {providerBadge}
          {workspace ? (
            <div className="text-xs text-blue-400 flex items-center bg-blue-900/10 border border-blue-900/30 px-3 py-1.5 rounded-full font-medium">
              <Folder className="w-3 h-3 mr-2"/>{workspace.rootPath}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <input value={wsInputPath} onChange={e => setWsInputPath(e.target.value)} placeholder="C:/Path/To/Repo"
                className="bg-neutral-950 border border-neutral-700 px-2 py-1 rounded text-xs" onKeyDown={e => e.key === 'Enter' && openWorkspace()} />
              <Button onClick={openWorkspace} className="h-7 text-xs py-1 px-3 bg-neutral-800 text-neutral-300 hover:bg-neutral-700">Connect</Button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar viewMode={viewMode} setViewMode={setViewMode} prepareDeployment={prepareDeployment} />

        <main className="flex-1 flex flex-col bg-[#050505] relative overflow-y-auto">
          {workspace && viewMode === 'editor' && activeFile ? (
            <textarea className="flex-1 w-full p-6 bg-transparent resize-none outline-none font-mono text-[13px] leading-loose text-neutral-300" value={activeFile.content} readOnly />
          ) : null}

          {viewMode === 'settings' && (
            <SettingsView 
              providerHealth={providerHealth} settingsForm={settingsForm} setSettingsForm={setSettingsForm}
              availableModels={availableModels} providerConfig={providerConfig} saveProviderSettings={saveProviderSettings}
              runHealthCheck={runHealthCheck} isCheckingHealth={isCheckingHealth} testPrompt={testPrompt}
              setTestPrompt={setTestPrompt} runTestGeneration={runTestGeneration} testResponse={testResponse}
            />
          )}

          {viewMode === 'deploy' && <DeployView deployState={deployState} />}

          {viewMode === 'browser' && (
            <BrowserView 
              browserSession={browserSession} launchBrowserSession={launchBrowserSession} closeBrowserSession={closeBrowserSession}
              browserAction={browserAction} setBrowserAction={setBrowserAction} triggerBrowserAction={triggerBrowserAction}
              lastScreenshot={lastScreenshot} workspace={workspace} timeline={timeline} setTimeline={setTimeline}
            />
          )}

          {viewMode === 'verifier' && (
            <VerifierView verState={verState} retryReq={retryReq} loadRepairState={loadRepairState} prepareDeployment={prepareDeployment} />
          )}

          {viewMode === 'executor' && (
            <ExecutorView 
              execState={execState} activePatch={activePatch} repairState={repairState}
              handlePatchDecision={handlePatchDecision} startVerification={startVerification}
              timeline={timeline} setTimeline={setTimeline} journalEndRef={journalEndRef}
            />
          )}

          {viewMode === 'plan' && (
            <PlanView activePlan={activePlan} setPlanApproval={setPlanApproval} startExecution={startExecution} />
          )}

          <WelcomeView 
            workspace={workspace} wsInputPath={wsInputPath} setWsInputPath={setWsInputPath}
            openWorkspace={openWorkspace} setTaskIntent={setTaskIntent}
          />
        </main>

        <aside className="w-80 border-l border-neutral-800 bg-[#050505] flex flex-col shadow-xl z-10 shrink-0">
          <div className="flex h-12 items-center px-6 shrink-0 border-b border-neutral-900">
            <span className="text-xs font-bold tracking-widest text-neutral-500 uppercase flex items-center"><Terminal className="w-4 h-4 mr-2 text-blue-500"/> Agent</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
            <div className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between ${providerHealth?.reachable ? 'bg-green-950/20 border-green-900/30 text-green-400' : 'bg-yellow-950/20 border-yellow-900/30 text-yellow-400'}`}>
              <div className="flex items-center">
                {providerHealth?.reachable ? <Activity className="w-3.5 h-3.5 mr-2 text-green-400"/> : <Activity className="w-3.5 h-3.5 mr-2 text-yellow-400"/>}
                {providerHealth?.reachable ? 'Live' : 'Mock'} Mode
              </div>
              <span className="font-mono text-[10px] opacity-70">{providerConfig?.modelId ?? 'echo'}</span>
            </div>
            {isPlanning && <div className="text-xs font-mono text-neutral-500 animate-pulse">Planning task...</div>}
            <div className="text-xs text-neutral-400 leading-relaxed bg-neutral-900/50 p-4 rounded-xl border border-neutral-800">
              Describe a task for Codra to process.
            </div>
            
            {!workspace ? (
               <div className="pt-4 space-y-2">
                 <div className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest px-1">Connect to start</div>
                 <Button onClick={openWorkspace} className="w-full justify-center bg-blue-600 py-4 opacity-50 cursor-not-allowed" disabled>Awaiting Workspace</Button>
               </div>
            ) : (
              <div className="pt-4 space-y-3">
                 <div className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest px-1">New Task</div>
                 <textarea 
                  value={taskIntent} 
                  onChange={e => setTaskIntent(e.target.value)} 
                  placeholder="What should Codra build today?"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs outline-none focus:border-blue-500 resize-none min-h-[100px]"
                 />
                 <Button 
                  onClick={submitTask} 
                  disabled={!taskIntent || isPlanning} 
                  className="w-full justify-center bg-blue-600 text-white font-bold py-3 shadow-lg shadow-blue-900/20"
                 >
                   <Rocket className="w-4 h-4 mr-2"/> Launch Plan
                 </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
