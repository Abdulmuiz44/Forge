use std::sync::Mutex;
use tauri::{State, Manager};
use codra_protocol::*;
use codra_tools::fs::LocalFileSystem;
use codra_tools::git::LocalGit;
use codra_tools::search::LocalSearch;
use codra_tools::terminal::LocalTerminal;
use codra_core::planner::PlannerService;
use codra_core::executor::ExecutionOrchestrator;
use codra_core::verifier::VerificationService;
use codra_core::repair::RepairService;
use codra_core::deploy::DeployPrepService;
use codra_core::provider::{
    create_provider, LiveProvider, EchoMockProvider, IntelligenceProvider,
};
use codra_core::provider_config::ProviderConfigService;
use codra_core::config::GlobalConfigService;

use codra_browser::LocalBrowserService;

struct AppState {
    workspace_root: Mutex<Option<String>>,
    provider_config: Mutex<Option<ProviderConfig>>,
    provider_api_key: Mutex<Option<String>>,
    browser: Mutex<LocalBrowserService>,
    global_config: Mutex<GlobalConfigService>,
}

// --- Centralized provider instantiation ---
// This is the single source of truth for which provider is active.
// Every command handler that needs intelligence calls this.
// Variant that skips health check for speed — used when we know config was recently validated
fn resolve_provider_fast(state: &State<'_, AppState>) -> Box<dyn IntelligenceProvider> {
    let cfg = state.provider_config.lock().unwrap().clone();
    let api_key = state.provider_api_key.lock().unwrap().clone();

    match cfg {
        Some(ref config) => create_provider(config, api_key.as_deref()),
        None => Box::new(EchoMockProvider::new()),
    }
}

fn is_mock_mode(state: &State<'_, AppState>) -> bool {
    let cfg = state.provider_config.lock().unwrap().clone();
    cfg.is_none()
}

fn find_latest_plan(workspace_path: &str) -> Option<ExecutionPlan> {
    let roots = [".codra", ".forge"];

    for root in roots {
        let plans_dir = std::path::PathBuf::from(workspace_path).join(root).join("plans");
        if let Ok(entries) = std::fs::read_dir(plans_dir) {
            let mut latest_plan = None;
            for entry in entries.flatten() {
                if let Ok(p) = std::fs::read_to_string(entry.path()) {
                    if let Ok(plan) = serde_json::from_str::<ExecutionPlan>(&p) {
                        latest_plan = Some(plan);
                    }
                }
            }
            if latest_plan.is_some() {
                return latest_plan;
            }
        }
    }

    None
}

#[tauri::command]
fn check_health() -> String {
    "Rust Backend is online and healthy!".to_string()
}

#[tauri::command]
fn open_workspace(path: String, state: State<'_, AppState>) -> Result<WorkspaceSummary, String> {
    *state.workspace_root.lock().unwrap() = Some(path.clone());
    let _ = state.global_config.lock().unwrap().set_last_workspace(path.clone());

    // Auto-load provider config from workspace storage if it exists.
    // The provider service reads from `.codra` first and falls back to legacy `.forge`.
    let config_svc = ProviderConfigService::new(&path);
    if let Some(cfg) = config_svc.load_config() {
        eprintln!("[Codra Provider] Loaded config: {:?} / model: {}", cfg.kind, cfg.model_id);
        *state.provider_config.lock().unwrap() = Some(cfg);
    } else {
        eprintln!("[Codra Provider] No persisted provider config found. Mock mode active.");
    }
    if let Some(key) = config_svc.load_api_key() {
        eprintln!("[Codra Provider] API key loaded from workspace storage.");
        *state.provider_api_key.lock().unwrap() = Some(key);
    }

    Ok(WorkspaceSummary {
        id: "local-ws".to_string(),
        root_path: path,
    })
}

