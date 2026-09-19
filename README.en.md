# dsh-memory-evolve-suite

> **In one sentence**: gives DSH cross-session long-term memory, four-track todos, self-evolving skills and external AI dispatch — plus three bundled "memory-ops" skills and 15 helper scripts. **Memory grows by itself, and can slim itself down.**

Related docs: [Detailed feature guide](README-详细说明.md) · [Memory & review rules](docs/rules.md) · [COI dispatch](docs/COI-调度.md) · [Memory sync](docs/记忆同步.md) · [Changelog](docs/CHANGELOG.md) · [Upstream original: usage scenario guide](docs/上游-使用场景指南.en.md) · [中文](README.md)

---

## About This Package (Redistributed Build)

**This is `dsh-memory-evolve-suite`, not the original plugin.** It is built on **csyangwen**'s **[dsh-memory-evolve](https://github.com/csyangwen/dsh-memory-evolve)** v0.1.0 (MIT). **The plugin's own feature logic is unchanged** — only four things differ:

| Item | What changed |
|---|---|
| Package & plugin name | `dsh-memory-evolve` → `dsh-memory-evolve-suite`. The plugin row id, client registration id, log tags, config keys, lock and cache directory names were renamed too, so it **can be installed side by side with the original without overwriting it** |
| Bundled skills | `skills/` grew from 4 to 7; added `dsh-memory-compression`, `dsh-memory-curation`, `dsh-injection-track-triage` |
| Helper scripts | New `tools/`: 14 parameterized scripts for memory compression, expiry auditing and session forensics (generalized — no private data) |
| Factory tests | New `tests/bundled-skills.test.js` and `tests/tools.test.js` |

**Want the original?** `dsh plugin --profile web add github:csyangwen/dsh-memory-evolve`.

**About auto-update**: version detection (`lib/update.js`) needs a fetchable remote **and an intact `.git` working copy** — both. This package is published at `https://github.com/Archer76/dsh-memory-evolve-suite`: install it from a `git clone` (`dsh plugin add <clone directory>`) and the Version tab can detect new releases and update in one click (the update does `git fetch` + `checkout --detach`; your memory data is untouched). Three install paths cannot auto-update, all expected, none affecting a memory feature: (1) a zip or a plain local directory has no remote; (2) a plugin marketplace install, or `pnpm add github:...` / `dsh plugin add <git url>` — measured: git-dependency installs strip `.git` (marketplace users should use the marketplace own Update button, which re-runs the install); (3) a directory hand-copied into the profile.

---

## Quick Start (Installation)

The plugin ships its own `cordis.patch.yml` (declared via `dsh.bundle.patch`), so after `dsh plugin add` the **host side registers automatically — no manual configuration needed**. Using the web profile as an example, two steps:

```sh
# 0. (optional) Want the Version tab to auto-update? Clone first so the plugin
#    directory carries a git remote:
git clone https://github.com/Archer76/dsh-memory-evolve-suite.git

# 1. Install into the profile (replace <this package directory> with the cloned or
#    extracted directory; link:<path> also works)
dsh plugin --profile web add <this package directory>

# 2. Restart dsh web — done
```

> ⚠️ **Do NOT manually `insert` this plugin into `~/.dsh/profiles/web/cordis.patch.yml`**: the bundle patch already registers it; a duplicate insert with the same id crashes the loader with a duplicate loader entry id error.

**Changing default config** (e.g. turning on per-turn memory review): override by id in the profile's `cordis.patch.yml` (top-level form, not an insert):

```yaml
- id: dsh-memory-evolve-suite
  config:
    reviewEnabled: true      # enable per-turn memory review (off by default)
    reviewInterval: 10       # review every 10 user turns
```

**Temporarily disabling** (when the plugin breaks DSH startup; undo after the fix — no uninstall needed):

```yaml
- id: dsh-memory-evolve-suite
  disabled: true
```

**Upgrading from an older version**: if you previously inserted this plugin manually per older docs, delete that insert block from your profile patch (it now duplicates the bundle registration).

**Uninstall**: `dsh plugin --profile web remove dsh-memory-evolve-suite`. Plugin effects are cleaned up on uninstall; **files already synced into your skill library are not deleted** — the sync only pushes, never pulls back. Remove the directories under `~/.agents/skills/` yourself if you want them gone.

**If you rename the package**: four places must stay **byte-identical**, or the browser half loads without registering (features silently missing): the `name` in `package.json`, the `id` and `name` of the row in `cordis.patch.yml`, `export const name` in `lib/index.js`, and the registration `id` on line 1 of `lib/client.js`. Afterwards run `node scripts/build.mjs` once — it bakes the `package.json` name into the client bundle.

---

## What's Inside

### 1. The plugin: feature overview

Config keys go in the profile's `cordis.patch.yml` (top-level id override, see above).

