const assert = require("assert");
const fs = require("fs");
const path = require("path");
const LobbyManager = require("../server/game/lobbyManager");

console.log("--- Testing Lobby Features & Dynamic Assets ---");

// Test 1: Check assets.json existence and schema
console.log("Test 1: Assets Config Schema Validation");
const assetsPath = path.join(__dirname, "../client/config/assets.json");
assert.ok(fs.existsSync(assetsPath), "assets.json exists");

const assetsConfig = JSON.parse(fs.readFileSync(assetsPath, "utf-8"));
assert.ok(Array.isArray(assetsConfig.hats), "hats is an array");
assert.ok(Array.isArray(assetsConfig.map_themes), "map_themes is an array");

assert.ok(assetsConfig.hats.length > 0, "hats has entries");
assert.ok(assetsConfig.hats[1].id && assetsConfig.hats[1].src, "hat entry has id and src");

assert.ok(assetsConfig.map_themes.length > 0, "map_themes has entries");
assert.ok(assetsConfig.map_themes[0].theme_id && assetsConfig.map_themes[0].bg_src, "theme entry has theme_id and bg_src");

// Test 2: Host Migration Logic Simulation
console.log("Test 2: Host Migration Simulation");
const dummyIo = {
    to: () => ({ emit: () => {} })
};
const lobbyMgr = new LobbyManager(dummyIo);

// Create dummy sockets
const socketHost = { id: "host_socket_1", join: () => {}, leave: () => {}, emit: () => {} };
const socketPlayer2 = { id: "player_socket_2", join: () => {}, leave: () => {}, emit: () => {} };

lobbyMgr.createLobby(socketHost, { name: "HostAlice" });
const lobbyId = lobbyMgr.playerLobbyMap.get("host_socket_1");
const lobby = lobbyMgr.lobbies.get(lobbyId);

assert.strictEqual(lobby.host_ID, "host_socket_1", "Initial host set");

// Player 2 joins
lobbyMgr.joinLobby(socketPlayer2, { Lobby_id: lobbyId, name: "PlayerBob" });
assert.strictEqual(lobby.players.size, 2, "2 players in lobby");

// Host leaves lobby -> Host role should migrate to Player 2
lobbyMgr.leaveLobby(socketHost);
assert.strictEqual(lobby.host_ID, "player_socket_2", "Host migrated to Player 2!");
assert.strictEqual(lobby.players.size, 1, "Host removed, 1 player remaining");

console.log("--- ALL LOBBY FEATURES & ASSET TESTS PASSED! ---");
