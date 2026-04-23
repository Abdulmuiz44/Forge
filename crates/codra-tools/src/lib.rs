pub mod computer_use;
pub mod design;
pub mod fs;
pub mod git;
pub mod registry;
pub mod search;
pub mod terminal;

pub trait Tool {
    fn name(&self) -> &'static str;
    fn execute(&self, arguments: &str) -> Result<String, String>;
}
