import fs from "node:fs/promises";
import path from "node:path";
import type { Experiment } from "./types";
const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
let queue = Promise.resolve();
export async function read(id: string): Promise<Experiment> {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid experiment ID");
  return JSON.parse(await fs.readFile(path.join(dir, id + ".json"), "utf8"));
}
export async function write(exp: Experiment) {
  const snapshot = JSON.stringify(exp, null, 2);
  const job = queue.then(async () => {
    await fs.mkdir(dir, { recursive: true });
    const dest = path.join(dir, exp.id + ".json");
    await fs.writeFile(dest + ".tmp", snapshot, { mode: 0o600 });
    await fs.rename(dest + ".tmp", dest);
  });
  queue = job.catch(() => {});
  await job;
}
export async function list() {
  await fs.mkdir(dir, { recursive: true });
  const names = (await fs.readdir(/* turbopackIgnore: true */ dir)).filter(
    (f) => /^[a-f0-9-]{36}\.json$/.test(f),
  );
  return (await Promise.all(names.map((f) => read(f.slice(0, -5))))).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}
