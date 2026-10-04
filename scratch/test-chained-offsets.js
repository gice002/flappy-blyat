const assert = require("assert");
const GameEngine = require("../server/game/gameLoop");
const Lobby = require("../server/models/Lobby");
const Player = require("../server/models/Player");
const { generateMapsAndCheckpoints } = require("../server/game/mapGenerator");

console.log("--- Testing Chained Mode Spawn Spacing & Fixed X-Axis Lock ---");

const dummyIo = { to: () => ({ emit: () => {} }) };
const lobby = new Lobby("CHAIN1", "p0");
lobby.mode_id = "flappy_chained";

const p0 = new Player("p0", "Bird 0");
const p1 = new Player("p1", "Bird 1");
const p2 = new Player("p2", "Bird 2");
const p3 = new Player("p3", "Bird 3");

lobby.addPlayer(p0);
lobby.addPlayer(p1);
lobby.addPlayer(p2);
lobby.addPlayer(p3);

const mapData = generateMapsAndCheckpoints(1, "CHAIN1");
lobby.maps = mapData.maps;
lobby.checkpoints = mapData.checkpoints;
lobby.startCheckpointId = mapData.startCheckpointId;
lobby.finishLineX = mapData.finishLineX;

const engine = new GameEngine(lobby, dummyIo);

// Initialize engine physics start
engine.start();

const players = Array.from(lobby.players.values());

// Test 1: Spacing at Start Spawn
console.log("Test 1: Horizontal Spawn Spacing");
assert.strictEqual(players[0].chain_index, 0);
assert.strictEqual(players[1].chain_index, 1);
assert.strictEqual(players[2].chain_index, 2);
assert.strictEqual(players[3].chain_index, 3);

assert.strictEqual(players[0].x - players[1].x, 60, "Bird 0 is 60px ahead of Bird 1");
assert.strictEqual(players[1].x - players[2].x, 60, "Bird 1 is 60px ahead of Bird 2");
assert.strictEqual(players[2].x - players[3].x, 60, "Bird 2 is 60px ahead of Bird 3");

// Test 2: Fixed Distance Maintenance after ticks
console.log("Test 2: Distance Lock after 100 Server Ticks");
for (let i = 0; i < 100; i++) {
    engine.tick();
}

assert.strictEqual(players[0].x - players[1].x, 60, "Spacing remains locked at 60px");
assert.strictEqual(players[1].x - players[2].x, 60, "Spacing remains locked at 60px");
assert.strictEqual(players[2].x - players[3].x, 60, "Spacing remains locked at 60px");

// Test 3: Spacing on Checkpoint Respawn
console.log("Test 3: Checkpoint Respawn Offset");
engine.respawnPlayerAtCheckpoint(p0, "chk_CHAIN1_1");
engine.respawnPlayerAtCheckpoint(p1, "chk_CHAIN1_1");
engine.respawnPlayerAtCheckpoint(p2, "chk_CHAIN1_1");
engine.respawnPlayerAtCheckpoint(p3, "chk_CHAIN1_1");

assert.strictEqual(p0.x - p1.x, 60, "Respawn spacing locked at 60px");
assert.strictEqual(p1.x - p2.x, 60, "Respawn spacing locked at 60px");
assert.strictEqual(p2.x - p3.x, 60, "Respawn spacing locked at 60px");

engine.stop();
console.log("--- ALL CHAINED MODE SPACING TESTS PASSED SUCCESSFULLY! ---");
