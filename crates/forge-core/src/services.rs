use forge_protocol::*;

pub trait WorkspaceService {
    fn open_workspace(&self, path: &str) -> Result<WorkspaceSummary, String>;
    fn list_entries(&self, workspace_id: &str, relative_path: Option<&str>) -> Result<Vec<FileEntry>, String>;
}

pub trait RepoService {
    fn get_status(&self, workspace_id: &str) -> Result<GitStatusSummary, String>;
    fn get_diff_summary(&self, workspace_id: &str) -> Result<String, String>;
}

pub trait SearchService {
    fn search(&self, workspace_id: &str, query: SearchQuery) -> Result<Vec<SearchMatch>, String>;
}

pub trait FileService {
    fn read_file(&self, workspace_id: &str, path: &str) -> Result<FileReadResult, String>;
    fn write_file(&self, workspace_id: &str, request: FileWriteRequest) -> Result<FileWriteResult, String>;
}

pub trait ExecutionService {
    fn execute_command(&self, workspace_id: &str, request: CommandExecutionRequest) -> Result<CommandExecutionResult, String>;
}

pub trait CheckpointService {
    fn create_checkpoint(&self, workspace_id: &str, target_path: &str, operation: &str) -> Result<CheckpointRecord, String>;
}
