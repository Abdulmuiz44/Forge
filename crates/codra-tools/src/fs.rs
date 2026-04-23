use chrono::Utc;
use codra_protocol::{
    CheckpointRecord, FileEntry, FileReadResult, FileWriteRequest, FileWriteResult,
};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

pub struct LocalFileSystem {
    root_path: PathBuf,
}

impl LocalFileSystem {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self {
            root_path: root.into(),
        }
    }

    fn resolve_safe_path(&self, rel_path: &str) -> Result<PathBuf, String> {
        let joined = self.root_path.join(rel_path);
        // Canonicalize carefully and ensure it starts with root_path
        let resolved = joined.canonicalize().unwrap_or(joined);
        let root_canon = self
            .root_path
            .canonicalize()
            .unwrap_or_else(|_| self.root_path.clone());
        if !resolved.starts_with(&root_canon) {
            return Err("Security Error: Path escape detected".to_string());
        }
        Ok(resolved)
    }

    pub fn list_entries(&self, rel_path: Option<&str>) -> Result<Vec<FileEntry>, String> {
        let path_to_list = match rel_path {
            Some(p) => self.resolve_safe_path(p)?,
            None => self.root_path.clone(),
        };

        let mut entries = Vec::new();
        if path_to_list.is_dir() {
            for entry in fs::read_dir(path_to_list).map_err(|e| e.to_string())? {
                let entry = entry.map_err(|e| e.to_string())?;
                let file_type = entry.file_type().map_err(|e| e.to_string())?;
                let file_name = entry.file_name().into_string().unwrap_or_default();
                let full_path = entry.path().to_string_lossy().into_owned();

                entries.push(FileEntry {
                    name: file_name,
                    path: full_path,
                    is_directory: file_type.is_dir(),
                });
            }
        }
        Ok(entries)
    }

    pub fn read_file(&self, rel_path: &str) -> Result<FileReadResult, String> {
        let target = self.resolve_safe_path(rel_path)?;
        if !target.is_file() {
            return Err("Target is not a file".to_string());
        }
        let content = fs::read_to_string(target).map_err(|e| e.to_string())?;
        Ok(FileReadResult { content })
    }

    pub fn write_file_with_checkpoint(
        &self,
        workspace_id: &str,
        req: FileWriteRequest,
    ) -> Result<FileWriteResult, String> {
        let target = self.resolve_safe_path(&req.path)?;

        let checkpoint_id = Uuid::new_v4().to_string();

        // Primitive checkpoint representation (in reality we'd save the diff or backup the file)
        let _chk = CheckpointRecord {
            id: checkpoint_id.clone(),
            workspace_id: workspace_id.to_string(),
            timestamp: Utc::now().to_rfc3339(),
            target_path: target.to_string_lossy().to_string(),
            operation_type: "WRITE".to_string(),
            status: "CREATED".to_string(),
        };

        // Write the file
        fs::write(&target, req.content).map_err(|e| e.to_string())?;

        Ok(FileWriteResult {
            success: true,
            checkpoint_id: Some(checkpoint_id),
            error: None,
        })
    }
}
