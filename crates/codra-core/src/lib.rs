// pub mod architect;
pub mod planner;
pub mod verifier;
pub mod services;
pub mod provider;
pub mod executor;
pub mod repair;
pub mod deploy;
pub mod prompts;
pub mod provider_config;
pub mod config;

pub struct ExecutionContext {
    pub task_id: String,
    pub status: String,
}

impl ExecutionContext {
    pub fn new(task_id: impl Into<String>) -> Self {
        Self {
            task_id: task_id.into(),
            status: "IDLE".to_string(),
        }
    }
}
