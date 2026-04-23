import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  Circle,
  Code2,
  Cpu,
  ExternalLink,
  FileCode2,
  Folder,
  Globe2,
  Home,
  Layers3,
  Loader2,
  Lock,
  Pause,
  Play,
  Rocket,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  Wand2,
  X,
} from 'lucide-react';
import type {
  AppBootData,
  BrowserActionRequest,
  BrowserActionResult,
  BrowserSessionState,
  CodraShellData,
  ExecutionPlan,
  PlanStatus,
  ProviderConfig,
  ProviderHealthResult,
  ProviderKind,
  RuntimeMode,
  SafetyMode,
  TaskRequest,
  TimelineEvent,
  ToolDefinition,
  WorkspaceSummary,
} from '@codra/shared';
import { useNotify } from './context/NotificationContext';
import logo from './assets/codra-icon-only.png';
import './App.css';

type ViewMode = 'home' | 'agent' | 'code' | 'browser' | 'deploy' | 'settings';
type UtilityTab = 'terminal' | 'logs' | 'activity' | 'timeline';
type RightTab = 'context' | 'memory';

const primaryNav = [
  { id: 'home', label: 'Home', icon: Home, items: ['Overview'] },
  { id: 'agent', label: 'Agent', icon: Bot, items: ['New Task', 'Tasks'] },
  { id: 'code', label: 'Code', icon: Code2, items: ['Files', 'Search', 'Extensions'] },
  { id: 'browser', label: 'Browser', icon: Globe2, items: ['Live Browser'] },
  { id: 'deploy', label: 'Deploy', icon: Rocket, items: ['Prep & Deploy'] },
  { id: 'settings', label: 'Settings', icon: Settings, items: ['Models', 'Workspace', 'Preferences'] },
] as const;

function compactPath(path?: string) {
  if (!path) return '~/projects/no-workspace';
  return path.replace(/^([A-Za-z]:)?\\Users\\[^\\]+\\/, '~/').replaceAll('\\', '/');
}

function statusTone(status?: string) {
  if (!status) return 'text-zinc-400 bg-zinc-800/70 border-zinc-700/80';
  if (['connected', 'passed', 'completed', 'ready', 'running'].some((v) => status.includes(v))) return 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20';
  if (['failed', 'blocked', 'error'].some((v) => status.includes(v))) return 'text-rose-300 bg-rose-500/10 border-rose-400/20';
  return 'text-violet-200 bg-violet-500/10 border-violet-400/20';
}

function StatusPill({ children, status }: { children: string; status?: string }) {
  return <span className={`rounded-md border px-2 py-1 text-[11px] font-medium ${statusTone(status)}`}>{children}</span>;
}

