const http = require("http");
const express = require("express");
const { WebSocketServer, WebSocket } = require("ws");
const LobbyManager = require("../server/game/lobbyManager");
const initSocketHandler = require("../server/sockets/socketHandler");

console.log("=== Testing Native WebSocket (ws) End-to-End Networking ===");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Map();
const lobbyManager = new LobbyManager(clients);

initSocketHandler(wss, clients, lobbyManager);

server.listen(0, async () => {
    const port = server.address().port;
    console.log(`Test WebSocket Server started on port ${port}`);

    const wsUrl = `ws://localhost:${port}`;
    const ws1 = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl);

    let lobbyId = null;
    let ws1PlayerId = null;
    let ws2PlayerId = null;

    const messagesWs1 = [];
    const messagesWs2 = [];

    ws1.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        messagesWs1.push(msg);
        console.log("[WS1 Received]:", msg.type);

        if (msg.type === "lobby_created") {
            lobbyId = msg.data.lobby.Lobby_id;
            ws1PlayerId = msg.data.playerId;
            console.log("-> Lobby created with ID:", lobbyId);

            // Client 2 joins the created lobby
            ws2.send(JSON.stringify({
                type: "join_lobby",
                data: { Lobby_id: lobbyId, name: "Player2", skin_ID: 1, hat_ID: 1 }
            }));
        }
    });

    ws2.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        messagesWs2.push(msg);
        console.log("[WS2 Received]:", msg.type);

        if (msg.type === "lobby_joined") {
            ws2PlayerId = msg.data.playerId;
            console.log("-> WS2 joined lobby successfully!");

            // Test Chat Message
            ws2.send(JSON.stringify({
                type: "send_chat_message",
                data: { message: "Hello from Player2!" }
            }));

            // Test Toggle Ready
            ws2.send(JSON.stringify({
                type: "toggle_ready",
                data: {}
            }));
        }
    });

    ws1.on("open", () => {
        console.log("-> WS1 connected, sending create_lobby...");
        ws1.send(JSON.stringify({
            type: "create_lobby",
            data: { name: "HostPlayer", skin_ID: 0, hat_ID: 0 }
        }));
    });

    // Timeout check to verify E2E flow completion
    setTimeout(() => {
        try {
            console.log("\n--- Verification Results ---");
            console.log("WS1 message count:", messagesWs1.length);
            console.log("WS2 message count:", messagesWs2.length);

            const chatReceivedByWs1 = messagesWs1.some(m => m.type === "receive_chat_message" && m.data.message === "Hello from Player2!");
            const lobbyUpdatedReceivedByWs1 = messagesWs1.some(m => m.type === "lobby_updated");

            if (chatReceivedByWs1 && lobbyUpdatedReceivedByWs1) {
                console.log("=== NATIVE WEBSOCKET E2E TEST PASSED CLEANLY! ===");
            } else {
                console.error("FAILED: Missing expected messages!", { chatReceivedByWs1, lobbyUpdatedReceivedByWs1 });
            }
        } finally {
            ws1.close();
            ws2.close();
            server.close();
            process.exit(0);
        }
    }, 1500);
});
