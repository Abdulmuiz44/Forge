use forge_protocol::{
    TaskContext, ExecutionPlan, ArchitectureProposal, PlannerOutput, PlanStep,
    ActionIntent, ActionKind, VerificationCheck, VerificationFinding,
    FailureClassification, VerificationSeverity, GenerationRequest,
    GenerationResponse, GenerationMode, ProviderConfig, ProviderKind,
    ProviderHealthResult, ProviderStatus, ModelDescriptor, TokenUsage,
};
use serde::{Deserialize, Serialize};

// ===== UNIFIED GENERATION TRAIT =====

pub trait IntelligenceProvider: Send + Sync {
    fn generate(&self, request: &GenerationRequest) -> Result<GenerationResponse, String>;
    fn health_check(&self) -> Result<ProviderHealthResult, String>;
    fn list_models(&self) -> Result<Vec<ModelDescriptor>, String>;
}

// ===== HIGHER-LEVEL TRAITS FOR SUBSYSTEM CONSUMPTION =====

pub trait ModelProvider {
    fn generate_plan(&self, context: &TaskContext) -> Result<PlannerOutput, String>;
    fn generate_architecture(&self, plan: &ExecutionPlan) -> Result<ArchitectureProposal, String>;
}

pub trait ExecutionProvider {
    fn refine_step(&self, step: &PlanStep) -> Result<ActionIntent, String>;
}

pub trait VerificationProvider {
    fn parse_outputs(&self, check: &VerificationCheck, raw_stdout: &str) -> (Vec<VerificationFinding>, String);
}

// ===== OLLAMA ADAPTER =====

pub struct OllamaProvider {
    pub base_url: String,
    pub model: String,
}

impl OllamaProvider {
    pub fn new(base_url: &str, model: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            model: model.to_string(),
        }
    }
}

// Ollama /api/generate request/response shapes
#[derive(Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    system: Option<String>,
    stream: bool,
    options: Option<OllamaOptions>,
}

#[derive(Serialize)]
struct OllamaOptions {
    temperature: Option<f64>,
    num_predict: Option<i64>,
}

#[derive(Deserialize)]
struct OllamaGenerateResponse {
    response: String,
    done: bool,
    #[serde(default)]
    eval_count: Option<i64>,
    #[serde(default)]
    prompt_eval_count: Option<i64>,
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModelEntry>,
}

#[derive(Deserialize)]
struct OllamaModelEntry {
    name: String,
}

impl IntelligenceProvider for OllamaProvider {
    fn generate(&self, request: &GenerationRequest) -> Result<GenerationResponse, String> {
        let url = format!("{}/api/generate", self.base_url);
        let body = OllamaGenerateRequest {
            model: self.model.clone(),
            prompt: format!("{}\n\n{}", request.system_prompt, request.user_prompt),
            system: Some(request.system_prompt.clone()),
            stream: false,
            options: Some(OllamaOptions {
                temperature: request.temperature,
                num_predict: request.max_tokens,
            }),
        };

        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| format!("HTTP client init failed: {}", e))?;

