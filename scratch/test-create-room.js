const LobbyManager = require("../server/game/lobbyManager");

const mockIo = {
    to: () => ({ emit: () => {} }),
    sockets: { sockets: new Map() }
};

const mockSocket = {
    id: "socket_123",
    join: () => {},
    emit: (evt, data) => {
        console.log("EMITTED EVENT:", evt, data);
    }
};

const lm = new LobbyManager(mockIo);
try {
    lm.createLobby(mockSocket, { name: "TestHost", skin_ID: 0, hat_ID: 0 });
    console.log("CREATE LOBBY SUCCESS!");
} catch (e) {
    console.error("CREATE LOBBY ERROR:", e);
}
