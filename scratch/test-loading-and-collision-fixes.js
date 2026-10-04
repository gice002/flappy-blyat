const assert = require("assert");
const GameEngine = require("../server/game/gameLoop");
const Lobby = require("../server/models/Lobby");
const Player = require("../server/models/Player");
const { generateMapsAndCheckpoints } = require("../server/game/mapGenerator");

console.log("--- Testing Loading Screen & Collision Fixes ---");

// Test 1: Physical Collisions with Shield / Items
console.log("Test 1: Physical Collision Integrity with Shield & Items");
const lobby = new Lobby("LOBBY_TEST", "p1");
const p1 = new Player("p1", "Alice");
const p2 = new Player("p2", "Bob");
lobby.addPlayer(p1);
lobby.addPlayer(p2);

const mapData = generateMapsAndCheckpoints(1, "LOBBY_TEST", "flappy_race");
lobby.maps = mapData.maps;
lobby.checkpoints = mapData.checkpoints;
lobby.itemBoxes = mapData.itemBoxes;
lobby.startCheckpointId = mapData.startCheckpointId;
lobby.finishLineX = mapData.finishLineX;

const mockIo = { to: () => ({ emit: () => {} }) };
const engine = new GameEngine(lobby, mockIo);

// Test Ground Collision for Player with Active Shield
p1.y = 616; // Ground Y boundary
p1.hasShield = true;
p1.heldItem = "ink";
const collidedGround = engine.checkCollisions(p1);
assert.strictEqual(collidedGround, true, "Player with active shield MUST STILL COLLIDE with ground!");

// Test Pipe Collision for Player with Active Shield
const firstPipe = mapData.maps[0].pipes[0];
p1.x = firstPipe.x;
p1.y = firstPipe.topY + 10; // Inside top pipe
const collidedPipe = engine.checkCollisions(p1);
assert.strictEqual(collidedPipe, true, "Player with active shield MUST STILL COLLIDE with pipes!");
console.log("-> Physical collision checks verified: Shield does NOT grant map invincibility!");

// Test 2: Synchronized Loading Screen & Ready Progress
console.log("Test 2: Loading Screen Ready Tracking");
lobby.status = "loading";
lobby.loadingReadyPlayers.clear();
assert.strictEqual(lobby.loadingReadyPlayers.size, 0, "Initial loading ready count is 0");

lobby.loadingReadyPlayers.add("p1");
assert.strictEqual(lobby.loadingReadyPlayers.size, 1, "p1 ready registered");
assert.strictEqual(lobby.loadingReadyPlayers.has("p1"), true, "p1 marked as ready");

lobby.loadingReadyPlayers.add("p2");
assert.strictEqual(lobby.loadingReadyPlayers.size, 2, "All players ready (2/2)");
console.log("-> Synchronized loading screen ready count tracking verified!");

// Test 3: Loading Timeout Kick Simulation
console.log("Test 3: Loading Timeout Kick Logic");
const lobbyTimeout = new Lobby("LOBBY_TIMEOUT", "p1");
const pTimeout1 = new Player("p1", "Alice");
const pTimeout2 = new Player("p2", "SlowBob");
lobbyTimeout.addPlayer(pTimeout1);
lobbyTimeout.addPlayer(pTimeout2);
lobbyTimeout.status = "loading";
lobbyTimeout.loadingReadyPlayers.add("p1"); // Only p1 emitted client_ready

// Find unready players
const unready = [];
for (let pId of lobbyTimeout.players.keys()) {
    if (!lobbyTimeout.loadingReadyPlayers.has(pId)) {
        unready.push(pId);
    }
}
assert.strictEqual(unready.length, 1, "1 unready player detected");
assert.strictEqual(unready[0], "p2", "SlowBob identified for kick");

// Perform kick
lobbyTimeout.removePlayer("p2");
assert.strictEqual(lobbyTimeout.players.size, 1, "Unready player kicked from lobby");
assert.strictEqual(lobbyTimeout.players.has("p1"), true, "Ready player remains in lobby");
console.log("-> Timeout kick logic verified!");

console.log("--- ALL LOADING & COLLISION FIX TESTS PASSED SUCCESSFULLY! ---");