| Feature | What it does | Config keys |
|---|---|---|
| **Five memory tracks** | Global `MEMORY.md` · user `USER.md` · project `projects/<hash>/MEMORY.md` · project key facts `KEY.md` · daily `daily/YYYY-MM-DD.md`; git-branch aware, filed by working directory | — |
| **Summary injection (progressive disclosure)** | The `key` track injects only a one-line `[summary:…]`; load the full text on demand with `memory expand` — big tracks stop flooding the system prompt every turn | `keyProgressiveDisclosure`, `keyFullInjectThreshold`, `keyFullInjectCharLimit` |
| **Per-turn self review** | Every N user turns a separate reviewer model audits the session and files memory/skill suggestions into a confirmation queue | `reviewEnabled`, `reviewInterval`, `reviewMode` |
| **Skill self-evolution & skill manager** | Experiences crystallize into skills; browse, enable/disable and submit skills for adoption | `skillReviewEnabled` |
| **Per-turn write guard** | Prevents writing the same track repeatedly within one turn; rate-limits past a threshold | `perTurnDailyWrites`, `perTurnKeyWrites`, `perTurnProjectWrites`, `perTurnWriteGuard`, `writeGuardThreshold` |
| **Four-track todos** | Life / work / project (isolated by working directory) / daily, with quadrants and due reminders | `todoEnabled` |
| **Memory sync** | Share one project memory across machines; conflicts stay visible | `syncEnabled` |
| **Session advisor** | Observes sessions out of band, answers on demand and can inject, with adjustable visibility | `advisorEnabled`, `advisorPanelEnabled`, `advisorProvider`, `advisorModel`, `advisorSystemPrompt`, `advisorInfoInject`, `advisorImmuneTurns`, `advisorMaxMessages`, `advisorMaxQueued`, `advisorCallTimeoutMs`, `advisorSteerSeverities` |
| **COI external CLI dispatch** | Hands tasks to kimi / codex / grok / hermes or any custom CLI, with session layering and visible progress | `coiEnabled` |
| **Session orchestration & broadcast** | Spins up internal sessions that work together; broadcasts messages (optionally with images) to a group of sessions | `broadcastEnabled`, `broadcastImageEnabled` |
| **Session search & image fetch** | Searches past sessions; pulls images out of a session on demand | `sessionEnabled`, `sessionSearchEnabled`, `sessionImageQueryEnabled` |
| **Local file search** | Semantic/keyword search over local files, results can be fed back into memory | `searchDocsEnabled`, `searchDocsMode` |
| **Prompt manager** | Maintains a reusable prompt library and injects prompts on demand | `promptsEnabled` |
| **Model settings** | Manage models and routing from the UI | `modelsEnabled` |
| **UI settings** | A home for style-level micro-features | `uiSettingsEnabled` |
| **Session bookmarks & branches** | Mark, jump back and fork long sessions | `bookmarkEnabled` |
| **Infinite canvas** | A board to gather and render scattered material | `canvasEnabled` |
| **Notifications & channel send** | In-app notification bell; pushes results straight to connected IM channels | `notifyEnabled`, `channelSendEnabled` |
| **Workspace write coordination** | Locks and snapshots when several sessions write one workspace | `wsCoordEnabled`, `wsCoordEnforceWrite`, `wsCoordSnapshot` |

**Tools exposed to the model**: memory & skills — `memory`, `memory_suggest`, `skill_manage`, `memory_review_status`; todos — `dtodo`; search — `memory_evolve_search_local_files`; prompts/models — `de_prompts`, `de_models`; notifications & channels — `de_notify`, `de_channel_send`; sessions — `de_session`, `de_session_search`, `de_session_images`, `de_broadcast`; canvas — `de_canvas`; external CLI dispatch — `de_coi`, `de_coi_dispatch`, `de_coi_status`, `de_coi_wait`, `de_coi_cancel`, `de_coi_adapters`; workspace write coordination — `de_ws_declare`, `de_ws_status`, `de_ws_release`. (Slash commands `memory_review` and `memory_evolve_search_files` also exist.)

**WebUI pages**: memory files, skills, todos, settings, models, memory sync, COI dispatch, UI settings, bookmarks, canvas, broadcast, prompts, advisor panel, memory queue, version.

### 2. Bundled skills (`skills/`, 7)

On startup the plugin syncs them into your skill library (default `~/.agents/skills`, one directory each). They are injected with the system prompt and available in every session; enable/disable and editing live in the WebUI "Skills" tab.

| Skill | What it is for |
|---|---|
| `dsh-memory-compression` | Compression pipeline for oversized injection tracks (memory/user/key): measuring and attributing injection size, snapshotting for concurrency safety, block-parallel merging by topic, token-level fact verification, staging assembly and archiving — plus expiry auditing and how to turn summary injection on |
| `dsh-memory-curation` | Everyday curation: what each track can archive, full snapshots, rewriting by § blocks, entry format and timestamp rules, and post-edit render checks |
| `dsh-injection-track-triage` | Triage for a workspace where "anything sent fails instantly with no model call": locating consecutive left braces in an injection track, multi-frame zstd session forensics, reproducing and verifying the fix |
| `kimi-cli-calling` / `codex-cli-calling` / `grok-cli-calling` / `hermes-cli-calling` | External CLI dispatch adapters (provided by the plugin already) |

