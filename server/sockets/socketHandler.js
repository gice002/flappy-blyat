function initSocketHandler(io, lobbyManager) {
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

        socket.on("play_again", () => {
            lobbyManager.playAgain(socket);
        });

        socket.on("send_chat_message", (data) => {
            lobbyManager.sendChatMessage(socket, data);
        });

        socket.on("player_input", (data) => {
            lobbyManager.handlePlayerInput(socket, data);
        });

        socket.on("return_to_lobby", () => {
            lobbyManager.returnToLobby(socket);
        });

        socket.on("use_item", () => {
            lobbyManager.useItem(socket);
        });

        socket.on("client_ready", () => {
            lobbyManager.clientReady(socket);
        });

        socket.on("disconnect", () => {
            console.log(`[Socket] Client disconnected: ${socket.id}`);
            lobbyManager.handleDisconnect(socket);
        });
    });
}

module.exports = initSocketHandler;
