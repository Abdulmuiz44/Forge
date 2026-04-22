# Codra: The Native AI Coding Agent

## Product Vision
Codra is a local-first, native desktop application serving as a serious AI coding agent for Windows and Linux. It is not an opaque chatbot or a simple LLM wrapper. Codra is a powerful, repository-aware engineer capable of autonomous planning, architectural design, implementation, and deployment execution safely under user supervision.

## Product Goals
- **Autonomy with Approval**: Perform complex multi-step refactoring, file creation, and execution routines securely with clear user approval boundaries.
- **Deep Context**: Maintain robust awareness of the workspace state, metadata, test suites, and Git history.
- **Computer Use**: Equip the agent with a sandboxed Chrome DevTools Protocol (CDP) powered browser runtime for inspecting UI, validating web applications, and performing computer-use tasks securely.
- **Fast and Native**: Provide a snappy, dark-mode first UI using Tauri, React, and a stable Rust backend for OS-level control.
- **Extensible Intelligence**: Modular provider integrations to support everything from local open-weight models (Mistral) to cloud providers dynamically.

## Non-goals
- We are NOT building yet another clone of VS Code or Cursor. The interface centers on agent execution panels and diffs, not necessarily a replacement IDE.
- We are NOT a cloud SaaS locking users into a specific model provider.
- We are NOT relying on "faked" frontend state. System boundaries (especially tooling runs) must run natively in Rust.

## Core User Stories
1. **As a developer**, I want to provide a high-level task to Codra so that it can submit an architectural implementation plan before diving into code.
2. **As a security-conscious engineer**, I want to see a visual diff of files changed and approve terminal commands prior to their execution.
3. **As a web developer**, I want Codra to spawn a headless browser, navigate to my dev server, take screenshots, and auto-correct visual bugs based on its observations.

## Scope Breakdown
### v1 Scope
- Basic Tauri + React shell with the three-pane design.
- Local implementation of Rust workspace state management.
- Initial model provider interface for generating plans and diffs.
- `codra-tools` capabilities: basic file read/write, terminal execution.
- Typed approval request flows in UI.

### v1.1 Scope
- Introduce `codra-browser` CDP hook for basic site snapshots and interaction.
- AST semantic search indexing integration.

### v2 Scope
- Long-term memory integration with SQLite (`codra-memory`).
- Full UI state persistence across app reboots.
- Complete ACP-style text editor plugin system.

## Success Criteria
- [ ] Users can bootstrap a full feature with Codra end-to-end without touching a terminal directly.
- [ ] The app consumes minimal resources when idle natively (`<100MB` RAM via Tauri).
- [ ] Agents can accurately apply non-contiguous file replacements on large codebases.
