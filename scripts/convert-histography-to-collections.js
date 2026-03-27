import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const sourceFile = path.join(projectRoot, "src/data/histography.json");
const outputDir = path.join(projectRoot, "src/data/collections/histography");
const HISTOGRAPHY_IMAGE_BASE_URL = "https://histography.io/images/";

const categoryEmoji = {
  art: "🎨",
  assassinations: "🗡️",
  construction: "🏗️",
  disasters: "🌋",
  discoveries: "🔭",
  empires: "👑",
  evolution: "🧬",
  "human prehistory": "🦴",
  inventions: "💡",
  literature: "📚",
  music: "🎵",
  nationality: "🏳️",
  "natural history": "🌍",
  politics: "🏛️",
  religion: "🛐",
  riots: "✊",
  wars: "⚔️",
  "women rights": "♀️",
};

const cleanText = (value) =>
  String(value ?? "")
    .replaceAll("\u00a0", " ")
    .replace(/\s+/g, " ")
    .trim();

const toOptionalText = (value) => {
  const cleaned = cleanText(value);
  return cleaned === "" ? undefined : cleaned;
};

const slugify = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toEventTime = (rawYear) => {
  const normalized = cleanText(rawYear);
  const match = normalized.match(/^(-?\d+)(?:\.(\d+))?$/u);

  if (!match) {
    return [Number(normalized), null, null, null, null, null];
  }

  const [, yearPart, fractionPart] = match;
  const year = Number(yearPart);

  if (!fractionPart) {
    return [year, null, null, null, null, null];
  }

  const fraction = Number(`0.${fractionPart}`);
  const month = Math.max(1, Math.min(12, Math.floor(fraction * 12) + 1));

  return [year, month, null, null, null, null];
};

const toHistographyImageUrl = (image) => {
  const cleaned = toOptionalText(image);
  return cleaned ? `${HISTOGRAPHY_IMAGE_BASE_URL}${cleaned}` : undefined;
};

const compactEventTime = (time) => {
  const nextTime = [...time];
  while (nextTime.length > 1 && nextTime[nextTime.length - 1] == null) {
    nextTime.pop();
  }
  return nextTime;
};

const byYearThenPriority = (a, b) => {
  const yearDiff = a.time[0] - b.time[0];
  if (yearDiff !== 0) return yearDiff;

  const priorityDiff = b.priority - a.priority;
  if (priorityDiff !== 0) return priorityDiff;

  return a.title.localeCompare(b.title);
};

const main = async () => {
  const raw = await fs.readFile(sourceFile, "utf8");
  const items = JSON.parse(raw);
  const grouped = new Map();

  for (const item of items) {
    const category = cleanText(item.category).toLowerCase();
    const collectionId = slugify(category);
    const emoji = categoryEmoji[category] ?? "🗂️";

    const event = {
      id: `h${cleanText(item.i)}`,
      title: cleanText(item.title),
      description: "",
      time: compactEventTime(toEventTime(item.year)),
      emoji,
      priority: Number(item.rating),
    };

    const link = toOptionalText(item.link);
    const image = toHistographyImageUrl(item.image);
    const video = toOptionalText(item.video);

    if (link) event.link = link;
    if (image) event.image = image;
    if (video) event.video = video;

    const events = grouped.get(collectionId) ?? [];
    events.push(event);
    grouped.set(collectionId, events);
  }

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const collectionIds = [...grouped.keys()].sort();

  for (const collectionId of collectionIds) {
    const events = grouped.get(collectionId);
    events.sort(byYearThenPriority);

    await fs.writeFile(
      path.join(outputDir, `${collectionId}.json`),
      `${JSON.stringify(events, null, 2)}\n`,
    );
  }

  console.log(
    `Converted histography.json into ${collectionIds.length} collection files`,
  );
};

await main();
