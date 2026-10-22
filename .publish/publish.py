"""Local-only source synchronization and accidental-secret publication guards."""

import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import sqlite3
import stat
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
REMOTE = "https://github.com/Black-Jony/Dingent.git"
BRANCH = "dingent-resource-v2"
SEED = "public-data/db/dingent.sqlite"
SEED_HASH = "1b4faa60ade22db65a149b8774dccb30480b5617f699a1fc349edbe93236854f"
MAX_FILE = 20 * 1024 * 1024
DIRS = {"src", "ui", "tests", "alembic", "assets", "docs", "examples", "scripts", "website", ".github", ".claude", ".devin"}
ROOT_FILES = {".bun-version", ".dockerignore", ".envrc", ".gitattributes", ".gitignore", ".gitleaks.toml", ".pre-commit-config.yaml", "AGENTS.md", "CLAUDE.md", "CODE_OF_CONDUCT.md", "Dockerfile.backend", "Dockerfile.frontend", "LICENSE", "README.md", "README.zh-CN.md", "alembic.ini", "dingent.spec", "docker-compose.yml", "flake.lock", "flake.nix", "justfile", "locustfile.py", "pyproject.toml", "uv.lock"}
CONTROL_FILES = {"sync_from_local.bat", "check_before_upload.bat", "PUBLIC_RELEASE.md"}
SKIP_DIRS = {".git", ".gitnexus", ".venv", "venv", "node_modules", "__pycache__", ".next", ".cache", ".pytest_cache", ".ruff_cache", ".benchmarks", ".turbo", ".vercel", "test-results", "playwright-report", ".playwright-cli"}
PRIVATE_EXT = re.compile(r"\.(?:sqlite3?|db)(?:-.*)?$|\.(?:key|pem|p12|pfx|zip|tar|tgz|gz|7z|rar|bak|log|pyc|pyo|tsbuildinfo)$", re.I)
BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".eot"}
SECRET_PATTERNS = {
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "provider-token": re.compile(r"\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|AIza[A-Za-z0-9_-]{30,}|xox[baprs]-[A-Za-z0-9-]{20,})\b"),
    "password-hash": re.compile(r"\$(?:argon2(?:id|i|d)\$|2[aby]\$|pbkdf2[-_$])", re.I),
    "encrypted-secret": re.compile(r"\bgAAAAA[A-Za-z0-9_-]{50,}"),
    "jwt-token": re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b"),
    "url-password": re.compile(r"\b(?:https?|postgres(?:ql)?|mysql|redis)://[^\s:@/]+:([^\s@/]{8,})@", re.I),
}
ASSIGNMENT = re.compile(r"(?<![\w.])(?:[\"']?)(api[_-]?key|secret[_-]?key|client[_-]?secret|access[_-]?token|password|passwd|authorization)(?:[\"']?)(?:\s*:\s*str(?:\s*\|\s*None)?)?\s*[:=]\s*[\"']([^\"'\r\n]{8,})[\"']", re.I)
REVIEWED_TEST_LITERALS = {
    "tests/server/conftest.py": {"authpassword"},
    "tests/server/test_auth.py": {"testpassword123", "loginpassword", "wrongpassword"},
    "ui/e2e/dashboard-regression.spec.ts": {"Audit-password-123!"},
}
IGNORES = """
# Safety rules owned by .publish/publish.py; only the verified public seed is allowed.
.env
.env.*
!.env.example
!.env.*.example
*.sqlite
*.sqlite3
*.sqlite-*
*.db
*.db-*
*.key
*.pem
*.p12
*.pfx
/data/
/db/
/security/
/logs/
/.gitnexus/
/.venv/
**/node_modules/
**/__pycache__/
**/.next/
**/test-results/
**/playwright-report/
*.bak
*.zip
*.tar
*.tar.gz
*.tgz
!public-data/
!public-data/db/
!public-data/db/dingent.sqlite
"""


class Rejected(RuntimeError):
    pass


def git(root, *args, data=None):
    result = subprocess.run(["git", "-C", str(root), *args], input=data, capture_output=True)
    if result.returncode:
        raise Rejected("Git command failed: " + " ".join(args[:2]) + "; check repository state.")
    return result.stdout


def names(raw):
    return [name.decode("utf-8") for name in raw.split(b"\0") if name]


