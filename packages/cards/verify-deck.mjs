import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.argv[2] ?? path.resolve("packages/cards/assets/CHAOS-133-V1");
const manifestPath = process.argv[3] ?? path.resolve("packages/cards/deck-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

let failures = 0;

for (const card of manifest.cards) {
  const full = path.join(root, card.path);
  if (!fs.existsSync(full)) {
    console.error("MISSING:", card.path);
    failures++;
    continue;
  }

  const data = fs.readFileSync(full);
  if (data.length === 0) {
    console.error("EMPTY:", card.path);
    failures++;
    continue;
  }

  const sha = crypto.createHash("sha256").update(data).digest("hex");
  if (sha !== card.sha256) {
    console.error("CHANGED:", card.path);
    failures++;
  }
}

if (manifest.actualPlayableFiles !== manifest.expectedPlayableCards) {
  console.error(
    `COUNT: expected ${manifest.expectedPlayableCards}, manifest has ${manifest.actualPlayableFiles}`
  );
  failures++;
}

if (failures > 0) {
  console.error(`Deck verification failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log(`Deck verified: ${manifest.expectedPlayableCards} playable cards.`);
