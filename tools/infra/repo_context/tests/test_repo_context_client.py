from __future__ import annotations

import subprocess
from pathlib import Path

from tools.infra.repo_context.client import RepoContextClient


def _git(cwd: Path, *args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()


def _make_repo(root: Path, name: str = "owner/repo") -> tuple[Path, str]:
    repo = root / name
    repo.mkdir(parents=True)
    _git(repo, "init")
    _git(repo, "config", "user.email", "test@example.com")
    _git(repo, "config", "user.name", "Test User")
    (repo / "README.md").write_text("hello world\nsecond line\n", encoding="utf-8")
    (repo / "src").mkdir()
    (repo / "src" / "app.py").write_text("print('hello world')\n", encoding="utf-8")
    (repo / ".env").write_text("SECRET=do-not-read\n", encoding="utf-8")
    (repo / ".npmrc").write_text("//registry.example/:_authToken=token\n", encoding="utf-8")
    _git(repo, "add", "README.md", "src/app.py", ".env", ".npmrc")
    _git(repo, "commit", "-m", "initial")
    sha = _git(repo, "rev-parse", "HEAD")
    return repo, sha


def test_list_repos_returns_only_configured_repos(tmp_path: Path) -> None:
    _make_repo(tmp_path, "owner/repo")
    _make_repo(tmp_path, "other/repo")

    client = RepoContextClient(str(tmp_path), ["owner/repo"])

    result = client.list_repos()

    assert result["ok"] is True
    assert result["aliases"] == {}
    assert result["repositories"][0]["repo"] == "owner/repo"
    assert result["repositories"][0]["available"] is True
    assert result["repositories"][0]["head_commit_sha"]


def test_repo_alias_maps_to_explicit_allowlist_entry(tmp_path: Path) -> None:
    _repo, sha = _make_repo(tmp_path, "owner/repo")
    client = RepoContextClient(
        str(tmp_path), ["owner/repo"], aliases={"infinex-platform": "owner/repo"}
    )

    result = client.search("infinex-platform", "hello")

    assert result["ok"] is True
    assert result["repo"] == "owner/repo"
    assert result["resolved_commit_sha"] == sha


def test_resolve_ref_search_and_read_include_commit_pinned_provenance(tmp_path: Path) -> None:
    _repo, sha = _make_repo(tmp_path)
    client = RepoContextClient(str(tmp_path), ["owner/repo"])

    resolved = client.resolve_ref("owner/repo", "HEAD")
    searched = client.search("owner/repo", "hello", limit=5)
    read = client.read_range("owner/repo", "README.md", 1, 1)

    assert resolved["resolved_commit_sha"] == sha
    assert searched["ok"] is True
    assert searched["matches"][0]["resolved_commit_sha"] == sha
    assert searched["matches"][0]["path"] == "README.md"
    assert searched["evidence"][0]["provenance"]["operation"] == "search"
    assert read["ok"] is True
    assert read["content"] == "hello world\n"
    assert read["evidence"][0]["provenance"]["line_range"] == {"start": 1, "end": 1}


def test_disallowed_repo_and_unsafe_paths_are_denied(tmp_path: Path) -> None:
    repo, _sha = _make_repo(tmp_path, "owner/repo")
    _make_repo(tmp_path, "other/repo")
    (repo / "config").mkdir()
    (repo / "config" / "secrets.yml").write_text("secret: value\n", encoding="utf-8")
    (repo / "terraform.tfstate").write_text("{}\n", encoding="utf-8")
    _git(repo, "add", "config/secrets.yml", "terraform.tfstate")
    _git(repo, "commit", "-m", "add denied files")
    client = RepoContextClient(str(tmp_path), ["owner/repo"])

    disallowed = client.read_file("other/repo", "README.md")
    traversal = client.read_file("owner/repo", "../README.md")
    secret = client.read_file("owner/repo", ".env")
    npmrc = client.read_file("owner/repo", ".npmrc")
    directory = client.read_file("owner/repo", "src")
    secrets_yml = client.read_file("owner/repo", "config/secrets.yml")
    tfstate = client.read_file("owner/repo", "terraform.tfstate")

    assert disallowed["ok"] is False
    assert disallowed["error"]["code"] == "repo_denied"
    assert traversal["ok"] is False
    assert traversal["error"]["code"] == "path_denied"
    assert secret["ok"] is False
    assert secret["error"]["code"] == "path_denied"
    assert npmrc["ok"] is False
    assert npmrc["error"]["code"] == "path_denied"
    assert directory["ok"] is False
    assert directory["error"]["code"] == "path_denied"
    assert secrets_yml["ok"] is False
    assert secrets_yml["error"]["code"] == "path_denied"
    assert tfstate["ok"] is False
    assert tfstate["error"]["code"] == "path_denied"


def test_search_drops_denied_secret_paths(tmp_path: Path) -> None:
    _make_repo(tmp_path, "owner/repo")
    client = RepoContextClient(str(tmp_path), ["owner/repo"])

    result = client.search("owner/repo", "do-not-read")

    assert result["ok"] is True
    assert result["matches"] == []
    assert result["evidence"] == []


def test_pinned_read_is_stable_after_branch_moves(tmp_path: Path) -> None:
    repo, old_sha = _make_repo(tmp_path)
    client = RepoContextClient(str(tmp_path), ["owner/repo"])

    old_read = client.read_file("owner/repo", "README.md", ref=old_sha)
    (repo / "README.md").write_text("changed\n", encoding="utf-8")
    _git(repo, "add", "README.md")
    _git(repo, "commit", "-m", "change readme")

    pinned_read = client.read_file("owner/repo", "README.md", ref=old_sha)
    head_read = client.read_file("owner/repo", "README.md", ref="HEAD")

    assert pinned_read["content"] == old_read["content"]
    assert pinned_read["resolved_commit_sha"] == old_sha
    assert head_read["content"] == "changed\n"


def test_read_range_can_select_lines_beyond_public_read_cap(tmp_path: Path) -> None:
    repo, _sha = _make_repo(tmp_path)
    lines = [f"line {idx}" for idx in range(12000)]
    (repo / "large.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    _git(repo, "add", "large.txt")
    _git(repo, "commit", "-m", "add large text")
    client = RepoContextClient(str(tmp_path), ["owner/repo"])

    result = client.read_range("owner/repo", "large.txt", 11000, 11000)

    assert result["ok"] is True
    assert result["content"] == "line 10999\n"


def test_read_range_rejects_out_of_range_and_caps_output(tmp_path: Path) -> None:
    repo, _sha = _make_repo(tmp_path)
    (repo / "long.txt").write_text("x" * (70_000) + "\n", encoding="utf-8")
    _git(repo, "add", "long.txt")
    _git(repo, "commit", "-m", "add long line")
    client = RepoContextClient(str(tmp_path), ["owner/repo"])

    missing = client.read_range("owner/repo", "README.md", 100, 101)
    capped = client.read_range("owner/repo", "long.txt", 1, 1)

    assert missing["ok"] is False
    assert missing["error"]["code"] == "range_not_found"
    assert capped["ok"] is True
    assert len(capped["content"]) == 64_000
    assert capped["truncated"] is True
    assert capped["evidence"][0]["text"] == capped["content"]


def test_missing_repo_cache_reports_unavailable(tmp_path: Path) -> None:
    client = RepoContextClient(str(tmp_path), ["owner/repo"])

    result = client.search("owner/repo", "hello")

    assert result["ok"] is False
    assert result["error"]["code"] == "repo_unavailable"
    assert result["retryable"] is True
