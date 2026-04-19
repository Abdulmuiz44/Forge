use forge_protocol::{CommandExecutionRequest, CommandExecutionResult};
use std::process::Command;
use std::path::PathBuf;

pub struct LocalTerminal {
    root_path: PathBuf,
}

impl LocalTerminal {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self {
            root_path: root.into()
        }
    }

    pub fn execute(&self, req: CommandExecutionRequest) -> Result<CommandExecutionResult, String> {
        let mut cmd = Command::new(&req.command);
        cmd.args(&req.args);
        cmd.current_dir(&self.root_path);

        match cmd.output() {
            Ok(output) => {
                Ok(CommandExecutionResult {
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    exit_code: output.status.code().unwrap_or(-1),
                })
            }
            Err(e) => {
                Err(format!("Execution failed: {}", e))
            }
        }
    }
}
