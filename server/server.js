const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const LobbyManager = require("./game/lobbyManager");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let PORT = process.env.PORT || 3000;

// Serve client static files
app.use(express.static(path.join(__dirname, "../client")));

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
        console.log(` Open http://localhost:${portToUse} in your browser.`);
        console.log(`====================================================`);
    });
}

startServer(PORT);
