const assert = require("assert");
const { performance } = require("perf_hooks");
const GameEngine = require("../server/game/gameLoop");
const LobbyManager = require("../server/game/lobbyManager");
const Lobby = require("../server/models/Lobby");
const Player = require("../server/models/Player");
const { generateMapsAndCheckpoints } = require("../server/game/mapGenerator");

console.log("=== Testing High-Precision Fixed Timestep & Optimized WebSocket Broadcasts ===");

// 1. Test Fixed Timestep Accumulator Logic
console.log("\n-> Test 1: Fixed Timestep Engine Tick Execution & Accumulator");
const lobby = new Lobby("TIMESTEP1", "p1");
const p1 = new Player("p1", "Tester 1");
const p2 = new Player("p2", "Tester 2");
lobby.addPlayer(p1);
lobby.addPlayer(p2);

const mapData = generateMapsAndCheckpoints(1, "TIMESTEP1");
lobby.maps = mapData.maps;
lobby.checkpoints = mapData.checkpoints;
lobby.startCheckpointId = mapData.startCheckpointId;
lobby.finishLineX = mapData.finishLineX;

let broadcastCount = 0;
const mockLobbyManager = {
    broadcastToRoom: (lobbyId, type, data) => {
        if (type === "game_snapshot") {
            broadcastCount++;
        }
    }
};

const engine = new GameEngine(lobby, mockLobbyManager);
engine.start();

assert.strictEqual(engine.isRunning, true, "Engine should be running after start()");

// Simulate physics step ticks
const initialX = p1.x;
engine.tick();
assert.strictEqual(engine.tickCount, 1, "Tick count should increment to 1");
assert.ok(p1.x > initialX, "Player position updated after discrete tick step");

engine.stop();
assert.strictEqual(engine.isRunning, false, "Engine should be stopped cleanly");

// 2. Test Accumulator loop step behavior over real time
console.log("\n-> Test 2: High-Precision Loop Running for 500ms");
let ticksReceived = 0;
const testLobbyManager = {
    broadcastToRoom: (lobbyId, type, data) => {
        if (type === "game_snapshot") {
            ticksReceived++;
        }
    }
};

const timedEngine = new GameEngine(lobby, testLobbyManager);
const startMs = performance.now();
timedEngine.start();

setTimeout(() => {
    timedEngine.stop();
    const duration = performance.now() - startMs;
    console.log(`Ran for ${duration.toFixed(2)}ms, executed ${ticksReceived} ticks`);
    
    // Expected ~30 ticks for 500ms at 60 TPS (approx 25-35 ticks depending on OS timer accuracy)
    assert.ok(ticksReceived >= 20 && ticksReceived <= 40, `Expected ~30 ticks in 500ms, got ${ticksReceived}`);
    console.log("-> High-Precision Timestep Loop verified successfully!");

    // 3. Test WebSocket Broadcast Efficiency & Single Serialization
    console.log("\n-> Test 3: WebSocket Broadcast Single Serialization to Native Clients");
    let sendCalls = [];
    const fakeWs1 = {
        readyState: 1, // OPEN
        send: (payload) => { sendCalls.push({ client: "ws1", payload }); }
    };
    const fakeWs2 = {
        readyState: 1, // OPEN
        send: (payload) => { sendCalls.push({ client: "ws2", payload }); }
    };

    const clientsMap = new Map([["p1", fakeWs1], ["p2", fakeWs2]]);
    const realLobbyManager = new LobbyManager(clientsMap);
    realLobbyManager.lobbies.set(lobby.Lobby_id, lobby);

    realLobbyManager.broadcastToRoom(lobby.Lobby_id, "test_event", { foo: "bar" });

    assert.strictEqual(sendCalls.length, 2, "Both clients received the broadcast");
    assert.strictEqual(sendCalls[0].payload, sendCalls[1].payload, "Identical pre-serialized payload sent to both clients");
    assert.strictEqual(sendCalls[0].payload, JSON.stringify({ type: "test_event", data: { foo: "bar" } }));

    console.log("-> Optimized WebSocket Broadcasts verified successfully!");
    console.log("\n=== ALL HIGH-PRECISION TIMESTEP & WEBSOCKET BROADCAST TESTS PASSED! ===");
}, 500);
