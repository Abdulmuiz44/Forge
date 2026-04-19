pub trait MemoryStore {
    fn init(&self) -> Result<(), String>;
    fn store_context(&self, key: &str, value: &str) -> Result<(), String>;
    fn get_context(&self, key: &str) -> Result<Option<String>, String>;
}
