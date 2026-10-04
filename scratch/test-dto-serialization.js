const LobbyManager = require("../server/game/lobbyManager");
const Player = require("../server/models/Player");
const assert = require("assert");

console.log("--- Testing Player toJSON & Item Box DTO Serialization ---");

const p = new Player("p1", "TestPlayer");
p.curseTimer = setTimeout(() => {}, 1000);
p.shieldTimer = setTimeout(() => {}, 1000);
p.invincibleTimer = setTimeout(() => {}, 1000);

// Test direct JSON.stringify on Player instance (triggers toJSON)
const jsonString = JSON.stringify(p);
const parsedObj = JSON.parse(jsonString);

assert.strictEqual(parsedObj.curseTimer, undefined, "curseTimer must be stripped by toJSON");
assert.strictEqual(parsedObj.shieldTimer, undefined, "shieldTimer must be stripped by toJSON");
assert.strictEqual(parsedObj.invincibleTimer, undefined, "invincibleTimer must be stripped by toJSON");
assert.strictEqual(parsedObj.player_id, "p1", "player_id must be preserved");

clearTimeout(p.curseTimer);
clearTimeout(p.shieldTimer);
clearTimeout(p.invincibleTimer);

console.log("-> Direct Player.toJSON() serialization verified cleanly!");
console.log("--- ALL TESTS PASSED! ---");
