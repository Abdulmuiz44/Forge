use forge_protocol::{TaskRequest, TaskContext, ExecutionPlan, PlanStatus};
use crate::provider::ModelProvider;
use std::path::PathBuf;
use std::fs;

// --- Persistence Service ---
pub struct PlanPersistenceService {
    root_path: PathBuf,
}

impl PlanPersistenceService {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        let root_path = root.into();
        let plans_dir = root_path.join(".forge").join("plans");
        let _ = fs::create_dir_all(&plans_dir);
        Self { root_path: plans_dir }
    }

    pub fn save_plan(&self, plan: &ExecutionPlan) -> Result<(), String> {
        let file_path = self.root_path.join(format!("{}.json", plan.id));
        let data = serde_json::to_string_pretty(plan).map_err(|e| e.to_string())?;
        fs::write(file_path, data).map_err(|e| e.to_string())
    }

    pub fn load_plan(&self, plan_id: &str) -> Result<ExecutionPlan, String> {
        let file_path = self.root_path.join(format!("{}.json", plan_id));
        let data = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())
    }
}

// --- Planner Core Service ---
pub struct PlannerService<'a> {
    workspace_root: String,
    persistence: PlanPersistenceService,
    provider: &'a dyn ModelProvider,
}

impl<'a> PlannerService<'a> {
    pub fn new(workspace_root: &str, provider: &'a dyn ModelProvider) -> Self {
        Self {
            workspace_root: workspace_root.to_string(),
            persistence: PlanPersistenceService::new(workspace_root),
            provider,
        }
    }

    pub fn create_plan(&self, request: TaskRequest) -> Result<ExecutionPlan, String> {
        // Assemble Context
        let context = TaskContext {
            workspace_id: "local-ws".to_string(),
            workspace_path: self.workspace_root.clone(),
            intent: request.intent.clone(),
            recent_searches: vec![],
            recent_files: vec![],
        };

        let mut output = self.provider.generate_plan(&context)?;
        output.plan.task_id = request.id.clone();
        
        // Persist Draft
        self.persistence.save_plan(&output.plan)?;
        
        Ok(output.plan)
    }

    pub fn update_plan_status(&self, plan_id: &str, new_status: PlanStatus) -> Result<ExecutionPlan, String> {
        let mut plan = self.persistence.load_plan(plan_id)?;
        plan.status = new_status;
        self.persistence.save_plan(&plan)?;
        Ok(plan)
    }
}
