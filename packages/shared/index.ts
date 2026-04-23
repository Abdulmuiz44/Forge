// Shared types between frontend and backend representation
export interface AgentTask { id: string; title: string; status: 'PENDING' | 'RUNNING' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED'; description?: string; }
export interface WorkspaceSummary { id: string; rootPath: string; metadata?: Record<string, string>; }
export interface RepoSummary { workspaceId: string; name: string; }
export interface GitStatusSummary { isGit: boolean; branch?: string; changedFiles: number; }
export interface SearchQuery { pattern: string; directory?: string; }
export interface SearchMatch { path: string; lineNumber: number; preview: string; }
export interface FileReadResult { content: string; }
export interface FileWriteRequest { path: string; content: string; }
export interface FileWriteResult { success: boolean; checkpointId?: string; error?: string; }
export interface CommandExecutionRequest { command: string; args: string[]; }
export interface CommandExecutionResult { stdout: string; stderr: string; exitCode: number; }
export interface CheckpointRecord { id: string; workspaceId: string; timestamp: string; targetPath: string; operationType: string; status: string; }
export interface ApprovalRequirement { id: string; actionType: string; description: string; }
export interface ApprovalDecision { requirementId: string; approved: boolean; }
export interface FileEntry { name: string; path: string; isDirectory: boolean; }

// PLANNER ADDITIONS
export type PlanStatus = 'draft' | 'ready_for_review' | 'approved' | 'rejected' | 'superseded' | 'archived';
export type PlanningMode = 'auto' | 'interactive';
export type PlanStepStatus = 'pending' | 'running' | 'completed' | 'failed';
export type PlanStepKind = 'inspect' | 'search' | 'edit' | 'run_command' | 'verify' | 'git_review' | 'browser_task' | 'deploy_prep' | 'doc_update' | 'manual_input';
export interface TaskRequest { id: string; intent: string; mode: PlanningMode; }
export interface TaskContext { workspaceId: string; workspacePath: string; intent: string; recentSearches: string[]; recentFiles: string[]; }
export interface RiskItem { description: string; severity: 'low' | 'medium' | 'high'; }
export interface AssumptionItem { description: string; confidence: 'low' | 'medium' | 'high'; }
export interface PlanDependency { stepId: string; dependsOn: string; }
export interface PlanStep { id: string; kind: PlanStepKind; title: string; objective: string; status: PlanStepStatus; filesLikelyInvolved: string[]; requiredTools: string[]; }
export interface ArchitectureProposal { id: string; rationale: string; successCriteria: string[]; estimatedImpact: string; tradeoffs: string[]; touchedSubsystems: string[]; }
export interface ExecutionPlan { id: string; taskId: string; status: PlanStatus; title: string; objective: string; steps: PlanStep[]; dependencies: PlanDependency[]; assumptions: AssumptionItem[]; risks: RiskItem[]; architectureProposal?: ArchitectureProposal; }
export interface PlannerOutput { plan: ExecutionPlan; }
export interface PlannerDecision { requiresArchitecture: boolean; reason: string; }

// EXECUTOR ADDITIONS
export type ExecutionStatus = 'pending' | 'ready' | 'running' | 'waiting_for_approval' | 'paused' | 'blocked' | 'failed' | 'completed' | 'cancelled';
export type ExecutionMode = 'step_by_step' | 'autonomous';
export type StepExecutionStatus = 'not_started' | 'context_ready' | 'action_selected' | 'running' | 'awaiting_patch_review' | 'awaiting_approval' | 'applied' | 'verified' | 'failed' | 'skipped';
export type ActionKind = 'inspect_files' | 'search_repo' | 'read_file' | 'propose_edit' | 'apply_edit' | 'run_command' | 'update_docs' | 'git_review' | 'prepare_verify';
export type PatchProposalStatus = 'draft' | 'ready_for_review' | 'approved' | 'rejected' | 'applied' | 'superseded';

export interface ExecutionState {
  id: string;
  planId: string;
  status: ExecutionStatus;
  mode: ExecutionMode;
  currentStepId?: string;
}

export interface ObservationRecord {
  timestamp: string;
  message: string;
}

export interface PatchProposal {
  id: string;
  stepId: string;
  targetFile: string;
  rationale: string;
  diffContent: string;
  status: PatchProposalStatus;
  timestamp: string;
}

export interface StepExecutionRecord {
  stepId: string;
  status: StepExecutionStatus;
  observations: ObservationRecord[];
  pendingPatch?: PatchProposal;
}

export interface ActionIntent {
  kind: ActionKind;
  target: string;
  reason: string;
}

// VERIFIER ADDITIONS
export type VerificationStatus = 'pending' | 'ready' | 'running' | 'passed' | 'failed' | 'inconclusive' | 'blocked' | 'cancelled';
export type VerificationCheckKind = 'test_command' | 'lint_command' | 'typecheck_command' | 'build_command' | 'formatting_check' | 'custom_command';
export type VerificationSeverity = 'low' | 'medium' | 'critical' | 'fatal';
export type FailureClassification = 'test_failure' | 'lint_failure' | 'type_error' | 'build_error' | 'missing_dependency' | 'environment_issue' | 'command_failure' | 'timeout' | 'unknown';

export interface VerificationCheck {
  id: string;
  kind: VerificationCheckKind;
  command: string;
  args: string[];
}

export interface VerificationFinding {
  id: string;
  severity: VerificationSeverity;
  classification: FailureClassification;
  message: string;
  affectedFiles: string[];
}

export interface RetryRecommendation {
  reason: string;
  affectedFiles: string[];
  suggestedAction: string;
  allowAutoExecution: boolean;
}

export interface RetryRequest {
  id: string;
  verificationId: string;
  executionId: string;
  stepId: string;
  failureSummary: string;
  findings: VerificationFinding[];
  suggestedScope: string;
}

export interface VerificationState {
  id: string;
  executionId: string;
  stepId: string;
  status: VerificationStatus;
  checksConfigured: VerificationCheck[];
  findings: VerificationFinding[];
  retryRecommendation?: RetryRecommendation;
  stdout: string;
}

// INTEGRATION ADDITIONS (REPAIR, BROWSER, DEPLOY)
export type RepairAttemptStatus = 'pending' | 'running' | 'awaiting_approval' | 'applied' | 'verifying' | 'failed' | 'exhausted' | 'completed';
export type DeployTargetKind = 'node_web_app' | 'static_site' | 'tauri_desktop' | 'rust_service' | 'unknown';
export type BrowserSessionStatus = 'idle' | 'launching' | 'connecting' | 'ready' | 'navigating' | 'busy' | 'disconnected' | 'failed' | 'closed';
export type BrowserActionKind = 'open_url' | 'click_selector' | 'type_selector' | 'wait_for_selector' | 'extract_text' | 'capture_screenshot' | 'get_page_state';
export type BrowserArtifactKind = 'screenshot' | 'page_snapshot' | 'event_log' | 'extracted_text';

export interface BrowserTargetInfo {
  url: string;
  title: string;
}

export interface BrowserPageState {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface BrowserActionRequest {
  id: string;
  kind: BrowserActionKind;
  value: string;
  textInput?: string;
}

export interface BrowserActionResult {
  actionId: string;
  success: boolean;
  message: string;
  artifactPath?: string;
  screenshotBase64?: string;
}

export interface BrowserEventLogEntry {
  timestamp: string;
  actionId: string;
  kind: BrowserActionKind;
  success: boolean;
  message: string;
}

export interface BrowserArtifact {
  id: string;
  kind: BrowserArtifactKind;
  path: string;
  timestamp: string;
  metadata?: any;
}

export interface BrowserSessionState {
  status: BrowserSessionStatus;
  currentTarget?: BrowserTargetInfo;
  lastError?: string;
  artifacts?: BrowserArtifact[];
  eventLog?: BrowserEventLogEntry[];
}

export interface RepairAttempt {
  id: string;
  verificationId: string;
  status: RepairAttemptStatus;
  proposedPatch?: PatchProposal;
  error?: string;
  attemptNumber: number;
}

export interface DeployPrepSummary {
  id: string;
  targetKind: DeployTargetKind;
  detectedRoots: string[];
  proposedCommands: string[];
  risks: string[];
}

export interface AppBootData {
  lastWorkspace?: WorkspaceSummary;
  activePlan?: ExecutionPlan;
  activeExecution?: ExecutionState;
  providerConfig?: ProviderConfig;
  timeline?: TimelineEvent[];
  safetyMode?: SafetyMode;
  runtimeMode?: RuntimeMode;
  recoveredFromLegacy: boolean;
}

// PROVIDER DOMAIN TYPES
export type ProviderKind = 'ollama' | 'openai_compatible' | 'open_ai' | 'anthropic' | 'gemini' | 'bedrock' | 'vertex' | 'mock';
export type ProviderStatus = 'unconfigured' | 'connecting' | 'connected' | 'failed' | 'degraded';
export type GenerationMode = 'plan_generation' | 'architecture_generation' | 'step_refinement' | 'patch_rationale' | 'verification_analysis' | 'repair_generation' | 'deploy_prep_reasoning';

export interface ProviderConfig {
  kind: ProviderKind;
  baseUrl: string;
  modelId: string;
  apiKeySet: boolean;
  profileId?: string;
  profileName?: string;
}

export interface ProviderHealthResult {
  reachable: boolean;
  modelAvailable: boolean;
  status: ProviderStatus;
  message: string;
}

export interface ModelDescriptor {
  id: string;
  name: string;
  contextLength?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
}

export interface GenerationRequest {
  mode: GenerationMode;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerationResponse {
  content: string;
  finishReason?: string;
  tokenUsage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}


export type SafetyMode = 'read_only' | 'workspace_write' | 'danger_full_access';
export type RuntimeMode = 'balanced' | 'local_only' | 'cloud_assisted' | 'research_heavy' | 'browser_heavy';
export type TimelineSource = 'system' | 'planner' | 'executor' | 'verifier' | 'repair' | 'provider' | 'tool' | 'browser' | 'computer_use' | 'research' | 'deploy' | 'design';
export interface TimelineEvent { id: string; timestamp: string; source: TimelineSource; title: string; message: string; status: string; }
export interface ProviderProfile { id: string; name: string; config: ProviderConfig; runtimeMode: RuntimeMode; routePlannerModel?: string; routeExecutorModel?: string; routeVerifierModel?: string; routeResearchModel?: string; }
export type ToolCategory = 'filesystem' | 'search' | 'terminal' | 'git' | 'planner' | 'verifier' | 'browser' | 'computer_use' | 'web_research' | 'design' | 'deploy' | 'task';
export type ToolSafetyLevel = 'read_only' | 'workspace_write' | 'destructive' | 'external_network' | 'computer_control';
export interface ToolDefinition { name: string; displayName: string; description: string; category: ToolCategory; safetyLevel: ToolSafetyLevel; inputSchema: unknown; }
export interface ToolCallRequest { id: string; toolName: string; arguments: unknown; }
export interface ToolCallResult { id: string; toolName: string; success: boolean; output: unknown; approvalRequired?: ApprovalRequirement; timelineEvent?: TimelineEvent; }
export interface McpServerInfo { name: string; version: string; tools: ToolDefinition[]; }
export interface SkillDescriptor { name: string; path: string; description: string; enabled: boolean; }
export type ComputerUseActionKind = 'list_apps' | 'get_app_state' | 'press_key' | 'type_text' | 'click_target' | 'run_sequence';
export interface ComputerUseAction { id: string; kind: ComputerUseActionKind; target?: string; text?: string; sequence: ComputerUseAction[]; requiresPermission: boolean; }
export interface ComputerUseResult { actionId: string; success: boolean; message: string; state?: unknown; }
export interface WebResearchRecord { id: string; query: string; title: string; url: string; summary: string; markedRelevant: boolean; timestamp: string; }
export interface DesignToken { name: string; value: string; category: string; description?: string; }
export interface DesignSystemSummary { found: boolean; path?: string; tokens: DesignToken[]; rationale: string; issues: string[]; }
export interface CodraShellData { workspace?: WorkspaceSummary; provider?: ProviderConfig; providerHealth?: ProviderHealthResult; activePlan?: ExecutionPlan; activeExecution?: ExecutionState; tools: ToolDefinition[]; timeline: TimelineEvent[]; browser: BrowserSessionState; research: WebResearchRecord[]; designSystem: DesignSystemSummary; safetyMode: SafetyMode; runtimeMode: RuntimeMode; }