**Sync and upgrade semantics**: each skill carries `x-version` in its frontmatter. Missing on the user side → installed; higher `x-version` at the source → overwritten; anything else → left alone (protecting your local edits to SKILL.md). Note the protection is **one-directional**: **upgrading the plugin overwrites local edits to these skills** — keep long-term changes in a skill name of your own.

### 3. Helper scripts (`tools/`, 14 + 1 example)

Command-line tools for memory compression, expiry auditing and session forensics. All parameterized, no external dependencies (except `check-inject.js`, below).

| Script | Purpose |
|---|---|
| `check-inject.js` | Replicates DSH's interpolation rendering for one injection track: reports OK/THROW, consecutive left-brace count and the **rendered character count** (what actually gets injected each turn) |
| `check-summaries.js` | Format check: blocks missing `[summary:…]`, summaries over 120 chars, summaries containing a right bracket, double-brace count |
| `curate.js` | §-block curation: keep chosen blocks, archive removed blocks verbatim, append new entries |
| `track-index.js` | Prints an index of `number \| date \| bytes \| title` per block |
| `track-summaries.js` | Prints each block's summary line |
| `verify-merge.js` | Verifies a merged draft lost no facts: are the original entries' identifiers/numbers still present, and is the coverage table complete |
| `verify-hard.js` | Splits missing tokens into soft/hard: reports only hard misses and maps them back to the original entry number |
| `assemble.js` | Assembles the compressed version into a staging file, **leaving the original track untouched** (review first) |
| `assemble-and-swap.js` | Assembly + safety checks + backup + swap + verbatim archiving of replaced text; dry-run by default |
| `unexpire.js` | Expiry-audit writer: literal replacements, each requiring a unique hit and no double braces in the new text; re-reads and compares before writing |
| `ztail.js` | Session timeline: decompresses multi-frame zstd, summarizes turn-end reasons, error times and messages |
| `zscan.js` | Scans out error turns and error payloads |
| `zdump.js` | Multi-frame zstd unpacker (session logs are frame-concatenated; Node's built-in only decodes the first frame) |
| `msgsrc.js` | Prints the origin and shape of user messages (to tell which channel a message came from) |

**How to run them**: call them in place (`node <this package directory>/tools/ztail.js <session file>`), or copy the whole `tools/` into `<DSH_HOME>/tools/` and follow the `<TOOLS>/xxx.js` calls in the skills. Full arguments, behavior and exit codes are documented in each script's header comment and in the "辅助脚本" section at the end of the `dsh-memory-compression` skill.

- `tools/` ships a `package.json` containing `{"type": "commonjs"}`: the scripts are CommonJS, so **copying a single `.js` elsewhere** into a directory that belongs to an ESM package fails with `require is not defined` — copy that `package.json` along.
- `check-inject.js` needs DSH's interpolation implementation to replicate behavior; it resolves it in order: `DSH_SYSTEM_PROMPT_MODULE` → `$DSH_SOURCE` → `$DSH_HOME/source/current` → npx cache → current working directory, and exits with code 3 plus explicit instructions when nothing is found — it never fails silently.
- `unexpire.js` takes its replacement table from an external JSON file; see `tools/edits.example.json`.

### 4. Factory tests

```bash
node --test tests/bundled-skills.test.js   # bundled skills: manifest, format, sync and version protection
node --test tests/tools.test.js            # helper scripts: syntax, usage output, full pipeline on a synthetic fixture
```

(`tools.test.js` builds its own temporary fixture: snapshot → chunks → verify-merge/verify-hard → assemble → assemble-and-swap → unexpire → curate, then cleans up.)

---

## Storage Locations

| What | Where |
|---|---|
| Memory tracks | `<DSH_HOME>/memories/MEMORY.md`, `USER.md`, `daily/YYYY-MM-DD.md`, `projects/<hash>/MEMORY.md`, `projects/<hash>/KEY.md` |
| Runtime config | `<DSH_HOME>/memories/plugin-state.json` (UI config changes land here and survive restarts) |
| Skill library | `~/.agents/skills/<skill-name>/SKILL.md` |
| Archives | `*-archive.md` beside each track (can be moved back) |

## Origin and License

Derived from `dsh-memory-evolve` v0.1.0 (author csyangwen, MIT, `https://github.com/csyangwen/dsh-memory-evolve`): the package was renamed to `dsh-memory-evolve-suite`, version 0.3.1, with the 3 skills above plus `tools/` and `tests/` added, and the bundled-skill list in `lib/coi/skills-sync.js` adjusted from 4 to 7 items. Upstream feature logic is unchanged. The two upstream usage-scenario guides are kept as `docs/上游-使用场景指南.md` and `docs/上游-使用场景指南.en.md` (package name and install commands inside them are aligned with this build). The original `LICENSE` stays in the package root.