function App() {
  const { notify } = useNotify();
  const taskInputRef = useRef<HTMLInputElement | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [activeSubitem, setActiveSubitem] = useState('Overview');
  const [utilityTab, setUtilityTab] = useState<UtilityTab>('terminal');
  const [rightTab, setRightTab] = useState<RightTab>('context');

  const [workspace, setWorkspace] = useState<WorkspaceSummary | undefined>();
  const [workspaceInput, setWorkspaceInput] = useState('');
  const [provider, setProvider] = useState<ProviderConfig | undefined>();
  const [providerHealth, setProviderHealth] = useState<ProviderHealthResult | undefined>();
  const [activePlan, setActivePlan] = useState<ExecutionPlan | undefined>();
  const [browser, setBrowser] = useState<BrowserSessionState | undefined>();
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [terminalOutput, setTerminalOutput] = useState('Codra Terminal\nReady.');

  const [taskIntent, setTaskIntent] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [isAgentPaused, setIsAgentPaused] = useState(false);
  const [browserUrl, setBrowserUrl] = useState('https://example.com');

  const [settingsForm, setSettingsForm] = useState({
    kind: 'ollama' as ProviderKind,
    baseUrl: 'http://localhost:11434',
    modelId: 'llama3.2',
    apiKey: '',
  });

  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('balanced');
  const [safetyMode, setSafetyMode] = useState<SafetyMode>('workspace_write');

  const completedSteps = activePlan?.steps.filter((step) => step.status === 'completed').length ?? 0;
  const totalSteps = activePlan?.steps.length ?? 0;
  const progress = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const relevantFiles = useMemo(() => {
    const files = activePlan?.steps.flatMap((step) => step.filesLikelyInvolved).filter(Boolean) ?? [];
    return [...new Set(files)].slice(0, 8);
  }, [activePlan]);

  const recentTimeline = useMemo(
    () => (timeline.length ? timeline : [{ id: 'idle', source: 'system', title: 'Idle', message: 'Waiting for task input.', status: 'idle', timestamp: new Date().toISOString() }]),
    [timeline],
  );

  useEffect(() => {
    void boot();
  }, []);

  async function boot() {
    try {
      const bootData = await invoke<AppBootData>('get_app_boot_data');
      if (bootData.lastWorkspace) {
        setWorkspace(bootData.lastWorkspace);
        setWorkspaceInput(bootData.lastWorkspace.rootPath);
      }
      if (bootData.providerConfig) {
        setProvider(bootData.providerConfig);
        setSettingsForm({
          kind: bootData.providerConfig.kind,
          baseUrl: bootData.providerConfig.baseUrl,
          modelId: bootData.providerConfig.modelId,
          apiKey: '',
        });
      }
      if (bootData.activePlan) setActivePlan(bootData.activePlan);
      if (bootData.runtimeMode) setRuntimeMode(bootData.runtimeMode);
      if (bootData.safetyMode) setSafetyMode(bootData.safetyMode);
      if (bootData.timeline) setTimeline(bootData.timeline);
      await refreshShell();
    } catch {
      await refreshShell();
    }
  }

  async function refreshShell() {
    try {
      const data = await invoke<CodraShellData>('get_codra_shell_data');
      setWorkspace(data.workspace);
      setProvider(data.provider);
      setProviderHealth(data.providerHealth);
      setActivePlan(data.activePlan);
      setBrowser(data.browser);
      setTools(data.tools);
      setRuntimeMode(data.runtimeMode);
      setSafetyMode(data.safetyMode);
      if (data.timeline.length) setTimeline(data.timeline);
    } catch {
      try {
        setTools(await invoke<ToolDefinition[]>('list_registered_tools'));
      } catch {}
    }
  }

  function addLocalTimeline(title: string, message: string, source: TimelineEvent['source'] = 'system') {
    setTimeline((events) => [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source,
        title,
        message,
        status: 'running',
      },
      ...events,
    ]);
  }

  async function openWorkspace() {
    if (!workspaceInput.trim()) {
      notify('Enter a workspace path first.', 'warning');
      return;
    }
    try {
      const summary = await invoke<WorkspaceSummary>('open_workspace', { path: workspaceInput.trim() });
      setWorkspace(summary);
      notify('Workspace connected', 'success');
      addLocalTimeline('Workspace', `Connected to ${summary.rootPath}`);
      await refreshShell();
    } catch (error) {
      notify(`Workspace open failed: ${String(error)}`, 'error');
    }
  }

  async function submitTask() {
    if (!taskIntent.trim()) {
      notify('Describe a task first.', 'warning');
      return;
    }
    setIsPlanning(true);
    setViewMode('agent');
    setActiveSubitem('New Task');
    try {
      const request: TaskRequest = { id: crypto.randomUUID(), intent: taskIntent.trim(), mode: 'auto' };
      const plan = await invoke<ExecutionPlan>('submit_task_for_planning', { request });
      const readyPlan = await invoke<ExecutionPlan>('update_plan_status', { planId: plan.id, status: 'ready_for_review' satisfies PlanStatus });
      setActivePlan(readyPlan);
      setTaskIntent('');
      notify('Plan ready for review', 'success');
      addLocalTimeline('Planner', `Created plan ${readyPlan.title}`, 'planner');
    } catch (error) {
      notify(`Planning failed: ${String(error)}`, 'error');
    } finally {
      setIsPlanning(false);
    }
  }

  async function updatePlan(status: PlanStatus) {
    if (!activePlan) {
      notify('No active plan.', 'warning');
      return;
    }
    try {
      const updated = await invoke<ExecutionPlan>('update_plan_status', { planId: activePlan.id, status });
      setActivePlan(updated);
      notify(`Plan ${status.replaceAll('_', ' ')}`, 'success');
      addLocalTimeline('Plan Review', `Plan marked ${status.replaceAll('_', ' ')}`, 'planner');
    } catch (error) {
      notify(`Plan update failed: ${String(error)}`, 'error');
    }
  }

  async function startExecution() {
    if (!activePlan) {
      notify('No active plan to execute.', 'warning');
      return;
    }
    try {
      const execution = await invoke('start_execution', { plan: activePlan });
      addLocalTimeline('Executor', `Execution started: ${JSON.stringify(execution)}`, 'executor');
      notify('Execution started', 'success');
      await refreshShell();
    } catch (error) {
      notify(`Execution failed: ${String(error)}`, 'error');
    }
  }

  async function runHealthCheck() {
    try {
      const health = await invoke<ProviderHealthResult>('check_provider_health');
      setProviderHealth(health);
      notify(health.message, health.reachable ? 'success' : 'warning');
      addLocalTimeline('Provider', health.message, 'provider');
    } catch (error) {
      notify(`Health check failed: ${String(error)}`, 'error');
    }
  }

  async function saveProviderSettings() {
    try {
      const config = {
        kind: settingsForm.kind,
        baseUrl: settingsForm.baseUrl,
        modelId: settingsForm.modelId,
        apiKeySet: settingsForm.apiKey.length > 0,
        profileId: 'default',
        profileName: 'Default',
      };
      const saved = await invoke<ProviderConfig>('save_provider_config', { config, apiKey: settingsForm.apiKey || null });
      setProvider(saved);
      setSettingsForm((current) => ({ ...current, apiKey: '' }));
      addLocalTimeline('Provider', `Saved provider ${saved.kind} / ${saved.modelId}`, 'provider');
      await runHealthCheck();
    } catch (error) {
      notify(`Provider save failed: ${String(error)}`, 'error');
    }
  }

  async function launchBrowser() {
    try {
      setBrowser(await invoke<BrowserSessionState>('browser_launch_session'));
      setViewMode('browser');
      setActiveSubitem('Live Browser');
      notify('Browser session ready', 'success');
      addLocalTimeline('Browser', 'Session launched', 'browser');
    } catch (error) {
      notify(`Browser launch failed: ${String(error)}`, 'error');
    }
  }

  async function closeBrowser() {
    try {
      setBrowser(await invoke<BrowserSessionState>('browser_close_session'));
      notify('Browser session closed', 'info');
      addLocalTimeline('Browser', 'Session closed', 'browser');
    } catch (error) {
      notify(`Browser close failed: ${String(error)}`, 'error');
    }
  }

  async function navigateBrowser() {
    if (!browserUrl.trim()) {
      notify('Enter a URL first.', 'warning');
      return;
    }
    try {
      const action: BrowserActionRequest = { id: crypto.randomUUID(), kind: 'open_url', value: browserUrl.trim() };
      const result = await invoke<BrowserActionResult>('execute_browser_action', { action });
      notify(result.message, result.success ? 'success' : 'warning');
      setBrowser(await invoke<BrowserSessionState>('browser_get_session_state'));
      addLocalTimeline('Browser', `Navigate to ${browserUrl}`, 'browser');
    } catch (error) {
      notify(`Browser navigation failed: ${String(error)}`, 'error');
    }
  }

  async function captureBrowser() {
    try {
      const action: BrowserActionRequest = { id: crypto.randomUUID(), kind: 'capture_screenshot', value: '' };
      const result = await invoke<BrowserActionResult>('execute_browser_action', { action });
      notify(result.message, result.success ? 'success' : 'warning');
      setBrowser(await invoke<BrowserSessionState>('browser_get_session_state'));
      addLocalTimeline('Browser', 'Screenshot captured', 'browser');
    } catch (error) {
      notify(`Browser action failed: ${String(error)}`, 'error');
    }
  }

  async function runCargoCheck() {
    try {
      const result = await invoke<{ stdout: string; stderr: string; exitCode: number }>('run_workspace_command', {
        request: { command: 'cargo', args: ['check', '--workspace'] },
      });
      setTerminalOutput(`${result.stdout}\n${result.stderr}`.trim() || `Command exited ${result.exitCode}`);
      setUtilityTab('terminal');
      addLocalTimeline('Verifier', `cargo check exited ${result.exitCode}`, 'verifier');
    } catch (error) {
      notify(`cargo check failed: ${String(error)}`, 'error');
    }
  }

  function togglePause() {
    setIsAgentPaused((v) => !v);
    addLocalTimeline('Agent', isAgentPaused ? 'Agent resumed' : 'Agent paused', 'executor');
  }

  function handleGlobalSearch() {
    setUtilityTab('timeline');
    taskInputRef.current?.focus();
    notify('Focused task command input.', 'info');
  }

  function handleNavChange(mode: ViewMode, subitem: string) {
    setViewMode(mode);
    setActiveSubitem(subitem);
    addLocalTimeline('Navigation', `${mode.toUpperCase()} / ${subitem}`);
  }

  const utilityContent = useMemo(() => {
    if (utilityTab === 'terminal') return terminalOutput || 'Codra Terminal\nReady for approved workspace commands.';
    if (utilityTab === 'logs') return providerHealth?.message ?? 'No provider log output yet.';
    if (utilityTab === 'activity') return recentTimeline.map((e) => `${e.timestamp.slice(11, 19)}  ${e.title}: ${e.message}`).join('\n');
    return recentTimeline.map((e) => `${e.timestamp.slice(11, 19)}  [${e.source}] ${e.title}: ${e.message}`).join('\n');
  }, [utilityTab, terminalOutput, providerHealth?.message, recentTimeline]);

  return (
    <div className="codra-shell h-screen w-screen overflow-hidden bg-[#060910] text-zinc-100">
      <div className="grid h-full grid-cols-[210px_324px_minmax(540px,1fr)_380px] grid-rows-[48px_minmax(0,1fr)_44px]">
        <aside className="row-span-3 border-r border-white/[0.08] bg-[#070c14]/98 px-3 py-3">
          <div className="mb-4 flex items-center gap-3 px-2">
            <img src={logo} alt="Codra" className="h-8 w-8" />
            <div>
              <div className="text-[34px] font-semibold leading-7 tracking-tight">Codra</div>
            </div>
          </div>
          <nav className="space-y-1">
            {primaryNav.map((group) => {
              const Icon = group.icon;
              const active = viewMode === group.id;
              return (
                <div key={group.id} className="rounded-md">
                  <button
                    onClick={() => handleNavChange(group.id, group.items[0])}
                    className={`flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm transition ${
                      active ? 'bg-violet-600/85 text-white' : 'text-zinc-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {group.label}
                  </button>
                  <div className="ml-8 mt-1 space-y-1">
                    {group.items.map((item) => (
                      <button
                        key={item}
                        onClick={() => handleNavChange(group.id, item)}
                        className={`flex h-6 w-full items-center gap-2 rounded px-2 text-xs transition ${
                          activeSubitem === item ? 'text-zinc-100 bg-white/[0.05]' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Lock className="h-3 w-3" />
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="mt-6 rounded-md border border-white/[0.08] bg-[#101722] p-3">
            <div className="text-sm font-semibold">Codra Core</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {isAgentPaused ? 'Paused' : 'Running'}
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">v0.1.0</div>
          </div>
          <div className="mt-4 flex items-center gap-2 px-2 text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            {safetyMode.replaceAll('_', ' ')}
          </div>
          <div className="mt-2 flex items-center gap-2 px-2 text-xs text-zinc-500">
            <Layers3 className="h-3.5 w-3.5" />
            {runtimeMode.replaceAll('_', ' ')}
          </div>
          <div className="mt-2 flex items-center gap-2 px-2 text-xs text-zinc-500">
            <Wand2 className="h-3.5 w-3.5" />
            {tools.length} tools
          </div>
        </aside>
        <header className="col-span-3 flex items-center justify-between border-b border-white/[0.08] bg-[#070b12] px-4">
          <div className="mx-auto flex h-7 min-w-[380px] items-center justify-between rounded-md border border-white/[0.06] bg-[#111724] px-3 text-xs text-zinc-300">
            <span className="font-medium">{compactPath(workspace?.rootPath)}</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={providerHealth?.status}>{providerHealth?.status ?? 'mock'}</StatusPill>
            <button onClick={handleGlobalSearch} className="rounded-md border border-white/[0.08] bg-white/[0.04] p-1.5 text-zinc-300"><Search className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('settings')} className="rounded-md border border-white/[0.08] bg-white/[0.04] p-1.5 text-zinc-300"><Settings className="h-4 w-4" /></button>
          </div>
        </header>
        <section className="border-r border-white/[0.08] bg-[#090e16]">
          <div className="flex h-full flex-col">
            <div className="border-b border-white/[0.08] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Current Task</div>
                <StatusPill status={activePlan?.status}>{activePlan?.status?.replaceAll('_', ' ') ?? 'in progress'}</StatusPill>
              </div>
              <h1 className="text-[27px] font-semibold leading-8 text-white">{activePlan?.title ?? 'Implement authentication flow with verification and reset'}</h1>
              <p className="mt-2 text-sm leading-5 text-zinc-400">{activePlan?.objective ?? 'Build complete auth flow with planning, edits, verification, and repair visibility.'}</p>
            </div>
            <div className="border-b border-white/[0.08] p-4">
              <div className="mb-3 flex items-center justify-between text-sm"><span className="font-semibold">Plan</span><span className="text-zinc-500">{completedSteps}/{totalSteps} steps completed</span></div>
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-violet-500" style={{ width: `${progress}%` }} /></div>
              <div className="space-y-1.5">
                {(activePlan?.steps ?? []).slice(0, 7).map((step, index) => (
                  <button key={step.id} onClick={() => addLocalTimeline('Plan Step', `Opened ${step.title}`, 'planner')} className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm ${step.status === 'running' ? 'bg-violet-500/15 text-violet-100' : 'text-zinc-400 hover:bg-white/[0.04]'}`}>
                    {step.status === 'completed' ? <Check className="mt-0.5 h-4 w-4 text-emerald-400" /> : <Circle className="mt-1 h-3.5 w-3.5" />}
                    <span>{index + 1}. {step.title}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-auto p-4">
              <div className="rounded-md border border-white/[0.08] bg-[#121926] p-3 text-sm">
                <div className="mb-2 font-semibold">Agent Status</div>
                <div className="space-y-2 text-xs text-zinc-400">
                  <div className="flex justify-between"><span>Core</span><span className="text-emerald-300">{isAgentPaused ? 'Paused' : 'Running'}</span></div>
                  <div className="flex justify-between"><span>Provider</span><span className="text-zinc-200">{provider?.modelId ?? 'echo-mock'}</span></div>
                  <div className="flex justify-between"><span>Workspace</span><span className="max-w-[150px] truncate text-zinc-200">{compactPath(workspace?.rootPath)}</span></div>
                </div>
              </div>
              <button onClick={togglePause} className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-violet-600 text-sm font-semibold text-white hover:bg-violet-500">{isAgentPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{isAgentPaused ? 'Resume Agent' : 'Pause Agent'}</button>
            </div>
          </div>
        </section>
        <main className="flex min-w-0 flex-col overflow-hidden bg-[#070b12]">
          <div className="flex h-10 items-center justify-between border-b border-white/[0.08] bg-[#0d111a] px-2">
            <div className="flex h-full items-center">
              {(relevantFiles.length ? relevantFiles : ['auth.ts', 'auth.controller.ts', 'auth.service.ts', 'user.model.ts', 'db.ts']).slice(0, 5).map((file, index) => (
                <button key={file} onClick={() => addLocalTimeline('Editor', `Opened ${file}`, 'executor')} className={`flex h-full items-center gap-2 border-r border-white/[0.06] px-3 text-xs ${index === 0 ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <FileCode2 className="h-3.5 w-3.5" />{file}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => updatePlan('approved')} className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">Review Changes</button>
              <button onClick={startExecution} className="rounded-md border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-zinc-200">Apply</button>
              <button onClick={() => updatePlan('rejected')} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-zinc-300">Reject</button>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden font-mono text-[12px] leading-6">
            <div className="overflow-auto border-r border-white/[0.08] bg-[#150d1a] p-5 text-rose-200/90"><div className="mb-3 font-sans text-xs text-zinc-500">Before</div><pre>{activePlan ? activePlan.steps.map((step) => `- ${step.kind}: ${step.objective}`).join('\n') : 'No patch selected.'}</pre></div>
            <div className="overflow-auto bg-[#08160f] p-5 text-emerald-200/90"><div className="mb-3 font-sans text-xs text-zinc-500">After</div><pre>{activePlan ? activePlan.steps.map((step) => `+ ${step.title}\n  tools: ${step.requiredTools.join(', ') || 'context'}`).join('\n') : 'Connect workspace and submit task.'}</pre></div>
          </div>
          <div className="h-[220px] border-t border-white/[0.08] bg-[#090d14]">
            <div className="flex h-9 items-center gap-5 border-b border-white/[0.08] px-3 text-xs">
              {(['terminal', 'logs', 'activity', 'timeline'] as UtilityTab[]).map((tab) => <button key={tab} onClick={() => setUtilityTab(tab)} className={utilityTab === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}>{tab === 'activity' ? 'Agent Activity' : tab[0].toUpperCase() + tab.slice(1)}</button>)}
              <button onClick={runCargoCheck} className="ml-auto flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-zinc-300 hover:bg-white/[0.04]"><SquareTerminal className="h-3.5 w-3.5" />cargo check</button>
            </div>
            <div className="grid h-[calc(100%-36px)] grid-cols-2 overflow-hidden">
              <pre className="overflow-auto border-r border-white/[0.08] p-4 text-xs text-zinc-300">{utilityContent}</pre>
              <div className="overflow-auto p-4 text-xs text-zinc-400">{recentTimeline.map((event) => <button key={event.id} onClick={() => notify(`${event.title}: ${event.message}`, 'info')} className="mb-1.5 flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left hover:bg-white/[0.04]"><span className="truncate">{event.title}: {event.message}</span><span className="text-zinc-600">{event.timestamp.slice(11, 19)}</span></button>)}</div>
            </div>
          </div>
        </main>
        <section className="border-l border-white/[0.08] bg-[#090e16]">
          <div className="flex h-10 items-center gap-4 border-b border-white/[0.08] px-4 text-xs">
            <button onClick={() => setRightTab('context')} className={rightTab === 'context' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}>Context</button>
            <button onClick={() => setRightTab('memory')} className={rightTab === 'memory' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}>Memory</button>
          </div>
          <div className="space-y-4 overflow-auto p-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-semibold">Workspace<button onClick={() => setViewMode('settings')} className="rounded bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-zinc-300">Change</button></div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-zinc-400"><div className="font-medium text-zinc-100">{compactPath(workspace?.rootPath)}</div><div>{provider?.kind ?? 'mock'} / {provider?.modelId ?? 'echo-mock'}</div></div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">Relevant Files</div>
              <div className="space-y-1 rounded-md border border-white/[0.08] bg-white/[0.03] p-2">{(relevantFiles.length ? relevantFiles : ['src/features/auth/auth.ts', 'src/features/auth/auth.controller.ts', 'src/features/auth/auth.service.ts', 'src/models/user.model.ts', 'src/lib/db.ts']).slice(0, 5).map((file) => <button key={file} onClick={() => addLocalTimeline('Context', `Pinned ${file}`, 'research')} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"><FileCode2 className="h-3.5 w-3.5 text-violet-300" />{file}</button>)}</div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Web Research</span><button onClick={() => addLocalTimeline('Research', 'Research panel expanded', 'research')} className="h-4 w-7 rounded-full bg-violet-500" /></div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-zinc-400"><button onClick={() => notify('Research source list opened.', 'info')} className="mb-1 block text-left text-zinc-200 hover:text-white">Next.js authentication best practices 2024</button><button onClick={() => notify('Research source list opened.', 'info')} className="mb-1 block text-left text-zinc-200 hover:text-white">Email verification in Next.js applications</button><button onClick={() => notify('Research source list opened.', 'info')} className="block text-left text-zinc-200 hover:text-white">Password reset flow implementation</button></div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Browser</span><StatusPill status={browser?.status}>{browser?.status ?? 'disconnected'}</StatusPill></div>
              <div className="rounded-md border border-white/[0.08] bg-[#121722] p-3">
                <div className="mb-2 aspect-video rounded bg-[#263a78] p-3 text-xs text-white/80">{browser?.currentTarget?.title ?? 'Live Browser'}<br />{browser?.currentTarget?.url ?? 'No active target'}</div>
                <div className="mb-2 flex gap-2"><button onClick={launchBrowser} className="flex items-center gap-1 rounded bg-white/[0.06] px-2 py-1 text-xs hover:bg-white/[0.1]"><Play className="h-3.5 w-3.5" />Launch</button><button onClick={captureBrowser} className="rounded bg-white/[0.06] px-2 py-1 text-xs hover:bg-white/[0.1]">Screenshot</button><button onClick={closeBrowser} className="rounded bg-white/[0.06] px-2 py-1 text-xs hover:bg-white/[0.1]">Close</button></div>
                <div className="flex gap-2"><input value={browserUrl} onChange={(e) => setBrowserUrl(e.target.value)} placeholder="https://localhost:3000/login" className="h-7 flex-1 rounded border border-white/[0.08] bg-[#0f1520] px-2 text-[11px] outline-none" /><button onClick={navigateBrowser} className="rounded bg-violet-600 px-2 text-[11px] font-semibold text-white">Go</button></div>
              </div>
            </div>
            {rightTab === 'memory' && <div><div className="mb-2 text-sm font-semibold">Execution Memory</div><div className="rounded-md border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-zinc-400">Recovered local session state is loaded into this panel.</div></div>}
          </div>
        </section>
        <footer className="col-span-3 flex items-center gap-3 border-t border-white/[0.08] bg-[#070b12] px-4">
          <div className="flex h-9 flex-1 items-center rounded-md border border-white/[0.08] bg-[#111722] px-3">{isPlanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-violet-300" /> : <Sparkles className="mr-2 h-4 w-4 text-violet-300" />}<input ref={taskInputRef} value={taskIntent} onChange={(event) => setTaskIntent(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submitTask()} placeholder="Ask Codra to build, fix, or improve anything..." className="h-full flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500" /><button onClick={submitTask} className="rounded bg-violet-600 p-1.5 text-white"><Send className="h-4 w-4" /></button></div>
          <div className="flex items-center gap-2"><Folder className="h-4 w-4 text-zinc-500" /><input value={workspaceInput} onChange={(event) => setWorkspaceInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && openWorkspace()} placeholder="C:\\path\\to\\repo" className="h-9 w-64 rounded-md border border-white/[0.08] bg-[#111722] px-3 text-xs outline-none" /><button onClick={openWorkspace} className="h-9 rounded-md bg-white/[0.07] px-3 text-xs hover:bg-white/[0.12]">Connect</button></div>
          <button onClick={refreshShell} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />All Systems Operational<ExternalLink className="h-3.5 w-3.5" /></button>
        </footer>
      </div>
      {viewMode === 'settings' && (
        <div className="absolute right-4 top-16 z-20 w-[360px] rounded-md border border-white/[0.08] bg-[#10131b] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold"><div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-violet-300" />Provider Profile</div><button onClick={() => setViewMode('home')} className="rounded p-1 hover:bg-white/[0.06]"><X className="h-4 w-4" /></button></div>
          <div className="space-y-3 text-xs">
            <select value={settingsForm.kind} onChange={(event) => setSettingsForm((current) => ({ ...current, kind: event.target.value as ProviderKind }))} className="w-full rounded border border-white/[0.07] bg-[#080b12] p-2 outline-none">{(['ollama', 'openai_compatible', 'open_ai', 'anthropic', 'gemini', 'bedrock', 'vertex', 'mock'] as ProviderKind[]).map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select>
            <input value={settingsForm.baseUrl} onChange={(event) => setSettingsForm((current) => ({ ...current, baseUrl: event.target.value }))} className="w-full rounded border border-white/[0.07] bg-[#080b12] p-2 outline-none" placeholder="Base URL" />
            <input value={settingsForm.modelId} onChange={(event) => setSettingsForm((current) => ({ ...current, modelId: event.target.value }))} className="w-full rounded border border-white/[0.07] bg-[#080b12] p-2 outline-none" placeholder="Model" />
            <input value={settingsForm.apiKey} onChange={(event) => setSettingsForm((current) => ({ ...current, apiKey: event.target.value }))} className="w-full rounded border border-white/[0.07] bg-[#080b12] p-2 outline-none" placeholder="API key (never logged)" type="password" />
            <div className="grid grid-cols-2 gap-2"><button onClick={saveProviderSettings} className="rounded bg-violet-600 px-3 py-2 font-semibold text-white">Save</button><button onClick={runHealthCheck} className="rounded border border-white/[0.07] px-3 py-2">Health Check</button></div>
            {providerHealth && <div className="rounded border border-white/[0.07] bg-white/[0.04] p-2 text-zinc-400"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{providerHealth.message}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