        let resp = client
            .post(&url)
            .json(&body)
            .send()
            .map_err(|e| format!("Ollama request failed: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Ollama returned status {}", resp.status()));
        }

        let ollama_resp: OllamaGenerateResponse = resp
            .json()
            .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

        let usage = match (ollama_resp.prompt_eval_count, ollama_resp.eval_count) {
            (Some(p), Some(c)) => Some(TokenUsage {
                prompt_tokens: p,
                completion_tokens: c,
                total_tokens: p + c,
            }),
            _ => None,
        };

        Ok(GenerationResponse {
            content: ollama_resp.response,
            finish_reason: if ollama_resp.done { Some("stop".to_string()) } else { None },
            token_usage: usage,
        })
    }

    fn health_check(&self) -> Result<ProviderHealthResult, String> {
        let url = format!("{}/api/tags", self.base_url);
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?;

        match client.get(&url).send() {
            Ok(resp) if resp.status().is_success() => {
                let tags: OllamaTagsResponse = resp.json().unwrap_or(OllamaTagsResponse { models: vec![] });
                let model_available = tags.models.iter().any(|m| m.name.starts_with(&self.model));
                Ok(ProviderHealthResult {
                    reachable: true,
                    model_available,
                    status: if model_available { ProviderStatus::Connected } else { ProviderStatus::Degraded },
                    message: if model_available {
                        format!("Connected to Ollama. Model '{}' is available.", self.model)
                    } else {
                        format!("Connected to Ollama but model '{}' not found. Available: {:?}", self.model, tags.models.iter().map(|m| &m.name).collect::<Vec<_>>())
                    },
                })
            }
            Ok(resp) => Ok(ProviderHealthResult {
                reachable: true,
                model_available: false,
                status: ProviderStatus::Failed,
                message: format!("Ollama returned HTTP {}", resp.status()),
            }),
            Err(e) => Ok(ProviderHealthResult {
                reachable: false,
                model_available: false,
                status: ProviderStatus::Failed,
                message: format!("Cannot reach Ollama at {}: {}", self.base_url, e),
            }),
        }
    }

    fn list_models(&self) -> Result<Vec<ModelDescriptor>, String> {
        let url = format!("{}/api/tags", self.base_url);
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?;

        let resp = client.get(&url).send().map_err(|e| format!("Failed to reach Ollama: {}", e))?;
        let tags: OllamaTagsResponse = resp.json().map_err(|e| format!("Parse error: {}", e))?;

        Ok(tags.models.iter().map(|m| ModelDescriptor {
            id: m.name.clone(),
            name: m.name.clone(),
            context_length: None,
        }).collect())
    }
}

// ===== OPENAI-COMPATIBLE ADAPTER =====

pub struct OpenAiCompatibleProvider {
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
}

impl OpenAiCompatibleProvider {
    pub fn new(base_url: &str, model: &str, api_key: Option<String>) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            model: model.to_string(),
            api_key,
        }
    }
}

#[derive(Serialize)]
struct OpenAiChatRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OpenAiChatResponse {
    choices: Vec<OpenAiChoice>,
    usage: Option<OpenAiUsage>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct OpenAiUsage {
    prompt_tokens: i64,
    completion_tokens: i64,
    total_tokens: i64,
}

#[derive(Deserialize)]
struct OpenAiModelsResponse {
    data: Vec<OpenAiModelEntry>,
}

#[derive(Deserialize)]
struct OpenAiModelEntry {
    id: String,
}

impl IntelligenceProvider for OpenAiCompatibleProvider {
    fn generate(&self, request: &GenerationRequest) -> Result<GenerationResponse, String> {
        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = OpenAiChatRequest {
            model: self.model.clone(),
            messages: vec![
                OpenAiMessage { role: "system".to_string(), content: request.system_prompt.clone() },
                OpenAiMessage { role: "user".to_string(), content: request.user_prompt.clone() },
            ],
            max_tokens: request.max_tokens,
            temperature: request.temperature,
        };

        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| format!("HTTP client init failed: {}", e))?;

        let mut req_builder = client.post(&url).json(&body);
        if let Some(key) = &self.api_key {
            req_builder = req_builder.header("Authorization", format!("Bearer {}", key));
        }

        let resp = req_builder.send().map_err(|e| format!("Request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().unwrap_or_default();
            return Err(format!("Provider returned HTTP {}: {}", status, body_text));
        }

        let chat_resp: OpenAiChatResponse = resp.json().map_err(|e| format!("Parse error: {}", e))?;
        let choice = chat_resp.choices.first().ok_or("Empty response from provider")?;

        let usage = chat_resp.usage.map(|u| TokenUsage {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        });

        Ok(GenerationResponse {
            content: choice.message.content.clone(),
            finish_reason: choice.finish_reason.clone(),
            token_usage: usage,
        })
    }

    fn health_check(&self) -> Result<ProviderHealthResult, String> {
        let url = format!("{}/v1/models", self.base_url);
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?;

        let mut req = client.get(&url);
        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }

        match req.send() {
            Ok(resp) if resp.status().is_success() => {
                Ok(ProviderHealthResult {
                    reachable: true,
                    model_available: true,
                    status: ProviderStatus::Connected,
                    message: format!("Connected to {} with model '{}'", self.base_url, self.model),
                })
            }
            Ok(resp) => Ok(ProviderHealthResult {
                reachable: true,
                model_available: false,
                status: ProviderStatus::Failed,
                message: format!("Provider returned HTTP {}", resp.status()),
            }),
            Err(e) => Ok(ProviderHealthResult {
                reachable: false,
                model_available: false,
                status: ProviderStatus::Failed,
                message: format!("Cannot reach {}: {}", self.base_url, e),
            }),
        }
    }

