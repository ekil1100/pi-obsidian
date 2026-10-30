import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import { getAgentDir, truncateHead, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, queryActions, queryArgs, saveArgs, selectVault } from "./core.ts";

const skillPath = fileURLToPath(new URL("../skills/obd/SKILL.md", import.meta.url));
const scriptPath = fileURLToPath(new URL("../skills/obd/scripts/wiki_save.py", import.meta.url));
const optionalString = () => Type.Optional(Type.String({ minLength: 1 }));

export default function (pi: ExtensionAPI) {
  const configPath = join(getAgentDir(), "obd.json");

  async function run(command: string, args: string[], cwd: string, signal?: AbortSignal) {
    const result = await pi.exec(command, args, { cwd, signal, timeout: 60_000 });
    if (result.killed || result.code !== 0 || /^Error:/m.test(result.stdout)) {
      // Do not echo command arguments: they can contain private note content.
      throw new Error(`${command} failed${result.killed ? " or was interrupted" : ""}. ${result.stderr || result.stdout}`);
    }
    return result.stdout;
  }

  async function output(text: string) {
    const result = truncateHead(text);
    let fullOutputPath: string | undefined;
    if (result.truncated) {
      const dir = await mkdtemp(join(tmpdir(), "pi-obd-"));
      fullOutputPath = join(dir, "output.txt");
      await writeFile(fullOutputPath, text, { mode: 0o600 });
    }
    return {
      content: [{ type: "text" as const, text: result.content + (fullOutputPath ? `\n\nOutput truncated. Read the full output at ${fullOutputPath}` : "") }],
      details: { fullOutputPath },
    };
  }

  pi.registerTool({
    name: "obd_query",
    label: "Obsidian query",
    description: "Read-only Obsidian CLI queries. Read the bundled obd skill for Wiki tasks. Start with resolve to pin the configured or explicit vault and its path; vaults/help need no default. path is an exact note path (search/files use a directory).",
    parameters: Type.Object({
      action: Type.Union(queryActions.map(action => Type.Literal(action))),
      vault: optionalString(), path: optionalString(), query: optionalString(),
      limit: Type.Optional(Type.Integer({ minimum: 1 })), command: optionalString(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async execute(_id, input, signal, _onUpdate, ctx) {
      if (input.action === "help" || input.action === "vaults") {
        return output(await run("obsidian", queryArgs(input), ctx.cwd, signal));
      }
      const vault = selectVault(input.vault, await loadConfig(configPath));
      const resolved = await run("python3", [scriptPath, "resolve", "--vault", vault], ctx.cwd, signal);
      if (input.action === "resolve") return output(resolved);
      return output(await run("obsidian", queryArgs(input, vault), ctx.cwd, signal));
    },
  });

  pi.registerTool({
    name: "obd_save",
    label: "Obsidian save",
    description: "Save Wiki Markdown through Obsidian CLI with conflict detection and exact readback. Read the obd skill first. snapshot captures an existing note to a new local snapshotFile. create takes path and a local UTF-8 contentFile. update takes snapshotFile and contentFile; the snapshot pins the vault, even if defaultVault changes. Parent note folders must exist. Errors can mean a partial/unknown write: inspect before retrying.",
    parameters: Type.Object({
      action: Type.Union([Type.Literal("snapshot"), Type.Literal("create"), Type.Literal("update")]),
      vault: optionalString(), path: optionalString(), contentFile: optionalString(), snapshotFile: optionalString(),
    }),
    executionMode: "sequential",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async execute(_id, input, signal, _onUpdate, ctx) {
      const vault = input.action === "update" ? input.vault : selectVault(input.vault, await loadConfig(configPath));
      return output(await run("python3", [scriptPath, ...saveArgs(input, vault)], ctx.cwd, signal));
    },
  });

  pi.registerCommand("obd", {
    description: "Show Obsidian configuration, or /obd <task> to search/save Wiki notes",
    handler: async (args, ctx) => {
      if (!args.trim()) {
        const config = await loadConfig(configPath);
        const text = `Obsidian CLI\nDefault vault: ${config.defaultVault ?? "not configured"}\nConfig: ${configPath}\nUsage: /obd <task>\nExamples: /obd 查找之前的缓存方案 | /obd 保存刚才的结论`;
        if (ctx.hasUI) ctx.ui.notify(text, "info");
        else pi.sendMessage({ customType: "obd-status", content: text, display: true, details: undefined });
        return;
      }
      const skill = await readFile(skillPath, "utf8");
      pi.sendUserMessage(`Use the Obsidian tools and the following Wiki workflow. Skill location: ${skillPath}\n\n${skill}\n\nUser task:\n${args}`, { deliverAs: "followUp" });
    },
  });
}
