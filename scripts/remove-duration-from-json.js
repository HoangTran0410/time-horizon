import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const targetDir = path.resolve(projectRoot, process.argv[2] ?? "data");

const getJsonFiles = async (targetPath) => {
  const stats = await fs.stat(targetPath);

  if (stats.isFile()) {
    return targetPath.endsWith(".json") ? [targetPath] : [];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        return getJsonFiles(fullPath);
      }

      return entry.isFile() && entry.name.endsWith(".json") ? [fullPath] : [];
    }),
  );

  return files.flat();
};

const stripDuration = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripDuration);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "duration")
        .map(([key, nestedValue]) => [key, stripDuration(nestedValue)]),
    );
  }

  return value;
};

const main = async () => {
  const jsonFiles = await getJsonFiles(targetDir);
  let updatedFiles = 0;

  for (const filePath of jsonFiles) {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const next = stripDuration(parsed);
    const nextRaw = `${JSON.stringify(next, null, 2)}\n`;

    if (raw === nextRaw) {
      continue;
    }

    await fs.writeFile(filePath, nextRaw);
    updatedFiles += 1;
  }

  console.log(
    `Removed "duration" from ${updatedFiles} file${updatedFiles === 1 ? "" : "s"} under ${path.relative(projectRoot, targetDir) || "."}.`,
  );
};

await main();
