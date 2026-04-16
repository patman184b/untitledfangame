import { getShard, updateShardTick, query } from "../db.js";
import { completeMarch } from "../actions/handlers.js";

export class ShardEngine {
  constructor(config = {}) {
    this.tickIntervalMs = config.tickIntervalMs || 5000;
    this.ticksPerDay = config.ticksPerDay || 17280; // 1 day = 86400s / 5s
    this.isRunning = false;
    this.currentShard = null;
  }

  async init() {
    this.currentShard = await getShard();
    console.log(`Shard Engine initialized. Status: ${this.currentShard.status}, Tick: ${this.currentShard.tick}`);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tickLoop();
  }

  stop() {
    this.isRunning = false;
  }

  async tickLoop() {
    while (this.isRunning) {
      const startTime = Date.now();
      await this.runTick();
      const elapsed = Date.now() - startTime;
      const wait = Math.max(0, this.tickIntervalMs - elapsed);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  async runTick() {
    if (!this.currentShard) return;

    // 1. Advance Tick
    this.currentShard.tick += 1;
    
    // 2. Calculate Season Day
    const newSeasonDay = Math.floor(this.currentShard.tick / this.ticksPerDay) + 1;
    this.currentShard.season_day = newSeasonDay;

    // 3. Persistent Save
    await updateShardTick(this.currentShard.tick, this.currentShard.season_day);

    // 4. Process Action Queue
    await this.processQueue();
    
    // 5. Military Training Completion
    import("./recruitment-manager.js").then(m => m.RecruitmentManager.processQueue());

    // 6. Trigger Tick Events
    this.onTick(this.currentShard);
    
    // 6. Handle Season Transitions
    if (this.currentShard.season_day > this.currentShard.season_length_days) {
      await this.endSeason();
    }
  }

  async processQueue() {
    if (!this.currentShard) return;
    
    const res = query(
        "SELECT * FROM action_queue WHERE status = 'pending' AND end_tick <= ?",
        [this.currentShard.tick]
    );

    for (const action of res.rows) {
        try {
            if (action.type === "march") {
                await completeMarch(action.payload);
            } else if (action.type === "recruit") {
                await completeRecruit(action.payload);
            }
            
            query("UPDATE action_queue SET status = 'completed' WHERE id = ?", [action.id]);
        } catch (e) {
            console.error(`Failed to process action ${action.id}:`, e);
            query("UPDATE action_queue SET status = 'failed' WHERE id = ?", [action.id]);
        }
    }
  }

  async enqueue(type, playerId, payload, delayTicks) {
    if (!this.currentShard) await this.init();
    const startTick = this.currentShard.tick;
    const endTick = startTick + delayTicks;
    
    query(
        "INSERT INTO action_queue (type, player_id, payload, start_tick, end_tick, status) VALUES (?, ?, ?, ?, ?, 'pending')",
        [type, playerId, JSON.stringify(payload), startTick, endTick]
    );
  }

  async endSeason() {
    console.log("Season ended! Locking shard for scoring...");
    this.currentShard.status = "endgame";
    query("UPDATE shards SET status = 'endgame'");
    this.stop();
  }

  onTick(shard) {
    // Callback for server.js to broadcast
  }
}

export const shardEngine = new ShardEngine();
