use codra_protocol::{ToolCategory, ToolDefinition, ToolSafetyLevel};
use serde_json::json;

fn schema(properties: serde_json::Value, required: Vec<&str>) -> serde_json::Value {
    json!({
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": false
    })
}

pub fn builtin_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "fs.read".to_string(),
            display_name: "Read file".to_string(),
            description: "Read a workspace file without mutating state.".to_string(),
            category: ToolCategory::Filesystem,
            safety_level: ToolSafetyLevel::ReadOnly,
            input_schema: schema(json!({ "path": { "type": "string" } }), vec!["path"]),
        },
        ToolDefinition {
            name: "fs.write_checkpointed".to_string(),
            display_name: "Write file with checkpoint".to_string(),
            description: "Write a workspace file after approval and create a checkpoint."
                .to_string(),
            category: ToolCategory::Filesystem,
            safety_level: ToolSafetyLevel::WorkspaceWrite,
            input_schema: schema(
                json!({ "path": { "type": "string" }, "content": { "type": "string" } }),
                vec!["path", "content"],
            ),
        },
        ToolDefinition {
            name: "search.grep".to_string(),
            display_name: "Search workspace".to_string(),
            description: "Search non-ignored workspace files for a pattern.".to_string(),
            category: ToolCategory::Search,
            safety_level: ToolSafetyLevel::ReadOnly,
            input_schema: schema(
                json!({ "pattern": { "type": "string" }, "directory": { "type": ["string", "null"] } }),
                vec!["pattern"],
            ),
        },
        ToolDefinition {
            name: "terminal.run".to_string(),
            display_name: "Run command".to_string(),
            description: "Run an approved command in the workspace root.".to_string(),
            category: ToolCategory::Terminal,
            safety_level: ToolSafetyLevel::Destructive,
            input_schema: schema(
                json!({ "command": { "type": "string" }, "args": { "type": "array", "items": { "type": "string" } } }),
                vec!["command", "args"],
            ),
        },
        ToolDefinition {
            name: "git.status".to_string(),
            display_name: "Git status".to_string(),
            description: "Inspect repository status and changed file count.".to_string(),
            category: ToolCategory::Git,
            safety_level: ToolSafetyLevel::ReadOnly,
            input_schema: schema(json!({}), vec![]),
        },
        ToolDefinition {
            name: "browser.navigate".to_string(),
            display_name: "Navigate browser".to_string(),
            description: "Navigate the isolated CDP browser session.".to_string(),
            category: ToolCategory::Browser,
            safety_level: ToolSafetyLevel::ExternalNetwork,
            input_schema: schema(json!({ "url": { "type": "string" } }), vec!["url"]),
        },
        ToolDefinition {
            name: "computer_use.sequence".to_string(),
            display_name: "Computer action sequence".to_string(),
            description: "Run explicit, permission-aware OS interaction actions.".to_string(),
            category: ToolCategory::ComputerUse,
            safety_level: ToolSafetyLevel::ComputerControl,
            input_schema: schema(json!({ "sequence": { "type": "array" } }), vec!["sequence"]),
        },
        ToolDefinition {
            name: "design.lint".to_string(),
            display_name: "Lint DESIGN.md".to_string(),
            description: "Parse and lint project-level DESIGN.md tokens and rationale.".to_string(),
            category: ToolCategory::Design,
            safety_level: ToolSafetyLevel::ReadOnly,
            input_schema: schema(json!({ "path": { "type": ["string", "null"] } }), vec![]),
        },
        ToolDefinition {
            name: "deploy.prepare".to_string(),
            display_name: "Prepare deploy".to_string(),
            description: "Detect deploy target, commands, and risks without deploying.".to_string(),
            category: ToolCategory::Deploy,
            safety_level: ToolSafetyLevel::ReadOnly,
            input_schema: schema(json!({}), vec![]),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_tools_have_unique_names() {
        let mut names = builtin_tool_definitions()
            .into_iter()
            .map(|t| t.name)
            .collect::<Vec<_>>();
        names.sort();
        names.dedup();
        assert!(names.len() >= 9);
    }
}
