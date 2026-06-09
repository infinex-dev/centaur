from __future__ import annotations

import json
import os
import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any

MAX_FILE_BYTES = 256_000
MAX_RETURN_BYTES = 64_000
MAX_SEARCH_RESULTS = 100
MAX_RANGE_LINES = 400

_SECRET_PATH_PATTERNS = (
    re.compile(r"(^|/)\.git(/|$)"),
    re.compile(r"(^|/)node_modules(/|$)"),
    re.compile(r"(^|/)(dist|build|coverage|\.next|\.turbo)(/|$)"),
    re.compile(r"(^|/)\.env(\.|$|/)", re.IGNORECASE),
    re.compile(r"(^|/)\.(npmrc|pypirc|netrc|docker/config\.json)$", re.IGNORECASE),
    re.compile(r"(^|/)\.(?!github(/|$))[^/]+"),
    re.compile(r"(^|/).*\.(pem|key|p12|pfx|jks|keystore)$", re.IGNORECASE),
    re.compile(r"(^|/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)(\.|$)", re.IGNORECASE),
    re.compile(
        r"(^|/)(secrets?|credentials?|tokens?|kubeconfig)(\.|-|_|/|$)",
        re.IGNORECASE,
    ),
    re.compile(r"(^|/)(service-account|service_account).+\.json$", re.IGNORECASE),
    re.compile(r"(^|/).*\.tfstate(\.backup)?$", re.IGNORECASE),
)
_REF_RE = re.compile(r"^[A-Za-z0-9._/\-]+$")
_SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _error(code: str, message: str, *, retryable: bool = False, **extra: Any) -> dict[str, Any]:
    return {
        "ok": False,
        "error": {"code": code, "message": message},
        "retryable": retryable,
        **extra,
    }


def _parse_repositories(raw: str) -> list[str]:
    cleaned = raw.strip()
    if not cleaned:
        return []
    if cleaned.startswith("["):
        try:
            data = json.loads(cleaned)
            if isinstance(data, list):
                return [str(item).strip() for item in data if str(item).strip()]
        except json.JSONDecodeError:
            pass
    return [part.strip() for part in re.split(r"[\s,]+", cleaned) if part.strip()]


def _parse_aliases(raw: str) -> dict[str, str]:
    cleaned = raw.strip()
    if not cleaned:
        return {}
    if cleaned.startswith("{"):
        try:
            data = json.loads(cleaned)
            if isinstance(data, dict):
                return {str(k).strip(): str(v).strip() for k, v in data.items() if k and v}
        except json.JSONDecodeError:
            pass
    aliases: dict[str, str] = {}
    for part in re.split(r"[\s,]+", cleaned):
        if not part or "=" not in part:
            continue
        alias, _, target = part.partition("=")
        if alias.strip() and target.strip():
            aliases[alias.strip()] = target.strip()
    return aliases


def _safe_alias(alias: str) -> str:
    normalized = alias.strip().strip("/")
    if not normalized or normalized.startswith(".") or "/" in normalized or ".." in normalized:
        raise ValueError("invalid repo alias")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", normalized):
        raise ValueError("invalid repo alias")
    return normalized


def _safe_repo_name(repo: str) -> str:
    normalized = repo.strip().strip("/")
    if not normalized or normalized.startswith(".") or ".." in normalized.split("/"):
        raise ValueError("invalid repo name")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", normalized):
        raise ValueError("repo must be owner/name")
    return normalized


def _safe_path(path: str) -> str:
    normalized = path.strip().replace("\\", "/").lstrip("/")
    if not normalized:
        raise ValueError("path is required")
    pure = PurePosixPath(normalized)
    if pure.is_absolute() or any(part in {"", ".", ".."} for part in pure.parts):
        raise ValueError("path traversal is not allowed")
    safe = pure.as_posix()
    for pattern in _SECRET_PATH_PATTERNS:
        if pattern.search(safe):
            raise PermissionError(f"path is denied: {safe}")
    return safe


