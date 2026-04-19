pub mod fs;
pub mod git;
pub mod terminal;
pub mod search;

pub trait Tool {
    fn name(&self) -> &'static str;
    fn execute(&self, arguments: &str) -> Result<String, String>;
}