    fn list_models(&self) -> Result<Vec<ModelDescriptor>, String> {
        let url = format!("{}/v1/models", self.base_url);
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?;

        let mut req = client.get(&url);
        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }

        let resp = req.send().map_err(|e| format!("Failed: {}", e))?;
        let models_resp: OpenAiModelsResponse = resp.json().map_err(|e| format!("Parse error: {}", e))?;

        Ok(models_resp.data.iter().map(|m| ModelDescriptor {
            id: m.id.clone(),
            name: m.id.clone(),
            context_length: None,
        }).collect())
    }
}

// ===== MOCK PROVIDER (preserved for offline/testing) =====

pub struct EchoMockProvider;

impl EchoMockProvider {
    pub fn new() -> Self { Self }
}

impl IntelligenceProvider for EchoMockProvider {
    fn generate(&self, request: &GenerationRequest) -> Result<GenerationResponse, String> {
        Ok(GenerationResponse {
            content: format!("[Mock] Processed {} prompt: {}...", format!("{:?}", request.mode), &request.user_prompt[..request.user_prompt.len().min(80)]),
            finish_reason: Some("stop".to_string()),
            token_usage: Some(TokenUsage { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }),
        })
    }

    fn health_check(&self) -> Result<ProviderHealthResult, String> {
        Ok(ProviderHealthResult {
            reachable: true,
            model_available: true,
            status: ProviderStatus::Connected,
            message: "Mock provider always healthy".to_string(),
        })
    }

    fn list_models(&self) -> Result<Vec<ModelDescriptor>, String> {
        Ok(vec![ModelDescriptor { id: "echo-mock".to_string(), name: "Echo Mock".to_string(), context_length: Some(4096) }])
    }
}

// ===== PROVIDER FACTORY =====

pub fn create_provider(config: &ProviderConfig, api_key: Option<&str>) -> Box<dyn IntelligenceProvider> {
    match config.kind {
        ProviderKind::Ollama => Box::new(OllamaProvider::new(&config.base_url, &config.model_id)),
        ProviderKind::OpenaiCompatible | ProviderKind::OpenAi => {
            Box::new(OpenAiCompatibleProvider::new(&config.base_url, &config.model_id, api_key.map(|s| s.to_string())))
        }
    }
}

// ===== SUBSYSTEM BRIDGE =====
// This struct bridges the unified IntelligenceProvider to the older subsystem traits

pub struct LiveProvider {
    inner: Box<dyn IntelligenceProvider>,
}

impl LiveProvider {
    pub fn new(inner: Box<dyn IntelligenceProvider>) -> Self {
        Self { inner }
    }

    pub fn generate_raw(&self, request: &GenerationRequest) -> Result<GenerationResponse, String> {
        self.inner.generate(request)
    }

    pub fn health(&self) -> Result<ProviderHealthResult, String> {
        self.inner.health_check()
    }

    pub fn models(&self) -> Result<Vec<ModelDescriptor>, String> {
        self.inner.list_models()
    }
}

