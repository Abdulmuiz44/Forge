pub mod managed;

use codra_protocol::*;
pub use managed::BrowserSession;
use std::path::PathBuf;

pub struct LocalBrowserService {
    session: Option<BrowserSession>,
}

impl LocalBrowserService {
    pub fn new() -> Self {
        Self { session: None }
    }

    pub fn launch(&mut self, workspace_root: PathBuf) -> Result<(), String> {
        let session = BrowserSession::launch(workspace_root)?;
        self.session = Some(session);
        Ok(())
    }

    pub fn close(&mut self) -> Result<(), String> {
        self.session = None;
        Ok(())
    }

    pub fn execute_action(
        &self,
        request: &BrowserActionRequest,
    ) -> Result<BrowserActionResult, String> {
        if let Some(ref session) = self.session {
            session.execute_action(request)
        } else {
            Err("No active browser session. Launch a session first.".to_string())
        }
    }

    pub fn get_state(&self) -> BrowserSessionState {
        if let Some(ref session) = self.session {
            session.get_status()
        } else {
            BrowserSessionState {
                status: BrowserSessionStatus::Disconnected,
                current_target: None,
                last_error: None,
                artifacts: vec![],
                event_log: vec![],
            }
        }
    }
}
