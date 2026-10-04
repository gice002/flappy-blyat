require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const LobbyManager = require("./game/lobbyManager");
const initSocketHandler = require("./sockets/socketHandler");

const app = express();

// Trust reverse proxy for PaaS cloud deployments
app.set("trust proxy", 1);

const server = http.createServer(app);

// Socket.IO configuration
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ["websocket", "polling"],
    pingTimeout: 10000,
    pingInterval: 5000
});

const PORT = parseInt(process.env.PORT, 10) || 3000;

// Serve client static files
app.use(express.static(path.join(__dirname, "../client")));

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Instantiate Lobby Manager & Socket Event Handlers
const lobbyManager = new LobbyManager(io);
initSocketHandler(io, lobbyManager);

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
        console.log(` Open http://localhost:${portToUse} in your browser.`);
        console.log(`====================================================`);
    });
}

startServer(PORT);