def checked_path(root, relative):
    path = PurePosixPath(relative)
    if not relative or path.is_absolute() or any(p in {"..", "."} or ":" in p or "\\" in p for p in path.parts):
        raise Rejected("Unsafe relative path")
    candidate = root.joinpath(*path.parts)
    if not candidate.resolve().is_relative_to(root.resolve()):
        raise Rejected("Path escapes repository: " + relative)
    current = root
    for part in path.parts:
        current = current / part
        if current.exists() or current.is_symlink():
            info = current.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
                raise Rejected("Links/junctions are not publishable: " + relative)
    return candidate


def reserved(relative):
    return relative.startswith((".publish/", "public-data/")) or relative in CONTROL_FILES


def excluded(relative):
    path = PurePosixPath(relative)
    example = path.name == ".env.example" or (path.name.startswith(".env.") and path.name.endswith(".example"))
    return bool(set(path.parts) & SKIP_DIRS or PRIVATE_EXT.search(path.name) or
                (path.name.startswith(".env") and path.name != ".envrc" and not example) or
                relative.startswith(("data/", "db/", "security/", "logs/", "bio_workspace/", "src/data/", "src/bio_workspace/", "src/dingent/static/")))


def allowed_source(relative):
    path = PurePosixPath(relative)
    return not excluded(relative) and not reserved(relative) and (relative in ROOT_FILES or len(path.parts) > 1 and path.parts[0] in DIRS)


def placeholder(value):
    value = value.strip()
    return bool(re.fullmatch(r"(?:\$\{[^}]+\}|<[^>]+>|\[[^]]+\])", value) or
                re.match(r"(?:YOUR_|your[-_ ]|CHANGE_ME|change-me|REPLACE_|example[-_]|test[-_]|fake[-_]|dummy[-_]|mock[-_])", value) or
                value.lower() in {"testpassword", "password123", "newpassword", "test-secret", "long-enough-test-secret"})


def verify_seed(blob):
    if hashlib.sha256(blob).hexdigest() != SEED_HASH:
        raise Rejected("Public database differs from the approved sanitized seed; no automatic replacement.")
    db = sqlite3.connect(":memory:")
    try:
        db.deserialize(blob)
        db.execute("PRAGMA query_only=ON")
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or db.execute("PRAGMA foreign_key_check").fetchall():
            raise Rejected("Public database integrity/foreign-key check failed")
        for table in ("user", "useridentity", "userrolelink", "workspacemember", "resource", "conversation", "checkpoints", "writes"):
            if db.execute('SELECT count(*) FROM "' + table + '"').fetchone()[0]:
                raise Rejected("Public database contains account or runtime records")
        for table, field in (("llmmodelconfig", "encrypted_api_key"), ("assistantpluginlink", "user_plugin_config")):
            if db.execute(f'SELECT count(*) FROM "{table}" WHERE "{field}" IS NOT NULL').fetchone()[0]:
                raise Rejected("Public database contains stored credentials")
        if db.execute("SELECT count(*) FROM workspace WHERE allow_guest_access!=0").fetchone()[0]:
            raise Rejected("Public database unexpectedly enables guest access")
    finally:
        db.close()


def reviewed_literal(relative, match):
    value = match.group(2)
    if placeholder(value):
        return True
    if match.group(1).lower() == "password" and value in REVIEWED_TEST_LITERALS.get(relative, set()):
        return True
    return bool(match.group(1).lower() in {"api_key", "api-key", "apikey"} and
                re.fullmatch(r"keyring:[A-Za-z0-9_.-]+", value))


def source_payload(relative, blob):
    if relative != "scripts/performance.py":
        return blob
    text = blob.decode("utf-8")
    jwt = SECRET_PATTERNS["jwt-token"].pattern.removeprefix(r"\b").removesuffix(r"\b")
    pattern = re.compile(r'(?m)^(\s*["\']authorization["\']\s*:\s*)(["\'])(' + jwt + r')\2([, \t]*\r?)$')
    text, count = pattern.subn(lambda m: m.group(1) + 'os.environ["DINGENT_BENCHMARK_TOKEN"]' + m.group(4), text)
    if count and not re.search(r"(?m)^import os\s*$", text):
        text = "import os\n" + text
    return text.encode("utf-8")


def preserve_line_endings(blob, baseline):
    if b"\0" in blob or b"\0" in baseline:
        return blob
    normalized = blob.replace(b"\r\n", b"\n")
    if normalized == baseline.replace(b"\r\n", b"\n"):
        return baseline
    if b"\r\n" in baseline and baseline.count(b"\n") == baseline.count(b"\r\n"):
        return normalized.replace(b"\n", b"\r\n")
    return normalized if b"\r\n" not in baseline else blob