def _safe_ref(ref: str) -> str:
    normalized = ref.strip()
    if not normalized:
        normalized = "HEAD"
    if normalized != "HEAD":
        if normalized.startswith("-") or ".." in normalized or normalized.endswith(".lock"):
            raise ValueError("invalid ref")
        if not _REF_RE.fullmatch(normalized):
            raise ValueError("invalid ref")
    return normalized


def _is_secret_path(path: str) -> bool:
    try:
        _safe_path(path)
    except (PermissionError, ValueError):
        return True
    return False


class RepoContextClient:
    """Read-only, commit-pinned repository search/read backed by Centaur repoCache."""

    def __init__(
        self,
        root: str | None = None,
        repositories: list[str] | None = None,
        aliases: dict[str, str] | None = None,
    ) -> None:
        root_value = root or os.getenv("REPO_CONTEXT_ROOT") or os.getenv("REPOS_PATH", "")  # noqa: TID251
        self.root_configured = bool(str(root_value).strip())
        self.root = Path(root_value).resolve() if self.root_configured else Path("/")
        configured = repositories
        if configured is None:
            configured = _parse_repositories(os.getenv("REPO_CONTEXT_REPOSITORIES", ""))  # noqa: TID251
        self.repositories = [_safe_repo_name(repo) for repo in configured]
        raw_aliases = aliases
        if raw_aliases is None:
            raw_aliases = _parse_aliases(os.getenv("REPO_CONTEXT_REPOSITORY_ALIASES", ""))  # noqa: TID251
        self.aliases = {
            _safe_alias(alias): _safe_repo_name(target) for alias, target in raw_aliases.items()
        }
        for alias, target in self.aliases.items():
            if target not in self.repositories:
                raise ValueError(f"repo alias {alias!r} points outside the configured allowlist")

    def _normalize_repo(self, repo: str) -> str:
        candidate = repo.strip().strip("/")
        if candidate in self.aliases:
            return self.aliases[candidate]
        return _safe_repo_name(candidate)

    def _repo_path(self, repo: str) -> Path:
        normalized = self._normalize_repo(repo)
        if normalized not in self.repositories:
            raise PermissionError(f"repo is not allowed: {normalized}")
        if not self.root_configured:
            raise FileNotFoundError("repo context root is not configured")
        repo_path = (self.root / normalized).resolve()
        try:
            repo_path.relative_to(self.root)
        except ValueError as exc:
            raise PermissionError("repo path escapes repo root") from exc
        if not (repo_path / ".git").exists():
            raise FileNotFoundError(f"repo cache is unavailable for {normalized}")
        return repo_path

    def _git(
        self, repo_path: Path, args: list[str], *, check: bool = True
    ) -> subprocess.CompletedProcess[str]:
        cmd = ["git", "-C", str(repo_path), *args]
        return subprocess.run(
            cmd,
            check=check,
            capture_output=True,
            text=True,
            timeout=20,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
        )

    def list_repos(self) -> dict[str, Any]:
        """List configured repositories and whether each cache checkout is available."""
        repos: list[dict[str, Any]] = []
        for repo in self.repositories:
            path = self.root / repo if self.root_configured else Path(repo)
            available = self.root_configured and (path / ".git").exists()
            entry: dict[str, Any] = {"repo": repo, "available": available}
            if available:
                head_proc = self._git(path, ["rev-parse", "--verify", "HEAD^{commit}"], check=False)
                if head_proc.returncode == 0:
                    entry["head_commit_sha"] = head_proc.stdout.strip().splitlines()[-1]
                branch_proc = self._git(path, ["branch", "--show-current"], check=False)
                if branch_proc.returncode == 0 and branch_proc.stdout.strip():
                    entry["current_branch"] = branch_proc.stdout.strip()
                default_proc = self._git(
                    path,
                    ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
                    check=False,
                )
                if default_proc.returncode == 0 and default_proc.stdout.strip():
                    entry["default_ref"] = default_proc.stdout.strip().removeprefix("origin/")
            repos.append(entry)
        return {
            "ok": True,
            "root_configured": self.root_configured,
            "repositories": repos,
            "aliases": dict(sorted(self.aliases.items())),
        }

    def resolve_ref(self, repo: str, ref: str = "HEAD") -> dict[str, Any]:
        """Resolve a branch, tag, or SHA to a commit SHA."""
        try:
            repo_path = self._repo_path(repo)
            requested_ref = _safe_ref(ref)
            candidates = [requested_ref]
            if requested_ref != "HEAD" and not requested_ref.startswith(("refs/", "origin/")):
                candidates.extend(
                    [
                        f"origin/{requested_ref}",
                        f"refs/heads/{requested_ref}",
                        f"refs/remotes/origin/{requested_ref}",
                        f"refs/tags/{requested_ref}",
                    ]
                )
            last_err = ""
            for candidate in candidates:
                proc = self._git(
                    repo_path,
                    ["rev-parse", "--verify", f"{candidate}^{{commit}}"],
                    check=False,
                )
                if proc.returncode == 0:
                    sha = proc.stdout.strip().splitlines()[-1]
                    if _SHA_RE.fullmatch(sha):
                        return {
                            "ok": True,
                            "repo": self._normalize_repo(repo),
                            "requested_ref": requested_ref,
                            "resolved_commit_sha": sha,
                            "retrieved_at": _now(),
                        }
                last_err = proc.stderr.strip() or proc.stdout.strip()
            return _error(
                "ref_not_found", f"could not resolve ref {requested_ref!r}", last_error=last_err
            )
        except PermissionError as exc:
            return _error("repo_denied", str(exc))
        except FileNotFoundError as exc:
            return _error("repo_unavailable", str(exc), retryable=True)
        except (ValueError, subprocess.SubprocessError) as exc:
            return _error("repo_error", str(exc))

    def discover_refs(self, repo: str, query: str = "", limit: int = 50) -> dict[str, Any]:
        """Discover local/remotes/tags known by repoCache for an allowed repo."""
        try:
            repo_path = self._repo_path(repo)
            max_results = max(1, min(int(limit), 200))
            proc = self._git(
                repo_path,
                [
                    "for-each-ref",
                    "--format=%(refname:short) %(objectname)",
                    "refs/heads",
                    "refs/remotes",
                    "refs/tags",
                ],
            )
            needle = query.strip().lower()
            refs = []
            seen: set[str] = set()
            for line in proc.stdout.splitlines():
                name, _, sha = line.partition(" ")
                if not name or name in seen:
                    continue
                if needle and needle not in name.lower():
                    continue
                seen.add(name)
                refs.append({"name": name, "commit_sha": sha})
                if len(refs) >= max_results:
                    break
            return {"ok": True, "repo": self._normalize_repo(repo), "query": query, "refs": refs}
        except PermissionError as exc:
            return _error("repo_denied", str(exc))
        except FileNotFoundError as exc:
            return _error("repo_unavailable", str(exc), retryable=True)
        except (ValueError, subprocess.SubprocessError) as exc:
            return _error("repo_error", str(exc))

    def search(
        self,
        repo: str,
        query: str,
        ref: str = "HEAD",
        path_glob: str | None = None,
        limit: int = 25,
    ) -> dict[str, Any]:
        """Search an allowed repository at a resolved commit using git grep."""
        normalized_query = query.strip()
        if not normalized_query:
            return _error("invalid_input", "query is required")
        resolved = self.resolve_ref(repo, ref)
        if not resolved.get("ok"):
            return resolved
        try:
            repo_path = self._repo_path(repo)
            sha = resolved["resolved_commit_sha"]
            max_results = max(1, min(int(limit), MAX_SEARCH_RESULTS))
            pathspec = path_glob.strip().lstrip("/") if path_glob else ":(exclude).git"
            if path_glob and (".." in pathspec or pathspec.startswith("-")):
                return _error("invalid_input", "invalid path_glob")
            proc = self._git(
                repo_path,
                ["grep", "-n", "-I", "-F", "-e", normalized_query, sha, "--", pathspec],
                check=False,
            )
            if proc.returncode not in {0, 1}:
                return _error("repo_search_failed", proc.stderr.strip() or "git grep failed")
            matches: list[dict[str, Any]] = []
            evidence: list[dict[str, Any]] = []
            for line in proc.stdout.splitlines():
                # Format: <sha>:<path>:<line>:<text>. Paths can contain colons, but repo paths in practice
                # rarely do; skip malformed lines rather than risk wrong provenance.
                prefix = f"{sha}:"
                if not line.startswith(prefix):
                    continue
                rest = line[len(prefix) :]
                parts = rest.split(":", 2)
                if len(parts) != 3:
                    continue
                path, line_no_raw, text = parts
                if _is_secret_path(path):
                    continue
                try:
                    line_no = int(line_no_raw)
                except ValueError:
                    continue
                preview = text[:500]
                item = {
                    "repo": resolved["repo"],
                    "requested_ref": resolved["requested_ref"],
                    "resolved_commit_sha": sha,
                    "path": path,
                    "line": line_no,
                    "line_range": {"start": line_no, "end": line_no},
                    "query": normalized_query,
                    "preview": preview,
                }
                matches.append(item)
                evidence.append(
                    {
                        "type": "repo.search_match",
                        "text": preview,
                        "provenance": {
                            "repo": resolved["repo"],
                            "requested_ref": resolved["requested_ref"],
                            "resolved_commit_sha": sha,
                            "path": path,
                            "line_range": {"start": line_no, "end": line_no},
                            "operation": "search",
                            "query": normalized_query,
                            "retrieved_at": resolved["retrieved_at"],
                        },
                    }
                )
                if len(matches) >= max_results:
                    break
            return {
                "ok": True,
                **resolved,
                "query": normalized_query,
                "matches": matches,
                "evidence": evidence,
            }
        except PermissionError as exc:
            return _error("repo_denied", str(exc))
        except FileNotFoundError as exc:
            return _error("repo_unavailable", str(exc), retryable=True)
        except (ValueError, subprocess.SubprocessError) as exc:
            return _error("repo_error", str(exc))

    def read_file(
        self, repo: str, path: str, ref: str = "HEAD", max_bytes: int = MAX_RETURN_BYTES
    ) -> dict[str, Any]:
        """Read a safe text file from an allowed repo at a resolved commit."""
        try:
            safe_path = _safe_path(path)
        except (PermissionError, ValueError) as exc:
            return _error("path_denied", str(exc))
        resolved = self.resolve_ref(repo, ref)
        if not resolved.get("ok"):
            return resolved
        try:
            repo_path = self._repo_path(repo)
            sha = resolved["resolved_commit_sha"]
            spec = f"{sha}:{safe_path}"
            type_proc = self._git(repo_path, ["cat-file", "-t", spec], check=False)
            if type_proc.returncode != 0:
                return _error("path_not_found", f"path not found at commit: {safe_path}")
            if type_proc.stdout.strip() != "blob":
                return _error("path_denied", "only regular files are readable")
            size_proc = self._git(repo_path, ["cat-file", "-s", spec], check=False)
            size = int(size_proc.stdout.strip() or 0)
            if size > MAX_FILE_BYTES:
                return _error(
                    "file_too_large", f"file exceeds {MAX_FILE_BYTES} bytes", size_bytes=size
                )
            show_proc = self._git(repo_path, ["show", spec])
            content = show_proc.stdout
            if "\x00" in content:
                return _error("binary_file_denied", "binary files are not readable")
            capped = content[: max(1, min(int(max_bytes), MAX_RETURN_BYTES))]
            truncated = len(content) > len(capped)
            lines = content.splitlines()
            line_count = len(lines)
            evidence = [
                {
                    "type": "repo.file",
                    "text": capped,
                    "provenance": {
                        "repo": resolved["repo"],
                        "requested_ref": resolved["requested_ref"],
                        "resolved_commit_sha": sha,
                        "path": safe_path,
                        "line_range": {"start": 1, "end": line_count},
                        "operation": "read_file",
                        "retrieved_at": resolved["retrieved_at"],
                    },
                }
            ]
            return {
                "ok": True,
                **resolved,
                "path": safe_path,
                "size_bytes": size,
                "line_count": line_count,
                "content": capped,
                "truncated": truncated,
                "evidence": evidence,
            }
        except PermissionError as exc:
            return _error("path_denied", str(exc))
        except FileNotFoundError as exc:
            return _error("repo_unavailable", str(exc), retryable=True)
        except (ValueError, subprocess.SubprocessError) as exc:
            return _error("repo_error", str(exc))

    def read_range(
        self,
        repo: str,
        path: str,
        start_line: int,
        end_line: int,
        ref: str = "HEAD",
    ) -> dict[str, Any]:
        """Read a bounded inclusive line range from a safe text file at a resolved commit."""
        start = max(1, int(start_line))
        end = max(start, int(end_line))
        if end - start + 1 > MAX_RANGE_LINES:
            end = start + MAX_RANGE_LINES - 1
        try:
            safe_path = _safe_path(path)
        except (PermissionError, ValueError) as exc:
            return _error("path_denied", str(exc))
        resolved = self.resolve_ref(repo, ref)
        if not resolved.get("ok"):
            return resolved
        try:
            repo_path = self._repo_path(repo)
            sha = resolved["resolved_commit_sha"]
            spec = f"{sha}:{safe_path}"
            type_proc = self._git(repo_path, ["cat-file", "-t", spec], check=False)
            if type_proc.returncode != 0:
                return _error("path_not_found", f"path not found at commit: {safe_path}")
            if type_proc.stdout.strip() != "blob":
                return _error("path_denied", "only regular files are readable")
            size_proc = self._git(repo_path, ["cat-file", "-s", spec], check=False)
            size = int(size_proc.stdout.strip() or 0)
            if size > MAX_FILE_BYTES:
                return _error(
                    "file_too_large", f"file exceeds {MAX_FILE_BYTES} bytes", size_bytes=size
                )
            show_proc = self._git(repo_path, ["show", spec])
            full_content = show_proc.stdout
            if "\x00" in full_content:
                return _error("binary_file_denied", "binary files are not readable")
        except PermissionError as exc:
            return _error("path_denied", str(exc))
        except FileNotFoundError as exc:
            return _error("repo_unavailable", str(exc), retryable=True)
        except (ValueError, subprocess.SubprocessError) as exc:
            return _error("repo_error", str(exc))
        lines = full_content.splitlines()
        if start > len(lines):
            return _error(
                "range_not_found",
                f"start_line {start} is beyond end of file ({len(lines)} lines)",
            )
        selected = lines[start - 1 : end]
        content = "\n".join(selected)
        if content and not content.endswith("\n"):
            content += "\n"
        capped = content[:MAX_RETURN_BYTES]
        truncated = len(content) > len(capped)
        line_range = {"start": start, "end": min(end, len(lines))}
        evidence = [
            {
                "type": "repo.file_range",
                "text": capped,
                "provenance": {
                    "repo": resolved["repo"],
                    "requested_ref": resolved["requested_ref"],
                    "resolved_commit_sha": sha,
                    "path": safe_path,
                    "line_range": line_range,
                    "operation": "read_range",
                    "retrieved_at": resolved["retrieved_at"],
                },
            }
        ]
        return {
            "ok": True,
            **resolved,
            "path": safe_path,
            "size_bytes": size,
            "line_count": len(lines),
            "content": capped,
            "truncated": truncated,
            "line_range": line_range,
            "evidence": evidence,
        }


def _client() -> RepoContextClient:
    return RepoContextClient()
