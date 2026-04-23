// pub mod architect;
pub mod config;
pub mod deploy;
pub mod executor;
pub mod planner;
pub mod prompts;
pub mod provider;
pub mod provider_config;
pub mod repair;
pub mod services;
pub mod verifier;

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
