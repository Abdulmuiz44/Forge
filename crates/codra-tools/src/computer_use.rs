use codra_protocol::{ComputerUseAction, ComputerUseActionKind, ComputerUseResult};
use serde_json::json;

pub trait ComputerUseAdapter {
    fn execute(&self, action: &ComputerUseAction) -> ComputerUseResult;
}

pub struct WindowsComputerUseAdapter;

impl WindowsComputerUseAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl ComputerUseAdapter for WindowsComputerUseAdapter {
    fn execute(&self, action: &ComputerUseAction) -> ComputerUseResult {
        if action.requires_permission
            && action.kind != ComputerUseActionKind::ListApps
            && action.kind != ComputerUseActionKind::GetAppState
        {
            return ComputerUseResult {
                action_id: action.id.clone(),
                success: false,
                message: "Computer-use action requires explicit approval before execution."
                    .to_string(),
                state: None,
            };
        }

        match action.kind {
            ComputerUseActionKind::ListApps => ComputerUseResult {
                action_id: action.id.clone(),
                success: true,
                message: "Windows adapter available. App enumeration is intentionally permission-gated for production hardening.".to_string(),
                state: Some(json!({ "platform": "windows", "adapter": "codra-tools", "apps": [] })),
            },
            ComputerUseActionKind::GetAppState => ComputerUseResult {
                action_id: action.id.clone(),
                success: true,
                message: "Returned visible adapter state.".to_string(),
                state: Some(json!({ "target": action.target, "focused": false, "permissions": "explicit" })),
            },
            ComputerUseActionKind::RunSequence => ComputerUseResult {
                action_id: action.id.clone(),
                success: action.sequence.iter().all(|item| !item.requires_permission),
                message: format!("Validated {} computer-use actions for explicit execution.", action.sequence.len()),
                state: Some(json!({ "sequenceLength": action.sequence.len() })),
            },
            ComputerUseActionKind::PressKey | ComputerUseActionKind::TypeText | ComputerUseActionKind::ClickTarget => ComputerUseResult {
                action_id: action.id.clone(),
                success: false,
                message: "Direct keyboard, text, and click actions are exposed but require an approved platform executor.".to_string(),
                state: Some(json!({ "target": action.target, "textLength": action.text.as_ref().map(|v| v.len()).unwrap_or(0) })),
            },
        }
    }
}

pub fn default_adapter() -> WindowsComputerUseAdapter {
    WindowsComputerUseAdapter::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gated_actions_do_not_execute_without_approval() {
        let adapter = default_adapter();
        let result = adapter.execute(&ComputerUseAction {
            id: "a1".to_string(),
            kind: ComputerUseActionKind::ClickTarget,
            target: Some("button".to_string()),
            text: None,
            sequence: vec![],
            requires_permission: true,
        });
        assert!(!result.success);
    }
}
