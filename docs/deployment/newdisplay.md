# Newdisplay Collaboration and Deployment

## Version and Collaboration

- Repository: `https://github.com/Black-Jony/Dingent`
- Collaboration branch: `dingent-resource-v2`.
- This branch now contains the newdisplay application. The earlier Resource
  snapshot remains available in its commit history; `genebase` stays separate.
- This snapshot preserves the current local newdisplay application, not every
  change that may exist in other local Resource directories.

```bash
git clone --branch dingent-resource-v2 --single-branch https://github.com/Black-Jony/Dingent.git dingent-newdisplay
cd dingent-newdisplay
git switch -c feature/my-change
```

Commit changes on individual feature branches and open pull requests targeting
`dingent-resource-v2`. Do not share GitHub accounts, personal tokens, or
model API keys. Public repository access does not grant write permission;
the owner must invite collaborators separately.

## What Is Included

The repository includes application source, dependency lockfiles, seven locale
catalogs, the CopilotKit dependency patch, and formal regression tests. Keep
`ui/patches/` and `ui/messages/.i18n-lock.json` when checking out or deploying.

The repository does not include SQLite databases, chat history, runtime plugin
packages, model credentials, master keys, local `.env` files, dependencies, or
built frontend assets. Install dependencies and build on the target machine.

## Compact Database: Private Delivery Only

A deployment snapshot was prepared on 2026-10-08. It is an SQLite application
configuration database, not the scientific annotation databases or plugin code.

- File: `db/dingent.sqlite` in the separately delivered database directory.
- Size: 344,064 bytes (336 KiB).
- SHA-256:
  `e4f4ef4df538065d97143c60fc48c8efede9c7bdd12f11f736e42084b8ca84fc`.
- `conversation`, `checkpoints`, and `writes` are empty.
- Users, workspaces, models, assistants, workflows, and plugin configuration
  remain. This is private configuration, not a sanitized public demo database.
- Database integrity and foreign keys were rechecked on 2026-10-22. This does not
  certify complete application/plugin compatibility on a production server.

For a new environment only, transfer the snapshot privately and place it at
`<DINGENT_HOME>/db/dingent.sqlite` before starting the backend. Retain the
separate verification report with the deployment backup, not in this public repo.
Do not overwrite an existing production database with this empty-history snapshot.

Encrypted model/plugin values need the same master key as the source environment.
Supply it securely as `DING_MASTER_KEY`, or privately provision the corresponding
`<DINGENT_HOME>/security/master.key`. An environment override takes priority over
the file. Never commit the key or attach it to a public GitHub issue/release.
Without the original key, re-enter affected secrets through the application.

Install the actual plugin files under `<DINGENT_HOME>/plugins/`, along with their
dependencies. Review stored file paths, object-store configuration, model URLs,
workspace membership, and existing user access before enabling public access.
Use a unique production `SECRET_KEY`; do not use the development default.

Automatic checkpoint-retention maintenance from the separate local Resource
version is not present in this newdisplay snapshot. The small initial database does not prevent later
growth. Back up production data and monitor database/WAL size; port and test the
retention changes separately instead of assuming they are already included.

## Local Setup

Use Python 3.12 or 3.13, `uv`, Node.js >= 20.9, and Bun 1.2.20 or a compatible
version. Set the runtime directory before importing or starting the backend.
For a colleague's development environment, use a separate runtime directory and
their own model keys rather than sharing the production database.

Example in PowerShell, from the repository root:

```powershell
$env:DINGENT_HOME = Join-Path $env:LOCALAPPDATA 'dingent-newdisplay'
# Supply a private, unique SECRET_KEY through your environment or secret manager.
uv sync --frozen --extra speech
uv run --no-sync dingent run --dev --host 127.0.0.1 --port 8000 -d "$env:DINGENT_HOME"
```

In a second terminal, from `ui/`:

```powershell
$env:BACKEND_URL = 'http://127.0.0.1:8000'
bun install --frozen-lockfile
bun run dev -- -p 3000
```

Open `http://localhost:3000/dingent-resource/auth/login`.

## Validation and Server Deployment

From `ui/`, run:

```bash
bun run i18n:check
bun run test --maxWorkers=2
bun run build
```

`BACKEND_URL` must point to the backend reachable from the Next.js server at build
time, because rewrites are generated during the build. A container frontend uses
`http://backend:8000`; a host-based frontend may use `http://127.0.0.1:8000`.

The production frontend uses the Next.js standalone output. The normal Node
server package also needs `ui/src/public` assets copied to `public`, and
`.next/static` copied to `.next/static` alongside `server.js`. The frontend
Dockerfile already performs these copies. Run a fresh local Docker build when
using the included Compose configuration; do not assume a prebuilt upstream image
contains this branch. Install any extra plugin/speech dependencies separately.

Before public deployment, verify authentication, all required plugins and data
mounts, model connectivity, chat completion/history switching, results expansion,
TLS/reverse-proxy routing under `/dingent-resource`, streaming/timeouts, and backup
restore. The compact database is an initialization artifact, not a complete
deployment bundle or proof that every stored configuration is production-ready.
