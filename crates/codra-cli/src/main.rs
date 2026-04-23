use codra_core::provider::{create_provider, EchoMockProvider, IntelligenceProvider};
use codra_core::provider_config::ProviderConfigService;
use codra_protocol::{McpServerInfo, ProviderConfig, ProviderKind};
use codra_tools::design::load_design_system;
use codra_tools::registry::builtin_tool_definitions;
use std::env;
use std::io::{self, Write};
use std::path::PathBuf;

fn main() {
    let mut args = env::args().skip(1).collect::<Vec<_>>();
    let command = args.first().map(String::as_str).unwrap_or("help");
    let result = match command {
        "smoke" => smoke(),
        "provider" => {
            args.remove(0);
            if args.first().map(String::as_str) == Some("check") {
                provider_check()
            } else {
                help()
            }
        }
        "headless" => headless(
            args.get(1)
                .cloned()
                .unwrap_or_else(|| "Inspect workspace and report readiness.".to_string()),
        ),
        "mcp-server" => mcp_server(),
        _ => help(),
    };

    if let Err(err) = result {
        eprintln!("codra: {}", err);
        std::process::exit(1);
    }
}

fn workspace_root() -> PathBuf {
    env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn smoke() -> Result<(), String> {
    let root = workspace_root();
    let tools = builtin_tool_definitions();
    let design = load_design_system(&root);
    println!("Codra smoke check");
    println!("workspace: {}", root.display());
    println!("tools: {} registered", tools.len());
    println!(
        "design.md: {}",
        if design.found { "found" } else { "missing" }
    );
    println!(
        "mock provider: {}",
        EchoMockProvider::new().health_check()?.message
    );
    Ok(())
}

fn provider_check() -> Result<(), String> {
    let root = workspace_root();
    let config_service = ProviderConfigService::new(root.to_string_lossy().as_ref());
    let cfg = config_service
        .load_config()
        .unwrap_or_else(default_provider_config);
    let key = env::var("CODRA_API_KEY")
        .ok()
        .or_else(|| config_service.load_api_key());
    let health = create_provider(&cfg, key.as_deref()).health_check()?;
    println!("provider: {:?} / {}", cfg.kind, cfg.model_id);
    println!("status: {:?}", health.status);
    println!("message: {}", health.message);
    Ok(())
}

fn headless(intent: String) -> Result<(), String> {
    let root = workspace_root();
    println!("Codra headless run");
    println!("workspace: {}", root.display());
    println!("intent: {}", intent);
    println!("mode: dry-run planning surface; use desktop app for approval-gated execution");
    println!("tools: {} registered", builtin_tool_definitions().len());
    Ok(())
}

fn mcp_server() -> Result<(), String> {
    let info = McpServerInfo {
        name: "codra".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        tools: builtin_tool_definitions(),
    };
    let json = serde_json::to_string_pretty(&info).map_err(|e| e.to_string())?;
    println!("{}", json);
    let _ = io::stdout().flush();
    Ok(())
}

fn default_provider_config() -> ProviderConfig {
    ProviderConfig {
        kind: ProviderKind::Mock,
        base_url: String::new(),
        model_id: "echo-mock".to_string(),
        api_key_set: false,
        profile_id: "mock".to_string(),
        profile_name: "Offline Mock".to_string(),
    }
}

fn help() -> Result<(), String> {
    println!("codra <command>");
    println!("  smoke             Validate local tool registry and workspace readiness");
    println!("  provider check    Check active provider health");
    println!("  headless <intent> Run a dry-run headless planning surface");
    println!("  mcp-server        Print MCP-compatible server/tool metadata");
    Ok(())
}
