import { MapGenerator } from "./src/engine/map-generator.js";
import { ensureShard } from "./src/db.js";

async function run() {
  await ensureShard();
  const gen = new MapGenerator({ width: 100, height: 60 });
  await gen.generateWorld();
  console.log("World generation complete. Shard is ready.");
  process.exit(0);
}

run();
