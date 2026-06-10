#!/usr/bin/env python3
"""Poll all 7 dispatched twitter-researcher subagents in parallel, save results to disk."""
import json, subprocess, sys, os, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

CLI = "/Users/opaque/.local/bin/projectjin"
WORK_DIR = Path("/Users/opaque/.superset/projects/comms-factory/research/wave-1.5-tweets")
DISPATCH_LOG = WORK_DIR / "dispatch.log"
PROGRESS_LOG = WORK_DIR / "polling.log"

def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with PROGRESS_LOG.open("a") as f:
        f.write(line + "\n")

def call(tool, payload):
    result = subprocess.run(
        [CLI, "--agent", "--json", "tool", "call", tool, "--input", json.dumps(payload)],
        capture_output=True, text=True, timeout=130,
    )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"error": True, "raw_stdout": result.stdout[:500], "raw_stderr": result.stderr[:500]}

def extract_body(result_payload):
    """Pull human-readable body out of the result.result field, falling back to JSON."""
    r = result_payload.get("result", result_payload)
    if isinstance(r, str):
        return r
    if isinstance(r, list):
        parts = []
        for item in r:
            if isinstance(item, dict):
                parts.append(item.get("text") or json.dumps(item, indent=2))
            else:
                parts.append(str(item))
        return "\n\n".join(parts)
    if isinstance(r, dict):
        for key in ("text", "content", "report", "synthesis", "answer"):
            v = r.get(key)
            if isinstance(v, str) and v:
                return v
            if isinstance(v, list):
                return extract_body({"result": v})
        return json.dumps(r, indent=2)
    return str(r)

def poll_one(handle, taskid, max_rounds=6):
    out_path = WORK_DIR / f"{handle}.md"
    if out_path.exists():
        log(f"{handle}: already saved, skipping")
        return True
    for round_n in range(max_rounds):
        log(f"{handle}: polling round {round_n+1}/{max_rounds}")
        status = call("infinex_async_task_status", {
            "context": f"comms-factory polling {handle}",
            "taskId": taskid,
            "wait": True,
            "timeout": 120,
        })
        if not isinstance(status, dict):
            log(f"{handle}: bad status response {status}")
            return False
        s = status.get("status")
        if s == "completed":
            result = call("infinex_async_task_result", {
                "context": f"comms-factory fetching {handle} result",
                "taskId": taskid,
            })
            body = extract_body(result)
            out_path.write_text(f"# @{handle} — wave-1.5 50-post recon\n\n{body}\n")
            log(f"{handle}: COMPLETED, saved {out_path.name} ({len(body)} chars)")
            return True
        elif s == "failed" or s == "error":
            log(f"{handle}: FAILED {status}")
            (WORK_DIR / f"{handle}.FAILED.json").write_text(json.dumps(status, indent=2))
            return False
        elif s in ("pending", "running", "in_progress", None):
            log(f"{handle}: status={s}, continuing")
            continue
        else:
            log(f"{handle}: unexpected status={s}, full={status}")
    log(f"{handle}: TIMED OUT after {max_rounds} polling rounds")
    return False

def main():
    tasks = []
    with DISPATCH_LOG.open() as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("==="):
                continue
            parts = line.split("\t")
            if len(parts) == 2 and "FAILED" not in parts[1]:
                tasks.append((parts[0], parts[1]))
    log(f"Polling {len(tasks)} tasks in parallel")
    with ThreadPoolExecutor(max_workers=len(tasks)) as ex:
        futs = {ex.submit(poll_one, h, t): h for h, t in tasks}
        outcomes = {}
        for fut in as_completed(futs):
            h = futs[fut]
            try:
                outcomes[h] = fut.result()
            except Exception as e:
                outcomes[h] = False
                log(f"{h}: exception {e}")
    log(f"DONE: {sum(1 for v in outcomes.values() if v)}/{len(outcomes)} succeeded")
    for h, ok in outcomes.items():
        log(f"  {'✓' if ok else '✗'} {h}")

if __name__ == "__main__":
    main()
