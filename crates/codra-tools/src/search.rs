use codra_protocol::{SearchQuery, SearchMatch};
use ignore::WalkBuilder;
use regex::Regex;
use std::path::PathBuf;
use std::fs;

pub struct LocalSearch {
    root_path: PathBuf,
}

impl LocalSearch {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self {
            root_path: root.into()
        }
    }

    pub fn execute_search(&self, query: SearchQuery) -> Result<Vec<SearchMatch>, String> {
        let re = Regex::new(&query.pattern).map_err(|e| e.to_string())?;
        
        let target_dir = match query.directory {
            Some(d) => self.root_path.join(d),
            None => self.root_path.clone()
        };

        let mut matches = Vec::new();

        let walker = WalkBuilder::new(target_dir)
            .hidden(false)
            .ignore(true)
            .git_ignore(true)
            .build();

        for result in walker {
            match result {
                Ok(entry) => {
                    if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                        if let Ok(content) = fs::read_to_string(entry.path()) {
                            for (line_idx, line) in content.lines().enumerate() {
                                if re.is_match(line) {
                                    // Make safe preview
                                    let preview = line.chars().take(200).collect::<String>();
                                    // Adjust path relative to root if possible
                                    let rel_path = entry.path().strip_prefix(&self.root_path)
                                        .unwrap_or(entry.path())
                                        .to_string_lossy()
                                        .to_string();

                                    matches.push(SearchMatch {
                                        path: rel_path,
                                        line_number: line_idx + 1,
                                        preview
                                    });

                                    // Cap matches per file simply for safety initially
                                    if matches.len() > 100 { break; }
                                }
                            }
                        }
                    }
                }
                Err(_) => continue,
            }
        }

        Ok(matches)
    }
}
