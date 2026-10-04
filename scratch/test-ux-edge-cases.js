const assert = require("assert");
const LobbyManager = require("../server/game/lobbyManager");

console.log("--- Testing UX & Edge Cases (GC, Mid-Match Host Disconnect, Chat) ---");

let emittedEvents = [];
const dummyIo = {
    to: (room) => ({
        emit: (event, payload) => {
            emittedEvents.push({ room, event, payload });
        }
    })
};

const lobbyMgr = new LobbyManager(dummyIo);

// 1. Garbage Collection test (room destroyed when 0 players)
console.log("Test 1: Anti-Ghost Room Garbage Collection on 0 players");
const socketHost = { id: "host_1", join: () => {}, leave: () => {}, emit: () => {} };
lobbyMgr.createLobby(socketHost, { name: "Host" });
const lobbyId = lobbyMgr.playerLobbyMap.get("host_1");
assert.ok(lobbyMgr.lobbies.has(lobbyId), "Lobby exists");

// Host leaves -> room should be GC destroyed immediately
lobbyMgr.leaveLobby(socketHost);
assert.strictEqual(lobbyMgr.lobbies.has(lobbyId), false, "Room instance destroyed from memory (0 players remaining)");

// 2. Mid-Match Host Disconnect & Migration test
console.log("Test 2: Mid-Match Host Disconnect & Migration");
const sHost = { id: "host_2", join: () => {}, leave: () => {}, emit: () => {} };
const sPlayer2 = { id: "player_2", join: () => {}, leave: () => {}, emit: () => {} };

lobbyMgr.createLobby(sHost, { name: "HostAlice" });
const lobbyId2 = lobbyMgr.playerLobbyMap.get("host_2");
lobbyMgr.joinLobby(sPlayer2, { Lobby_id: lobbyId2, name: "Bob" });

const lobby2 = lobbyMgr.lobbies.get(lobbyId2);
lobby2.status = "playing"; // Mid-match state!

// Host disconnects during match
lobbyMgr.handleDisconnect(sHost);
assert.strictEqual(lobby2.host_ID, "player_2", "Host migrated to player_2 mid-match!");
assert.strictEqual(lobby2.status, "playing", "Match status remains active!");

// 3. Real-time Chat Broadcasting test
console.log("Test 3: Real-Time Chat Broadcasting");
emittedEvents = [];
lobbyMgr.sendChatMessage(sPlayer2, { message: "Hello world!" });
const chatEvent = emittedEvents.find(e => e.event === "receive_chat_message");
assert.ok(chatEvent, "receive_chat_message emitted");
assert.strictEqual(chatEvent.payload.senderName, "Bob");
assert.strictEqual(chatEvent.payload.message, "Hello world!");

console.log("--- ALL UX & EDGE CASE TESTS PASSED SUCCESSFULLY! ---");
