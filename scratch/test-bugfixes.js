const assert = require("assert");
const PhysicsEngine = require("../client/js/physics");

// Test physics state wipe and ghost pruning
console.log("--- Testing Bug Fixes (Ghost Players & Chat Persistence) ---");

// Mock Physics Engine instance
const physics = new PhysicsEngine();
physics.setLocalPlayerId("local_player_1");

// Simulate remote players
physics.remotePlayers.set("ghost_player_99", { player_id: "ghost_player_99", x: 100, y: 320 });
physics.remotePlayers.set("active_player_2", { player_id: "active_player_2", x: 150, y: 320 });

assert.strictEqual(physics.remotePlayers.size, 2, "2 players in remote map");

// Test 1: Snapshot Reconciliation Prunes Stale Ghost Players
console.log("Test 1: Ghost Player Pruning during Snapshot Reconciliation");
physics.reconcileServerSnapshot({
    players: [
        { player_id: "local_player_1", x: 100, y: 320, velocityY: 0 },
        { player_id: "active_player_2", x: 150, y: 320, velocityY: 0 }
    ]
});

assert.strictEqual(physics.remotePlayers.has("ghost_player_99"), false, "Stale ghost player pruned!");
assert.strictEqual(physics.remotePlayers.size, 1, "Only active remote player remains");

// Test 2: Explicit State Wipe
console.log("Test 2: Explicit Remote State Wipe");
physics.clearRemotePlayers();
assert.strictEqual(physics.remotePlayers.size, 0, "Remote state map wiped completely!");

console.log("--- ALL TARGETED BUG FIX VERIFICATIONS PASSED! ---");
