import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@forge/ui';
import { Play, Folder, Terminal, Settings, Layout, Search, GitBranch, FileText, CheckCircle, ShieldAlert, Check, X, Code, ListTodo, Map, Activity, FileDiff, RefreshCw, AlertTriangle, Rocket, Wrench, Globe, ArrowRight, Cpu, Wifi, WifiOff, Zap, Server } from 'lucide-react';
import { WorkspaceSummary, FileEntry, GitStatusSummary, FileReadResult, ExecutionPlan, TaskRequest, PlanStatus, ExecutionState, StepExecutionRecord, PatchProposal, VerificationState, RetryRequest, RepairAttempt, DeployPrepSummary, BrowserActionRequest, BrowserActionResult, BrowserActionKind, BrowserArtifactKind, BrowserSessionStatus, BrowserSessionState, BrowserArtifact, ProviderConfig, ProviderHealthResult, ProviderKind, ModelDescriptor, GenerationResponse, AppBootData, PlanStepStatus, StepExecutionStatus, PatchProposalStatus, VerificationStatus, RepairAttemptStatus, ProviderStatus } from '@forge/shared';

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [wsInputPath, setWsInputPath] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [gitStatus, setGitStatus] = useState<GitStatusSummary | null>(null);
  const [activeFile, setActiveFile] = useState<{ path: string, content: string } | null>(null);
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
  const [notification, setNotification] = useState<{ message: string, type: 'error' | 'success' | 'info', visible: boolean }>({ message: '', type: 'info', visible: false });

  const notify = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setNotification({ message, type, visible: true });
    if (type !== 'error') {
      setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 5000);
    }
  };

  useEffect(() => { journalEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [timeline]);

  useEffect(() => {
    // App Boot Recovery
    invoke<AppBootData>("get_app_boot_data").then(boot => {
      if (boot.lastWorkspace) {
        setWorkspace(boot.lastWorkspace);
        setWsInputPath(boot.lastWorkspace.rootPath);
        // Refresh entries
        invoke<FileEntry[]>("list_workspace_entries", { relativePath: null }).then(setEntries).catch(() => {});
        invoke<GitStatusSummary>("get_git_status").then(setGitStatus).catch(() => {});
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
      // Probe health
      invoke<ProviderHealthResult>("check_provider_health").then(setProviderHealth).catch(() => {});
    }).catch(e => {
       console.error("Boot error", e);
       // Fallback
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
      const files = await invoke<FileEntry[]>("list_workspace_entries", { relativePath: null });
      setEntries(files);
      const git = await invoke<GitStatusSummary>("get_git_status");
      setGitStatus(git);
      // Reload provider config from workspace
      const cfg = await invoke<ProviderConfig>("get_provider_config");
      setProviderConfig(cfg);
      setSettingsForm({ kind: cfg.kind, baseUrl: cfg.baseUrl, modelId: cfg.modelId, apiKey: '' });
      // Auto-probe provider readiness
      try {
        const health = await invoke<ProviderHealthResult>("check_provider_health");
        setProviderHealth(health);
      } catch {}
    } catch (e) { notify(`Failed to open workspace: ${e}`, 'error'); }
  };

  const openFile = async (path: string) => {
    try {
      const result = await invoke<FileReadResult>("read_workspace_file", { path });
      setActiveFile({ path, content: result.content });
      setViewMode('editor');
    } catch (e) { notify(`Read failed: ${e}`, 'error'); }
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
    try { const updatedPlan = await invoke<ExecutionPlan>("update_plan_status", { planId: activePlan.id, status }); setActivePlan(updatedPlan);    } catch (e) { notify(`Update failed: ${e}`, 'error'); }
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
      else if (rec.status === 'applied') { setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Step completed. Ready for Verification.", source: 'system' }]); }
    } catch (e) { setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `Action failed: ${e}`, source: 'system' }]); }
  };

  const handlePatchDecision = async (approved: boolean) => {
    if (!execState || !activePatch) return;
    try {
      const updatedSt = await invoke<ExecutionState>("submit_patch_decision", { execState, patchId: activePatch.id, approved });
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `Patch ${approved ? 'approved & applied' : 'rejected'}`, source: 'system' }]);
      setActivePatch(null); setExecState(updatedSt);
      if (approved && !repairState) { 
        setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Step applied. Verifier handover available.", source: 'system' }]);
      }
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
      const req: BrowserActionRequest = { 
        id: actionId,
        kind, 
        value: val 
      };
      
      setTimeline(prev => [...prev, { 
        timestamp: new Date().toLocaleTimeString(), 
        message: `Browser Action dispatched: ${kind} (${val})`, 
        source: 'browser' 
      }]);
      const result = await invoke<BrowserActionResult>("execute_browser_action", { action: req });
      
      if (result.success) {
        setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `OK: ${result.message}`, source: 'browser' }]);
        if (result.screenshotBase64) {
          setLastScreenshot(result.screenshotBase64);
        }
      } else {
        setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `ERROR: ${result.message}`, source: 'browser' }]);
      }
      
      setBrowserAction("");
      // Update state after action
      await syncBrowserState();
    } catch (e) { notify(`Browser error: ${e}`, 'error'); }
  };

  const launchBrowserSession = async () => {
    try {
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Launching browser session...", source: 'browser' }]);
      const state = await invoke<BrowserSessionState>("browser_launch_session");
      setBrowserSession(state);
      setTimeline(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: "Browser ready.", source: 'browser' }]);
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

  const syncBrowserState = async () => {
    try {
      const state = await invoke<BrowserSessionState>("browser_get_session_state");
      setBrowserSession(state);
    } catch {}
  };

  // ---- Provider Settings ----
  const saveProviderSettings = async () => {
    try {
      const cfg = await invoke<ProviderConfig>("save_provider_config", {
        config: { kind: settingsForm.kind, baseUrl: settingsForm.baseUrl, modelId: settingsForm.modelId, apiKeySet: settingsForm.apiKey.length > 0 },
        apiKey: settingsForm.apiKey || null,
      });
      setProviderConfig(cfg);
      setSettingsForm(prev => ({ ...prev, apiKey: '' }));
      runHealthCheck();
    } catch (e) { notify(`Save configuration failed: ${e}`, 'error'); }
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

  const renderSidebarItem = (label: string, icon: any, currentMode: string, trigger?: () => void) => {
    const active = viewMode === currentMode;
    return (
      <div onClick={() => trigger ? trigger() : setViewMode(currentMode as any)}
        className={`flex items-center px-4 py-2.5 cursor-pointer text-xs font-semibold tracking-wide transition-all ${active ? 'border-l-2 border-blue-500 bg-neutral-900/80 text-blue-400' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'}`}>
        {icon} {label}
      </div>
    );
  };

  const providerBadge = providerHealth?.reachable
    ? (providerHealth.modelAvailable 
        ? <span className="flex items-center text-[10px] font-bold text-green-500 bg-green-900/20 px-2 py-1 rounded-full border border-green-900/30 shadow-[0_0_10px_rgba(34,197,94,0.1)] transition-all hover:scale-105 cursor-default"><Zap className="w-3 h-3 mr-1"/>{providerConfig?.modelId}</span>
        : <span className="flex items-center text-[10px] font-bold text-yellow-500 bg-yellow-900/20 px-2 py-1 rounded-full border border-yellow-900/30"><AlertTriangle className="w-3 h-3 mr-1"/>No Model</span>)
    : <span className="flex items-center text-[10px] font-bold text-red-500 bg-red-900/20 px-2 py-1 rounded-full border border-red-900/30 animate-pulse"><WifiOff className="w-3 h-3 mr-1"/>Disconnected</span>;

  return (
    <div className="flex h-screen w-full flex-col bg-neutral-950 text-neutral-50 overflow-hidden text-sm">
      <header className="flex h-12 w-full items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 shrink-0">
        <div className="flex items-center space-x-2 font-semibold tracking-tight text-neutral-300">
          <Zap className="w-4 h-4 text-blue-500" />
          <span className="text-white">Forge</span> <span className="text-neutral-500 font-normal">Desktop</span>
        </div>

        {/* Global Notification Banner */}
        {notification.visible && (
          <div className={`absolute top-14 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center animate-in slide-in-from-top-4 duration-300 ${
            notification.type === 'error' ? 'bg-red-950/40 border-red-900/50 text-red-200' :
            notification.type === 'success' ? 'bg-green-950/40 border-green-900/50 text-green-200' :
            'bg-blue-950/40 border-blue-900/50 text-blue-200'
          }`}>
            {notification.type === 'error' ? <AlertTriangle className="w-4 h-4 mr-3 text-red-400"/> :
             notification.type === 'success' ? <CheckCircle className="w-4 h-4 mr-3 text-green-400"/> :
             <Activity className="w-4 h-4 mr-3 text-blue-400"/>}
            <span className="text-sm font-medium mr-6">{notification.message}</span>
            <button onClick={() => setNotification(prev => ({ ...prev, visible: false }))} className="hover:text-white transition-colors">
              <X className="w-4 h-4"/>
            </button>
          </div>
        )}
        <div className="flex items-center space-x-3">
          {providerBadge}
          {!workspace ? (
            <div className="flex items-center space-x-2">
              <input value={wsInputPath} onChange={e => setWsInputPath(e.target.value)} placeholder="C:/Path/To/Repo"
                className="bg-neutral-950 border border-neutral-700 px-2 py-1 rounded text-xs" onKeyDown={e => e.key === 'Enter' && openWorkspace()} />
              <Button onClick={openWorkspace} className="h-7 text-xs py-1 px-3 bg-neutral-800 text-neutral-300 hover:bg-neutral-700">Connect</Button>
            </div>
          ) : (
            <div className="text-xs text-blue-400 flex items-center bg-blue-900/10 border border-blue-900/30 px-3 py-1.5 rounded-full font-medium">
              <Folder className="w-3 h-3 mr-2"/>{workspace.rootPath}
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 border-r border-neutral-800 bg-black flex flex-col pt-4 shrink-0">
          <div className="px-4 pb-2 text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Navigation</div>
          {renderSidebarItem("File Explorer", <Folder className="w-4 h-4 mr-3"/>, 'editor')}
          {renderSidebarItem("Execution Plan", <Map className="w-4 h-4 mr-3"/>, 'plan')}
          {renderSidebarItem("Active Context", <Activity className="w-4 h-4 mr-3"/>, 'executor')}
          {renderSidebarItem("Verifications", <CheckCircle className="w-4 h-4 mr-3"/>, 'verifier')}
          {renderSidebarItem("Browser Runtime", <Globe className="w-4 h-4 mr-3"/>, 'browser')}

          <div className="px-4 pt-6 pb-2 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">System</div>
          {renderSidebarItem("AI Provider", <Cpu className="w-4 h-4 mr-3"/>, 'settings')}
          {renderSidebarItem("Deploy Target", <Rocket className="w-4 h-4 mr-3"/>, 'deploy', prepareDeployment)}
        </aside>

        <main className="flex-1 flex flex-col bg-[#050505] relative overflow-y-auto">
          {viewMode === 'settings' ? (
            <div className="flex-1 pt-10 max-w-3xl mx-auto w-full px-8">
              <h2 className="text-3xl font-semibold mb-8 flex items-center border-b border-neutral-900 pb-4">
                <Server className="w-8 h-8 mr-4 text-blue-500"/> AI Provider Configuration
              </h2>

              {/* Health Banner */}
              {providerHealth && (
                <div className={`mb-6 p-4 rounded-xl border text-sm font-medium flex items-center ${providerHealth.reachable ? 'bg-green-950/20 border-green-900/30 text-green-400' : 'bg-red-950/20 border-red-900/30 text-red-400'}`}>
                  {providerHealth.reachable ? <Wifi className="w-5 h-5 mr-3"/> : <WifiOff className="w-5 h-5 mr-3"/>}
                  {providerHealth.message}
                </div>
              )}

              <div className="grid gap-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-5">Connection Settings</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-neutral-500 font-semibold mb-1.5">Provider Type</label>
                      <select value={settingsForm.kind} onChange={e => setSettingsForm(prev => ({ ...prev, kind: e.target.value as ProviderKind }))}
                        className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 outline-none focus:border-blue-500">
                        <option value="ollama">Ollama (Local)</option>
                        <option value="openai_compatible">OpenAI Compatible</option>
                        <option value="open_ai">OpenAI</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-500 font-semibold mb-1.5">Base URL</label>
                      <input value={settingsForm.baseUrl} onChange={e => setSettingsForm(prev => ({ ...prev, baseUrl: e.target.value }))}
                        className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 font-mono outline-none focus:border-blue-500" />
                    </div>

                    <div>
                      <label className="block text-xs text-neutral-500 font-semibold mb-1.5">Model ID</label>
                      <div className="flex space-x-2">
                        <input value={settingsForm.modelId} onChange={e => setSettingsForm(prev => ({ ...prev, modelId: e.target.value }))}
                          className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 font-mono outline-none focus:border-blue-500"
                          placeholder="e.g. llama3.2, gpt-4o, mistral" />
                        {availableModels.length > 0 && (
                          <select onChange={e => setSettingsForm(prev => ({ ...prev, modelId: e.target.value }))} className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 text-xs text-neutral-300">
                            <option value="">Select...</option>
                            {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        )}
                      </div>
                    </div>

                    {settingsForm.kind !== 'ollama' && (
                      <div>
                        <label className="block text-xs text-neutral-500 font-semibold mb-1.5">API Key {providerConfig?.apiKeySet && <span className="text-green-500 ml-2">(saved)</span>}</label>
                        <input value={settingsForm.apiKey} onChange={e => setSettingsForm(prev => ({ ...prev, apiKey: e.target.value }))}
                          type="password" placeholder={providerConfig?.apiKeySet ? "••••••• (update to change)" : "Enter API key"}
                          className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 outline-none focus:border-blue-500" />
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-3 mt-6">
                    <Button onClick={saveProviderSettings} className="bg-blue-600 hover:bg-blue-700 font-bold flex-1 justify-center">
                      <Check className="w-4 h-4 mr-2"/> Save Configuration
                    </Button>
                    <Button onClick={runHealthCheck} disabled={isCheckingHealth} className="bg-neutral-800 hover:bg-neutral-700 font-medium">
                      <RefreshCw className={`w-4 h-4 mr-2 ${isCheckingHealth ? 'animate-spin' : ''}`}/> Test Connection
                    </Button>
                  </div>
                </div>

                {/* Test Generation */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-5">Test Generation</h3>
                  <textarea value={testPrompt} onChange={e => setTestPrompt(e.target.value)}
                    placeholder="Type a test prompt to verify your model responds..."
                    className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 outline-none focus:border-blue-500 resize-none font-mono" rows={3} />
                  <Button onClick={runTestGeneration} disabled={!testPrompt} className="mt-3 bg-purple-600 hover:bg-purple-700 font-bold w-full justify-center">
                    <Zap className="w-4 h-4 mr-2"/> Generate
                  </Button>
                  {testResponse && (
                    <div className="mt-4 bg-black border border-neutral-800 rounded-lg p-4 text-xs font-mono text-blue-300 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {testResponse}
                    </div>
                  )}
                </div>
              </div>
            </div>

          ) : viewMode === 'deploy' && deployState ? (
            <div className="flex-1 flex flex-col pt-10 max-w-4xl mx-auto w-full">
              <h2 className="text-3xl font-semibold mb-8 flex items-center px-8 border-b border-neutral-900 pb-4">
                <Rocket className="w-8 h-8 mr-4 text-purple-500"/> Deployment Setup
              </h2>
              <div className="px-8 grid gap-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">Detected Architecture</h3>
                    <span className="bg-purple-900/20 text-purple-400 border border-purple-900/40 px-3 py-1 rounded text-xs uppercase font-bold tracking-wider">{deployState.targetKind.replace(/_/g, ' ')}</span>
                  </div>
                  <ul className="mt-3 space-y-2 list-disc pl-5">
                    {deployState.detectedRoots.map((d, i) => <li key={i} className="text-blue-300 font-mono text-xs">{d}</li>)}
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
                    <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold"><Play className="w-4 h-4 mr-2"/> Execute Deploy Chain</Button>
                  </div>
                  <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4 flex items-center"><ShieldAlert className="w-4 h-4 text-yellow-500 mr-2"/> Known Risks</h3>
                    <ul className="space-y-3">{deployState.risks.map((c, i) => <li key={i} className="text-xs text-neutral-400 bg-neutral-950 p-2 rounded">{c}</li>)}</ul>
                  </div>
                </div>
              </div>
            </div>

          ) : viewMode === 'browser' ? (
            <div className="flex-1 flex flex-col pt-6 max-w-5xl mx-auto w-full px-8 pb-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold flex items-center"><Globe className="w-6 h-6 mr-3 text-blue-400"/> Browser Runtime</h2>
                <div className="flex items-center space-x-3">
                  {browserSession?.status === 'ready' || browserSession?.status === 'busy' || browserSession?.status === 'navigating' ? (
                    <Button variant="outline" className="text-red-400 border-red-900/30 hover:bg-red-950/20" onClick={closeBrowserSession}><X className="w-4 h-4 mr-2"/> Stop Session</Button>
                  ) : (
                    <Button className="bg-blue-600 hover:bg-blue-700 font-bold" onClick={launchBrowserSession} disabled={!workspace}><Play className="w-4 h-4 mr-2"/> Launch Browser</Button>
                  )}
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    browserSession?.status === 'ready' ? 'bg-green-950/20 border-green-900/30 text-green-400' :
                    browserSession?.status === 'disconnected' ? 'bg-neutral-900 border-neutral-800 text-neutral-500' :
                    'bg-blue-950/20 border-blue-900/30 text-blue-400 animate-pulse'
                  }`}>
                    {browserSession?.status ?? 'disconnected'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Toolbar */}
                <div className="bg-neutral-900 border border-neutral-800 p-2 rounded-xl flex items-center space-x-2 shadow-2xl">
                  <div className="flex-1 flex items-center bg-black rounded-lg border border-neutral-800 px-4 py-2 focus-within:border-blue-500 transition-colors">
                    <Globe className="w-4 h-4 text-neutral-600 mr-3" />
                    <input 
                      className="flex-1 bg-transparent text-sm text-neutral-200 outline-none font-mono"
                      placeholder="Enter URL to navigate..." 
                      value={browserAction} 
                      onChange={e => setBrowserAction(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && triggerBrowserAction('open_url')}
                    />
                  </div>
                  <Button onClick={() => triggerBrowserAction('open_url')} className="bg-blue-600 h-10 w-20 justify-center" disabled={!browserSession || browserSession.status === 'disconnected'}>
                    Go
                  </Button>
                  <div className="h-6 w-px bg-neutral-800 mx-2" />
                  <Button variant="outline" className="h-10 px-3" onClick={() => triggerBrowserAction('capture_screenshot')} disabled={!browserSession || browserSession.status === 'disconnected'}>
                    <Code className="w-4 h-4" />
                  </Button>
                </div>

                {/* Main View */}
                <div className="grid grid-cols-[1fr_300px] gap-6 h-[500px]">
                  <div className="bg-black border border-neutral-800 rounded-2xl overflow-hidden relative group">
                    {lastScreenshot ? (
                      <img src={`data:image/png;base64,${lastScreenshot}`} className="w-full h-full object-contain" alt="Browser Viewport" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-neutral-700 bg-[radial-gradient(#111_1px,transparent_0)] [background-size:20px_20px]">
                        <Zap className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm font-medium opacity-40">No viewport data available</p>
                        <p className="text-xs opacity-30 mt-2">Launch a session and navigate to a URL to see content</p>
                      </div>
                    )}
                    
                    {browserSession?.currentTarget && (
                      <div className="absolute top-4 left-4 right-4 bg-black/80 backdrop-blur-md border border-neutral-800 p-3 rounded-lg flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center overflow-hidden mr-4">
                          <Layout className="w-4 h-4 text-blue-500 mr-3 shrink-0" />
                          <div className="truncate">
                            <p className="text-[10px] font-bold text-neutral-500 uppercase leading-none mb-1">Current Page</p>
                            <p className="text-xs text-neutral-300 truncate font-medium">{browserSession.currentTarget.title || 'Untitled'}</p>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-neutral-500 bg-neutral-900 px-2 py-1 rounded truncate max-w-[200px]">
                          {browserSession.currentTarget.url}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sidebar Log */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col overflow-hidden shadow-xl">
                    <div className="px-4 py-3 border-b border-neutral-800 bg-black/20 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center"><Terminal className="w-3 h-3 mr-2"/> Action Log</span>
                      <Button variant="ghost" className="h-6 w-6 p-0 text-neutral-600" onClick={() => setTimeline(prev => prev.filter(t => t.source !== 'browser'))}><RefreshCw className="w-3 h-3"/></Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px] leading-relaxed">
                      {timeline.filter(t => t.source === 'browser').length === 0 ? (
                        <div className="h-full flex items-center justify-center text-neutral-700 italic">No events yet</div>
                      ) : (
                        timeline.filter(t => t.source === 'browser').map((item, i) => (
                          <div key={i} className={`pb-2 border-b border-neutral-800/50 ${
                            item.message.includes('ERROR') ? 'text-red-400' : 
                            item.message.includes('OK') ? 'text-green-400' : 
                            item.message.includes('[System]') ? 'text-blue-400' : 'text-neutral-500'
                          }`}>
                            {item.message}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          ) : viewMode === 'verifier' && verState ? (
            <div className="flex-1 flex flex-col pt-10 max-w-4xl mx-auto w-full">
              <div className="flex items-center justify-between px-8 mb-6">
                <h2 className="text-2xl font-semibold flex items-center"><CheckCircle className="w-6 h-6 mr-3 text-purple-500"/> Verification Report</h2>
              </div>
              <div className="px-8 grid grid-cols-[1fr_380px] gap-6 flex-1 items-start">
                <div className="space-y-6">
                  <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Command Output</h3>
                    <div className="bg-black border border-neutral-800 rounded p-4 font-mono text-[11px] leading-loose text-neutral-400 whitespace-pre-wrap overflow-x-auto h-[200px]">{verState.stdout}</div>
                  </div>
                  {verState.findings.length > 0 && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
                      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Findings</h3>
                      {verState.findings.map((f, i) => (
                        <div key={i} className="bg-red-950/20 border border-red-900/30 p-4 rounded mb-2">
                          <span className="font-semibold text-red-400">{f.classification.replace(/_/g, ' ').toUpperCase()}</span>
                          <p className="text-neutral-300 text-sm mt-1 font-mono">{f.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!verState.findings.length && (
                    <div className="bg-green-950/20 border border-green-900/30 p-6 rounded text-center text-green-400">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2" /> All checks passed.
                    </div>
                  )}
                </div>
                <div>
                  {retryReq && (
                    <div className="bg-neutral-900/90 border border-neutral-800 p-5 rounded-xl shadow-2xl relative">
                      <h3 className="font-bold text-yellow-500 uppercase text-sm mb-4">Repair Available</h3>
                      <div className="bg-black/50 p-3 rounded border border-neutral-800 font-mono text-xs text-blue-300 mb-4">{retryReq.suggestedScope}</div>
                      <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-neutral-950 font-bold justify-center" onClick={loadRepairState}>
                        <RefreshCw className="w-4 h-4 mr-2"/> Begin Repair
                      </Button>
                    </div>
                  )}
                  {!retryReq && verState.status === 'passed' && (
                    <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                      <h3 className="font-bold text-green-500 uppercase text-sm mb-4">Continue</h3>
                      <Button className="w-full justify-center bg-blue-600 font-bold" onClick={prepareDeployment}>
                        Next Stage <ArrowRight className="w-4 h-4 ml-2"/>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

          ) : viewMode === 'executor' ? (
            <div className="flex-1 flex flex-col pt-8 max-w-4xl mx-auto w-full">
              <div className="flex items-center justify-between px-8 mb-6">
                <h2 className="text-2xl font-semibold flex items-center"><Activity className="w-6 h-6 mr-3 text-blue-500"/> Execution</h2>
                {execState && execState.status === 'ready' && !activePatch && (
                  <Button className="bg-purple-600 hover:bg-purple-700 font-medium" onClick={startVerification}><CheckCircle className="w-4 h-4 mr-2"/> Verify</Button>
                )}
              </div>
              {activePatch ? (
                <div className="px-8 flex-1">
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden mt-4">
                    <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center text-yellow-500 font-semibold text-sm"><ShieldAlert className="w-4 h-4 mr-2"/> Patch Proposal</div>
                      <span className="text-xs text-neutral-400 font-mono">{activePatch.targetFile}</span>
                    </div>
                    {repairState && (
                      <div className="px-4 py-2 bg-yellow-900/20 text-yellow-300 text-xs font-mono font-bold border-b border-yellow-900/40">
                        REPAIR ATTEMPT #{repairState.attemptNumber}
                      </div>
                    )}
                    <div className="p-4 border-b border-neutral-800 text-sm text-neutral-300"><strong>Rationale:</strong> {activePatch.rationale}</div>
                    <div className="p-4 bg-black overflow-x-auto text-xs font-mono text-green-400 leading-relaxed"><pre>{activePatch.diffContent}</pre></div>
                    <div className="p-4 flex justify-end space-x-3 bg-neutral-900 border-t border-neutral-800">
                      <Button className="bg-red-600 hover:bg-red-700" onClick={() => handlePatchDecision(false)}><X className="w-4 h-4 mr-2"/> Reject</Button>
                      <Button className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20" onClick={() => handlePatchDecision(true)}><Check className="w-4 h-4 mr-2"/> Approve</Button>
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
                      <div className="text-center"><Activity className="w-10 h-10 mx-auto text-blue-500/50 mb-4"/><p className="text-neutral-500 text-xs uppercase">Processing...</p></div>
                    </div>
                  )}
                </div>
              )}
              <div className="h-64 border-t border-neutral-900 bg-[#0a0a0a] flex flex-col shrink-0 mt-8">
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

          ) : viewMode === 'plan' && activePlan ? (
            <div className="p-10 max-w-4xl mx-auto w-full">
              <h2 className="text-3xl font-semibold tracking-tight text-white flex items-center mb-8"><Map className="w-6 h-6 mr-3 text-blue-500"/> Execution Plan</h2>
              <div className="mb-8">
                {activePlan.steps.map((step, i) => (
                  <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 mb-4 hover:border-neutral-700 transition-colors">
                    <div className="font-semibold text-neutral-200 text-base"><span className="text-neutral-600 font-mono mr-3">{String(i+1).padStart(2,'0')}</span>{step.title}</div>
                    <p className="text-neutral-400 text-sm ml-9 mt-2">{step.objective}</p>
                  </div>
                ))}
              </div>
              {activePlan.status === 'ready_for_review' ? (
                <div className="sticky bottom-6 bg-neutral-900/90 backdrop-blur border border-neutral-800 p-5 rounded-2xl flex items-center justify-between shadow-2xl">
                  <div className="text-sm font-semibold text-white">Ready for approval</div>
                  <Button className="bg-green-600 hover:bg-green-700 text-white font-bold" onClick={() => setPlanApproval('approved')}><Check className="w-5 h-5 mr-2"/> Approve Plan</Button>
                </div>
              ) : activePlan.status === 'approved' ? (
                <div className="sticky bottom-6 bg-neutral-900/90 backdrop-blur border border-neutral-800 p-5 rounded-2xl flex items-center justify-between shadow-2xl">
                  <div className="text-sm font-bold text-green-400 flex items-center"><CheckCircle className="w-5 h-5 mr-2"/> Plan Approved</div>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={startExecution}><Play className="w-4 h-4 mr-2"/> Execute</Button>
                </div>
              ) : null}
            </div>

          ) : viewMode === 'editor' && activeFile ? (
            <textarea className="flex-1 w-full p-6 bg-transparent resize-none outline-none font-mono text-[13px] leading-loose text-neutral-300" value={activeFile.content} readOnly />
          ) : !workspace ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-gradient-to-b from-transparent to-blue-900/5">
              <div className="max-w-xl w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
                <div className="relative inline-block">
                  <div className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
                  <Rocket className="w-20 h-20 mx-auto text-blue-500 relative" />
                </div>
                <div>
                  <h1 className="text-5xl font-bold tracking-tighter text-white mb-4 italic">FORGE</h1>
                  <p className="text-neutral-400 text-lg leading-relaxed">Local-first, native AI software engineering agent. Deep workspace integration without cloud boundaries.</p>
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
                       <Button onClick={openWorkspace} className="px-6 font-bold bg-blue-600 hover:bg-blue-500" disabled={!wsInputPath}>Initialize</Button>
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
                         <button key={i} onClick={() => setTaskIntent(item.title)} className="flex items-center p-3 rounded-lg bg-neutral-950 border border-neutral-900 hover:border-blue-500/50 hover:bg-blue-950/10 text-neutral-400 hover:text-blue-300 transition-all text-sm group">
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
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-neutral-500">
              <div className="text-center opacity-50">
                <Zap className="w-12 h-12 mx-auto text-neutral-600 mb-6"/>
                <p className="text-sm font-mono tracking-widest uppercase">Forge Ready</p>
                <p className="text-xs text-neutral-600 mt-2">Connect a workspace and configure your AI provider to begin.</p>
              </div>
            </div>
          )}
        </main>

        <aside className="w-80 border-l border-neutral-800 bg-[#050505] flex flex-col shadow-xl z-10 shrink-0">
          <div className="flex h-12 items-center px-6 shrink-0 border-b border-neutral-900">
            <span className="text-xs font-bold tracking-widest text-neutral-500 uppercase flex items-center"><Terminal className="w-4 h-4 mr-2 text-blue-500"/> Agent</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
            {/* Provider mode indicator */}
            <div className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between ${providerHealth?.reachable ? 'bg-green-950/20 border-green-900/30 text-green-400' : 'bg-yellow-950/20 border-yellow-900/30 text-yellow-400'}`}>
              <div className="flex items-center">
                {providerHealth?.reachable ? <Wifi className="w-3.5 h-3.5 mr-2"/> : <WifiOff className="w-3.5 h-3.5 mr-2"/>}
                {providerHealth?.reachable ? 'Live' : 'Mock'} Mode
              </div>
              <span className="font-mono text-[10px] opacity-70">{providerConfig?.modelId ?? 'echo'}</span>
            </div>
            {isPlanning && <div className="text-xs font-mono text-neutral-500 animate-pulse">Planning...</div>}
            <div className="text-xs text-neutral-400 leading-relaxed bg-neutral-900/50 p-4 rounded-xl border border-neutral-800">
              Describe a task. Forge will plan, execute, verify, and repair using your {providerHealth?.reachable ? 'configured' : 'mock'} AI provider.
            </div>
          </div>
          <div className="p-6 bg-neutral-900 border-t border-neutral-800 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
            <textarea placeholder="Describe your task..." className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 outline-none focus:border-blue-500 resize-none font-mono" value={taskIntent} onChange={e => setTaskIntent(e.target.value)} rows={4} />
            <Button variant="primary" className="w-full mt-4 h-10 font-bold" onClick={submitTask} disabled={!taskIntent || !workspace || isPlanning}>
              Submit Task
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
