require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const LobbyManager = require("./game/lobbyManager");

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

// Instantiate Lobby Manager
const lobbyManager = new LobbyManager(io);

io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on("create_lobby", (data) => {
        lobbyManager.createLobby(socket, data);
    });

    socket.on("join_lobby", (data) => {
        lobbyManager.joinLobby(socket, data);
    });

    socket.on("leave_lobby", () => {
        lobbyManager.leaveLobby(socket);
    });

    socket.on("kick_player", (data) => {
        lobbyManager.kickPlayer(socket, data);
    });

    socket.on("update_customization", (data) => {
        lobbyManager.updateCustomization(socket, data);
    });

    socket.on("toggle_ready", () => {
        lobbyManager.toggleReady(socket);
    });

    socket.on("update_lobby_settings", (data) => {
        lobbyManager.updateLobbySettings(socket, data);
    });

    socket.on("start_match", () => {
        lobbyManager.startMatch(socket);
    });

    socket.on("player_input", (data) => {
        lobbyManager.handlePlayerInput(socket, data);
    });

    socket.on("return_to_lobby", () => {
        lobbyManager.returnToLobby(socket);
    });

    socket.on("disconnect", () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
        lobbyManager.handleDisconnect(socket);
    });
});

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
