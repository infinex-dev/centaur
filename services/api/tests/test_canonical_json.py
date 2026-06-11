"""Unit tests for canonical_json's JSONB-safety sanitization.

Postgres ``text``/JSONB cannot store NUL (U+0000), and a ``::jsonb`` cast
rejects the non-finite floats ``json.dumps`` emits as bare ``NaN``/``Infinity``.
canonical_json must strip/neutralize both so any value (notably tool results
built from scraped web content) can be persisted.
"""

import json

from api.runtime_control import canonical_json


def test_strips_nul_from_string_values():
    out = canonical_json({"fact": "weight\x00motor"})
    assert "\\u0000" not in out
    assert json.loads(out) == {"fact": "weightmotor"}


def test_strips_nul_from_dict_keys():
    out = canonical_json({"a\x00b": 1})
    assert json.loads(out) == {"ab": 1}


def test_strips_nul_nested_in_lists_and_dicts():
    payload = {"facts": [{"text": "x\x00y"}, ["a\x00"], "ok"]}
    out = canonical_json(payload)
    assert "\\u0000" not in out
    assert json.loads(out) == {"facts": [{"text": "xy"}, ["a"], "ok"]}


def test_non_finite_floats_become_null():
    out = canonical_json({"a": float("nan"), "b": float("inf"), "c": float("-inf")})
    assert json.loads(out) == {"a": None, "b": None, "c": None}


def test_clean_values_pass_through_unchanged():
    payload = {"n": 1, "f": 1.5, "s": "hello", "b": True, "z": None, "l": [1, 2]}
    assert json.loads(canonical_json(payload)) == payload


def test_colliding_keys_after_nul_strip_merge_without_crashing():
    # Keys differing only by NUL collide after stripping — last wins, no error.
    out = canonical_json({"a\x00": 1, "a": 2})
    assert json.loads(out) == {"a": 2}


def test_output_is_valid_jsonb_text_with_no_nul_byte():
    out = canonical_json({"k": "bad\x00value", "list": ["a\x00", "b"]})
    assert "\x00" not in out  # raw NUL byte
    assert "\\u0000" not in out  # escaped NUL
    json.loads(out)  # still parseable
