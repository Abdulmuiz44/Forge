import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@forge/ui';
import { Play, Folder, Terminal, Settings, Layout, Search, GitBranch, FileText, CheckCircle, ShieldAlert, Check, X, Code, ListTodo, Map, Activity, FileDiff, RefreshCw, AlertTriangle, Rocket, Wrench, Globe, ArrowRight, Cpu, Wifi, WifiOff, Zap, Server } from 'lucide-react';
import { WorkspaceSummary, FileEntry, GitStatusSummary, FileReadResult, ExecutionPlan, TaskRequest, PlanStatus, ExecutionState, StepExecutionRecord, PatchProposal, VerificationState, RetryRequest, RepairAttempt, DeployPrepSummary, BrowserActionRequest, BrowserActionResult, ProviderConfig, ProviderHealthResult, ProviderKind, ModelDescriptor, GenerationResponse } from '@forge/shared';

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
  const [journal, setJournal] = useState<string[]>([]);
  const journalEndRef = useRef<HTMLDivElement>(null);
  const [browserAction, setBrowserAction] = useState("");
  const [browserLog, setBrowserLog] = useState<string[]>([]);

  // Provider state
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealthResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelDescriptor[]>([]);
  const [settingsForm, setSettingsForm] = useState({ kind: 'ollama' as ProviderKind, baseUrl: 'http://localhost:11434', modelId: 'llama3.2', apiKey: '' });
  const [testPrompt, setTestPrompt] = useState("");
  const [testResponse, setTestResponse] = useState("");

  useEffect(() => { journalEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [journal]);

  useEffect(() => {
    invoke<ProviderConfig>("get_provider_config").then(cfg => {
      setProviderConfig(cfg);
      setSettingsForm({ kind: cfg.kind, baseUrl: cfg.baseUrl, modelId: cfg.modelId, apiKey: '' });
    }).catch(() => {});
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
    } catch (e) { alert(`Failed: ${e}`); }
  };

  const openFile = async (path: string) => {
    try {
      const result = await invoke<FileReadResult>("read_workspace_file", { path });
      setActiveFile({ path, content: result.content });
      setViewMode('editor');
    } catch (e) { alert(`Read failed: ${e}`); }
  };

  const submitTask = async () => {
    if (!taskIntent) return;
    setIsPlanning(true); setViewMode('plan');
    try {
      const req: TaskRequest = { id: crypto.randomUUID(), intent: taskIntent, mode: 'auto' };
      setJournal(prev => [...prev, `[System] Planning with ${providerHealth?.reachable ? 'live' : 'mock'} provider (${providerConfig?.kind ?? 'none'} / ${providerConfig?.modelId ?? 'echo'})`]);
      const plan = await invoke<ExecutionPlan>("submit_task_for_planning", { request: req });
      const reviewPlan = await invoke<ExecutionPlan>("update_plan_status", { planId: plan.id, status: 'ready_for_review' });
      setActivePlan(reviewPlan);
    } catch (e) { alert(`Planning failed: ${e}`); }
    finally { setIsPlanning(false); setTaskIntent(""); }
  };

  const setPlanApproval = async (status: PlanStatus) => {
    if (!activePlan) return;
    try { const updatedPlan = await invoke<ExecutionPlan>("update_plan_status", { planId: activePlan.id, status }); setActivePlan(updatedPlan); } catch (e) { alert(`Update failed: ${e}`); }
  };

  const startExecution = async () => {
    if (!activePlan || activePlan.status !== 'approved') return;
    try {
      setJournal(["[System] Bootstrapping execution context..."]); setViewMode('executor');
      const st = await invoke<ExecutionState>("start_execution", { plan: activePlan });
      setExecState(st); runStep(st, activePlan);
    } catch (e) { alert(`Execution start error: ${e}`); }
  };

  const runStep = async (currentState: ExecutionState, plan: ExecutionPlan) => {
    try {
      const rec = await invoke<StepExecutionRecord>("execute_step", { execState: currentState, plan });
      setJournal(prev => [...prev, ...rec.observations.map(o => `[${o.timestamp}] ${o.message}`)]);
      if (rec.status === 'awaiting_patch_review' && rec.pendingPatch) { setActivePatch(rec.pendingPatch); }
      else if (rec.status === 'completed') { setJournal(prev => [...prev, "[System] Step completed. Ready for Verification."]); }
    } catch (e) { setJournal(prev => [...prev, `[FATAL] Action failed: ${e}`]); }
  };

  const handlePatchDecision = async (approved: boolean) => {
    if (!execState || !activePatch) return;
    try {
      const updatedSt = await invoke<ExecutionState>("submit_patch_decision", { execState, patchId: activePatch.id, approved });
      setJournal(prev => [...prev, `[System] Patch ${approved ? 'approved & applied' : 'rejected'}`]);
      setActivePatch(null); setExecState(updatedSt);
      if (approved && !repairState) { setJournal(prev => [...prev, `[System] Step applied. Verifier handover available.`]); }
    } catch(e) { setJournal(prev => [...prev, `[Error] ${e}`]); }
  };

  const startVerification = async () => {
    if (!execState || !execState.currentStepId) return;
    try {
      setJournal(prev => [...prev, "[Verifier] Running checks..."]); setViewMode('verifier');
      const ver = await invoke<VerificationState>("start_verification", { executionId: execState.id, stepId: execState.currentStepId });
      setVerState(ver);
      if (ver.status === 'failed') {
        const proposal = await invoke<RetryRequest>("generate_retry_proposal", { verificationState: ver });
        setRetryReq(proposal); setJournal(prev => [...prev, `[Verifier] Tests failed. Retry available.`]);
      } else { setJournal(prev => [...prev, `[Verifier] All checks passed.`]); }
    } catch (e) { alert(`Verification Error: ${e}`); }
  };

  const loadRepairState = async () => {
    if (!retryReq) return;
    try {
      setJournal(prev => [...prev, `[Repair] Generating fix...`]); setViewMode('executor');
      const attempt = await invoke<RepairAttempt>("start_repair_attempt", { retryRequest: retryReq });
      setRepairState(attempt);
      if (attempt.proposedPatch) { setActivePatch(attempt.proposedPatch); }
    } catch (e) { alert(`Repair Init Error: ${e}`); }
  };

  const prepareDeployment = async () => {
    try {
      setJournal(prev => [...prev, "[Deploy] Evaluating workspace..."]); setViewMode('deploy');
      const deployReq = await invoke<DeployPrepSummary>("prepare_deployment");
      setDeployState(deployReq);
    } catch (e) { alert(`Deploy Error: ${e}`); }
  };

  const triggerBrowserAction = async () => {
    try {
      setViewMode('browser');
      const req: BrowserActionRequest = { actionKind: 'open_url', value: browserAction || 'https://localhost:3000' };
      const result = await invoke<BrowserActionResult>("execute_browser_action", { action: req });
      setBrowserLog(prev => [...prev, `[DOM] ${req.actionKind} -> ${result.message}`]); setBrowserAction("");
    } catch (e) { alert(`Browser failed: ${e}`); }
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
    } catch (e) { alert(`Save failed: ${e}`); }
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
    ? <span className="flex items-center text-[10px] font-bold text-green-500 bg-green-900/20 px-2 py-1 rounded-full border border-green-900/30"><Wifi className="w-3 h-3 mr-1"/>{providerConfig?.modelId}</span>
    : <span className="flex items-center text-[10px] font-bold text-neutral-500 bg-neutral-900 px-2 py-1 rounded-full border border-neutral-800"><WifiOff className="w-3 h-3 mr-1"/>No Model</span>;

  return (
    <div className="flex h-screen w-full flex-col bg-neutral-950 text-neutral-50 overflow-hidden text-sm">
      <header className="flex h-12 w-full items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 shrink-0">
        <div className="flex items-center space-x-2 font-semibold tracking-tight text-neutral-300">
          <Zap className="w-4 h-4 text-blue-500" />
          <span className="text-white">Forge</span> <span className="text-neutral-500 font-normal">Desktop</span>
        </div>
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
            <div className="flex-1 flex flex-col pt-10 max-w-4xl mx-auto w-full px-8">
              <h2 className="text-2xl font-semibold mb-6 flex items-center"><Globe className="w-6 h-6 mr-3 text-blue-400"/> Browser Runtime</h2>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col h-[500px]">
                <div className="flex space-x-2 border-b border-neutral-800 pb-4 mb-4 items-center">
                  <input className="flex-1 bg-black text-xs font-mono text-neutral-300 px-4 py-2 rounded outline-none border border-neutral-800 focus:border-blue-500"
                    placeholder="Action trigger..." value={browserAction} onChange={e => setBrowserAction(e.target.value)} onKeyDown={e => e.key === 'Enter' && triggerBrowserAction()} />
                  <Button onClick={triggerBrowserAction} className="bg-blue-600 hover:bg-blue-700"><ArrowRight className="w-4 h-4" /></Button>
                </div>
                <div className="bg-black/50 border border-neutral-800 flex-1 rounded flex items-center justify-center relative overflow-hidden">
                  <span className="text-neutral-600 absolute">Visual Layout Placeholder</span>
                  <div className="absolute inset-x-0 bottom-0 bg-neutral-900/90 border-t border-neutral-800 h-1/3 p-4 flex flex-col">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase flex items-center mb-2"><Code className="w-3 h-3 mr-1"/> CDP Traces</div>
                    <div className="flex-1 overflow-y-auto text-xs font-mono text-green-500 space-y-1">{browserLog.map((log, i) => <div key={i}>{log}</div>)}</div>
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
                <div className="flex h-8 items-center bg-neutral-900 border-b border-neutral-800 px-4 text-[10px] font-bold uppercase tracking-widest text-neutral-600">Operation Log</div>
                <div className="p-4 flex-1 overflow-y-auto font-mono text-[11px] whitespace-pre-wrap text-blue-300/80 leading-relaxed">
                  {journal.map((line, i) => <div key={i} className="mb-1">{line}</div>)}
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
