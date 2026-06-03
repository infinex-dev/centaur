from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

CAPABILITY_RESULT_SCHEMA = "centaur.capability_result.v1"
EVIDENCE_ITEM_SCHEMA = "centaur.evidence_item.v1"


class CapabilityError(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class EvidenceItem(BaseModel):
    schema_version: Literal["centaur.evidence_item.v1"] = EVIDENCE_ITEM_SCHEMA
    id: str
    type: str
    capability: str
    text: str = ""
    provenance: dict[str, Any] = Field(default_factory=dict)
    retrieved_at: str | None = None
    # Compatibility fields consumed by comms-factory PR #2. Keep these as a
    # normalized projection over the typed v1 provenance so callers can cite
    # stable evidence IDs without understanding every source-specific payload.
    source: str = ""
    source_ref: str | None = None
    title: str | None = None
    url: str | None = None
    quote: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CapabilityExecuteRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    schema_version: str = "centaur.capability_execute.v1"
    request_id: str = Field(min_length=1, max_length=200)
    job_id: str = Field(min_length=1, max_length=200)
    thread_key: str = Field(default="", max_length=500)
    stage: str = Field(min_length=1, max_length=100)
    capability: str = Field(min_length=1, max_length=120)
    input: dict[str, Any] = Field(default_factory=dict)
    requester: dict[str, Any] | None = None
    trace: dict[str, Any] | None = None


class CapabilityResult(BaseModel):
    schema_version: Literal["centaur.capability_result.v1"] = CAPABILITY_RESULT_SCHEMA
    ok: bool
    capability: str
    request_id: str
    result: dict[str, Any] | None = None
    # Alias used by comms-factory's capability executor. It is intentionally
    # separate from evidence: successful freeform output is model-visible
    # context, not claim-supporting proof unless `evidence` is populated.
    output: dict[str, Any] | str | None = None
    content: str | None = None
    text: str | None = None
    error: CapabilityError | None = None
    retryable: bool = False
    evidence: list[EvidenceItem] = Field(default_factory=list)
    partial_failures: list[dict[str, Any]] = Field(default_factory=list)


class CapabilityCatalogEntry(BaseModel):
    capability: str
    description: str
    input_schema: dict[str, Any] = Field(default_factory=dict)
    evidence_types: list[str] = Field(default_factory=list)
    read_only: bool = True
    available: bool = True


class CapabilityCatalogResponse(BaseModel):
    schema_version: str = "centaur.capability_catalog.v1"
    profile: str = "default"
    capabilities: list[CapabilityCatalogEntry]
