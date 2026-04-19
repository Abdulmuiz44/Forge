use forge_protocol::{ProviderConfig, ProviderKind};
use std::path::PathBuf;
use std::fs;

const CONFIG_FILE: &str = "provider_config.json";
const SECRET_FILE: &str = "provider_secret.key";

pub struct ProviderConfigService {
    config_dir: PathBuf,
}

impl ProviderConfigService {
    pub fn new(workspace_root: &str) -> Self {
        let dir = PathBuf::from(workspace_root).join(".forge");
        let _ = fs::create_dir_all(&dir);
        Self { config_dir: dir }
    }

    pub fn load_config(&self) -> Option<ProviderConfig> {
        let path = self.config_dir.join(CONFIG_FILE);
        let data = fs::read_to_string(path).ok()?;
        serde_json::from_str(&data).ok()
    }

    pub fn save_config(&self, config: &ProviderConfig) -> Result<(), String> {
        let path = self.config_dir.join(CONFIG_FILE);
        let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(path, data).map_err(|e| e.to_string())
    }

    pub fn save_api_key(&self, key: &str) -> Result<(), String> {
        let path = self.config_dir.join(SECRET_FILE);
        // Simple file-based storage. Not encrypted, but isolated from logs and general config.
        // The architecture is ready for a proper keyring/vault integration later.
        fs::write(path, key).map_err(|e| e.to_string())
    }

    pub fn load_api_key(&self) -> Option<String> {
        let path = self.config_dir.join(SECRET_FILE);
        fs::read_to_string(path).ok().map(|s| s.trim().to_string())
    }

    pub fn default_config() -> ProviderConfig {
        ProviderConfig {
            kind: ProviderKind::Ollama,
            base_url: "http://localhost:11434".to_string(),
            model_id: "llama3.2".to_string(),
            api_key_set: false,
        }
    }
}
