# Codra Demo Video

This folder contains a browser-rendered demo video for Codra.

Run:

```sh
pnpm video:demo
```

The renderer opens Chrome through the DevTools Protocol, records `codra-demo-video.html`
as a 1920x1080 WebM, and writes a timestamped file:

```text
demo/codra-demo-video-YYYYMMDD-HHMMSS.webm
```

The storyboard covers:

- Codra as a local-first AI coding agent
- the premium desktop workspace shell
- plan, execute, verify, repair workflow
- provider routing, MCP tools, browser/runtime surfaces, and durable local memory
