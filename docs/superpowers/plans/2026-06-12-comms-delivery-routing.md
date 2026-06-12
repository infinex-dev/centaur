# Comms Delivery Routing Implementation Plan

> **Status: SKELETON — Stage A of the handoff fills this in.**
> Working PR: this branch (`feat/comms-delivery-routing`). Do not start Stage B
> (implementation) until this plan is written, document-reviewed, and operator-approved.

**Goal:** Route each approved channel from a `ready_to_ship` comms release
(`final_by_channel`, shipped in PR #20) to its real destination behind a human-confirmed
delivery gate: blog/web → platform PR via GitHub REST; x/x-thread → Typefully drafts;
optional display.dev draft-review loop for blog; one additive NetworkPolicy 443 egress
hook in `contrib/chart/`.

**Spec:** `docs/superpowers/specs/2026-06-11-comms-delivery-routing-design.md`
(adversarially reviewed — design decisions are settled; encode, don't relitigate).

**Handoff / instructions for the executing session:**
`docs/superpowers/plans/2026-06-12-comms-delivery-routing.handoff.md`

## Stage A checklist (planning session)
- [ ] Spec read end-to-end
- [ ] Spec "Open verifications" resolved (live `FEATURES_COPY` schema in
      `infinex-xyz/platform`, via GitHub API — no local checkout exists)
- [ ] Operator prerequisites collected: `COMMS_GITHUB_TOKEN` (write-scoped, separate from
      read cache token), `TYPEFULLY_API_KEY`, display.dev credentials; test repo +
      private Typefully workspace for E2E
- [ ] Task-by-task TDD plan written below (superpowers:writing-plans)
- [ ] Document review run on the plan
- [ ] Operator approval received → Stage B may begin

## Tasks

_To be written by Stage A._
