pub trait Deployer {
    fn plan_deployment(&self) -> Result<String, String>;
    fn execute(&self) -> Result<(), String>;
}
