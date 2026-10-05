require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const LobbyManager = require("./game/lobbyManager");
const initSocketHandler = require("./sockets/socketHandler");

const app = express();

// Trust reverse proxy for PaaS cloud deployments
app.set("trust proxy", 1);

const server = http.createServer(app);

// Native WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// Map to store connected clients: player_id -> WebSocket instance
const clients = new Map();

const PORT = parseInt(process.env.PORT, 10) || 3000;

// Serve client static files
app.use(express.static(path.join(__dirname, "../client")));

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Instantiate Lobby Manager & WebSocket Handlers
const lobbyManager = new LobbyManager(clients);
initSocketHandler(wss, clients, lobbyManager);

function startServer(portToUse) {
    server.removeAllListeners("error");
    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.warn(`[Warning] Port ${portToUse} is in use. Trying port ${portToUse + 1}...`);
            startServer(portToUse + 1);
        } else {
            console.error("[Error] Server error:", err);
        }
    });

    server.listen(portToUse, () => {
        console.log(`====================================================`);
        console.log(` Flappy Bird Multiplayer Server running on port ${portToUse}`);
        console.log(` Environment: ${process.env.NODE_ENV || "development"}`);
        console.log(` WebSocket: Native (ws) enabled`);
        console.log(` Open http://localhost:${portToUse} in your browser.`);
        console.log(`====================================================`);
    });
}

startServer(PORT);