impl ModelProvider for LiveProvider {
    fn generate_plan(&self, context: &TaskContext) -> Result<PlannerOutput, String> {
        let request = GenerationRequest {
            mode: GenerationMode::PlanGeneration,
            system_prompt: crate::prompts::PLAN_SYSTEM_PROMPT.to_string(),
            user_prompt: format!("Task intent: {}\nWorkspace: {}\nRecent files: {:?}", context.intent, context.workspace_path, context.recent_files),
            max_tokens: Some(4096),
            temperature: Some(0.3),
        };

        let response = self.inner.generate(&request)?;

        // Attempt structured parse, fall back to reasonable default
        match serde_json::from_str::<PlannerOutput>(&response.content) {
            Ok(output) => Ok(output),
            Err(_) => {
                // Build a reasonable plan from freeform text
                Ok(PlannerOutput {
                    plan: ExecutionPlan {
                        id: uuid::Uuid::new_v4().to_string(),
                        task_id: "live_task".to_string(),
                        status: forge_protocol::PlanStatus::Draft,
                        title: format!("Plan for: {}", &context.intent[..context.intent.len().min(60)]),
                        objective: context.intent.clone(),
                        steps: vec![
                            forge_protocol::PlanStep {
                                id: "step_1".to_string(),
                                kind: forge_protocol::PlanStepKind::Inspect,
                                title: "Analyze workspace context".to_string(),
                                objective: "Assess current state of relevant files.".to_string(),
                                status: forge_protocol::PlanStepStatus::Pending,
                                files_likely_involved: vec![],
                                required_tools: vec!["fs_list".to_string()],
                            },
                            forge_protocol::PlanStep {
                                id: "step_2".to_string(),
                                kind: forge_protocol::PlanStepKind::Edit,
                                title: "Implement changes".to_string(),
                                objective: response.content[..response.content.len().min(200)].to_string(),
                                status: forge_protocol::PlanStepStatus::Pending,
                                files_likely_involved: vec!["src/main.rs".to_string()],
                                required_tools: vec!["fs_write".to_string()],
                            },
                        ],
                        dependencies: vec![forge_protocol::PlanDependency { step_id: "step_2".to_string(), depends_on: "step_1".to_string() }],
                        assumptions: vec![],
                        risks: vec![],
                        architecture_proposal: None,
                    },
                })
            }
        }
    }

    fn generate_architecture(&self, plan: &ExecutionPlan) -> Result<ArchitectureProposal, String> {
        let request = GenerationRequest {
            mode: GenerationMode::ArchitectureGeneration,
            system_prompt: crate::prompts::ARCHITECTURE_SYSTEM_PROMPT.to_string(),
            user_prompt: format!("Plan objective: {}\nSteps: {:?}", plan.objective, plan.steps.iter().map(|s| &s.title).collect::<Vec<_>>()),
            max_tokens: Some(2048),
            temperature: Some(0.3),
        };

        let response = self.inner.generate(&request)?;

        Ok(ArchitectureProposal {
            id: uuid::Uuid::new_v4().to_string(),
            rationale: response.content,
            success_criteria: vec!["Compiles without errors".to_string()],
            estimated_impact: "medium".to_string(),
            tradeoffs: vec![],
            touched_subsystems: vec![],
        })
    }
}

impl ExecutionProvider for LiveProvider {
    fn refine_step(&self, step: &PlanStep) -> Result<ActionIntent, String> {
        let request = GenerationRequest {
            mode: GenerationMode::StepRefinement,
            system_prompt: crate::prompts::STEP_REFINEMENT_SYSTEM_PROMPT.to_string(),
            user_prompt: format!("Step title: {}\nObjective: {}\nTools available: {:?}\nFiles involved: {:?}", step.title, step.objective, step.required_tools, step.files_likely_involved),
            max_tokens: Some(1024),
            temperature: Some(0.2),
        };

        let response = self.inner.generate(&request)?;

        // Determine action kind from step tools
        let kind = if step.required_tools.contains(&"fs_write".to_string()) {
            ActionKind::ProposeEdit
        } else {
            ActionKind::InspectFiles
        };

        Ok(ActionIntent {
            kind,
            target: step.files_likely_involved.first().cloned().unwrap_or_else(|| "src".to_string()),
            reason: response.content[..response.content.len().min(200)].to_string(),
        })
    }
}

impl VerificationProvider for LiveProvider {
    fn parse_outputs(&self, check: &VerificationCheck, raw_stdout: &str) -> (Vec<VerificationFinding>, String) {
        let request = GenerationRequest {
            mode: GenerationMode::VerificationAnalysis,
            system_prompt: crate::prompts::VERIFICATION_SYSTEM_PROMPT.to_string(),
            user_prompt: format!("Command: {} {:?}\nOutput:\n{}", check.command, check.args, raw_stdout),
            max_tokens: Some(1024),
            temperature: Some(0.1),
        };

        match self.inner.generate(&request) {
            Ok(response) => {
                // If the LLM says it looks like failure, build a finding
                let content_lower = response.content.to_lowercase();
                if content_lower.contains("error") || content_lower.contains("fail") {
                    let finding = VerificationFinding {
                        id: uuid::Uuid::new_v4().to_string(),
                        severity: VerificationSeverity::Critical,
                        classification: FailureClassification::Unknown,
                        message: response.content[..response.content.len().min(300)].to_string(),
                        affected_files: vec![],
                    };
                    (vec![finding], raw_stdout.to_string())
                } else {
                    (vec![], raw_stdout.to_string())
                }
            }
            Err(e) => {
                // Provider failure shouldn't crash verification — return raw
                let finding = VerificationFinding {
                    id: uuid::Uuid::new_v4().to_string(),
                    severity: VerificationSeverity::Low,
                    classification: FailureClassification::Unknown,
                    message: format!("Provider analysis failed: {}. Raw output preserved.", e),
                    affected_files: vec![],
                };
                (vec![finding], raw_stdout.to_string())
            }
        }
    }
}

