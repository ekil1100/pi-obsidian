import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadConfig, queryArgs, saveArgs, selectVault } from "../src/core.ts";

test("configuration is reread, explicit vault wins, and missing default fails closed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "obd-config-test-"));
  const path = join(dir, "obd.json");
  try {
    assert.deepEqual(await loadConfig(path), {});
    assert.throws(() => selectVault(undefined, {}), /defaultVault/);
    await writeFile(path, JSON.stringify({ defaultVault: "lib" }));
    assert.equal(selectVault(undefined, await loadConfig(path)), "lib");
    assert.equal(selectVault("other", await loadConfig(path)), "other");
    await writeFile(path, JSON.stringify({ defaultVault: "changed" }));
    assert.equal(selectVault(undefined, await loadConfig(path)), "changed");
    for (const bad of ['null', '[]', '{', '{"defaultVault":" "}', '{"defaultVault":3}', '{"defaultVualt":"lib"}']) {
      await writeFile(path, bad);
      await assert.rejects(loadConfig(path));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("query arguments preserve special characters as one argument", () => {
  const query = '中文 "quoted" $(touch /tmp/no) `cmd`\nnext';
  assert.deepEqual(queryArgs({ action: "search", query, path: "wiki/a b", limit: 7 }, "My Vault"),
    ["vault=My Vault", "search", `query=${query}`, "format=json", "limit=7", "path=wiki/a b"]);
  assert.deepEqual(queryArgs({ action: "files", path: "wiki" }, "lib"), ["vault=lib", "files", "folder=wiki", "ext=md"]);
  assert.deepEqual(queryArgs({ action: "vaults" }), ["vaults", "verbose"]);
  for (const action of ["read", "properties", "backlinks", "links", "outline"] as const) {
    assert.throws(() => queryArgs({ action }, "lib"), /exact note path/);
  }
});

test("updates leave vault selection to the snapshot and require candidate and snapshot", () => {
  assert.deepEqual(saveArgs({ action: "update", snapshotFile: "/tmp/old.json", contentFile: "/tmp/new.md" }),
    ["update", "--snapshot", "/tmp/old.json", "--content", "/tmp/new.md"]);
  assert.throws(() => saveArgs({ action: "update", contentFile: "/tmp/new.md" }), /snapshotFile/);
  assert.throws(() => saveArgs({ action: "create", path: "wiki/new.md" }, "lib"), /contentFile/);
});
