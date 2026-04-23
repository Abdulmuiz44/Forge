use crate::provider::IntelligenceProvider;
use chrono::Utc;
use codra_protocol::{
    GenerationMode, GenerationRequest, PatchProposal, PatchProposalStatus, RepairAttempt,
    RepairAttemptStatus, RetryRequest,
};
use uuid::Uuid;

pub struct RepairService<'a> {
    _workspace_root: String,
    provider: &'a dyn IntelligenceProvider,
}

impl<'a> RepairService<'a> {
    pub fn new(workspace_root: &str, provider: &'a dyn IntelligenceProvider) -> Self {
        Self {
            _workspace_root: workspace_root.to_string(),
            provider,
        }
    }

    pub fn construct_repair_attempt(
        &self,
        retry_request: &RetryRequest,
    ) -> Result<RepairAttempt, String> {
        let attempt_number = 1;
        let max_retries = 3;

        if attempt_number > max_retries {
            return Err("Repair budget exhausted for this verification boundary.".to_string());
        }

        // Use real provider to generate targeted repair diff
        let request = GenerationRequest {
            mode: GenerationMode::RepairGeneration,
            system_prompt: crate::prompts::REPAIR_SYSTEM_PROMPT.to_string(),
            user_prompt: format!(
                "Failure summary: {}\nSuggested scope: {}\nAffected findings:\n{}",
                retry_request.failure_summary,
                retry_request.suggested_scope,
                retry_request
                    .findings
                    .iter()
                    .map(|f| format!("- [{}] {}", format!("{:?}", f.classification), f.message))
                    .collect::<Vec<_>>()
                    .join("\n")
            ),
            max_tokens: Some(1024),
            temperature: Some(0.2),
        };

        let diff_content = match self.provider.generate(&request) {
            Ok(response) => response.content,
            Err(e) => {
                // Explicit fallback: still produce the attempt structure but note the failure
                format!(
                    "// Provider repair generation failed: {}\n// Manual intervention required",
                    e
                )
            }
        };

        let target_file = retry_request
            .findings
            .first()
            .and_then(|f| f.affected_files.first().cloned())
            .unwrap_or_else(|| "src/main.rs".to_string());

        let patch = PatchProposal {
            id: Uuid::new_v4().to_string(),
            step_id: retry_request.step_id.clone(),
            target_file,
            rationale: format!(
                "Attempt {}: {}",
                attempt_number, retry_request.suggested_scope
            ),
            diff_content,
            status: PatchProposalStatus::ReadyForReview,
            timestamp: Utc::now().to_rfc3339(),
        };

        Ok(RepairAttempt {
            id: Uuid::new_v4().to_string(),
            verification_id: retry_request.verification_id.clone(),
            status: RepairAttemptStatus::AwaitingApproval,
            proposed_patch: Some(patch),
            error: None,
            attempt_number,
        })
    }
}