// ===== LEGACY EchoMockProvider bridge (preserves old test code) =====

impl ModelProvider for EchoMockProvider {
    fn generate_plan(&self, context: &TaskContext) -> Result<PlannerOutput, String> {
        let needs_arch = context.intent.len() > 50;
        let mut plan = ExecutionPlan {
            id: uuid::Uuid::new_v4().to_string(),
            task_id: "mock_task_id".to_string(),
            status: forge_protocol::PlanStatus::Draft,
            title: "Generated Mock Plan".to_string(),
            objective: context.intent.clone(),
            steps: vec![
                forge_protocol::PlanStep { id: "step_1".to_string(), kind: forge_protocol::PlanStepKind::Inspect, title: "Inspect Workspace".to_string(), objective: "Verify current state matches assumptions.".to_string(), status: forge_protocol::PlanStepStatus::Pending, files_likely_involved: vec![], required_tools: vec!["fs_list".to_string()] },
                forge_protocol::PlanStep { id: "step_2".to_string(), kind: forge_protocol::PlanStepKind::Edit, title: "Implement requested feature".to_string(), objective: "Apply code changes according to architecture.".to_string(), status: forge_protocol::PlanStepStatus::Pending, files_likely_involved: vec!["src/main.rs".to_string()], required_tools: vec!["fs_write".to_string()] },
            ],
            dependencies: vec![forge_protocol::PlanDependency { step_id: "step_2".to_string(), depends_on: "step_1".to_string() }],
            assumptions: vec![forge_protocol::AssumptionItem { description: "Rust toolchain is installed.".to_string(), confidence: "high".to_string() }],
            risks: vec![forge_protocol::RiskItem { description: "File lock might exist.".to_string(), severity: "low".to_string() }],
            architecture_proposal: None,
        };
        if needs_arch { plan.architecture_proposal = Some(self.generate_architecture(&plan)?); }
        Ok(PlannerOutput { plan })
    }

    fn generate_architecture(&self, _plan: &ExecutionPlan) -> Result<ArchitectureProposal, String> {
        Ok(ArchitectureProposal {
            id: uuid::Uuid::new_v4().to_string(),
            rationale: "Requires system separation to maintain bounded contexts.".to_string(),
            success_criteria: vec!["Compiles without warnings".to_string()],
            estimated_impact: "medium".to_string(),
            tradeoffs: vec!["Increased boilerplate for safety".to_string()],
            touched_subsystems: vec!["frontend".to_string(), "backend routing".to_string()],
        })
    }
}

impl ExecutionProvider for EchoMockProvider {
    fn refine_step(&self, step: &PlanStep) -> Result<ActionIntent, String> {
        let (kind, target) = if step.required_tools.contains(&"fs_write".to_string()) {
            (ActionKind::ProposeEdit, "src/main.rs".to_string())
        } else {
            (ActionKind::InspectFiles, "src".to_string())
        };
        Ok(ActionIntent { kind, target, reason: format!("Executing strategy for objective: {}", step.objective) })
    }
}

impl VerificationProvider for EchoMockProvider {
    fn parse_outputs(&self, check: &VerificationCheck, _raw_stdout: &str) -> (Vec<VerificationFinding>, String) {
        let simulated_out = format!("Running {} {:?}...\nerror[E0308]: mismatched types\n --> src/main.rs:12:5\n  = note: expected struct `PatchProposalStatus`\n", check.command, check.args);
        let finding = VerificationFinding {
            id: "find_1".to_string(), severity: VerificationSeverity::Critical, classification: FailureClassification::TypeError,
            message: "Mismatched types: Expected Status enum but got String in patch state.".to_string(), affected_files: vec!["src/main.rs".to_string()],
        };
        (vec![finding], simulated_out)
    }
}
