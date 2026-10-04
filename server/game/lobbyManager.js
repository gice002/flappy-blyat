const Lobby = require("../models/Lobby");
const Player = require("../models/Player");
const { generateMapsAndCheckpoints } = require("./mapGenerator");
const GameEngine = require("./gameLoop");

class LobbyManager {
    constructor(io) {
        this.io = io;
        this.lobbies = new Map(); // Lobby_id -> Lobby
        this.playerLobbyMap = new Map(); // socketId -> Lobby_id
        this.gameEngines = new Map(); // Lobby_id -> GameEngine
    }

    generateLobbyId() {
        let code = "";
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    createLobby(socket, data) {
        let lobbyId = this.generateLobbyId();
        while (this.lobbies.has(lobbyId)) {
            lobbyId = this.generateLobbyId();
        }

        const player = new Player(socket.id, data.name, data.skin_ID || 0, data.hat_ID || 0);
        player.ready_status = true; // Host is auto-ready

        const lobby = new Lobby(lobbyId, socket.id);
        lobby.addPlayer(player);

        this.lobbies.set(lobbyId, lobby);
        this.playerLobbyMap.set(socket.id, lobbyId);

        socket.join(lobbyId);

        socket.emit("lobby_created", {
            lobby: this.serializeLobby(lobby),
            playerId: socket.id
        });
    }

    joinLobby(socket, data) {
        const lobbyId = (data.Lobby_id || "").toUpperCase().trim();
        const lobby = this.lobbies.get(lobbyId);

        if (!lobby) {
            return socket.emit("error_message", { message: "Lobby not found. Please check code." });
        }

        if (lobby.status !== "waiting") {
            return socket.emit("error_message", { message: "Match already in progress or completed." });
        }

        if (lobby.players.size >= 4) { // Max 4 players
            return socket.emit("error_message", { message: "Lobby is full (Max 4 players)." });
        }

        const player = new Player(socket.id, data.name, data.skin_ID || 0, data.hat_ID || 0);
        lobby.addPlayer(player);

        this.playerLobbyMap.set(socket.id, lobbyId);
        socket.join(lobbyId);

        socket.emit("lobby_joined", {
            lobby: this.serializeLobby(lobby),
            playerId: socket.id
        });

        this.io.to(lobbyId).emit("lobby_updated", {
            lobby: this.serializeLobby(lobby)
        });
    }

    leaveLobby(socket) {
        const lobbyId = this.playerLobbyMap.get(socket.id);
        if (!lobbyId) return;

        const lobby = this.lobbies.get(lobbyId);
        if (!lobby) return;

        // Mid-Match & Lobby Host Migration: Silent re-assignment if Host leaves
        if (lobby.host_ID === socket.id && lobby.players.size > 1) {
            const remainingPlayers = Array.from(lobby.players.values()).filter(p => p.player_id !== socket.id);
            const newHost = remainingPlayers[0];
            lobby.host_ID = newHost.player_id;
            newHost.ready_status = true; // New host auto-ready
        }

        lobby.removePlayer(socket.id);
        this.playerLobbyMap.delete(socket.id);
        socket.leave(lobbyId);

        socket.emit("left_lobby");

        // Strict Anti-Ghost Room Garbage Collection
        if (lobby.players.size === 0) {
            this.destroyRoom(lobbyId);
        } else {
            this.io.to(lobbyId).emit("lobby_updated", {
                lobby: this.serializeLobby(lobby)
            });
        }
    }

    destroyRoom(lobbyId) {
        const engine = this.gameEngines.get(lobbyId);
        if (engine) {
            engine.stop();
            this.gameEngines.delete(lobbyId);
        }
        this.lobbies.delete(lobbyId);
        console.log(`[GC] Room destroyed & memory cleared for Lobby ID: ${lobbyId}`);
    }

    kickPlayer(socket, data) {
        const lobbyId = this.playerLobbyMap.get(socket.id);
        if (!lobbyId) return;

        const lobby = this.lobbies.get(lobbyId);
        if (!lobby || lobby.host_ID !== socket.id) {
            return socket.emit("error_message", { message: "Only the Host can kick players." });
        }

        const targetPlayerId = data.targetPlayerId;
        if (!targetPlayerId || targetPlayerId === socket.id) {
            return socket.emit("error_message", { message: "Cannot kick yourself." });
        }

        const targetPlayer = lobby.players.get(targetPlayerId);
        if (targetPlayer) {
            this.io.to(targetPlayerId).emit("player_kicked", {
                message: "You have been kicked from the lobby by the Host."
            });

            const targetSocket = this.io.sockets.sockets.get(targetPlayerId);
            if (targetSocket) {
                targetSocket.leave(lobbyId);
            }

            lobby.removePlayer(targetPlayerId);
            this.playerLobbyMap.delete(targetPlayerId);

            if (lobby.players.size === 0) {
                this.destroyRoom(lobbyId);
            } else {
                this.io.to(lobbyId).emit("lobby_updated", {
                    lobby: this.serializeLobby(lobby)
                });
            }
        }
    }

    updateCustomization(socket, data) {
        const lobbyId = this.playerLobbyMap.get(socket.id);
        if (!lobbyId) return;

        const lobby = this.lobbies.get(lobbyId);
        if (!lobby) return;

        const player = lobby.players.get(socket.id);
        if (player) {
            if (data.skin_ID !== undefined) player.skin_ID = data.skin_ID;
            if (data.hat_ID !== undefined) player.hat_ID = data.hat_ID;
            if (data.name !== undefined && data.name.trim()) player.name = data.name.trim();

            this.io.to(lobbyId).emit("lobby_updated", {
                lobby: this.serializeLobby(lobby)
            });
        }
    }

    toggleReady(socket) {
        const lobbyId = this.playerLobbyMap.get(socket.id);
        if (!lobbyId) return;

        const lobby = this.lobbies.get(lobbyId);
        if (!lobby) return;

        const player = lobby.players.get(socket.id);
        if (player) {
            player.ready_status = !player.ready_status;

            this.io.to(lobbyId).emit("lobby_updated", {
                lobby: this.serializeLobby(lobby)
            });
        }
    }

    updateLobbySettings(socket, data) {
        const lobbyId = this.playerLobbyMap.get(socket.id);
        if (!lobbyId) return;

        const lobby = this.lobbies.get(lobbyId);
        if (!lobby || lobby.host_ID !== socket.id) {
            return socket.emit("error_message", { message: "Only the Host can modify settings." });
        }

        if (data.mode_id) {
            lobby.mode_id = data.mode_id;
        }

        if (data.amount_of_map && [1, 3, 5].includes(Number(data.amount_of_map))) {
            lobby.amount_of_map = Number(data.amount_of_map);
        }

        this.io.to(lobbyId).emit("lobby_updated", {
            lobby: this.serializeLobby(lobby)
        });
    }

    startMatch(socket) {
        const lobbyId = this.playerLobbyMap.get(socket.id);
        if (!lobbyId) return;

        const lobby = this.lobbies.get(lobbyId);
        if (!lobby || lobby.host_ID !== socket.id) {
            return socket.emit("error_message", { message: "Only the Host can start the match." });
        }

        if (lobby.players.size < 2) {
            return socket.emit("error_message", { message: "Minimum 2 players required to start match." });
        }

        if (!lobby.allPlayersReady()) {
            return socket.emit("error_message", { message: "All players must be Ready before starting." });
        }

        // Generate Maps, Checkpoints, and Item Boxes
        const mapData = generateMapsAndCheckpoints(lobby.amount_of_map, lobbyId);
        lobby.maps = mapData.maps;
        lobby.checkpoints = mapData.checkpoints;
        lobby.itemBoxes = mapData.itemBoxes;
        lobby.startCheckpointId = mapData.startCheckpointId;
        lobby.finishLineX = mapData.finishLineX;
        lobby.totalPipes = mapData.totalPipes;

        // Initialize GameEngine
        const engine = new GameEngine(lobby, this.io);
        this.gameEngines.set(lobbyId, engine);

        // Notify clients match is starting
        this.io.to(lobbyId).emit("match_starting", {
            lobby: this.serializeLobby(lobby),
            maps: lobby.maps,
            checkpoints: Array.from(lobby.checkpoints.values()),
            itemBoxes: lobby.itemBoxes,
            finishLineX: lobby.finishLineX,
            totalPipes: lobby.totalPipes,
            countdownSeconds: 3
        });

        // Launch physics engine after 3s countdown
        setTimeout(() => {
            engine.start();
        }, 3000);
    }

    playAgain(socket) {
        const lobbyId = this.playerLobbyMap.get(socket.id);
        if (!lobbyId) return;

        const lobby = this.lobbies.get(lobbyId);
        if (!lobby || lobby.host_ID !== socket.id) {
            return socket.emit("error_message", { message: "Only the Host can restart the match." });
        }

        // Stop existing engine
        const oldEngine = this.gameEngines.get(lobbyId);
        if (oldEngine) oldEngine.stop();

        // Generate new maps & checkpoints
        const mapData = generateMapsAndCheckpoints(lobby.amount_of_map, lobbyId);
        lobby.maps = mapData.maps;
        lobby.checkpoints = mapData.checkpoints;
        lobby.itemBoxes = mapData.itemBoxes;
        lobby.startCheckpointId = mapData.startCheckpointId;
        lobby.finishLineX = mapData.finishLineX;
        lobby.totalPipes = mapData.totalPipes;

        const newEngine = new GameEngine(lobby, this.io);
        this.gameEngines.set(lobbyId, newEngine);

        this.io.to(lobbyId).emit("match_starting", {
            lobby: this.serializeLobby(lobby),
            maps: lobby.maps,
            checkpoints: Array.from(lobby.checkpoints.values()),
            itemBoxes: lobby.itemBoxes,
            finishLineX: lobby.finishLineX,
            totalPipes: lobby.totalPipes,
            countdownSeconds: 3
        });

        setTimeout(() => {
            newEngine.start();
        }, 3000);
    }

    sendChatMessage(socket, data) {
        const lobbyId = this.playerLobbyMap.get(socket.id);
        if (!lobbyId) return;

        const lobby = this.lobbies.get(lobbyId);
        if (!lobby) return;

        const player = lobby.players.get(socket.id);
        if (!player) return;

        const text = (data.message || "").trim();
        if (!text) return;

        this.io.to(lobbyId).emit("receive_chat_message", {
            senderId: socket.id,
            senderName: player.name,
            message: text,
            timestamp: Date.now()
        });
    }

    handlePlayerInput(socket, data) {
        const lobbyId = this.playerLobbyMap.get(socket.id);
        if (!lobbyId) return;

        const engine = this.gameEngines.get(lobbyId);
        if (engine) {
            engine.queueInput(socket.id, data);
        }
    }

    returnToLobby(socket) {
        const lobbyId = this.playerLobbyMap.get(socket.id);
        if (!lobbyId) return;

        const lobby = this.lobbies.get(lobbyId);
        if (!lobby) return;

        // Only host can initiate return to lobby from post-match
        if (lobby.host_ID !== socket.id) {
            return socket.emit("error_message", { message: "Only the Host can return to lobby." });
        }

        const engine = this.gameEngines.get(lobbyId);
        if (engine) {
            engine.stop();
            this.gameEngines.delete(lobbyId);
        }

        lobby.status = "waiting";
        for (let p of lobby.players.values()) {
            p.ready_status = (p.player_id === lobby.host_ID); // Host ready by default
        }

        this.io.to(lobbyId).emit("returned_to_lobby", {
            lobby: this.serializeLobby(lobby)
        });
    }

    handleDisconnect(socket) {
        this.leaveLobby(socket);
    }

    serializeLobby(lobby) {
        return {
            Lobby_id: lobby.Lobby_id,
            mode_id: lobby.mode_id,
            host_ID: lobby.host_ID,
            amount_of_map: lobby.amount_of_map,
            status: lobby.status,
            players: Array.from(lobby.players.values()),
            leaderboard: lobby.leaderboard
        };
    }
}

module.exports = LobbyManager;
