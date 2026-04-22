<p align="center">
  <img src="assets/logo.png" width="180" alt="Codra Logo">
</p>

<h1 align="center">Codra</h1>

<p align="center">
  <strong>The Local-First AI Coding Agent for Serious Engineering.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Production--Ready-green?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Architecture-Tauri--Rust--React-blue?style=for-the-badge" alt="Architecture">
  <img src="https://img.shields.io/badge/Runtime-Secure--Sandboxed-orange?style=for-the-badge" alt="Runtime">
</p>

---

**Codra** is a native, local-first AI software engineering agent designed to live where your code lives. Unlike cloud-based agents, Codra operates with direct access to your local file system, tools, and browser, maintaining a high-fidelity feedback loop without the latency or privacy concerns of remote proxies.

## 🚀 Core Pillars

- **Privately Native**: Codra runs as a local Tauri desktop application. Your code never leaves your machine unless explicitly sent to your configured AI provider.
- **Unified Intelligence Loop**: Integrates a multi-stage orchestration system:
  - **Planner**: Strategizes multi-file changes and architectural shifts.
  - **Executor**: Applies surgical patches with high precision.
  - **Verifier**: Runs real tests and build commands to ensure integrity.
  - **Repair Loop**: Automatically detects and fixes its own failures.
- **Real Browser Runtime**: Features a CDP-backed browser subsystem for interacting with web apps, capturing screenshots, and verifying deployments in real-time.
- **Persistent Context**: Automatically saves and restores workspace, planning, and execution states. Recover from a restart exactly where you left off.

## ✨ Features

- 🏗️ **Repo-Aware**: Contextual understanding of large monorepos.
- 🌐 **Browser Control**: Full autonomous web interaction for end-to-end testing.
- 🛠️ **Deployment Ready**: Analyzes your stack and prepares deployment chains.
- 📊 **Activity Timeline**: Unified system observability into a single, color-coded stream.
- 🔌 **Model Agnostic**: Seamlessly switch between Ollama, OpenAI, and other providers.

## 🏁 Getting Started

1. **Launch Codra**: Open the desktop application.
2. **Connect Workspace**: Point Codra to any local repository path.
3. **Configure Provider**: Set up Ollama (local) or your preferred API provider.
4. **Build**: Simply describe your intent and let Codra handle the orchestration.

## 🏗️ Architecture

Codra is built on a high-performance stack for low-latency engineering:
- **Core**: Rust (using `codra-core`) for heavy-duty system interaction.
- **Frontend**: React + Tailwind for a premium, responsive UI.
- **Bridge**: Tauri for secure, typed IPC between the UI and local system.
- **Protocol**: Shared schemas between Rust and TypeScript for 100% type safety.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a deep dive.

---

<p align="center">
  Built with obsession for the local-first engineering future.
</p>
