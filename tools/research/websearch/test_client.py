import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from tools.research.websearch.client import WebSearchClient
from tools.research.websearch.models import SourceDocument


def _sources() -> list[SourceDocument]:
    return [
        SourceDocument(source_id=0, title="Zero Source", url="https://example.com/zero"),
        SourceDocument(source_id=1, title="One Source", url="https://example.com/one"),
        SourceDocument(source_id=2, title="Two Source", url="https://example.com/two"),
    ]


@pytest.mark.asyncio
async def test_validate_citations_rebuilds_incomplete_sources_section():
    client = WebSearchClient(exa_api_key="exa", anthropic_api_key="anthropic")
    report = """Answer cites multiple sources [0] and [1].

## Sources
[1] One Source — https://example.com/one
"""

    repaired = await client._validate_and_repair_citations(
        report=report,
        sources=_sources(),
        max_report_chars=12000,
    )

    assert "Answer cites multiple sources [0] and [1]." in repaired
    assert "[0] Zero Source — https://example.com/zero" in repaired
    assert "[1] One Source — https://example.com/one" in repaired
    assert "[2] Two Source" not in repaired


@pytest.mark.asyncio
async def test_validate_citations_adds_missing_sources_section():
    client = WebSearchClient(exa_api_key="exa", anthropic_api_key="anthropic")
    report = "Answer cites a source without a sources section [2]."

    repaired = await client._validate_and_repair_citations(
        report=report,
        sources=_sources(),
        max_report_chars=12000,
    )

    assert repaired.endswith("## Sources\n[2] Two Source — https://example.com/two")


def test_extract_sources_section_ids_accepts_common_markdown_formats():
    client = WebSearchClient(exa_api_key="exa", anthropic_api_key="anthropic")
    report = """Body [0] [1] [2].

## Sources
- [0] Zero Source — https://example.com/zero
* [1]: https://example.com/one
[2] Two Source — https://example.com/two
"""

    assert client._extract_sources_section_ids(report) == {0, 1, 2}


@pytest.mark.asyncio
async def test_validate_citations_still_rejects_unrepairable_invalid_ids(monkeypatch):
    client = WebSearchClient(exa_api_key="exa", anthropic_api_key="anthropic")
    report = "Answer cites a missing source [99]."

    async def no_op_repair(**kwargs):
        return kwargs["report"]

    monkeypatch.setattr(client, "_repair_report_citations", no_op_repair)

    with pytest.raises(RuntimeError, match=r"Invalid source IDs in report: \[99\]"):
        await client._validate_and_repair_citations(
            report=report,
            sources=_sources(),
            max_report_chars=12000,
        )
