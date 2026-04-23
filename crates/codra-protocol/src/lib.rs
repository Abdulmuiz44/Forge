use serde::{Deserialize, Serialize};

// --- PREVIOUS SHARED TYPES ---
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskMode {
    pub is_autonomous: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ApprovalState {
    Pending,
    Approved,
    Rejected,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub id: String,
    pub root_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SafetyMode {
    ReadOnly,
    WorkspaceWrite,
    DangerFullAccess,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeMode {
    Balanced,
    LocalOnly,
    CloudAssisted,
    ResearchHeavy,
    BrowserHeavy,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TimelineSource {
    System,
    Planner,
    Executor,
    Verifier,
    Repair,
    Provider,
    Tool,
    Browser,
    ComputerUse,
    Research,
    Deploy,
    Design,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEvent {
    pub id: String,
    pub timestamp: String,
    pub source: TimelineSource,
    pub title: String,
    pub message: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepoSummary {
    pub workspace_id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusSummary {
    pub is_git: bool,
    pub branch: Option<String>,
    pub changed_files: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    pub pattern: String,
    pub directory: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub path: String,
    pub line_number: usize,
    pub preview: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileReadResult {
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileWriteRequest {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileWriteResult {
    pub success: bool,
    pub checkpoint_id: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommandExecutionRequest {
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommandExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointRecord {
    pub id: String,
    pub workspace_id: String,
    pub timestamp: String,
    pub target_path: String,
    pub operation_type: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalRequirement {
    pub id: String,
    pub action_type: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalDecision {
    pub requirement_id: String,
    pub approved: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
}

// --- PLANNER SHARED TYPES ---
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PlanStatus {
    Draft,
    ReadyForReview,
    Approved,
    Rejected,
    Superseded,
    Archived,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PlanningMode {
    Auto,
    Interactive,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PlanStepStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PlanStepKind {
    Inspect,
    Search,
    Edit,
    RunCommand,
    Verify,
    GitReview,
    BrowserTask,
    DeployPrep,
    DocUpdate,
    ManualInput,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskRequest {
    pub id: String,
    pub intent: String,
    pub mode: PlanningMode,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskContext {
    pub workspace_id: String,
    pub workspace_path: String,
    pub intent: String,
    pub recent_searches: Vec<String>,
    pub recent_files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RiskItem {
    pub description: String,
    pub severity: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AssumptionItem {
    pub description: String,
    pub confidence: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlanDependency {
    pub step_id: String,
    pub depends_on: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlanStep {
    pub id: String,
    pub kind: PlanStepKind,
    pub title: String,
    pub objective: String,
    pub status: PlanStepStatus,
    pub files_likely_involved: Vec<String>,
    pub required_tools: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArchitectureProposal {
    pub id: String,
    pub rationale: String,
    pub success_criteria: Vec<String>,
    pub estimated_impact: String,
    pub tradeoffs: Vec<String>,
    pub touched_subsystems: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionPlan {
    pub id: String,
    pub task_id: String,
    pub status: PlanStatus,
    pub title: String,
    pub objective: String,
    pub steps: Vec<PlanStep>,
    pub dependencies: Vec<PlanDependency>,
    pub assumptions: Vec<AssumptionItem>,
    pub risks: Vec<RiskItem>,
    pub architecture_proposal: Option<ArchitectureProposal>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlannerOutput {
    pub plan: ExecutionPlan,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlannerDecision {
    pub requires_architecture: bool,
    pub reason: String,
}

// --- EXECUTOR SHARED TYPES ---
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionStatus {
    Pending,
    Ready,
    Running,
    WaitingForApproval,
    Paused,
    Blocked,
    Failed,
    Completed,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionMode {
    StepByStep,
    Autonomous,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StepExecutionStatus {
    NotStarted,
    ContextReady,
    ActionSelected,
    Running,
    AwaitingPatchReview,
    AwaitingApproval,
    Applied,
    Verified,
    Failed,
    Skipped,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ActionKind {
    InspectFiles,
    SearchRepo,
    ReadFile,
    ProposeEdit,
    ApplyEdit,
    RunCommand,
    UpdateDocs,
    GitReview,
    PrepareVerify,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PatchProposalStatus {
    Draft,
    ReadyForReview,
    Approved,
    Rejected,
    Applied,
    Superseded,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionState {
    pub id: String,
    pub plan_id: String,
    pub status: ExecutionStatus,
    pub mode: ExecutionMode,
    pub current_step_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ObservationRecord {
    pub timestamp: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PatchProposal {
    pub id: String,
    pub step_id: String,
    pub target_file: String,
    pub rationale: String,
    pub diff_content: String,
    pub status: PatchProposalStatus,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StepExecutionRecord {
    pub step_id: String,
    pub status: StepExecutionStatus,
    pub observations: Vec<ObservationRecord>,
    pub pending_patch: Option<PatchProposal>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActionIntent {
    pub kind: ActionKind,
    pub target: String,
    pub reason: String,
}

// --- VERIFIER SHARED TYPES ---
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VerificationStatus {
    Pending,
    Ready,
    Running,
    Passed,
    Failed,
    Inconclusive,
    Blocked,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VerificationCheckKind {
    TestCommand,
    LintCommand,
    TypecheckCommand,
    BuildCommand,
    FormattingCheck,
    CustomCommand,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VerificationSeverity {
    Low,
    Medium,
    Critical,
    Fatal,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FailureClassification {
    TestFailure,
    LintFailure,
    TypeError,
    BuildError,
    MissingDependency,
    EnvironmentIssue,
    CommandFailure,
    Timeout,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VerificationCheck {
    pub id: String,
    pub kind: VerificationCheckKind,
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VerificationFinding {
    pub id: String,
    pub severity: VerificationSeverity,
    pub classification: FailureClassification,
    pub message: String,
    pub affected_files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RetryRecommendation {
    pub reason: String,
    pub affected_files: Vec<String>,
    pub suggested_action: String,
    pub allow_auto_execution: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RetryRequest {
    pub id: String,
    pub verification_id: String,
    pub execution_id: String,
    pub step_id: String,
    pub failure_summary: String,
    pub findings: Vec<VerificationFinding>,
    pub suggested_scope: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VerificationState {
    pub id: String,
    pub execution_id: String,
    pub step_id: String,
    pub status: VerificationStatus,
    pub checks_configured: Vec<VerificationCheck>,
    pub findings: Vec<VerificationFinding>,
    pub retry_recommendation: Option<RetryRecommendation>,
    pub stdout: String,
}

// --- INTEGRATION SHARED TYPES ---
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RepairAttemptStatus {
    Pending,
    Running,
    AwaitingApproval,
    Applied,
    Verifying,
    Failed,
    Exhausted,
    Completed,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DeployTargetKind {
    NodeWebApp,
    StaticSite,
    TauriDesktop,
    RustService,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BrowserSessionStatus {
    Idle,
    Launching,
    Connecting,
    Ready,
    Navigating,
    Busy,
    Disconnected,
    Failed,
    Closed,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BrowserActionKind {
    OpenUrl,
    ClickSelector,
    TypeSelector,
    WaitForSelector,
    ExtractText,
    CaptureScreenshot,
    GetPageState,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BrowserArtifactKind {
    Screenshot,
    PageSnapshot,
    EventLog,
    ExtractedText,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrowserTargetInfo {
    pub url: String,
    pub title: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrowserPageState {
    pub url: String,
    pub title: String,
    pub can_go_back: bool,
    pub can_go_forward: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrowserActionRequest {
    pub id: String,
    pub kind: BrowserActionKind,
    pub value: String, // Dynamic target (URL, Selector, etc.)
    pub text_input: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrowserActionResult {
    pub action_id: String,
    pub success: bool,
    pub message: String,
    pub artifact_path: Option<String>,
    pub screenshot_base64: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrowserEventLogEntry {
    pub timestamp: String,
    pub action_id: String,
    pub kind: BrowserActionKind,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrowserArtifact {
    pub id: String,
    pub kind: BrowserArtifactKind,
    pub path: String,
    pub timestamp: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSessionState {
    pub status: BrowserSessionStatus,
    pub current_target: Option<BrowserTargetInfo>,
    pub last_error: Option<String>,
    #[serde(default)]
    pub artifacts: Vec<BrowserArtifact>,
    #[serde(default)]
    pub event_log: Vec<BrowserEventLogEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepairAttempt {
    pub id: String,
    pub verification_id: String,
    pub status: RepairAttemptStatus,
    pub proposed_patch: Option<PatchProposal>,
    pub error: Option<String>,
    pub attempt_number: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeployPrepSummary {
    pub id: String,
    pub target_kind: DeployTargetKind,
    pub detected_roots: Vec<String>,
    pub proposed_commands: Vec<String>,
    pub risks: Vec<String>,
}

// --- PROVIDER DOMAIN TYPES ---
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderKind {
    Ollama,
    OpenaiCompatible,
    OpenAi,
    Anthropic,
    Gemini,
    Bedrock,
    Vertex,
    Mock,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderStatus {
    Unconfigured,
    Connecting,
    Connected,
    Failed,
    Degraded,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GenerationMode {
    PlanGeneration,
    ArchitectureGeneration,
    StepRefinement,
    PatchRationale,
    VerificationAnalysis,
    RepairGeneration,
    DeployPrepReasoning,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub kind: ProviderKind,
    pub base_url: String,
    pub model_id: String,
    pub api_key_set: bool,
    #[serde(default = "default_profile_id")]
    pub profile_id: String,
    #[serde(default = "default_profile_name")]
    pub profile_name: String,
}

fn default_profile_id() -> String {
    "default".to_string()
}
fn default_profile_name() -> String {
    "Default".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderProfile {
    pub id: String,
    pub name: String,
    pub config: ProviderConfig,
    pub runtime_mode: RuntimeMode,
    pub route_planner_model: Option<String>,
    pub route_executor_model: Option<String>,
    pub route_verifier_model: Option<String>,
    pub route_research_model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderHealthResult {
    pub reachable: bool,
    pub model_available: bool,
    pub status: ProviderStatus,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelDescriptor {
    pub id: String,
    pub name: String,
    pub context_length: Option<i64>,
    #[serde(default)]
    pub supports_tools: bool,
    #[serde(default)]
    pub supports_vision: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GenerationRequest {
    pub mode: GenerationMode,
    pub system_prompt: String,
    pub user_prompt: String,
    pub max_tokens: Option<i64>,
    pub temperature: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GenerationResponse {
    pub content: String,
    pub finish_reason: Option<String>,
    pub token_usage: Option<TokenUsage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub total_tokens: i64,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppBootData {
    pub last_workspace: Option<WorkspaceSummary>,
    pub active_plan: Option<ExecutionPlan>,
    pub active_execution: Option<ExecutionState>,
    pub provider_config: Option<ProviderConfig>,
    #[serde(default)]
    pub timeline: Vec<TimelineEvent>,
    pub safety_mode: Option<SafetyMode>,
    pub runtime_mode: Option<RuntimeMode>,
    pub recovered_from_legacy: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ToolCategory {
    Filesystem,
    Search,
    Terminal,
    Git,
    Planner,
    Verifier,
    Browser,
    ComputerUse,
    WebResearch,
    Design,
    Deploy,
    Task,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ToolSafetyLevel {
    ReadOnly,
    WorkspaceWrite,
    Destructive,
    ExternalNetwork,
    ComputerControl,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ToolDefinition {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub category: ToolCategory,
    pub safety_level: ToolSafetyLevel,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallRequest {
    pub id: String,
    pub tool_name: String,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallResult {
    pub id: String,
    pub tool_name: String,
    pub success: bool,
    pub output: serde_json::Value,
    pub approval_required: Option<ApprovalRequirement>,
    pub timeline_event: Option<TimelineEvent>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct McpServerInfo {
    pub name: String,
    pub version: String,
    pub tools: Vec<ToolDefinition>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillDescriptor {
    pub name: String,
    pub path: String,
    pub description: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ComputerUseActionKind {
    ListApps,
    GetAppState,
    PressKey,
    TypeText,
    ClickTarget,
    RunSequence,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseAction {
    pub id: String,
    pub kind: ComputerUseActionKind,
    pub target: Option<String>,
    pub text: Option<String>,
    pub sequence: Vec<ComputerUseAction>,
    pub requires_permission: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ComputerUseResult {
    pub action_id: String,
    pub success: bool,
    pub message: String,
    pub state: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebResearchRecord {
    pub id: String,
    pub query: String,
    pub title: String,
    pub url: String,
    pub summary: String,
    pub marked_relevant: bool,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DesignToken {
    pub name: String,
    pub value: String,
    pub category: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DesignSystemSummary {
    pub found: bool,
    pub path: Option<String>,
    pub tokens: Vec<DesignToken>,
    pub rationale: String,
    pub issues: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CodraShellData {
    pub workspace: Option<WorkspaceSummary>,
    pub provider: Option<ProviderConfig>,
    pub provider_health: Option<ProviderHealthResult>,
    pub active_plan: Option<ExecutionPlan>,
    pub active_execution: Option<ExecutionState>,
    pub tools: Vec<ToolDefinition>,
    pub timeline: Vec<TimelineEvent>,
    pub browser: BrowserSessionState,
    pub research: Vec<WebResearchRecord>,
    pub design_system: DesignSystemSummary,
    pub safety_mode: SafetyMode,
    pub runtime_mode: RuntimeMode,
}
