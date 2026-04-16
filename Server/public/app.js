import { MapRenderer } from './renderer.js';

/**
 * IMPERIUM Browser Client 
 * Core Application Logic
 */

// ─────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────

const State = {
    token: localStorage.getItem('imp_token'),
    playerId: localStorage.getItem('imp_playerId'),
    profile: null,
    resources: { wood: 0, ore: 0, grain: 0, stone: 0, gems: 0 },
    map: {
        tiles: [],
        viewX: 150, // Starting at center (of 300)
        viewY: 100, // Starting at center (of 200)
        zoom: 40,
        selectedTile: null
    },
    renderer: null
};

const API_BASE = '/api';

// ─────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function updateResourceUI() {
    const res = State.resources;
    document.getElementById('res-wood').textContent = Math.floor(res.wood);
    document.getElementById('res-ore').textContent = Math.floor(res.ore);
    document.getElementById('res-grain').textContent = Math.floor(res.grain);
    document.getElementById('res-stone').textContent = Math.floor(res.stone);
    document.getElementById('res-gems').textContent = Math.floor(res.gems);
}

// ─────────────────────────────────────────────
// AUTHENTICATION FLOW
// ─────────────────────────────────────────────

async function api(path, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (State.token) headers['x-player-token'] = State.token;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
}

async function login(user, pass) {
    try {
        const data = await api('/auth/login', 'POST', { username: user, password: pass });
        State.token = data.token;
        State.playerId = data.playerId;
        localStorage.setItem('imp_token', data.token);
        localStorage.setItem('imp_playerId', data.playerId);
        initGame();
    } catch (err) {
        alert(err.message);
    }
}

async function register(user, pass, faction) {
    try {
        const data = await api('/auth/register', 'POST', { username: user, password: pass, factionKey: faction });
        State.token = data.token;
        State.playerId = data.player.id;
        localStorage.setItem('imp_token', data.token);
        localStorage.setItem('imp_playerId', data.player.id);
        initGame();
    } catch (err) {
        alert(err.message);
    }
}

function logout() {
    State.token = null;
    localStorage.removeItem('imp_token');
    showScreen('auth-screen');
}

// ─────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────

async function initGame() {
    try {
        const data = await api('/profile');
        State.profile = data;
        
        // Sync start coords to base if available
        if (data.base) {
            State.map.viewX = data.base.x;
            State.map.viewY = data.base.y;
        }

        document.getElementById('display-name').textContent = data.display_name;
        document.getElementById('faction-badge').textContent = data.base?.faction_id?.toUpperCase() || 'NONE';
        
        showScreen('game-screen');
        startMainLoop();
    } catch (err) {
        console.error("Game init failed:", err);
        logout();
    }
}

function startMainLoop() {
    // Start resource tick syncing
    setInterval(async () => {
        try {
            const res = await api('/resources');
            State.resources = res;
            updateResourceUI();
        } catch (e) {}
    }, 5000);

    // Initial map fetch
    fetchMap();
}

async function fetchMap() {
    try {
        const data = await api('/map');
        State.map.tiles = data.tiles;
        renderMap();
    } catch (e) {}
}

// ─────────────────────────────────────────────
// EVENT LISTENERS (BOILERPLATE)
// ─────────────────────────────────────────────

document.getElementById('btn-login').onclick = () => {
    login(document.getElementById('login-user').value, document.getElementById('login-pass').value);
};

document.getElementById('btn-register').onclick = () => {
    register(
        document.getElementById('reg-user').value, 
        document.getElementById('reg-pass').value,
        document.getElementById('reg-faction').value
    );
};

document.getElementById('to-register').onclick = () => {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
};

document.getElementById('to-login').onclick = () => {
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
};

document.getElementById('btn-logout').onclick = logout;

// ─────────────────────────────────────────────
// MAP RENDERING
// ─────────────────────────────────────────────

function renderMap() {
    if (!State.renderer) {
        const canvas = document.getElementById('map-canvas');
        State.renderer = new MapRenderer(canvas, State);
    }
    State.renderer.render();
}

// Auto-login check
if (State.token) initGame();
else showScreen('auth-screen');
