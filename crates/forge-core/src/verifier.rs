use forge_protocol::{
    VerificationState, VerificationStatus, VerificationCheck, VerificationCheckKind,
    RetryRecommendation, RetryRequest
};
use crate::provider::VerificationProvider;
use std::path::PathBuf;
use std::fs;
use uuid::Uuid;

pub struct VerifierPersistence {
    root_path: PathBuf,
}

impl VerifierPersistence {
    pub fn new(workspace_root: &str) -> Self {
        let dir = PathBuf::from(workspace_root).join(".forge").join("verifications");
        let _ = fs::create_dir_all(&dir);
        Self { root_path: dir }
    }

    pub fn save_state(&self, state: &VerificationState) -> Result<(), String> {
        let file_path = self.root_path.join(format!("{}.json", state.id));
        let data = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
        fs::write(file_path, data).map_err(|e| e.to_string())
    }
}

pub struct VerificationService<'a> {
    persistence: VerifierPersistence,
    provider: &'a dyn VerificationProvider,
}

impl<'a> VerificationService<'a> {
    pub fn new(workspace_root: &str, provider: &'a dyn VerificationProvider) -> Self {
        Self {
            persistence: VerifierPersistence::new(workspace_root),
            provider,
        }
    }

    pub fn start_verification(&self, execution_id: &str, step_id: &str) -> Result<VerificationState, String> {
        let id = Uuid::new_v4().to_string();
        
        let check = VerificationCheck {
            id: Uuid::new_v4().to_string(),
            kind: VerificationCheckKind::TypecheckCommand,
            command: "cargo".to_string(),
            args: vec!["check".to_string()],
        };

        let mut state = VerificationState {
            id: id.clone(),
            execution_id: execution_id.to_string(),
            step_id: step_id.to_string(),
            status: VerificationStatus::Running,
            checks_configured: vec![check.clone()],
            findings: vec![],
            retry_recommendation: None,
            stdout: String::new(),
        };

        // Use injected provider for output analysis
        let (findings, stdout) = self.provider.parse_outputs(&check, "error[E0308]: mismatched types");
        
        state.stdout = stdout;
        state.findings = findings;

        if !state.findings.is_empty() {
            state.status = VerificationStatus::Failed;
            
            state.retry_recommendation = Some(RetryRecommendation {
                reason: "Type signatures diverge in the proposed patch.".to_string(),
                affected_files: vec!["src/main.rs".to_string()],
                suggested_action: "Fix the returned ActionIntent shape to match explicitly.".to_string(),
                allow_auto_execution: false,
            });
        } else {
            state.status = VerificationStatus::Passed;
        }

        self.persistence.save_state(&state)?;
        Ok(state)
    }

    pub fn generate_retry_payload(&self, state: &VerificationState) -> Result<RetryRequest, String> {
        let recommendation = state.retry_recommendation.as_ref()
            .ok_or_else(|| "No retry recommendation on verified state.".to_string())?;

        Ok(RetryRequest {
            id: Uuid::new_v4().to_string(),
            verification_id: state.id.clone(),
            execution_id: state.execution_id.clone(),
            step_id: state.step_id.clone(),
            failure_summary: recommendation.reason.clone(),
            findings: state.findings.clone(),
            suggested_scope: recommendation.suggested_action.clone(),
        })
    }
}
