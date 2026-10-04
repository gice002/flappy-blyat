const Player = require("../server/models/Player");
const GameEngine = require("../server/game/gameLoop");
const LobbyManager = require("../server/game/lobbyManager");
const assert = require("assert");

console.log("--- Testing Item Enhancements & Invincibility Mechanics ---");

// Mock IO
const emittedEvents = [];
const mockIo = {
    to: (room) => ({
        emit: (event, payload) => {
            emittedEvents.push({ room, event, payload });
        }
    })
};

const lm = new LobbyManager(mockIo);

// 1. Test Player Model state
const p = new Player("p1", "Tester");
assert.strictEqual(p.isInvincible, false, "Player should default isInvincible to false");
assert.strictEqual(p.shieldTimer, null, "Player should default shieldTimer to null");
assert.strictEqual(p.invincibleTimer, null, "Player should default invincibleTimer to null");
console.log("-> Test 1: Player Model default fields verified!");

// 2. Test Invincibility Pipe Bypass in GameEngine
const dummyLobby = {
    Lobby_id: "TEST1",
    status: "playing",
    mode_id: "flappy_race",
    players: new Map([["p1", p]]),
    maps: [{
        pipes: [{ x: 100, topY: -100, bottomY: 200, width: 52, height: 320, pipeIndex: 1 }]
    }],
    itemBoxes: [],
    startCheckpointId: "chk1",
    checkpoints: new Map([["chk1", { respawn_coordinate_x: 100, respawn_coordinate_y: 320 }]])
};

const ge = new GameEngine(dummyLobby, mockIo);

p.x = 100;
p.y = 100; // Right inside pipe collision box
p.isInvincible = false;
assert.strictEqual(ge.checkCollisions(p), true, "Should collide with pipe when NOT invincible");

p.isInvincible = true;
assert.strictEqual(ge.checkCollisions(p), false, "Should BYPASS pipe collision when invincible!");

p.y = 616; // Ground Y level
assert.strictEqual(ge.checkCollisions(p), true, "Ground collision MUST REMAIN ACTIVE even when invincible!");
console.log("-> Test 2: Pipe bypass & ground collision enforcement verified!");

console.log("--- ALL ITEM ENHANCEMENT TESTS PASSED SUCCESSFULLY! ---");
