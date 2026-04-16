-- Shard metadata for cycle management
CREATE TABLE shards (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'active', -- preseason, active, endgame, reset
    tick INTEGER DEFAULT 0,
    season_day INTEGER DEFAULT 1,
    season_length_days INTEGER DEFAULT 40,
    tick_interval_sec INTEGER DEFAULT 5,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player world-state
CREATE TABLE players (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50),
    faction_key VARCHAR(50),
    wood INTEGER DEFAULT 500,
    ore INTEGER DEFAULT 500,
    grain INTEGER DEFAULT 500,
    spawn_x INTEGER,
    spawn_y INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commanders (Leaders)
CREATE TABLE commanders (
    id VARCHAR(20) PRIMARY KEY,
    player_id VARCHAR(20) REFERENCES players(id),
    name VARCHAR(100), -- e.g. "Legatus Caesar, Scion of Sol"
    template_id VARCHAR(50), 
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    leadership INTEGER DEFAULT 100, -- Multiplier for formation sizes
    skill_points INTEGER DEFAULT 0
);

-- Armies on the map
CREATE TABLE armies (
    id VARCHAR(20) PRIMARY KEY,
    commander_id VARCHAR(20) REFERENCES commanders(id),
    player_id VARCHAR(20) REFERENCES players(id),
    x INTEGER,
    y INTEGER,
    status VARCHAR(20) DEFAULT 'idle', -- idle, marching, combat
    health INTEGER DEFAULT 100
);

-- Formations within an army
CREATE TABLE formations (
    id SERIAL PRIMARY KEY,
    army_id VARCHAR(20) REFERENCES armies(id),
    unit_id VARCHAR(100), -- links to unit-data.json
    count INTEGER
);

-- Tile ownership and development
CREATE TABLE tiles (
    x INTEGER,
    y INTEGER,
    terrain VARCHAR(5),
    owner_id VARCHAR(20) REFERENCES players(id),
    capital_name VARCHAR(100),
    PRIMARY KEY (x, y)
);

-- Action Queue for asynchronous processing
CREATE TABLE action_queue (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20), -- march, recruit, build
    player_id VARCHAR(20) REFERENCES players(id),
    payload JSONB,
    start_tick INTEGER,
    end_tick INTEGER,
    status VARCHAR(20) DEFAULT 'pending' -- pending, completed, cancelled
);
