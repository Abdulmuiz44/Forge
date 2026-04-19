use std::process::Command;
use forge_protocol::{GitStatusSummary};
use std::path::PathBuf;

pub struct LocalGit {
    root_path: PathBuf,
}

impl LocalGit {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self {
            root_path: root.into()
        }
    }

    pub fn get_status(&self) -> Result<GitStatusSummary, String> {
        let output = Command::new("git")
            .arg("status")
            .arg("--porcelain")
            .arg("-b")
            .current_dir(&self.root_path)
            .output();

        if let Ok(out) = output {
            if !out.status.success() {
                return Ok(GitStatusSummary {
                    is_git: false,
                    branch: None,
                    changed_files: 0
                });
            }
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut lines = stdout.lines();
            
            let mut branch = None;
            if let Some(first_line) = lines.next() {
                if first_line.starts_with("##") {
                    let parts: Vec<&str> = first_line.split("...").collect();
                    branch = Some(parts[0].replace("## ", "").trim().to_string());
                }
            }

            let changed_files = lines.count(); // everything else is a changed file in porcelain

            Ok(GitStatusSummary {
                is_git: true,
                branch,
                changed_files
            })
        } else {
            Ok(GitStatusSummary {
                is_git: false,
                branch: None,
                changed_files: 0
            })
        }
    }

    pub fn get_diff_summary(&self) -> Result<String, String> {
        let output = Command::new("git")
            .arg("diff")
            .arg("--stat")
            .current_dir(&self.root_path)
            .output()
            .map_err(|e| e.to_string())?;

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}
