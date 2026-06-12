from __future__ import annotations

from pathlib import Path
import sys

import pytest  # noqa: F401  (needed for pytest.mark.asyncio in Task 12)

OVERLAY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OVERLAY_ROOT / "workflows"))
sys.path.insert(0, str(OVERLAY_ROOT))

from comms_delivery import (  # noqa: E402  (after the sys.path bootstrap)
    delivery_gate_blocks,
    deliverable_groups,
    deliveries_made,
    destination_groups,
    empty_deliveries,
    fenced_diff_blocks,
    tweets_for_channel,
)
from comms_shared import Gate  # noqa: E402


def test_destination_groups_splits_by_destination_and_skips_missing():
    final = {
        "blog": {"text": "b"},
        "web": {"text": "w"},
        "x": {"text": "t"},
        "x-thread": None,
        "in-product": {"text": "i"},
        "modal": {"text": "m"},
    }
    groups = destination_groups(list(final.keys()), final)
    assert groups["platform_pr"] == ["blog", "web"]
    assert groups["typefully"] == ["x"]  # x-thread is None -> missing
    assert groups["copy_only"] == ["in-product", "modal"]


def test_deliverable_groups_gate_on_capability():
    groups = {"platform_pr": ["blog"], "typefully": [], "copy_only": []}
    enabled = deliverable_groups(groups, {"platform_pr": False, "typefully": True})
    assert enabled == {"platform_pr": False, "typefully": False}


def test_tweets_for_channel_consumes_structured_array_never_resplits():
    candidates = [
        {"id": "c1", "structured": {"kind": "thread", "tweets": ["t1", "t2", "t3"]}}
    ]
    entry = {"text": "t1\n\nt2 t3 flattened weirdly", "candidate_id": "c1"}
    assert tweets_for_channel(candidates, entry, "x-thread") == ["t1", "t2", "t3"]


def test_tweets_for_channel_falls_back_to_blank_line_split_without_structured():
    assert tweets_for_channel(
        [], {"text": "a\n\nb", "candidate_id": "zz"}, "x-thread"
    ) == ["a", "b"]
    assert tweets_for_channel([], {"text": "solo"}, "x") == ["solo"]


def test_delivery_gate_blocks_states():
    gate = Gate("r1", "deliver", 1, "U1")
    groups = {"platform_pr": ["blog"], "typefully": ["x"], "copy_only": ["modal"]}
    enabled = {"platform_pr": True, "typefully": True}
    final = {"modal": {"text": "EMERGENCY: deposits paused"}}
    idle = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "idle", "typefully": "idle"},
            empty_deliveries(),
            final_by_channel=final,
        )
    )
    assert (
        "Preview platform PR" in idle
        and "Create Typefully drafts" in idle
        and "Finish" in idle
    )
    assert "Create PR" not in idle  # only after preview
    assert "deliver manually" in idle  # copy_only note
    assert "EMERGENCY: deposits paused" in idle  # copy-only text inlined

    previewed = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "previewed", "typefully": "idle"},
            empty_deliveries(),
        )
    )
    # typefully still idle -> Create PR announces its draft-creation side effect
    assert "Create Typefully drafts + PR" in previewed and "Cancel PR" in previewed
    assert "typefullyUrl" in previewed  # ordering note rendered

    previewed_after_tf = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "previewed", "typefully": "created"},
            empty_deliveries(),
        )
    )
    assert "Create PR" in previewed_after_tf
    assert "Create Typefully drafts + PR" not in previewed_after_tf

    failed = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "create_failed", "typefully": "created"},
            empty_deliveries(),
        )
    )
    assert (
        "creation FAILED" in failed and "Create PR" in failed and "Cancel PR" in failed
    )

    terminal = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "created", "typefully": "created"},
            empty_deliveries(),
            terminal=True,
        )
    )
    assert "'type': 'actions'" not in terminal  # terminal is buttonless


def test_delivery_gate_blocks_single_group():
    # Finish is always valid: it means "done — accept the current delivery state".
    gate = Gate("r1", "deliver", 1, "U1")
    groups = {"platform_pr": [], "typefully": ["x"], "copy_only": []}
    enabled = {"platform_pr": False, "typefully": True}
    only_tf = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "idle", "typefully": "idle"},
            empty_deliveries(),
        )
    )
    assert "Create Typefully drafts" in only_tf and "Finish" in only_tf
    assert "Platform PR" not in only_tf


def test_fenced_diff_blocks_every_chunk_is_fenced():
    long_diff = "\n".join(f"+ line {i}" for i in range(400))  # > one 2800-char chunk
    blocks = fenced_diff_blocks(long_diff)
    assert len(blocks) > 1
    for block in blocks:
        text = block["text"]["text"]
        assert text.startswith("```") and text.rstrip("…").rstrip().endswith("```")


def test_deliveries_made_flips_only_on_created():
    d = empty_deliveries()
    assert deliveries_made(d) is False
    d["typefully"] = [{"channel": "x", "status": "failed", "url": None}]
    assert deliveries_made(d) is False
    d["platform_pr"] = {"status": "created", "url": "https://github.com/x/pull/1"}
    assert deliveries_made(d) is True