#[tauri::command]
fn get_app_boot_data(state: State<'_, AppState>) -> Result<AppBootData, String> {
    let global = state.global_config.lock().unwrap().load();
    let mut boot_data = AppBootData {
        last_workspace: None,
        active_plan: None,
        active_execution: None,
        provider_config: None,
    };

    if let Some(path) = global.last_workspace_path {
        // Attempt to auto-open
        if let Ok(ws) = open_workspace(path.clone(), state.clone()) {
            boot_data.last_workspace = Some(ws);
            boot_data.provider_config = state.provider_config.lock().unwrap().clone();

            // Check for existing plan/execution (supports legacy `.forge`).
            boot_data.active_plan = find_latest_plan(&path);

            // Check for execution state
            use codra_core::executor::ExecutionPersistenceService;
            let persistence = ExecutionPersistenceService::new(&path);
            if let Ok(st) = persistence.load_state() {
                boot_data.active_execution = Some(st);
            }
        }
    }

    Ok(boot_data)
}

#[tauri::command]
fn get_workspace_summary(state: State<'_, AppState>) -> Result<WorkspaceSummary, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    Ok(WorkspaceSummary { id: "local-ws".to_string(), root_path: ws })
}

#[tauri::command]
fn list_workspace_entries(relative_path: Option<String>, state: State<'_, AppState>) -> Result<Vec<FileEntry>, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let fs = LocalFileSystem::new(ws);
    fs.list_entries(relative_path.as_deref())
}

#[tauri::command]
fn read_workspace_file(path: String, state: State<'_, AppState>) -> Result<FileReadResult, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let fs = LocalFileSystem::new(ws);
    fs.read_file(&path)
}

#[tauri::command]
fn write_workspace_file(request: FileWriteRequest, state: State<'_, AppState>) -> Result<FileWriteResult, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let fs = LocalFileSystem::new(ws);
    fs.write_file_with_checkpoint("local-ws", request)
}

#[tauri::command]
fn search_workspace(query: SearchQuery, state: State<'_, AppState>) -> Result<Vec<SearchMatch>, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let search_engine = LocalSearch::new(ws);
    search_engine.execute_search(query)
}

#[tauri::command]
fn run_workspace_command(request: CommandExecutionRequest, state: State<'_, AppState>) -> Result<CommandExecutionResult, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let terminal = LocalTerminal::new(ws);
    terminal.execute(request)
}

#[tauri::command]
fn get_git_status(state: State<'_, AppState>) -> Result<GitStatusSummary, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let git = LocalGit::new(ws);
    git.get_status()
}

#[tauri::command]
fn get_git_diff_summary(state: State<'_, AppState>) -> Result<String, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let git = LocalGit::new(ws);
    git.get_diff_summary()
}

// ----- PLANNER COMMANDS -----
// Provider is resolved and injected into PlannerService for every call.

#[tauri::command]
fn submit_task_for_planning(request: TaskRequest, state: State<'_, AppState>) -> Result<ExecutionPlan, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;

    let provider_box = resolve_provider_fast(&state);
    let live = LiveProvider::new(provider_box);
    let planner = PlannerService::new(&ws, &live);
    eprintln!("[Codra Planner] Planning task with {} provider", if is_mock_mode(&state) { "mock" } else { "live" });
    planner.create_plan(request)
}

#[tauri::command]
fn update_plan_status(plan_id: String, status: PlanStatus, state: State<'_, AppState>) -> Result<ExecutionPlan, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    // update_plan_status is pure persistence, no model needed, but API requires a provider ref
    let mock = EchoMockProvider::new();
    let planner = PlannerService::new(&ws, &mock);
    planner.update_plan_status(&plan_id, status)
}

// ----- EXECUTOR COMMANDS -----

#[tauri::command]
fn start_execution(plan: ExecutionPlan, state: State<'_, AppState>) -> Result<ExecutionState, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let provider_box = resolve_provider_fast(&state);
    let live = LiveProvider::new(provider_box);
    let executor = ExecutionOrchestrator::new(&ws, &live);
    eprintln!("[Codra Executor] Starting execution with {} provider", if is_mock_mode(&state) { "mock" } else { "live" });
    executor.start_execution(&plan)
}

