import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./paths.js";

export async function writeJson(pathname: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(pathname));
  await writeFile(pathname, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson<T>(pathname: string): Promise<T> {
  const raw = await readFile(pathname, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeText(pathname: string, value: string): Promise<void> {
  await ensureDir(path.dirname(pathname));
  await writeFile(pathname, `${value}\n`, "utf8");
}
