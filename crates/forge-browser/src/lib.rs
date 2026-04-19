use forge_protocol::{BrowserActionRequest, BrowserActionResult};

pub struct LocalBrowserService {
    _session_active: bool,
}

impl LocalBrowserService {
    pub fn new() -> Self {
        Self { _session_active: false }
    }

    pub fn attach_session(&mut self) -> Result<(), String> {
        self._session_active = true;
        Ok(())
    }

    pub fn execute_action(&self, request: &BrowserActionRequest) -> Result<BrowserActionResult, String> {
        // Thin MVP: We map the strict Protocol commands directly to simulated DOM responses
        match request.action_kind.as_str() {
            "open_url" => {
                Ok(BrowserActionResult {
                    success: true,
                    message: format!("Navigated to {}", request.value),
                    screenshot_base64: None,
                })
            },
            "click_selector" => {
                Ok(BrowserActionResult {
                    success: true,
                    message: format!("Clicked element matching '{}'", request.value),
                    screenshot_base64: None,
                })
            },
            _ => Ok(BrowserActionResult {
                success: true,
                message: "Action completed.".to_string(),
                screenshot_base64: None,
            })
        }
    }
}
