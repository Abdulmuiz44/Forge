use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct GlobalConfig {
    pub last_workspace_path: Option<String>,
}

pub struct GlobalConfigService {
    config_path: PathBuf,
}

impl GlobalConfigService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let global_dir = std::env::var("USERPROFILE")
            .map(|home| PathBuf::from(home).join(".codra"))
            .unwrap_or_else(|_| app_data_dir.join("codra-global"));
        let _ = fs::create_dir_all(&global_dir);
        let config_path = global_dir.join("config.json");
        Self { config_path }
    }

    pub fn load(&self) -> GlobalConfig {
        if let Ok(content) = fs::read_to_string(&self.config_path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            GlobalConfig::default()
        }
    }

    pub fn save(&self, config: &GlobalConfig) -> Result<(), String> {
        let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(&self.config_path, content).map_err(|e| e.to_string())
    }

    pub fn set_last_workspace(&self, path: String) -> Result<(), String> {
        let mut config = self.load();
        config.last_workspace_path = Some(path);
        self.save(&config)
    }
}