def inspect_blob(relative, blob):
    if relative == SEED:
        verify_seed(blob)
        return
    if excluded(relative):
        raise Rejected("Forbidden publication path: " + relative)
    if len(blob) > MAX_FILE:
        raise Rejected("File too large for automatic publication: " + relative)
    binary = PurePosixPath(relative).suffix.lower() in BINARY_EXT
    try:
        text = blob.decode("utf-8-sig") if not blob.startswith((b"\xff\xfe", b"\xfe\xff")) else blob.decode("utf-16")
    except UnicodeError:
        if not binary:
            raise Rejected("Unreviewed binary file: " + relative) from None
        text = blob.decode("utf-8", errors="ignore")
    for label, pattern in SECRET_PATTERNS.items():
        for match in pattern.finditer(text):
            if label == "url-password" and placeholder(match.group(1)):
                continue
            raise Rejected(f"{label} in {relative}:{text.count(chr(10), 0, match.start()) + 1}; value withheld")
    if not binary:
        if "\0" in text:
            raise Rejected("Unreviewed binary file: " + relative)
        if not relative.startswith("ui/messages/"):
            for match in ASSIGNMENT.finditer(text):
                if not reviewed_literal(relative, match):
                    raise Rejected(f"literal credential in {relative}:{text.count(chr(10), 0, match.start()) + 1}; value withheld")


def tree_blobs(root, revision=None):
    entries = {}
    raw = git(root, "ls-tree", "-rz", revision) if revision else git(root, "ls-files", "--stage", "-z")
    for record in raw.split(b"\0"):
        if not record:
            continue
        header, name = record.split(b"\t", 1)
        mode, middle, last = header.decode().split()
        oid = last if revision else middle
        if mode not in {"100644", "100755"} or not revision and last != "0":
            raise Rejected("Links, submodules, or unmerged entries are not publishable")
        entries[name.decode("utf-8")] = oid
    objects = list(dict.fromkeys(entries.values()))
    if not objects:
        return {}
    stream = io.BytesIO(git(root, "cat-file", "--batch", data=("\n".join(objects) + "\n").encode()))
    contents = {}
    for oid in objects:
        header = stream.readline().decode().split()
        if len(header) != 3 or header[1] != "blob":
            raise Rejected("Could not inspect Git blob")
        contents[oid] = stream.read(int(header[2]))
        if stream.read(1) != b"\n":
            raise Rejected("Invalid Git blob framing")
    return {name: contents[oid] for name, oid in entries.items()}


