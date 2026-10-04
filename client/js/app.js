// Global state references
window.playerName = "";
window.playerSkinId = 0;
window.playerHatId = 0;

document.addEventListener("DOMContentLoaded", () => {
    // Socket.IO client initialization
    const socket = io();

    // DOM Elements
    const screens = {
        mainMenu: document.getElementById("screen-main-menu"),
        lobbyRoom: document.getElementById("screen-lobby"),
        gameView: document.getElementById("screen-game"),
        resultsView: document.getElementById("screen-results")
    };

    const modals = {
        joinLobby: document.getElementById("modal-join"),
        settings: document.getElementById("modal-settings")
    };

    // Main Menu Inputs & Buttons
    const nameInput = document.getElementById("input-player-name");
    const btnCreateLobby = document.getElementById("btn-create-lobby");
    const btnOpenJoinModal = document.getElementById("btn-open-join");
    const btnConfirmJoin = document.getElementById("btn-confirm-join");
    const btnCancelJoin = document.getElementById("btn-cancel-join");
    const joinCodeInput = document.getElementById("input-join-code");

    // Customization Elements
    const skinNameLabel = document.getElementById("skin-name-label");
    const hatNameLabel = document.getElementById("hat-name-label");
    const btnPrevSkin = document.getElementById("btn-prev-skin");
    const btnNextSkin = document.getElementById("btn-next-skin");
    const btnPrevHat = document.getElementById("btn-prev-hat");
    const btnNextHat = document.getElementById("btn-next-hat");
    const previewBirdEl = document.getElementById("preview-bird");

    // Lobby Elements
    const lobbyIdDisplay = document.getElementById("lobby-id-display");
    const btnCopyLobbyId = document.getElementById("btn-copy-lobby-id");
    const playerListEl = document.getElementById("player-list");
    const hostControlsEl = document.getElementById("host-controls-panel");
    const selectMode = document.getElementById("select-game-mode");
    const selectMaps = document.getElementById("select-map-amount");
    const btnToggleReady = document.getElementById("btn-toggle-ready");
    const btnStartMatch = document.getElementById("btn-start-match");
    const btnOpenSettings = document.getElementById("btn-open-settings");
    const btnCloseSettings = document.getElementById("btn-close-settings");

    // Settings Inputs
    const sliderBgm = document.getElementById("slider-bgm");
    const sliderSfx = document.getElementById("slider-sfx");
    const checkFpsLock = document.getElementById("check-fps-lock");

    // HUD Elements
    const hudMapProgress = document.getElementById("hud-map-progress");
    const hudPipeCount = document.getElementById("hud-pipe-count");
    const finishTimerBanner = document.getElementById("finish-timer-banner");
    const finishTimerSecondsEl = document.getElementById("finish-timer-seconds");
    const startCountdownEl = document.getElementById("start-countdown");

    // Results Elements
    const leaderboardBody = document.getElementById("leaderboard-body");
    const btnReturnToLobby = document.getElementById("btn-return-lobby");

    // Canvas Setup
    const canvas = document.getElementById("gameCanvas");
    const physics = new PhysicsEngine();
    const renderer = new CanvasRenderer(canvas, physics);

    let currentLobby = null;
    let localPlayerId = null;
    let gameLoopRunning = false;
    let animationFrameId = null;

    const skins = ["Classic Yellow", "Crimson Red", "Emerald Green", "Ocean Blue", "Royal Gold"];
    const hats = ["None", "Golden Crown", "Top Hat", "Red Cap", "Viking Helmet"];

    // Update customization preview
    function updateCustomizationUI() {
        skinNameLabel.textContent = skins[window.playerSkinId];
        hatNameLabel.textContent = hats[window.playerHatId];

        const skinColors = ["#f7d51d", "#d9534f", "#55b02e", "#3993d0", "#9b59b6"];
        previewBirdEl.style.backgroundColor = skinColors[window.playerSkinId];

        if (currentLobby) {
            socket.emit("update_customization", {
                skin_ID: window.playerSkinId,
                hat_ID: window.playerHatId,
                name: window.playerName
            });
        }
    }

    // Navigation Helper
    function showScreen(screenKey) {
        for (let key in screens) {
            screens[key].classList.remove("active");
        }
        screens[screenKey].classList.add("active");
    }

    // Customization Event Listeners
    btnPrevSkin.addEventListener("click", () => {
        window.playerSkinId = (window.playerSkinId - 1 + skins.length) % skins.length;
        updateCustomizationUI();
    });

    btnNextSkin.addEventListener("click", () => {
        window.playerSkinId = (window.playerSkinId + 1) % skins.length;
        updateCustomizationUI();
    });

    btnPrevHat.addEventListener("click", () => {
        window.playerHatId = (window.playerHatId - 1 + hats.length) % hats.length;
        updateCustomizationUI();
    });

    btnNextHat.addEventListener("click", () => {
        window.playerHatId = (window.playerHatId + 1) % hats.length;
        updateCustomizationUI();
    });

    nameInput.addEventListener("input", (e) => {
        window.playerName = e.target.value.trim() || "BirdPlayer";
    });

    // Create & Join Lobby Actions
    btnCreateLobby.addEventListener("click", () => {
        window.playerName = nameInput.value.trim() || "BirdPlayer";
        audioManager.playBGM();
        socket.emit("create_lobby", {
            name: window.playerName,
            skin_ID: window.playerSkinId,
            hat_ID: window.playerHatId
        });
    });

    btnOpenJoinModal.addEventListener("click", () => {
        modals.joinLobby.classList.add("active");
    });

    btnCancelJoin.addEventListener("click", () => {
        modals.joinLobby.classList.remove("active");
    });

    btnConfirmJoin.addEventListener("click", () => {
        const code = joinCodeInput.value.trim();
        if (!code) return alert("Please enter a Lobby Code!");
        window.playerName = nameInput.value.trim() || "BirdPlayer";
        audioManager.playBGM();
        socket.emit("join_lobby", {
            Lobby_id: code,
            name: window.playerName,
            skin_ID: window.playerSkinId,
            hat_ID: window.playerHatId
        });
        modals.joinLobby.classList.remove("active");
    });

    btnCopyLobbyId.addEventListener("click", () => {
        if (currentLobby) {
            navigator.clipboard.writeText(currentLobby.Lobby_id);
            btnCopyLobbyId.textContent = "COPIED!";
            setTimeout(() => { btnCopyLobbyId.textContent = "COPY"; }, 1500);
        }
    });

    // Settings Modal Listeners
    btnOpenSettings.addEventListener("click", () => {
        modals.settings.classList.add("active");
    });

    btnCloseSettings.addEventListener("click", () => {
        modals.settings.classList.remove("active");
    });

    sliderBgm.addEventListener("input", (e) => {
        audioManager.setBGMVolume(e.target.value / 100);
    });

    sliderSfx.addEventListener("input", (e) => {
        audioManager.setSFXVolume(e.target.value / 100);
    });

    checkFpsLock.addEventListener("change", (e) => {
        renderer.setFpsLock(e.target.checked);
    });

    // Host Settings Listeners
    selectMode.addEventListener("change", (e) => {
        socket.emit("update_lobby_settings", { mode_id: e.target.value });
    });

    selectMaps.addEventListener("change", (e) => {
        socket.emit("update_lobby_settings", { amount_of_map: e.target.value });
    });

    // Ready & Start Controls
    btnToggleReady.addEventListener("click", () => {
        socket.emit("toggle_ready");
    });

    btnStartMatch.addEventListener("click", () => {
        socket.emit("start_match");
    });

    btnReturnToLobby.addEventListener("click", () => {
        socket.emit("return_to_lobby");
    });

    // Socket Event Handlers
    socket.on("lobby_created", (data) => {
        currentLobby = data.lobby;
        localPlayerId = data.playerId;
        physics.setLocalPlayerId(localPlayerId);
        updateLobbyUI();
        showScreen("lobbyRoom");
    });

    socket.on("lobby_joined", (data) => {
        currentLobby = data.lobby;
        localPlayerId = data.playerId;
        physics.setLocalPlayerId(localPlayerId);
        updateLobbyUI();
        showScreen("lobbyRoom");
    });

    socket.on("lobby_updated", (data) => {
        currentLobby = data.lobby;
        updateLobbyUI();
    });

    socket.on("error_message", (data) => {
        alert(data.message);
    });

    function updateLobbyUI() {
        if (!currentLobby) return;

        lobbyIdDisplay.textContent = currentLobby.Lobby_id;
        const isHost = (localPlayerId === currentLobby.host_ID);

        // Render Players list
        playerListEl.innerHTML = "";
        let allReady = true;

        for (let player of currentLobby.players) {
            if (!player.ready_status) allReady = false;

            const item = document.createElement("li");
            item.className = "player-item";

            const hostBadge = (player.player_id === currentLobby.host_ID) ? `<span class="badge badge-host">HOST</span>` : "";
            const readyBadge = player.ready_status ? `<span class="badge badge-ready">READY</span>` : `<span class="badge badge-not-ready">NOT READY</span>`;

            item.innerHTML = `
                <div>
                    <strong>${player.name}</strong> ${hostBadge}
                </div>
                <div>
                    ${readyBadge}
                </div>
            `;
            playerListEl.appendChild(item);
        }

        // Host controls visibility
        if (isHost) {
            hostControlsEl.style.display = "block";
            btnStartMatch.style.display = "inline-block";
            btnToggleReady.style.display = "none";
            selectMode.value = currentLobby.mode_id;
            selectMaps.value = currentLobby.amount_of_map;

            const canStart = (currentLobby.players.length >= 2) && allReady;
            btnStartMatch.disabled = !canStart;
            btnStartMatch.style.opacity = canStart ? "1" : "0.5";
        } else {
            hostControlsEl.style.display = "none";
            btnStartMatch.style.display = "none";
            btnToggleReady.style.display = "inline-block";

            const myPlayer = currentLobby.players.find(p => p.player_id === localPlayerId);
            if (myPlayer) {
                btnToggleReady.textContent = myPlayer.ready_status ? "UNREADY" : "TOGGLE READY";
                btnToggleReady.style.background = myPlayer.ready_status ? "#d9534f" : "#55b02e";
            }
        }
    }

    // Match Start Handler
    socket.on("match_starting", (data) => {
        currentLobby = data.lobby;
        showScreen("gameView");

        // Pass Map & Checkpoint data to Renderer
        renderer.setGameData(data.maps, data.checkpoints, data.itemBoxes, data.finishLineX, currentLobby.mode_id);
        
        // Reset physics engine local state
        const startChk = data.checkpoints.find(c => c.checkpoint_id === data.lobby.startCheckpointId);
        const startX = startChk ? startChk.respawn_coordinate_x : 100;
        const startY = startChk ? startChk.respawn_coordinate_y : 320;
        physics.resetLocalState(startX, startY);

        // 3-2-1 Countdown Overlay
        let count = data.countdownSeconds || 3;
        startCountdownEl.style.display = "block";
        startCountdownEl.textContent = count;

        const timer = setInterval(() => {
            count--;
            if (count > 0) {
                startCountdownEl.textContent = count;
            } else if (count === 0) {
                startCountdownEl.textContent = "GO!";
            } else {
                clearInterval(timer);
                startCountdownEl.style.display = "none";
                startGameLoop();
            }
        }, 1000);
    });

    // In-Game Jump Listener
    function handleJumpInput() {
        if (!gameLoopRunning) return;
        const input = physics.handleLocalJump();
        audioManager.playSFX("wing");
        socket.emit("player_input", input);
    }

    window.addEventListener("keydown", (e) => {
        if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyX") {
            handleJumpInput();
        }
    });

    canvas.addEventListener("mousedown", () => {
        handleJumpInput();
    });

    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        handleJumpInput();
    }, { passive: false });

    // Server Snapshot Handler
    socket.on("game_snapshot", (snapshot) => {
        physics.reconcileServerSnapshot(snapshot);

        // Update HUD
        const localState = physics.predictedState;
        hudPipeCount.textContent = `Pipes Cleared: ${snapshot.players.find(p => p.player_id === localPlayerId)?.last_pipe_passed || 0} / ${renderer.finishLineX ? Math.floor(renderer.finishLineX / 250) : 10}`;

        // Update 10s Finish Timer Banner
        if (snapshot.finishCountdown !== null && snapshot.finishCountdown >= 0) {
            finishTimerBanner.style.display = "block";
            finishTimerSecondsEl.textContent = snapshot.finishCountdown;
        } else {
            finishTimerBanner.style.display = "none";
        }
    });

    socket.on("chained_wipeout", () => {
        audioManager.playSFX("hit");
        audioManager.playSFX("die");
    });

    socket.on("item_collected", () => {
        audioManager.playSFX("point");
    });

    socket.on("player_respawned", (data) => {
        if (data.playerId === localPlayerId) {
            audioManager.playSFX("hit");
            physics.predictedState.x = data.x;
            physics.predictedState.y = data.y;
            physics.predictedState.velocityY = 0;
        }
    });

    // 60 FPS Client Game Render & Prediction Loop
    function startGameLoop() {
        gameLoopRunning = true;
        let lastTime = performance.now();

        function step(now) {
            if (!gameLoopRunning) return;

            // Physics step (60 FPS tick)
            physics.updateLocalPhysics();
            physics.updateRemotePlayers();

            // Render step
            renderer.render(now);

            animationFrameId = requestAnimationFrame(step);
        }

        animationFrameId = requestAnimationFrame(step);
    }

    function stopGameLoop() {
        gameLoopRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    // Match Finished Handler
    socket.on("match_finished", (data) => {
        stopGameLoop();
        finishTimerBanner.style.display = "none";
        showScreen("resultsView");

        // Populate Leaderboard Table
        leaderboardBody.innerHTML = "";
        for (let entry of data.leaderboard) {
            const tr = document.createElement("tr");

            const rankDisplay = entry.ranking ? `#${entry.ranking}` : "-";
            const statusDisplay = entry.finish_time 
                ? `<span class="status-finished">${entry.finish_time}</span>`
                : `<span class="status-out">${entry.status_text}</span>`;

            tr.innerHTML = `
                <td>${rankDisplay}</td>
                <td><strong>${entry.name}</strong></td>
                <td>${statusDisplay}</td>
            `;
            leaderboardBody.appendChild(tr);
        }
    });

    socket.on("returned_to_lobby", (data) => {
        stopGameLoop();
        currentLobby = data.lobby;
        updateLobbyUI();
        showScreen("lobbyRoom");
    });

    // Initial customization setup
    updateCustomizationUI();
});
