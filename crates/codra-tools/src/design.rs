use codra_protocol::{DesignSystemSummary, DesignToken};
use std::fs;
use std::path::{Path, PathBuf};

pub fn load_design_system(workspace_root: impl AsRef<Path>) -> DesignSystemSummary {
    let path = workspace_root.as_ref().join("DESIGN.md");
    if !path.exists() {
        return DesignSystemSummary {
            found: false,
            path: None,
            tokens: vec![],
            rationale: String::new(),
            issues: vec!["No DESIGN.md found at workspace root.".to_string()],
        };
    }

    match fs::read_to_string(&path) {
        Ok(content) => parse_design_system(path, &content),
        Err(err) => DesignSystemSummary {
            found: true,
            path: Some(path.display().to_string()),
            tokens: vec![],
            rationale: String::new(),
            issues: vec![format!("Failed to read DESIGN.md: {}", err)],
        },
    }
}

fn parse_design_system(path: PathBuf, content: &str) -> DesignSystemSummary {
    let mut tokens = Vec::new();
    let mut issues = Vec::new();
    let mut in_yaml = false;
    let mut yaml_lines = Vec::new();
    let mut body_lines = Vec::new();

    for (index, line) in content.lines().enumerate() {
        if index == 0 && line.trim() == "---" {
            in_yaml = true;
            continue;
        }
        if in_yaml && line.trim() == "---" {
            in_yaml = false;
            continue;
        }
        if in_yaml {
            yaml_lines.push(line.to_string());
        } else {
            body_lines.push(line.to_string());
        }
    }

    for line in yaml_lines {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.is_empty() || trimmed.ends_with(':') {
            continue;
        }
        if let Some((name, value)) = trimmed.split_once(':') {
            tokens.push(DesignToken {
                name: name.trim().trim_matches('"').to_string(),
                value: value.trim().trim_matches('"').to_string(),
                category: infer_category(name),
                description: None,
            });
        }
    }

    if tokens.is_empty() {
        issues.push("No YAML-style design tokens found in frontmatter.".to_string());
    }
    let rationale = body_lines.join("\n").trim().to_string();
    if rationale.is_empty() {
        issues.push("DESIGN.md is missing human-readable rationale.".to_string());
    }

    DesignSystemSummary {
        found: true,
        path: Some(path.display().to_string()),
        tokens,
        rationale,
        issues,
    }
}

fn infer_category(name: &str) -> String {
    let lower = name.to_ascii_lowercase();
    if lower.contains("color") || lower.contains("bg") || lower.contains("surface") {
        "color".to_string()
    } else if lower.contains("space") || lower.contains("radius") || lower.contains("gap") {
        "layout".to_string()
    } else if lower.contains("font") || lower.contains("text") {
        "typography".to_string()
    } else {
        "token".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_frontmatter_tokens_and_rationale() {
        let summary = parse_design_system(
            PathBuf::from("DESIGN.md"),
            "---\ncolorAccent: '#7c3aed'\nradiusPanel: 8px\n---\n# Rationale",
        );
        assert_eq!(summary.tokens.len(), 2);
        assert!(summary.issues.is_empty());
    }
}
