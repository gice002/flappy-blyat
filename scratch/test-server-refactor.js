const constants = require("../server/config/constants");
const initSocketHandler = require("../server/sockets/socketHandler");
const assert = require("assert");

console.log("--- Testing Modular Server Refactoring (Phase 1) ---");

// Test 1: Verify constants module exports all required physics & item parameters
assert.strictEqual(typeof constants.TICK_RATE, "number", "TICK_RATE must be exported number");
assert.strictEqual(typeof constants.GROUND_Y, "number", "GROUND_Y must be exported number");
assert.strictEqual(typeof constants.CURSE_SPEED_MULTIPLIER, "number", "CURSE_SPEED_MULTIPLIER must be exported number");
assert.strictEqual(constants.DEFAULT_THEME, "classic_day", "DEFAULT_THEME must be classic_day");
console.log("-> Test 1: server/config/constants.js verified!");

// Test 2: Verify socketHandler registers listeners cleanly
let connectionCallback = null;
const mockIo = {
    on: (event, cb) => {
        if (event === "connection") connectionCallback = cb;
    }
};

initSocketHandler(mockIo, {});
assert.strictEqual(typeof connectionCallback, "function", "initSocketHandler must register connection listener");
console.log("-> Test 2: server/sockets/socketHandler.js verified!");

console.log("--- ALL PHASE 1 REFACTORING TESTS PASSED! ---");
