# Comms-factory on Centaur — simple architecture explainer

What we're adding to the live `@firenze` bot, in one page. Nothing about base Centaur
changes — comms-factory is **layered on top**.

---

## Base Centaur (what's live today)

You mention `@firenze` in Slack, the API spins up an isolated sandbox Pod to do the work,
and all outbound traffic is mediated by the firewall (iron-proxy). Postgres is the source
of truth.

```
  Slack  ──mention──►  Slackbot ──►  API (control plane) ──spawn──►  Sandbox Pod ──► iron-proxy ──► internet
                                        │                                (the agent)
                                        ▼
                                     Postgres  +  60+ native tools
```

---

## With the comms-factory overlay (what this deploy adds)

Two new things, marked **★**:

1. **★ Overlay** — *content*, not a server. An image layered into the existing API/sandbox
   pods that adds the `comms_factory` **tool** and the `comms_release` / `comms_audit`
   **workflows** (plus skills + the Infinex voice/persona). No new pod.
2. **★ Attached service: comms-factory** — a *new Pod* running the actual copy engine
   (`validate · audit · ground · build_card · generate`).

…and the **★ new connection** is a two-way loop between them:

```
  Slack: "@firenze comms generate <brief>"          ★ new Slack trigger
     │
     ▼
  Slackbot ──►  ┌─────────────────────────────────────────────┐
                │            API (control plane)               │
                │   ★ comms-factory OVERLAY layered in:        │
                │      • comms_release / comms_audit workflows │
                │      • comms_factory tool  (thin client)     │
                └───┬─────────────────────────────▲───────────┘
            ①  call │  "generate this copy"        │  ② call back /tools
                    ▼                              │  "research: repo_context + websearch"
                ┌────────────────────────────────────────────────┐
                │  ★ ATTACHED SERVICE: comms-factory  (:8080)     │   ← new Pod, own image
                │     grounds + writes the copy, then asks        │
                │     Centaur for evidence via a scoped key       │
                └────────────────────────────────────────────────┘
                    ▲
                    │  ★ repoCache (read-only): infinex-xyz/platform, agent-platform
                    │     → grounds copy on real product facts
                                                                   Postgres unchanged
```

### The loop in words (① → ②)
1. A Slack message triggers the **`comms_release` workflow** (from the overlay).
2. It calls the **`comms_factory` tool** (overlay), which is a thin client to…
3. …the **attached comms-factory service** (new Pod) — the engine that generates the copy.
4. To stay factual, that service **calls *back* into Centaur's own `/tools`** using a
   narrow, least-privilege key (`service:comms-factory`, scope `bundle:research`) and grounds
   on **`repo_context`** (real repo facts) + **`websearch`**. ← this back-call is the new
   architectural bit.
5. The workflow surfaces **gates in Slack** (facts gate → candidate gate) for human
   approval and stops at **"ready to ship."**

### The guardrail (important for whoever you show this to)
Comms-factory **never auto-posts** to X / web / in-product. The loop **stops at the gate**
in Slack — a human approves. A pull request (the dogfood next step) is a *proposal*, not a
publish, so it stays within the rule.

---

## Why this shape (the "extend without forking" idea)
- The **overlay** adds org-specific tools/workflows by being layered **after** the base repo
  — later-wins-on-name. Base Centaur stays generic; no base code changes.
- The **attached service** runs the org's heavy engine as its own Pod with its own image,
  wired in purely by **config** (`attachedServices.comms-factory` + a declared `serviceKey`).
- So `@firenze` keeps all its existing tools **and** gains comms — additive, reversible
  (`helm rollback` removes it cleanly).
```
   base Centaur  +  overlay (tools/workflows/persona)  +  attached comms-factory service  =  @firenze with comms
        ↑ unchanged          ↑ layered content                ↑ new Pod, config-only
```
