# Hosted Connect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The hosted page can drive a user's local `skill-installer ui` server after they run one command.

**Architecture:** `skill-installer ui` keeps its 127.0.0.1 server and token, and now opens the hosted page with `#connect=<port>.<token>`. The server answers CORS for the hosted origins only. The page reads the fragment and sends its API calls to `http://127.0.0.1:<port>`.

**Tech Stack:** Node built-ins only (`node:http`, `node:test`), plain browser JavaScript.

**Spec:** `docs/superpowers/specs/2026-11-19-hosted-connect-design.md`

## Global Constraints

- No dependencies.
- Every write still goes through the real CLI; token check and argument checks are unchanged.
- Page texts live in `ui/i18n.js` in both languages; `index.html` holds no visible text; `app.js` renders text nodes only.
- CLI output stays English.
- The local page (`http://127.0.0.1:<port>/?t=<token>`) keeps working exactly as before.

## Review Focus

1. A request from another website that somehow has the right token: refused with 403 (Task 1 test).
2. `Origin: null` (file pages, sandboxed frames): refused (Task 1 test).
3. The browser blocks the public page from reaching 127.0.0.1 (Safari, or the user denies Chrome's prompt): the page shows a notice with a button to the local page (Task 2, checked in the browser).
4. A tab that outlives the CLI: same notice, which names the command to run again (Task 2, checked in the browser).
5. A reload of the connected page: stays connected through `sessionStorage` (Task 2, checked in the browser).

---

### Task 1: The server accepts the hosted page

**Files:**
- Modify: `src/ui.mjs`
- Test: `test/ui.test.mjs`

**Interfaces:**
- Produces: stdout line containing `<SITE>#connect=<port>.<token>`; `SITE` defaults to `https://catflyx520.github.io/skill-installer/`, overridden by `SKILL_INSTALLER_SITE`.
- Produces: for `/api/*`, allowed origins are the origin of `SITE`, `https://catflyx520.github.io`, `https://catfly.dev`, plus the server's own `http://127.0.0.1:<port>` and `http://localhost:<port>`.

- [ ] **Step 1: Write the failing tests** in `test/ui.test.mjs` (keep the startup output in a module variable `output`):
  - `the hosted site may call the API, other sites may not`: `OPTIONS /api/add` with `Origin: https://catflyx520.github.io` is 204 with `access-control-allow-origin` equal to that origin, `access-control-allow-private-network: true`, and allow-headers matching `/x-skill-installer-token/i`; `GET /api/state` with token and that origin is 200 with the same allow-origin; for `https://evil.example` and for `null`, `POST /api/add` with the right token is 403, carries no allow-origin, and `.skill-installer` does not exist.
  - `the command opens the hosted site with the connection details`: `output` contains `https://catflyx520.github.io/skill-installer/#connect=<port>.<token>`.
- [ ] **Step 2: Run `npm test`**; the two new tests fail.
- [ ] **Step 3: Implement in `src/ui.mjs`**: origin check and CORS headers at the top of the `/api/` branch, preflight answered before the token check, startup opens and prints the hosted address and prints the local one as the fallback.
- [ ] **Step 4: Run `npm test`**; everything passes.

### Task 2: The page connects

**Files:**
- Modify: `ui/app.js`, `ui/index.html`, `ui/i18n.js`, `ui/style.css` (only if the card needs a rule)

**Interfaces:**
- Consumes: `#connect=<port>.<token>` (port: 1 to 5 digits, token: 48 hex characters).

- [ ] **Step 1:** `app.js` start: read the fragment, keep it in `sessionStorage` under `connect`, remove it from the address bar, set `data-mode="local"` on `<html>`, send API calls to `http://127.0.0.1:<port>`.
- [ ] **Step 2:** A failed call in connected mode raises an error with an `action` that opens the local page; the three places that turn an error into a notice pass `action` on.
- [ ] **Step 3:** Demo-only "Connect your computer" card with the command and a copy button; new and changed texts in both languages (`connectTitle`, `connectLead`, `connectNote`, `copyCmd`, `cmdCopied`, `netHosted`, `openLocal`; update `demoNote`, `s1t`, `s1b`, `a1`, `a4`, `demoOnlyGithub`).
- [ ] **Step 4: Check in a browser** with a throwaway home: serve `ui/` on another origin, run the CLI with `SKILL_INSTALLER_SITE` pointing at it, then check connect, install, delete, reload, and the notice after the CLI stops.

### Task 3: Words and version

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `bin/skill-installer.mjs` (help line for `ui`), `package.json` (`0.2.0`)

- [ ] **Step 1:** README: the page can be used from the hosted site after one command; the local address is the fallback. CLAUDE.md: the new design decision, the allowed origins, the release order (page first, npm second).
- [ ] **Step 2: Run `npm test`** once more.
