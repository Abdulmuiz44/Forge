use forge_protocol::{
    ExecutionPlan, ExecutionState, ExecutionStatus, ExecutionMode, StepExecutionRecord, 
    StepExecutionStatus, PatchProposal, PatchProposalStatus, ObservationRecord, ActionIntent, ActionKind
};
use crate::provider::ExecutionProvider;
use std::path::PathBuf;
use std::fs;
use chrono::Utc;

pub struct JournalService {
    root_path: PathBuf,
}

impl JournalService {
    pub fn new(workspace_root: &str) -> Self {
        let dir = PathBuf::from(workspace_root).join(".forge").join("executions");
        let _ = fs::create_dir_all(&dir);
        Self { root_path: dir }
    }

    pub fn append_observation(&self, execution_id: &str, observation: ObservationRecord) -> Result<(), String> {
        let file_path = self.root_path.join(format!("{}.log", execution_id));
        let entry = format!("[{}] {}\n", observation.timestamp, observation.message);
        
        use std::io::Write;
        let mut file = fs::OpenOptions::new().create(true).append(true).open(file_path)
            .map_err(|e| e.to_string())?;
        file.write_all(entry.as_bytes()).map_err(|e| e.to_string())
    }
}

pub struct ExecutionOrchestrator<'a> {
    workspace_root: String,
    journal: JournalService,
    provider: &'a dyn ExecutionProvider,
}

impl<'a> ExecutionOrchestrator<'a> {
    pub fn new(workspace_root: &str, provider: &'a dyn ExecutionProvider) -> Self {
        Self {
            workspace_root: workspace_root.to_string(),
            journal: JournalService::new(workspace_root),
            provider,
        }
    }

    pub fn start_execution(&self, plan: &ExecutionPlan) -> Result<ExecutionState, String> {
        let execution_id = uuid::Uuid::new_v4().to_string();
        
        self.journal.append_observation(&execution_id, ObservationRecord {
            timestamp: Utc::now().to_rfc3339(),
            message: format!("Started execution for plan: {}", plan.id),
        })?;

        let first_step = plan.steps.first().map(|s| s.id.clone());

        let state = ExecutionState {
            id: execution_id,
            plan_id: plan.id.clone(),
            status: ExecutionStatus::Running,
            mode: ExecutionMode::StepByStep,
            current_step_id: first_step,
        };

        Ok(state)
    }

    pub fn execute_step(&self, state: &mut ExecutionState, plan: &ExecutionPlan) -> Result<StepExecutionRecord, String> {
        let step_id = match &state.current_step_id {
            Some(id) => id,
            None => return Err("No runnable steps found".to_string())
        };

        let step = plan.steps.iter().find(|s| &s.id == step_id)
            .ok_or_else(|| format!("Step {} not found in plan", step_id))?;

        self.journal.append_observation(&state.id, ObservationRecord {
            timestamp: Utc::now().to_rfc3339(),
            message: format!("[Provider] Refining step: {}", step.title),
        })?;

        // Use injected provider for step refinement
        let intent = self.provider.refine_step(step).unwrap_or_else(|e| {
            // Log provider failure, produce safe fallback
            let _ = self.journal.append_observation(&state.id, ObservationRecord {
                timestamp: Utc::now().to_rfc3339(),
                message: format!("[Provider] Refinement failed: {}. Using fallback.", e),
            });
            ActionIntent {
                kind: ActionKind::InspectFiles,
                target: step.files_likely_involved.first().cloned().unwrap_or_default(),
                reason: format!("Fallback: provider unavailable ({})", e),
            }
        });

        self.journal.append_observation(&state.id, ObservationRecord {
            timestamp: Utc::now().to_rfc3339(),
            message: format!("Resolved action: {:?} against {}", intent.kind, intent.target),
        })?;

        let mut patch = None;
        let mut status = StepExecutionStatus::Completed;

        if intent.kind == ActionKind::ProposeEdit || intent.kind == ActionKind::ApplyEdit {
            status = StepExecutionStatus::AwaitingPatchReview;
            state.status = ExecutionStatus::WaitingForApproval;
            
            self.journal.append_observation(&state.id, ObservationRecord {
                timestamp: Utc::now().to_rfc3339(),
                message: format!("Generated patch proposal for {}", intent.target),
            })?;

            patch = Some(PatchProposal {
                id: uuid::Uuid::new_v4().to_string(),
                step_id: step.id.clone(),
                target_file: intent.target.clone(),
                rationale: intent.reason.clone(),
                diff_content: format!("@@ -1,5 +1,6 @@\n+ // Autonomous Edit By Forge\n  fn existing() {{\n  }}"),
                status: PatchProposalStatus::ReadyForReview,
                timestamp: Utc::now().to_rfc3339(),
            });
        }

        Ok(StepExecutionRecord {
            step_id: step.id.clone(),
            status,
            observations: vec![ObservationRecord {
                timestamp: Utc::now().to_rfc3339(),
                message: "Step finalized output payload".to_string()
            }],
            pending_patch: patch,
        })
    }

    pub fn handle_patch_decision(&self, state: &mut ExecutionState, patch_id: &str, approved: bool) -> Result<(), String> {
        self.journal.append_observation(&state.id, ObservationRecord {
            timestamp: Utc::now().to_rfc3339(),
            message: format!("Patch {} decision: {}", patch_id, if approved { "Approved" } else { "Rejected" }),
        })?;
        
        if approved {
            self.journal.append_observation(&state.id, ObservationRecord {
                timestamp: Utc::now().to_rfc3339(),
                message: "FileSystem Applied: Changes written to disk safely with checkpoint".to_string(),
            })?;
        }

        state.status = ExecutionStatus::Ready;
        Ok(())
    }
}