#[tauri::command]
fn execute_step(mut exec_state: ExecutionState, plan: ExecutionPlan, state: State<'_, AppState>) -> Result<StepExecutionRecord, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let provider_box = resolve_provider_fast(&state);
    let live = LiveProvider::new(provider_box);
    let executor = ExecutionOrchestrator::new(&ws, &live);
    executor.execute_step(&mut exec_state, &plan)
}

#[tauri::command]
fn submit_patch_decision(mut exec_state: ExecutionState, patch_id: String, approved: bool, state: State<'_, AppState>) -> Result<ExecutionState, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let provider_box = resolve_provider_fast(&state);
    let live = LiveProvider::new(provider_box);
    let executor = ExecutionOrchestrator::new(&ws, &live);
    executor.handle_patch_decision(&mut exec_state, &patch_id, approved)?;
    Ok(exec_state)
}

// ----- VERIFIER COMMANDS -----

#[tauri::command]
fn start_verification(execution_id: String, step_id: String, state: State<'_, AppState>) -> Result<VerificationState, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let provider_box = resolve_provider_fast(&state);
    let live = LiveProvider::new(provider_box);
    let verifier = VerificationService::new(&ws, &live);
    eprintln!("[Codra Verifier] Starting verification with {} provider", if is_mock_mode(&state) { "mock" } else { "live" });
    verifier.start_verification(&execution_id, &step_id)
}

#[tauri::command]
fn generate_retry_proposal(verification_state: VerificationState, state: State<'_, AppState>) -> Result<RetryRequest, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let provider_box = resolve_provider_fast(&state);
    let live = LiveProvider::new(provider_box);
    let verifier = VerificationService::new(&ws, &live);
    verifier.generate_retry_payload(&verification_state)
}

// ----- REPAIR COMMAND -----

#[tauri::command]
fn start_repair_attempt(retry_request: RetryRequest, state: State<'_, AppState>) -> Result<RepairAttempt, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let provider_box = resolve_provider_fast(&state);
    let repair = RepairService::new(&ws, provider_box.as_ref());
    eprintln!("[Codra Repair] Generating repair with {} provider", if is_mock_mode(&state) { "mock" } else { "live" });
    repair.construct_repair_attempt(&retry_request)
}

// ----- DEPLOY / BROWSER -----

#[tauri::command]
fn prepare_deployment(state: State<'_, AppState>) -> Result<DeployPrepSummary, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    let deploy = DeployPrepService::new(&ws);
    deploy.evaluate_workspace()
}

#[tauri::command]
fn browser_launch_session(state: State<'_, AppState>) -> Result<BrowserSessionState, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;
    
    let mut browser = state.browser.lock().unwrap();
    browser.launch(std::path::PathBuf::from(ws))?;
    Ok(browser.get_state())
}

#[tauri::command]
fn browser_close_session(state: State<'_, AppState>) -> Result<BrowserSessionState, String> {
    let mut browser = state.browser.lock().unwrap();
    browser.close()?;
    Ok(browser.get_state())
}

#[tauri::command]
fn browser_get_session_state(state: State<'_, AppState>) -> Result<BrowserSessionState, String> {
    let browser = state.browser.lock().unwrap();
    Ok(browser.get_state())
}

#[tauri::command]
fn execute_browser_action(action: BrowserActionRequest, state: State<'_, AppState>) -> Result<BrowserActionResult, String> {
    let browser = state.browser.lock().unwrap();
    browser.execute_action(&action)
}

// ----- PROVIDER MANAGEMENT COMMANDS -----

#[tauri::command]
fn get_provider_config(state: State<'_, AppState>) -> Result<ProviderConfig, String> {
    let cfg = state.provider_config.lock().unwrap().clone();
    Ok(cfg.unwrap_or_else(ProviderConfigService::default_config))
}

