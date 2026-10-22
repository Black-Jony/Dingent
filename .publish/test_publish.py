import contextlib
import importlib.util
import io
from pathlib import Path
import subprocess
import tempfile
import unittest

MODULE = Path(__file__).with_name("publish.py")
spec = importlib.util.spec_from_file_location("publish", MODULE)
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="dingent-publish-selftest-")
        self.addCleanup(self.temporary.cleanup)
        self.source = Path(self.temporary.name) / "source"
        self.target = Path(self.temporary.name) / "target"
        for root in (self.source, self.target):
            root.mkdir()
            self.g(root, "init", "-q")
            self.g(root, "config", "user.name", "Publication Test")
            self.g(root, "config", "user.email", "test@example.invalid")
            self.g(root, "config", "core.autocrlf", "false")
            (root / "src").mkdir()
            (root / "src/main.py").write_text("VALUE = 1\n", encoding="utf-8")
            (root / ".gitignore").write_text(".env\n*.sqlite\n", encoding="utf-8")
            self.g(root, "add", ".")
            self.g(root, "commit", "-qm", "baseline")
        self.quiet = contextlib.redirect_stdout(io.StringIO())
        self.quiet.__enter__()
        self.addCleanup(self.quiet.__exit__, None, None, None)

    def g(self, root, *args):
        result = subprocess.run(["git", "-C", str(root), *args], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
        return result.stdout.decode().strip()

    def token(self):
        return "sk-" + "A" * 36

    def sync(self):
        publish.sync(self.target, self.source)

    def test_sync_includes_uncommitted_new_files_and_is_idempotent(self):
        (self.source / "src/new.py").write_text("VALUE = 2\n")
        self.sync()
        self.assertTrue((self.target / "src/new.py").is_file())
        first = (self.target / ".git/publish-state.json").read_bytes()
        self.sync()
        self.assertEqual(first, (self.target / ".git/publish-state.json").read_bytes())

    def test_runtime_files_and_unreviewed_roots_are_not_copied(self):
        (self.source / ".env").write_text("PRIVATE=example")
        (self.source / "src/private.sqlite").write_bytes(b"private")
        (self.source / "personal-notes.txt").write_text("private")
        (self.source / "ui/node_modules").mkdir(parents=True)
        (self.source / "ui/node_modules/data.js").write_text("private")
        self.sync()
        for path in (".env", "src/private.sqlite", "personal-notes.txt", "ui/node_modules/data.js"):
            self.assertFalse((self.target / path).exists())

    def test_environment_template_is_allowed_but_scanned(self):
        (self.source / ".env.example").write_text('API_KEY="YOUR_API_KEY"\n')
        # Root templates require an explicit allowlist entry rather than automatic publication.
        self.sync()
        self.assertFalse((self.target / ".env.example").exists())
        publish.inspect_blob("docs/.env.example", b'API_KEY="YOUR_API_KEY"\n')
        with self.assertRaises(publish.Rejected):
            publish.inspect_blob("docs/.env.example", self.token().encode())

    def test_secret_aborts_before_destination_changes_and_does_not_echo_value(self):
        (self.source / "src/main.py").write_text("VALUE = 2\n")
        (self.source / "src/token.py").write_text('TOKEN = "' + self.token() + '"\n')
        before = (self.target / "src/main.py").read_bytes()
        with self.assertRaises(publish.Rejected) as error:
            self.sync()
        self.assertNotIn(self.token(), str(error.exception))
        self.assertEqual(before, (self.target / "src/main.py").read_bytes())

    def test_utf16_secret_is_also_rejected(self):
        with self.assertRaises(publish.Rejected):
            publish.inspect_blob("src/config.txt", self.token().encode("utf-16"))

    def test_literal_credential_is_rejected(self):
        with self.assertRaises(publish.Rejected):
            publish.inspect_blob("src/config.py", b'API_KEY="' + b'an-actual-looking-value-123456' + b'"\n')

    def test_development_placeholder_is_allowed(self):
        publish.inspect_blob("src/config.py", b'SECRET_KEY: str = "YOUR_SUPER_SECRET_KEY_CHANGE_THIS"\n')

    def test_source_deletion_removes_only_managed_destination_file(self):
        self.sync()
        (self.source / "src/main.py").unlink()
        (self.target / "public-data").mkdir()
        (self.target / "public-data/README.md").write_text("Template information\n")
        self.sync()
        self.assertFalse((self.target / "src/main.py").exists())
        self.assertTrue((self.target / "public-data/README.md").exists())

    def test_destination_edits_are_not_overwritten(self):
        self.sync()
        (self.target / "src/main.py").write_text("LOCAL_EDIT = 1\n")
        with self.assertRaises(publish.Rejected):
            self.sync()
        self.assertEqual((self.target / "src/main.py").read_text(), "LOCAL_EDIT = 1\n")

    def test_staged_changes_block_sync(self):
        (self.target / "src/main.py").write_text("VALUE = 3\n")
        self.g(self.target, "add", "src/main.py")
        with self.assertRaises(publish.Rejected):
            self.sync()

    def test_unmanaged_destination_file_is_not_deleted(self):
        (self.target / "local-notes.txt").write_text("do not delete")
        with self.assertRaises(publish.Rejected):
            self.sync()
        self.assertTrue((self.target / "local-notes.txt").is_file())

    def test_staged_contents_are_checked_even_if_worktree_is_cleaned(self):
        (self.target / "src/main.py").write_text(self.token())
        self.g(self.target, "add", "src/main.py")
        (self.target / "src/main.py").write_text("SAFE = True\n")
        with self.assertRaises(publish.Rejected):
            publish.check(self.target, staged=True)

    def test_force_added_private_database_is_blocked(self):
        (self.target / "private.sqlite").write_bytes(b"not publishable")
        self.g(self.target, "add", "-f", "private.sqlite")
        with self.assertRaises(publish.Rejected):
            publish.check(self.target, staged=True)

    def test_only_exact_sanitized_database_is_allowed(self):
        seed = (MODULE.parents[1] / publish.SEED).read_bytes()
        publish.inspect_blob(publish.SEED, seed)
        with self.assertRaises(publish.Rejected):
            publish.inspect_blob(publish.SEED, seed + b"changed")
        with self.assertRaises(publish.Rejected):
            publish.inspect_blob("public-data/other.sqlite", seed)

    def test_pre_push_rejects_secret_in_earlier_outgoing_commit(self):
        base = self.g(self.target, "rev-parse", "HEAD")
        (self.target / "src/main.py").write_text(self.token())
        self.g(self.target, "add", "src/main.py")
        self.g(self.target, "commit", "-qm", "unsafe intermediate commit")
        (self.target / "src/main.py").write_text("VALUE = 4\n")
        self.g(self.target, "add", "src/main.py")
        self.g(self.target, "commit", "-qm", "remove secret")
        tip = self.g(self.target, "rev-parse", "HEAD")
        records = f"refs/heads/local {tip} refs/heads/{publish.BRANCH} {base}\n"
        with self.assertRaises(publish.Rejected):
            publish.check_push(self.target, publish.REMOTE, records)

    def test_pre_push_accepts_normal_clean_update(self):
        base = self.g(self.target, "rev-parse", "HEAD")
        (self.target / "src/main.py").write_text("VALUE = 5\n")
        self.g(self.target, "add", "src/main.py")
        self.g(self.target, "commit", "-qm", "safe update")
        tip = self.g(self.target, "rev-parse", "HEAD")
        publish.check_push(self.target, publish.REMOTE, f"refs/heads/local {tip} refs/heads/{publish.BRANCH} {base}\n")

    def test_wrong_remote_and_wrong_branch_are_blocked(self):
        head = self.g(self.target, "rev-parse", "HEAD")
        with self.assertRaises(publish.Rejected):
            publish.check_push(self.target, "https://github.com/another/repo.git", "")
        with self.assertRaises(publish.Rejected):
            publish.check_push(self.target, publish.REMOTE, f"refs/heads/local {head} refs/heads/main {head}\n")

    def test_traversal_and_symlink_are_rejected(self):
        with self.assertRaises(publish.Rejected):
            publish.checked_path(self.target, "../outside.txt")
        path = self.source / "src/link.py"
        try:
            path.symlink_to(self.target / "src/main.py")
        except OSError:
            return
        with self.assertRaises(publish.Rejected):
            self.sync()

    def test_application_security_and_logs_modules_are_preserved(self):
        for directory in ("src/dingent/core/security", "src/dingent/core/logs"):
            path = self.source / directory
            path.mkdir(parents=True)
            (path / "__init__.py").write_text("VALUE = 1\n")
        self.sync()
        self.assertTrue((self.target / "src/dingent/core/security/__init__.py").is_file())
        self.assertTrue((self.target / "src/dingent/core/logs/__init__.py").is_file())
        self.assertTrue(publish.excluded("security/master.key"))
        self.assertTrue(publish.excluded("logs/run.txt"))

    def test_reviewed_test_password_does_not_allow_arbitrary_values(self):
        fixture = b'password="' + b'authpassword' + b'"'
        publish.inspect_blob("tests/server/conftest.py", fixture)
        with self.assertRaises(publish.Rejected):
            publish.inspect_blob("src/config.py", fixture)
        with self.assertRaises(publish.Rejected):
            publish.inspect_blob("tests/server/conftest.py", b'password="' + b'a-new-looking-private-password' + b'"')

    def test_legacy_benchmark_jwt_is_replaced_in_copy_only(self):
        token = "eyJ" + "A" * 20 + "." + "B" * 25 + "." + "C" * 25
        original = ('payload = {\n    "authorization": "' + token + '",\n}\n').encode()
        result = publish.source_payload("scripts/performance.py", original)
        self.assertIn(token.encode(), original)
        self.assertNotIn(token.encode(), result)
        self.assertIn(b'import os\n', result)
        self.assertIn(b'os.environ["DINGENT_BENCHMARK_TOKEN"]', result)
        publish.inspect_blob("scripts/performance.py", result)
        with self.assertRaises(publish.Rejected):
            publish.inspect_blob("src/config.py", original)

    def test_keyring_reference_is_not_an_api_key(self):
        publish.inspect_blob("docs/config.md", b'api_key="keyring:llm.api_key"')

    def test_excluded_tracked_backup_removal_remains_idempotent(self):
        for root in (self.source, self.target):
            (root / "src/old.py.bak").write_text("OLD = True\n")
            self.g(root, "add", "src/old.py.bak")
            self.g(root, "commit", "-qm", "old backup fixture")
        self.sync()
        self.sync()
        self.assertFalse((self.target / "src/old.py.bak").exists())
        self.assertTrue((self.source / "src/old.py.bak").exists())

    def test_line_ending_only_change_does_not_dirty_publication(self):
        for root in (self.source, self.target):
            (root / ".gitattributes").write_text("src/main.py -text\n")
            (root / "src/main.py").write_bytes(b"VALUE = 1\r\n")
            self.g(root, "add", ".gitattributes", "src/main.py")
            self.g(root, "commit", "-qm", "CRLF fixture")
        (self.source / "src/main.py").write_bytes(b"VALUE = 1\n")
        self.sync()
        self.assertEqual((self.target / "src/main.py").read_bytes(), b"VALUE = 1\r\n")
        self.assertEqual(self.g(self.target, "diff", "--name-only", "--", "src/main.py"), "")


if __name__ == "__main__":
    unittest.main()
