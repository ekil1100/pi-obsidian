# Pi Obsidian

## Purpose

Use Obsidian from Pi through the official Obsidian CLI. The package combines Wiki search and saving into one `obd` skill, with duplicate checks, source citations, snapshot-based updates, and exact write verification.

- `/obd` shows the default vault, configuration path, and usage.
- `/obd <task>` explicitly loads the Wiki workflow and submits your task. During an active run, it queues a follow-up.
- `obd_query` resolves vaults, searches, reads notes, lists Markdown files, and inspects properties and links.
- `obd_save` captures recovery snapshots, creates notes, and updates notes against a snapshot.

The skill is also discoverable automatically for Wiki search/save requests, and can be invoked with `/skill:obd`.

## Installation

Requirements: Pi 1.4.0, Python 3.10+, and an enabled Obsidian CLI on `PATH`. Keep the Obsidian desktop app running. Verify the CLI with `obsidian help`.

After the first npm release, install with:

```bash
pi install npm:@like/pi-obsidian
```

GitHub installation is available immediately:

```bash
pi install git:github.com/ekil1100/pi-obsidian
```

For local development, run `pi install .` from a checkout.

Run `/reload` in an existing Pi session. For a temporary session that loads both tools and the skill:

```bash
pi -e .
```

The package contains its own Wiki scripts and does not depend on your personal skill directories. Existing `wiki-save` and `wiki-search` skills remain installed separately; disable them in your skill configuration if you want a single automatic Wiki workflow.

## Configuration

Create `~/.pi/agent/obd.json`:

```json
{
  "defaultVault": "lib"
}
```

When `PI_CODING_AGENT_DIR` is set, the file lives in that agent directory instead. `/obd` shows the exact path. Copy the structure from `obd.example.json` and use an exact registered name from `obsidian vaults verbose`.

Configuration is reread for each operation. An explicit tool `vault` overrides `defaultVault`. Without either, vault operations report a configuration error; `help` and `vaults` remain available. Updates use the vault and physical path recorded in the snapshot, regardless of later default changes. Invalid configuration is reported rather than ignored.

Examples:

```text
/obd Find the current cache design in the Wiki and cite its source.
/obd Save the decision we just made to the Wiki.
/obd Search the work vault for the release checklist.
```

Saving uses local UTF-8 candidate files and private recovery snapshots. Note writes go through the CLI and its fixed native API script. Existing notes require a snapshot; concurrent changes cause the update to stop. Parent note folders must already exist. Interrupted writes can have an unknown outcome: inspect the note before retrying. Large query output is saved to a private temporary file for continued reading; remove those files when no longer needed.

The first version focuses on Wiki queries and Markdown publishing. Moving/deleting notes, creating folders, and arbitrary Obsidian command execution are outside its tool interface.

Development checks:

```bash
npm ci
npm run check
npm test
```

The tests exercise tool registration, command dispatch, configuration, argument handling, and the actual write script against an in-memory Obsidian API model. They do not write to a real vault.

Maintainers: see [Publishing](docs/publishing.md) for GitHub Actions releases and npm authentication.
