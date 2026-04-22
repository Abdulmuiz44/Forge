use codra_protocol::{DeployPrepSummary, DeployTargetKind};
use std::path::PathBuf;
use std::fs;
use uuid::Uuid;

pub struct DeployPrepService {
    workspace_root: PathBuf,
}

impl DeployPrepService {
    pub fn new(workspace_root: &str) -> Self {
        Self {
            workspace_root: PathBuf::from(workspace_root),
        }
    }

    pub fn evaluate_workspace(&self) -> Result<DeployPrepSummary, String> {
        let mut target_kind = DeployTargetKind::Unknown;
        let mut commands = Vec::new();
        let mut detected = Vec::new();
        let mut risks = Vec::new();

        let package_json = self.workspace_root.join("package.json");
        let cargo_toml = self.workspace_root.join("Cargo.toml");

        if package_json.exists() {
            let content = fs::read_to_string(&package_json).unwrap_or_default();
            if content.contains("\"next\":") {
                target_kind = DeployTargetKind::NodeWebApp;
                detected.push("package.json (Next.js)".to_string());
                commands.push("npm run build".to_string());
                commands.push("npx vercel deploy".to_string());
            } else if content.contains("\"tauri\":") || content.contains("@tauri-apps") {
                target_kind = DeployTargetKind::TauriDesktop;
                detected.push("package.json (Tauri config)".to_string());
                commands.push("npm run tauri build".to_string());
                risks.push("Requires OS-specific bundling certificates.".to_string());
            } else {
                target_kind = DeployTargetKind::NodeWebApp;
                detected.push("package.json".to_string());
                commands.push("npm run build".to_string());
            }
        } else if cargo_toml.exists() {
            target_kind = DeployTargetKind::RustService;
            detected.push("Cargo.toml".to_string());
            commands.push("cargo build --release".to_string());
            risks.push("Binary deployment requires target matching.".to_string());
        } else {
            risks.push("No explicit framework manifests detected.".to_string());
        }

        Ok(DeployPrepSummary {
            id: Uuid::new_v4().to_string(),
            target_kind,
            detected_roots: detected,
            proposed_commands: commands,
            risks,
        })
    }
}
