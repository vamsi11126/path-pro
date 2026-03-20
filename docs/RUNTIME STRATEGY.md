# Runtime Strategy

This project will use a deliberately simple in-browser execution model:

- JavaScript and TypeScript run in WebContainers.
- Python runs in Pyodide.

## Why this split

- WebContainers give us a real Node-style environment for JavaScript tooling, package installs, file systems, and terminal-like workflows.
- Pyodide gives us a lightweight Python runtime in the browser without needing a separate backend sandbox.
- The split keeps the architecture easy to reason about and avoids building a generic multi-language execution layer too early.

## Language Mapping

| Language | Runtime | Notes |
| --- | --- | --- |
| JavaScript | WebContainers | Primary JS runtime |
| TypeScript | WebContainers | Compile or run through the same JS environment |
| Python | Pyodide | Browser-native Python execution |

## Product Rules

- Do not introduce Docker-based sandboxes for local browser execution.
- Do not add server-side code execution for JavaScript or Python unless a feature explicitly requires it later.
- Treat WebContainers and Pyodide as separate runtime adapters behind one UI.
- Keep the first version focused on code execution, stdout/stderr, and basic dependency loading.

## First Implementation Scope

1. Build one shared editor UI.
2. Route JavaScript and TypeScript sessions to a WebContainer-backed runner.
3. Route Python sessions to a Pyodide-backed runner.
4. Normalize output events so the UI renders logs and errors the same way for both runtimes.
5. Defer cross-language package-management abstractions until real usage demands them.

## Deferred for Later

- Additional languages
- Server-hosted sandboxes
- Persistent container snapshots
- Collaborative terminals
- Full package-lock or environment reproducibility across runtimes

## Decision Summary

For now, the runtime stack is:

- WebContainers for JavaScript and TypeScript
- Pyodide for Python

If we expand beyond that, we should do it only after the single-user browser experience is solid.