def check(root, staged=False):
    if staged:
        blobs = tree_blobs(root)
    else:
        paths = names(git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"))
        blobs = {}
        for relative in set(paths):
            path = checked_path(root, relative)
            if path.is_file():
                blobs[relative] = path.read_bytes()
    for relative, blob in blobs.items():
        inspect_blob(relative, blob)
    print(f"PASS: inspected {len(blobs)} {'staged' if staged else 'working-tree'} files; no commit or push performed.")


def sync(root, source):
    root, source = root.resolve(), source.resolve()
    if root == source or root.is_relative_to(source) or source.is_relative_to(root):
        raise Rejected("Source and destination must be separate, non-nested directories")
    for repo in (root, source):
        if Path(git(repo, "rev-parse", "--show-toplevel").decode().strip()).resolve() != repo:
            raise Rejected("Unexpected repository root")
    if git(root, "diff", "--cached", "--name-only").strip():
        raise Rejected("Destination has staged changes. Finish or unstage them before syncing.")
    baseline = tree_blobs(root, "HEAD")
    state_file = root / ".git" / "publish-state.json"
    if state_file.exists():
        previous = json.loads(state_file.read_text(encoding="utf-8"))
    else:
        if git(root, "diff", "--name-only").strip():
            raise Rejected("Initial destination checkout is not clean")
        previous = {
            name: hashlib.sha256(checked_path(root, name).read_bytes()).hexdigest()
            for name in names(git(root, "ls-files", "-z")) if not reserved(name)
        }
    paths = set(names(git(source, "ls-files", "--cached", "--others", "--exclude-standard", "-z")))
    desired, skipped = {}, 0
    for relative in sorted(paths):
        if not allowed_source(relative):
            skipped += 1
            continue
        path = checked_path(source, relative)
        if not path.exists():
            continue
        if not path.is_file():
            raise Rejected("Source entry is not a regular file: " + relative)
        blob = source_payload(relative, path.read_bytes())
        if relative == ".gitignore":
            blob = blob.rstrip() + b"\n" + IGNORES.encode()
        if relative in baseline and PurePosixPath(relative).suffix.lower() not in BINARY_EXT:
            blob = preserve_line_endings(blob, baseline[relative])
        inspect_blob(relative, blob)
        desired[relative] = blob
    for relative in set(previous) | set(desired):
        path = checked_path(root, relative)
        if path.exists():
            current = hashlib.sha256(path.read_bytes()).hexdigest()
            if relative in previous and current != previous[relative] or relative not in previous and relative in desired:
                raise Rejected("Destination-only change would be overwritten: " + relative)
        elif relative in previous:
            raise Rejected("Managed destination file was removed locally: " + relative)
    existing = {
        name for name in names(git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"))
        if checked_path(root, name).exists()
    }
    for relative in existing - set(previous) - set(desired):
        if not reserved(relative):
            raise Rejected("Unexpected destination-only file: " + relative)
    for relative in existing:
        if reserved(relative):
            path = checked_path(root, relative)
            if path.is_file():
                inspect_blob(relative, path.read_bytes())
    copied = deleted = 0
    for relative, blob in desired.items():
        path = checked_path(root, relative)
        if not path.exists() or path.read_bytes() != blob:
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_name(path.name + ".publish-tmp")
            if temporary.exists():
                raise Rejected("Unexpected previous temporary file: " + relative)
            try:
                with temporary.open("xb") as output:
                    output.write(blob)
                os.replace(temporary, path)
            finally:
                if temporary.exists():
                    temporary.unlink()
            copied += 1
    for relative in set(previous) - set(desired):
        path = checked_path(root, relative)
        if path.is_file():
            path.unlink()
            deleted += 1
    state = {name: hashlib.sha256(blob).hexdigest() for name, blob in desired.items()}
    state_file.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    print(f"SYNC: {copied} copied, {deleted} obsolete/forbidden source files removed in destination only, {skipped} excluded.")
    check(root)


def check_push(root, url, records):
    accepted = {REMOTE.lower(), REMOTE.removesuffix(".git").lower(), "git@github.com:black-jony/dingent.git"}
    if url.lower() not in accepted:
        raise Rejected("Push destination is not the approved Black-Jony/Dingent repository")
    for record in records.splitlines():
        parts = record.split()
        if len(parts) != 4:
            raise Rejected("Invalid pre-push input")
        _, local_sha, remote_ref, remote_sha = parts
        if remote_ref != "refs/heads/" + BRANCH or set(local_sha) == {"0"}:
            raise Rejected("This publishing copy only pushes normal updates to dingent-resource-v2")
        if set(remote_sha) == {"0"}:
            raise Rejected("Expected existing remote branch; fetch and inspect before publishing")
        git(root, "merge-base", "--is-ancestor", remote_sha, local_sha)
        revisions = git(root, "rev-list", "--reverse", remote_sha + ".." + local_sha).decode().splitlines()
        if len(revisions) > 100:
            raise Rejected("Too many outgoing commits for automatic review")
        for revision in revisions:
            for relative, blob in tree_blobs(root, revision).items():
                inspect_blob(relative, blob)
        for relative, blob in tree_blobs(root, local_sha).items():
            inspect_blob(relative, blob)
    print("PASS: outgoing commit snapshots inspected. Git will handle the explicitly requested push.")


def install(root):
    urls = git(root, "remote", "get-url", "--all", "origin").decode().splitlines()
    if urls != [REMOTE]:
        raise Rejected("origin is not the approved publication repository")
    for name in ("pre-commit", "pre-push"):
        path = checked_path(root, ".publish/hooks/" + name)
        path.chmod(path.stat().st_mode | 0o111)
    git(root, "config", "core.hooksPath", ".publish/hooks")
    print("Installed local pre-commit/pre-push checks. No commit or push performed.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    command = commands.add_parser("sync")
    command.add_argument("--source", type=Path, default=ROOT.parent / "dingent_newdisplay")
    command = commands.add_parser("check")
    command.add_argument("--staged", action="store_true")
    command = commands.add_parser("check-push")
    command.add_argument("--remote-url", required=True)
    commands.add_parser("install")
    args = parser.parse_args(argv)
    try:
        if args.command == "sync":
            sync(ROOT, args.source)
        elif args.command == "check":
            check(ROOT, args.staged)
        elif args.command == "install":
            install(ROOT)
        else:
            check_push(ROOT, args.remote_url, sys.stdin.read())
    except (Rejected, OSError, ValueError, sqlite3.Error) as error:
        print("BLOCKED: " + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
