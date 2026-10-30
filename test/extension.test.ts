import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension from "../src/index.ts";

function harness(stdout = "ok") {
  const tools = new Map<string, any>();
  const commands = new Map<string, any>();
  const calls: { command: string; args: string[]; options: any }[] = [];
  const messages: any[] = [];
  const notices: string[] = [];
  const result = { stdout, stderr: "", code: 0, killed: false };
  extension({
    registerTool: (tool: any) => tools.set(tool.name, tool),
    registerCommand: (name: string, command: any) => commands.set(name, command),
    exec: async (command: string, args: string[], options: any) => {
      calls.push({ command, args, options });
      return result;
    },
    sendUserMessage: (...args: any[]) => messages.push(args),
    sendMessage: (...args: any[]) => messages.push(args),
  } as unknown as ExtensionAPI);
  const ctx = { cwd: process.cwd(), hasUI: true, ui: { notify: (text: string) => notices.push(text) } };
  return { tools, commands, calls, messages, notices, result, ctx };
}

test("query verifies vault before using CLI and propagates cancellation", async () => {
  const h = harness();
  const signal = new AbortController().signal;
  await h.tools.get("obd_query").execute("id", { action: "read", vault: "lib", path: "wiki/中文.md" }, signal, undefined, h.ctx);
  assert.equal(h.calls[0].command, "python3");
  assert.deepEqual(h.calls[0].args.slice(1), ["resolve", "--vault", "lib"]);
  assert.deepEqual(h.calls[1].args, ["vault=lib", "read", "path=wiki/中文.md"]);
  assert.equal(h.calls[1].options.signal, signal);
  h.result.code = 1;
  await assert.rejects(h.tools.get("obd_query").execute("id", { action: "read", vault: "lib", path: "x.md" }, signal, undefined, h.ctx));
  assert.equal(h.calls.length, 3);
});

test("CLI errors on stdout and interrupted saves are failures", async () => {
  const h = harness("Error: File not found");
  await assert.rejects(h.tools.get("obd_query").execute("id", { action: "help" }, undefined, undefined, h.ctx), /File not found/);
  h.result.stdout = "";
  h.result.killed = true;
  await assert.rejects(h.tools.get("obd_save").execute("id", { action: "update", snapshotFile: "/tmp/s.json", contentFile: "/tmp/c.md" }, undefined, undefined, h.ctx), /interrupted/);
  assert.deepEqual(h.calls[1].args.slice(1), ["update", "--snapshot", "/tmp/s.json", "--content", "/tmp/c.md"]);
});

test("obd task loads the packaged skill and queues a follow-up; bare command shows status", async () => {
  const h = harness();
  await h.commands.get("obd").handler("查找缓存方案", h.ctx);
  assert.match(h.messages[0][0], /# Obsidian Wiki/);
  assert.match(h.messages[0][0], /User task:\n查找缓存方案/);
  assert.deepEqual(h.messages[0][1], { deliverAs: "followUp" });
  assert.equal(h.calls.length, 0);
  await h.commands.get("obd").handler("", h.ctx);
  assert.match(h.notices[0], /obd.json/);
});

test("large query output can be read in full from a private spill file", async () => {
  const text = "中文 output\n".repeat(6000);
  const h = harness(text);
  const result = await h.tools.get("obd_query").execute("id", { action: "help" }, undefined, undefined, h.ctx);
  const path = result.details.fullOutputPath;
  try {
    assert.match(result.content[0].text, /Output truncated/);
    assert.equal(await readFile(path, "utf8"), text);
  } finally { await rm(dirname(path), { recursive: true, force: true }); }
});
