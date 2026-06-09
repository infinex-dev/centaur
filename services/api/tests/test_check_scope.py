"""Unit tests for api.api_keys.check_scope."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


import pytest

from api.api_keys import (
    _SERVICE_API_KEYS,
    SCOPE_BUNDLES,
    APIKeyInfo,
    _load_attached_service_key_specs,
    _normalize_scopes,
    check_scope,
)


def _key(scopes: list[str]) -> APIKeyInfo:
    return APIKeyInfo(id="k1", name="test", key_prefix="tst", scopes=scopes, created_by="test")


class TestWildcard:
    def test_star_grants_everything(self):
        key = _key(["*"])
        assert check_scope(key, "admin") is True
        assert check_scope(key, "agent:execute") is True
        assert check_scope(key, "tools", resource="slack") is True


class TestToolScopes:
    def test_tools_star_grants_all_tools(self):
        key = _key(["tools:*"])
        assert check_scope(key, "tools", resource="slack") is True
        assert check_scope(key, "tools", resource="linear") is True

    def test_tools_slack_grants_only_slack(self):
        key = _key(["tools:slack"])
        assert check_scope(key, "tools", resource="slack") is True

    def test_tools_slack_does_not_grant_linear(self):
        key = _key(["tools:slack"])
        assert check_scope(key, "tools", resource="linear") is False


class TestCategoryScopes:
    def test_bare_agent_grants_agent_execute(self):
        key = _key(["agent"])
        assert check_scope(key, "agent:execute") is True

    def test_agent_execute_grants_agent_execute(self):
        key = _key(["agent:execute"])
        assert check_scope(key, "agent:execute") is True

    def test_agent_execute_does_not_grant_agent_stop(self):
        key = _key(["agent:execute"])
        assert check_scope(key, "agent:stop") is False

    def test_admin_scope_grants_admin(self):
        key = _key(["admin"])
        assert check_scope(key, "admin") is True


class TestSandboxScopes:
    def test_sandbox_scopes_grant_tools(self):
        key = _key(["agent", "tools:*"])
        assert check_scope(key, "tools", resource="slack") is True
        assert check_scope(key, "tools", resource="linear") is True

    def test_sandbox_scopes_grant_agent(self):
        key = _key(["agent", "tools:*"])
        assert check_scope(key, "agent:execute") is True

    def test_sandbox_scopes_do_not_grant_admin(self):
        key = _key(["agent", "tools:*"])
        assert check_scope(key, "admin") is False


class TestEmptyScopes:
    def test_empty_scopes_grant_nothing(self):
        key = _key([])
        assert check_scope(key, "admin") is False
        assert check_scope(key, "agent") is False
        assert check_scope(key, "agent:execute") is False
        assert check_scope(key, "tools", resource="slack") is False
        assert check_scope(key, "workflows", resource="muesli_meeting_ingest") is False


class TestWorkflowScopes:
    def test_workflows_star_grants_any_workflow(self):
        key = _key(["workflows:*"])
        assert check_scope(key, "workflows", resource="muesli_meeting_ingest") is True
        assert check_scope(key, "workflows", resource="agent_turn") is True

    def test_bare_workflows_grants_any_workflow(self):
        key = _key(["workflows"])
        assert check_scope(key, "workflows", resource="muesli_meeting_ingest") is True
        assert check_scope(key, "workflows", resource="other") is True

    def test_named_workflow_grants_only_that_workflow(self):
        key = _key(["workflows:muesli_meeting_ingest"])
        assert check_scope(key, "workflows", resource="muesli_meeting_ingest") is True
        assert check_scope(key, "workflows", resource="agent_turn") is False

    def test_named_workflow_does_not_grant_admin_or_tools(self):
        key = _key(["workflows:muesli_meeting_ingest"])
        assert check_scope(key, "admin") is False
        assert check_scope(key, "agent:execute") is False
        assert check_scope(key, "tools", resource="slack") is False

    def test_star_grants_workflows(self):
        key = _key(["*"])
        assert check_scope(key, "workflows", resource="anything") is True

    def test_workflows_scope_does_not_match_blank_resource_for_narrow_keys(self):
        key = _key(["workflows:muesli_meeting_ingest"])
        assert check_scope(key, "workflows", resource="") is False

    def test_workflows_wildcard_matches_blank_resource(self):
        key = _key(["workflows:*"])
        assert check_scope(key, "workflows", resource="") is True
        key = _key(["workflows"])
        assert check_scope(key, "workflows", resource="") is True


class TestCapabilityScopesRemoved:
    """The capability plane is deleted; ``capabilities:*`` grants nothing now."""

    def test_capabilities_scope_is_no_longer_recognized(self):
        key = _key(["capabilities:*"])
        assert check_scope(key, "capabilities", resource="repo.search") is False
        assert check_scope(key, "capabilities", resource="web.search") is False

    def test_named_capability_scope_grants_nothing(self):
        key = _key(["capabilities:repo.search"])
        assert check_scope(key, "capabilities", resource="repo.search") is False

    def test_capability_scope_does_not_grant_tools(self):
        key = _key(["capabilities:research"])
        assert check_scope(key, "tools", resource="repo_context") is False


class TestScopeBundles:
    """Tests for named scope bundles (bundle: token expansion)."""

    def test_research_bundle_expands_to_tool_scopes(self):
        scopes = _normalize_scopes(["bundle:research"])
        assert "tools:repo_context" in scopes
        assert "tools:websearch" in scopes
        assert "tools:twitter" in scopes
        assert "tools:company_context" in scopes

    def test_research_bundle_excludes_nonexistent_tools(self):
        """web_fetch / browser are not real tools — the only web tool is websearch."""
        scopes = _normalize_scopes(["bundle:research"])
        assert "tools:web_fetch" not in scopes
        assert "tools:browser" not in scopes

    def test_research_bundle_excludes_tools_star(self):
        scopes = _normalize_scopes(["bundle:research"])
        assert "tools:*" not in scopes

    def test_research_bundle_excludes_unbundled_tools(self):
        scopes = _normalize_scopes(["bundle:research"])
        assert "tools:slack" not in scopes
        assert "tools:linear" not in scopes
        assert "tools:jira" not in scopes

    def test_bundle_expansion_with_check_scope(self):
        """A key with bundle:research grants access to bundled tools."""
        scopes = _normalize_scopes(["bundle:research"])
        key = _key(scopes)
        assert check_scope(key, "tools", resource="repo_context") is True
        assert check_scope(key, "tools", resource="websearch") is True
        assert check_scope(key, "tools", resource="twitter") is True

    def test_bundle_does_not_grant_unbundled_tools(self):
        scopes = _normalize_scopes(["bundle:research"])
        key = _key(scopes)
        assert check_scope(key, "tools", resource="slack") is False
        assert check_scope(key, "tools", resource="linear") is False

    def test_bundle_does_not_grant_admin_or_agent(self):
        scopes = _normalize_scopes(["bundle:research"])
        key = _key(scopes)
        assert check_scope(key, "admin") is False
        assert check_scope(key, "agent:execute") is False

    def test_bundle_mixed_with_other_scopes(self):
        scopes = _normalize_scopes(["agent", "bundle:research", "threads"])
        key = _key(scopes)
        assert check_scope(key, "agent:execute") is True
        assert check_scope(key, "tools", resource="repo_context") is True
        assert check_scope(key, "threads") is True
        assert check_scope(key, "admin") is False

    def test_bundle_deduplicates_overlapping_scopes(self):
        scopes = _normalize_scopes(["tools:repo_context", "bundle:research"])
        assert scopes.count("tools:repo_context") == 1

    def test_unknown_bundle_raises(self):
        with pytest.raises(ValueError, match="Unknown scope bundle"):
            _normalize_scopes(["bundle:nonexistent"])

    def test_bundle_token_not_in_expanded_scopes(self):
        """The bundle: token itself should not appear in expanded scopes."""
        scopes = _normalize_scopes(["bundle:research"])
        assert not any(s.startswith("bundle:") for s in scopes)

    def test_research_bundle_matches_registry(self):
        """The research bundle contains exactly the real research tools."""
        expected = {
            "tools:repo_context",
            "tools:websearch",
            "tools:twitter",
            "tools:company_context",
        }
        assert set(SCOPE_BUNDLES["research"]) == expected


class TestBaseServiceKeysHaveNoOverlayCoupling:
    """Base ships only platform service keys; overlays declare theirs as config."""

    def test_no_attached_service_key_is_hardcoded(self):
        names = {spec.name for spec in _SERVICE_API_KEYS}
        assert names == {"service:slackbot", "service:local-dev"}


class TestAttachedServiceKeySpecLoading:
    """Attached-service callback keys are declared via ATTACHED_SERVICE_KEYS config.

    This is the generic seam a second overlay relies on: it can add a
    least-privilege service key by declaring it in chart config, with no base
    code change. Proven here against an arbitrary example service.
    """

    def test_absent_config_yields_no_specs(self, monkeypatch):
        monkeypatch.delenv("ATTACHED_SERVICE_KEYS", raising=False)
        assert _load_attached_service_key_specs() == ()

    def test_loads_declared_spec_with_scopes(self, monkeypatch):
        monkeypatch.setenv(
            "ATTACHED_SERVICE_KEYS",
            '[{"env_var": "EXAMPLE_SVC_API_KEY", "name": "service:example",'
            ' "scopes": ["bundle:research"]}]',
        )
        specs = _load_attached_service_key_specs()
        assert len(specs) == 1
        assert specs[0].name == "service:example"
        assert specs[0].env_var == "EXAMPLE_SVC_API_KEY"
        assert specs[0].scopes == ("bundle:research",)

    def test_declared_bundle_key_is_least_privilege(self, monkeypatch):
        monkeypatch.setenv(
            "ATTACHED_SERVICE_KEYS",
            '[{"env_var": "EXAMPLE_SVC_API_KEY", "name": "service:example",'
            ' "scopes": ["bundle:research"]}]',
        )
        spec = _load_attached_service_key_specs()[0]
        key = _key(_normalize_scopes(list(spec.scopes)))
        for tool in ("repo_context", "websearch", "twitter", "company_context"):
            assert check_scope(key, "tools", resource=tool) is True
        assert check_scope(key, "tools", resource="slack") is False
        assert check_scope(key, "admin") is False
        assert check_scope(key, "agent:execute") is False
        assert "tools:*" not in key.scopes
        assert "*" not in key.scopes

    def test_malformed_json_raises(self, monkeypatch):
        monkeypatch.setenv("ATTACHED_SERVICE_KEYS", "{not json")
        with pytest.raises(ValueError, match="not valid JSON"):
            _load_attached_service_key_specs()

    def test_entry_missing_fields_raises(self, monkeypatch):
        monkeypatch.setenv("ATTACHED_SERVICE_KEYS", '[{"name": "service:example"}]')
        with pytest.raises(ValueError, match="env_var, name, and non-empty scopes"):
            _load_attached_service_key_specs()
