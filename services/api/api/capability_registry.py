from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class CapabilitySpec:
    capability: str
    tool_name: str
    method_name: str
    description: str
    input_schema: dict[str, Any] = field(default_factory=dict)
    evidence_types: tuple[str, ...] = ()
    profiles: tuple[str, ...] = ("default",)
    read_only: bool = True


_CAPABILITIES: dict[str, CapabilitySpec] = {
    "repo.search": CapabilitySpec(
        capability="repo.search",
        tool_name="repo_context",
        method_name="search",
        description="Search an allowed repository at a commit-pinned ref.",
        input_schema={
            "type": "object",
            "required": ["repo", "query"],
            "properties": {
                "repo": {"type": "string"},
                "query": {"type": "string"},
                "ref": {"type": "string", "default": "HEAD"},
                "path_glob": {"type": "string"},
                "limit": {"type": "integer", "default": 25},
            },
        },
        evidence_types=("repo.search_match",),
        profiles=("default", "comms"),
    ),
    "repo.read_file": CapabilitySpec(
        capability="repo.read_file",
        tool_name="repo_context",
        method_name="read_file",
        description="Read a safe text file from an allowed repository at a commit-pinned ref.",
        input_schema={
            "type": "object",
            "required": ["repo", "path"],
            "properties": {
                "repo": {"type": "string"},
                "path": {"type": "string"},
                "ref": {"type": "string", "default": "HEAD"},
                "max_bytes": {"type": "integer"},
            },
        },
        evidence_types=("repo.file",),
        profiles=("default", "comms"),
    ),
    "repo.read_range": CapabilitySpec(
        capability="repo.read_range",
        tool_name="repo_context",
        method_name="read_range",
        description="Read a bounded safe line range from an allowed repository at a commit-pinned ref.",
        input_schema={
            "type": "object",
            "required": ["repo", "path", "start_line", "end_line"],
            "properties": {
                "repo": {"type": "string"},
                "path": {"type": "string"},
                "start_line": {"type": "integer"},
                "end_line": {"type": "integer"},
                "ref": {"type": "string", "default": "HEAD"},
            },
        },
        evidence_types=("repo.file_range",),
        profiles=("default", "comms"),
    ),
    "repo.discover_refs": CapabilitySpec(
        capability="repo.discover_refs",
        tool_name="repo_context",
        method_name="discover_refs",
        description="Discover branches/tags known by the repo cache for an allowed repository.",
        input_schema={
            "type": "object",
            "required": ["repo"],
            "properties": {
                "repo": {"type": "string"},
                "query": {"type": "string"},
                "limit": {"type": "integer", "default": 50},
            },
        },
        evidence_types=(),
        profiles=("default", "comms"),
    ),
    "web.search": CapabilitySpec(
        capability="web.search",
        tool_name="websearch",
        method_name="search",
        description="Search public web sources through the configured Centaur websearch tool.",
        input_schema={
            "type": "object",
            "required": ["query"],
            "properties": {"query": {"type": "string"}},
        },
        evidence_types=("web.search_result",),
        profiles=("default", "comms"),
    ),
    "slack.context_search": CapabilitySpec(
        capability="slack.context_search",
        tool_name="company_context",
        method_name="search",
        description="Search Centaur-owned indexed company context, including Slack ETL when enabled.",
        input_schema={
            "type": "object",
            "required": ["query"],
            "properties": {"query": {"type": "string"}},
        },
        evidence_types=("company_context.document",),
        profiles=("default", "comms"),
    ),
    "web.fetch": CapabilitySpec(
        capability="web.fetch",
        tool_name="web_fetch",
        method_name="fetch",
        description="Fetch a public web page through a deployment-provided read-only fetch tool.",
        input_schema={
            "type": "object",
            "required": ["url"],
            "properties": {"url": {"type": "string", "format": "uri"}},
        },
        evidence_types=("web.page",),
        profiles=("default", "comms"),
    ),
    "web.fetch_json": CapabilitySpec(
        capability="web.fetch_json",
        tool_name="web_fetch",
        method_name="fetch_json",
        description="Fetch a public JSON endpoint through a deployment-provided read-only fetch tool.",
        input_schema={
            "type": "object",
            "required": ["url"],
            "properties": {
                "url": {"type": "string", "format": "uri"},
                "method": {"type": "string", "enum": ["GET"]},
                "body": {"type": "object"},
                "jq": {"type": "string"},
            },
        },
        evidence_types=("web.json",),
        profiles=("default", "comms"),
    ),
    "browser.render": CapabilitySpec(
        capability="browser.render",
        tool_name="browser",
        method_name="render",
        description="Render a page through a deployment-provided read-only browser tool.",
        input_schema={
            "type": "object",
            "required": ["url"],
            "properties": {
                "url": {"type": "string", "format": "uri"},
                "selector": {"type": "string"},
                "wait_for": {"type": "string"},
                "wait_for_text": {"type": "string"},
            },
        },
        evidence_types=("browser.render",),
        profiles=("default", "comms"),
    ),
    "x.search_recent": CapabilitySpec(
        capability="x.search_recent",
        tool_name="twitter",
        method_name="search_tweets",
        description="Search recent public X/Twitter posts through the configured Twitter search tool.",
        input_schema={
            "type": "object",
            "required": ["query"],
            "properties": {
                "query": {"type": "string"},
                "hours_back": {"type": "integer"},
                "max_results": {"type": "integer", "default": 20},
                "sort_order": {"type": "string"},
            },
        },
        evidence_types=("x.post",),
        profiles=("default", "comms"),
    ),
}


def get_capability(capability: str) -> CapabilitySpec | None:
    return _CAPABILITIES.get(capability)


def iter_capabilities(profile: str | None = None) -> list[CapabilitySpec]:
    if not profile or profile == "default":
        return list(_CAPABILITIES.values())
    return [spec for spec in _CAPABILITIES.values() if profile in spec.profiles]
