use headless_chrome::{Browser, LaunchOptions, Tab};
use std::sync::Arc;
use codra_protocol::*;
use std::path::PathBuf;
use std::fs;
use chrono::Utc;
use base64::{Engine as _, engine::general_purpose};

pub struct BrowserSession {
    _browser: Browser,
    active_tab: Arc<Tab>,
    workspace_root: PathBuf,
}

impl BrowserSession {
    pub fn launch(workspace_root: PathBuf) -> Result<Self, String> {
        let options = LaunchOptions::default_builder()
            .headless(true) // Start headless by default for MVP
            .build()
            .map_err(|e| format!("Failed to build launch options: {}", e))?;

        let browser = Browser::new(options)
            .map_err(|e| format!("Failed to launch browser: {}", e))?;

        let active_tab = browser.new_tab()
            .map_err(|e| format!("Failed to create initial tab: {}", e))?;

        // Ensure artifact directory exists
        let artifact_dir = workspace_root.join(".codra/browser/artifacts");
        if !artifact_dir.exists() {
            fs::create_dir_all(&artifact_dir).map_err(|e| e.to_string())?;
        }

        Ok(Self {
            _browser: browser,
            active_tab,
            workspace_root,
        })
    }

    pub fn execute_action(&self, request: &BrowserActionRequest) -> Result<BrowserActionResult, String> {
        match request.kind {
            BrowserActionKind::OpenUrl => self.navigate(&request.value, &request.id),
            BrowserActionKind::CaptureScreenshot => self.screenshot(&request.id),
            BrowserActionKind::ClickSelector => self.click(&request.value, &request.id),
            BrowserActionKind::TypeSelector => self.type_text(&request.value, request.text_input.as_deref().unwrap_or(""), &request.id),
            BrowserActionKind::WaitForSelector => self.wait_for(&request.value, &request.id),
            BrowserActionKind::ExtractText => self.extract(&request.value, &request.id),
            BrowserActionKind::GetPageState => self.get_state(&request.id),
        }
    }

    fn navigate(&self, url: &str, action_id: &str) -> Result<BrowserActionResult, String> {
        self.active_tab.navigate_to(url)
            .map_err(|e| e.to_string())?;
        
        self.active_tab.wait_until_navigated()
            .map_err(|e| e.to_string())?;

        Ok(BrowserActionResult {
            action_id: action_id.to_string(),
            success: true,
            message: format!("Navigated to {}", url),
            artifact_path: None,
            screenshot_base64: None,
        })
    }

    fn screenshot(&self, action_id: &str) -> Result<BrowserActionResult, String> {
        let png_data = self.active_tab.capture_screenshot(
            headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Png,
            None,
            None,
            true
        ).map_err(|e| e.to_string())?;

        let filename = format!("screenshot_{}_{}.png", action_id, Utc::now().timestamp());
        let relative_path = format!(".codra/browser/artifacts/{}", filename);
        let full_path = self.workspace_root.join(&relative_path);

        fs::write(&full_path, &png_data).map_err(|e| e.to_string())?;

        let b64 = general_purpose::STANDARD.encode(&png_data);

        Ok(BrowserActionResult {
            action_id: action_id.to_string(),
            success: true,
            message: "Screenshot captured".to_string(),
            artifact_path: Some(relative_path),
            screenshot_base64: Some(b64),
        })
    }

    fn click(&self, selector: &str, action_id: &str) -> Result<BrowserActionResult, String> {
        let element = self.active_tab.wait_for_element(selector)
            .map_err(|e| format!("Selector '{}' not found: {}", selector, e))?;
        
        element.click()
            .map_err(|e| e.to_string())?;

        Ok(BrowserActionResult {
            action_id: action_id.to_string(),
            success: true,
            message: format!("Clicked element: {}", selector),
            artifact_path: None,
            screenshot_base64: None,
        })
    }

    fn type_text(&self, selector: &str, text: &str, action_id: &str) -> Result<BrowserActionResult, String> {
        let element = self.active_tab.wait_for_element(selector)
            .map_err(|e| format!("Selector '{}' not found: {}", selector, e))?;
        
        element.click()
            .map_err(|e| e.to_string())?;

        self.active_tab.type_str(text)
            .map_err(|e| e.to_string())?;

        Ok(BrowserActionResult {
            action_id: action_id.to_string(),
            success: true,
            message: format!("Typed text into: {}", selector),
            artifact_path: None,
            screenshot_base64: None,
        })
    }

    fn wait_for(&self, selector: &str, action_id: &str) -> Result<BrowserActionResult, String> {
        self.active_tab.wait_for_element(selector)
            .map_err(|e| e.to_string())?;

        Ok(BrowserActionResult {
            action_id: action_id.to_string(),
            success: true,
            message: format!("Element appeared: {}", selector),
            artifact_path: None,
            screenshot_base64: None,
        })
    }

    fn extract(&self, selector: &str, action_id: &str) -> Result<BrowserActionResult, String> {
        let element = self.active_tab.wait_for_element(selector)
            .map_err(|e| e.to_string())?;
        
        let text = element.get_inner_text()
            .map_err(|e| e.to_string())?;

        Ok(BrowserActionResult {
            action_id: action_id.to_string(),
            success: true,
            message: text,
            artifact_path: None,
            screenshot_base64: None,
        })
    }

    fn get_state(&self, action_id: &str) -> Result<BrowserActionResult, String> {
        let url = self.active_tab.get_url();
        let title = self.active_tab.get_title().unwrap_or_default();

        Ok(BrowserActionResult {
            action_id: action_id.to_string(),
            success: true,
            message: format!("Current Page: {} - {}", title, url),
            artifact_path: None,
            screenshot_base64: None,
        })
    }

    pub fn get_status(&self) -> BrowserSessionState {
        BrowserSessionState {
            status: BrowserSessionStatus::Ready,
            current_target: Some(BrowserTargetInfo {
                url: self.active_tab.get_url(),
                title: self.active_tab.get_title().unwrap_or_default(),
            }),
            last_error: None,
        }
    }
}