#[tauri::command]
fn save_provider_config(config: ProviderConfig, api_key: Option<String>, state: State<'_, AppState>) -> Result<ProviderConfig, String> {
    let ws = state.workspace_root.lock().unwrap().clone()
        .ok_or_else(|| "No workspace opened".to_string())?;

    let config_svc = ProviderConfigService::new(&ws);

    let mut cfg = config.clone();
    if let Some(ref key) = api_key {
        if !key.is_empty() {
            config_svc.save_api_key(key)?;
            cfg.api_key_set = true;
            *state.provider_api_key.lock().unwrap() = Some(key.clone());
            eprintln!("[Codra Provider] API key saved (length: {})", key.len());
        }
    }

    config_svc.save_config(&cfg)?;
    *state.provider_config.lock().unwrap() = Some(cfg.clone());
    eprintln!("[Codra Provider] Config saved: {:?} / model: {}", cfg.kind, cfg.model_id);
    Ok(cfg)
}

#[tauri::command]
fn check_provider_health(state: State<'_, AppState>) -> Result<ProviderHealthResult, String> {
    let cfg = state.provider_config.lock().unwrap().clone()
        .unwrap_or_else(ProviderConfigService::default_config);
    let api_key = state.provider_api_key.lock().unwrap().clone();

    eprintln!("[Codra Provider] Running health check against {:?} at {}", cfg.kind, cfg.base_url);
    let provider = create_provider(&cfg, api_key.as_deref());
    provider.health_check()
}

#[tauri::command]
fn list_provider_models(state: State<'_, AppState>) -> Result<Vec<ModelDescriptor>, String> {
    let cfg = state.provider_config.lock().unwrap().clone()
        .unwrap_or_else(ProviderConfigService::default_config);
    let api_key = state.provider_api_key.lock().unwrap().clone();

    let provider = create_provider(&cfg, api_key.as_deref());
    provider.list_models()
}

#[tauri::command]
fn test_generation(prompt: String, state: State<'_, AppState>) -> Result<GenerationResponse, String> {
    let provider_box = resolve_provider_fast(&state);

    let request = GenerationRequest {
        mode: GenerationMode::PlanGeneration,
        system_prompt: "You are a helpful coding assistant.".to_string(),
        user_prompt: prompt,
        max_tokens: Some(512),
        temperature: Some(0.7),
    };

    eprintln!("[Codra Provider] Test generation with {} mode", if is_mock_mode(&state) { "mock" } else { "live" });
    provider_box.generate(&request)
}

#[tauri::command]
fn get_provider_readiness(state: State<'_, AppState>) -> Result<ProviderHealthResult, String> {
    // Quick readiness probe: returns cached-style result without hitting the network
    let cfg = state.provider_config.lock().unwrap().clone();
    match cfg {
        Some(ref c) => Ok(ProviderHealthResult {
            reachable: true, // Optimistic — real check is check_provider_health
            model_available: !c.model_id.is_empty(),
            status: ProviderStatus::Connected,
            message: format!("{:?} / {}", c.kind, c.model_id),
        }),
        None => Ok(ProviderHealthResult {
            reachable: true,
            model_available: true,
            status: ProviderStatus::Degraded,
            message: "Mock mode (no provider configured)".to_string(),
        }),
    }
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let config_dir = app.path().app_config_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let global_config = GlobalConfigService::new(config_dir);
            
            app.manage(AppState {
                workspace_root: Mutex::new(None),
                provider_config: Mutex::new(None),
                provider_api_key: Mutex::new(None),
                browser: Mutex::new(LocalBrowserService::new()),
                global_config: Mutex::new(global_config),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_health,
            open_workspace,
            get_app_boot_data,
            get_workspace_summary,
            list_workspace_entries,
            read_workspace_file,
            write_workspace_file,
            search_workspace,
            run_workspace_command,
            get_git_status,
            get_git_diff_summary,
            submit_task_for_planning,
            update_plan_status,
            start_execution,
            execute_step,
            submit_patch_decision,
            start_verification,
            generate_retry_proposal,
            start_repair_attempt,
            prepare_deployment,
            execute_browser_action,
            get_provider_config,
            save_provider_config,
            check_provider_health,
            list_provider_models,
            test_generation,
            get_provider_readiness,
            browser_launch_session,
            browser_close_session,
            browser_get_session_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
