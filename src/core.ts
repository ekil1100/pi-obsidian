import { readFile } from "node:fs/promises";

export interface Config { defaultVault?: string }

export async function loadConfig(path: string): Promise<Config> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => key !== "defaultVault") ||
      (value.defaultVault !== undefined &&
        (typeof value.defaultVault !== "string" || !value.defaultVault.trim()))) {
    throw new Error(`Invalid ${path}: expected { "defaultVault": "vault-name" }`);
  }
  return value;
}

export function selectVault(explicit: string | undefined, config: Config): string {
  const vault = explicit ?? config.defaultVault;
  if (!vault?.trim()) throw new Error("Specify vault or set defaultVault in obd.json.");
  return vault;
}

export const queryActions = [
  "resolve", "vaults", "help", "search", "read", "files", "properties",
  "backlinks", "links", "outline", "unresolved", "tags",
] as const;
export type QueryAction = typeof queryActions[number];
export interface Query {
  action: QueryAction;
  vault?: string;
  path?: string;
  query?: string;
  limit?: number;
  command?: string;
}

export function queryArgs(input: Query, vault?: string): string[] {
  if (input.action === "vaults") return ["vaults", "verbose"];
  if (input.action === "help") return input.command ? ["help", input.command] : ["help"];
  if (!vault) throw new Error("A vault is required.");
  const args = [`vault=${vault}`, input.action];
  if (["read", "properties", "backlinks", "links", "outline"].includes(input.action) && !input.path) {
    throw new Error(`${input.action} requires an exact note path.`);
  }
  if (input.action === "search") {
    if (!input.query) throw new Error("search requires query.");
    args.push(`query=${input.query}`, "format=json");
    if (input.limit !== undefined) args.push(`limit=${input.limit}`);
  }
  if (input.path) args.push(`${input.action === "files" ? "folder" : "path"}=${input.path}`);
  if (input.action === "files") args.push("ext=md");
  if (["properties", "backlinks", "outline", "unresolved", "tags"].includes(input.action)) args.push("format=json");
  return args;
}

export interface Save {
  action: "snapshot" | "create" | "update";
  vault?: string;
  path?: string;
  contentFile?: string;
  snapshotFile?: string;
}

export function saveArgs(input: Save, vault?: string): string[] {
  const args: string[] = [input.action];
  if (vault) args.push("--vault", vault);
  const required = (value: string | undefined, name: string) => {
    if (!value) throw new Error(`${input.action} requires ${name}.`);
    return value;
  };
  if (input.action !== "update") args.push("--path", required(input.path, "path"));
  if (input.action === "snapshot") args.push("--out", required(input.snapshotFile, "snapshotFile"));
  if (input.action === "update") args.push("--snapshot", required(input.snapshotFile, "snapshotFile"));
  if (input.action !== "snapshot") args.push("--content", required(input.contentFile, "contentFile"));
  return args;
}
