// Global state references
window.playerName = "";
window.playerSkinId = 0;
window.playerHatId = 0;

document.addEventListener("DOMContentLoaded", () => {
    // Parse URL query parameter for custom backend (e.g. ?server=wss://xxxx.trycloudflare.com)
    const urlParams = new URLSearchParams(window.location.search);
    const queryServer = urlParams.get("server") || urlParams.get("backend") || urlParams.get("ws");
    if (queryServer) {
        let formattedServer = queryServer.trim();
        if (!formattedServer.startsWith("ws://") && !formattedServer.startsWith("wss://")) {
            const proto = (window.location.protocol === "https:" || formattedServer.startsWith("https://")) ? "wss://" : "ws://";
            formattedServer = proto + formattedServer.replace(/^https?:\/\//, "");
        }
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("GAME_SERVER_URL", formattedServer);
        }
        window.SERVER_URL = formattedServer;
    }

    // Native WebSocket client initialization
    const defaultProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const customBackend = window.SERVER_URL || (typeof localStorage !== "undefined" && localStorage.getItem("GAME_SERVER_URL"));
    const wsUrl = customBackend ? customBackend : `${defaultProtocol}//${window.location.host}`;
    
    console.log(`[WebSocket] Connecting to backend: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    window.ws = ws;

    // Helper: Send JSON message to server with standardized protocol { type, data }
    function sendWs(type, data = {}) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, data }));
        } else {
            console.warn(`[WebSocket] Cannot send ${type}: connection state is ${ws.readyState}`);
        }
    }

    // DOM Screens
    const screens = {
        mainMenu: document.getElementById("screen-main-menu"),
        lobbyRoom: document.getElementById("screen-lobby"),
        loadingScreen: document.getElementById("screen-loading"),
        gameView: document.getElementById("screen-game"),
        resultsView: document.getElementById("screen-results")
    };

    // DOM Modals
    const modals = {
        joinLobby: document.getElementById("modal-join"),
        settings: document.getElementById("modal-settings"),
        confirmExit: document.getElementById("modal-confirm-exit")
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
    const btnLeaveLobby = document.getElementById("btn-leave-lobby");
    const playerListEl = document.getElementById("player-list");
    const hostControlsEl = document.getElementById("host-controls-panel");
    const selectMode = document.getElementById("select-game-mode");
    const selectMaps = document.getElementById("select-map-amount");
    const btnToggleReady = document.getElementById("btn-toggle-ready");
    const btnStartMatch = document.getElementById("btn-start-match");
    const btnOpenSettings = document.getElementById("btn-open-settings");
    const btnCloseSettings = document.getElementById("btn-close-settings");

    // In-Game Exit & HUD Elements
    const btnInGameExit = document.getElementById("btn-in-game-exit");
    const btnCancelExit = document.getElementById("btn-cancel-exit");
    const btnConfirmExit = document.getElementById("btn-confirm-exit");
    const hudPipeCount = document.getElementById("hud-pipe-count");
    const finishTimerBanner = document.getElementById("finish-timer-banner");
    const finishTimerSecondsEl = document.getElementById("finish-timer-seconds");
    const startCountdownEl = document.getElementById("start-countdown");

    // Inventory UI Elements
    const hudInventory = document.getElementById("hud-inventory");
    const inventorySlot = document.getElementById("inventory-slot");
    const inventoryEmptyLabel = document.getElementById("inventory-empty-label");
    const inventoryItemIcon = document.getElementById("inventory-item-icon");

    // Results Screen Elements
    const resultsMainHeader = document.getElementById("results-main-header");
    const resultsSubHeader = document.getElementById("results-sub-header");
    const leaderboardHead = document.getElementById("leaderboard-head");
    const leaderboardBody = document.getElementById("leaderboard-body");
    const btnPlayAgain = document.getElementById("btn-play-again");
    const btnReturnToLobby = document.getElementById("btn-return-lobby");
    const btnResultsExitMenu = document.getElementById("btn-results-exit-menu");
    const waitingHostText = document.getElementById("waiting-host-text");

    // Settings Inputs
    const sliderBgm = document.getElementById("slider-bgm");
    const sliderSfx = document.getElementById("slider-sfx");

    // Chat Elements
    const lobbyChatMessages = document.getElementById("lobby-chat-messages");
    const lobbyChatInput = document.getElementById("lobby-chat-input");
    const btnLobbySendChat = document.getElementById("btn-lobby-send-chat");

    const resultsChatMessages = document.getElementById("results-chat-messages");
    const resultsChatInput = document.getElementById("results-chat-input");
    const btnResultsSendChat = document.getElementById("btn-results-send-chat");

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

    // Explicit State & Chat Cleanup Helpers
    function clearChatUI() {
        if (lobbyChatMessages) lobbyChatMessages.innerHTML = "";
        if (resultsChatMessages) resultsChatMessages.innerHTML = "";
    }

    function clearLocalPlayerState() {
        physics.clearRemotePlayers();
        clearChatUI();
    }

    // CRITICAL INPUT ISOLATION (Prevent Flap on Typing)
    const allInputElements = document.querySelectorAll("input, textarea, select");
    allInputElements.forEach(inputEl => {
        ["keydown", "keyup", "keypress"].forEach(eventType => {
            inputEl.addEventListener(eventType, (e) => {
                e.stopPropagation(); // Stop event bubbling
            });
        });
    });

    const skinFilters = [
        "none",
        "hue-rotate(140deg) saturate(1.8)", // Crimson Red
        "hue-rotate(80deg) saturate(1.5)",  // Emerald Green
        "hue-rotate(200deg) saturate(1.5)", // Ocean Blue
        "hue-rotate(280deg) saturate(1.5)"  // Royal Gold
    ];

    const hatSources = [
        "", // None
        "assets/images/hats/hat_crown.png",
        "assets/images/hats/hat_top.png",
        "assets/images/hats/hat_cap.png",
        "assets/images/hats/hat_viking.png"
    ];

    // Update customization preview
    function updateCustomizationUI() {
        skinNameLabel.textContent = skins[window.playerSkinId];
        hatNameLabel.textContent = hats[window.playerHatId];

        const birdImg = document.getElementById("preview-bird-img");
        const hatImg = document.getElementById("preview-hat-img");

        if (birdImg) {
            birdImg.style.filter = skinFilters[window.playerSkinId] || "none";
        }

        if (hatImg) {
            const hatSrc = hatSources[window.playerHatId];
            if (hatSrc) {
                hatImg.src = hatSrc;
                hatImg.style.display = "block";
            } else {
                hatImg.style.display = "none";
            }
        }

        if (currentLobby) {
            sendWs("update_customization", {
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
        clearLocalPlayerState();
        window.playerName = nameInput.value.trim() || "BirdPlayer";
        audioManager.playBGM();
        sendWs("create_lobby", {
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
        clearLocalPlayerState();
        window.playerName = nameInput.value.trim() || "BirdPlayer";
        audioManager.playBGM();
        sendWs("join_lobby", {
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

    // Leave Room Listener
    btnLeaveLobby.addEventListener("click", () => {
        if (currentLobby) {
            sendWs("leave_lobby");
            currentLobby = null;
            clearLocalPlayerState();
            showScreen("mainMenu");
        }
    });

    // In-Game Exit & Confirmation Modal Listeners
    btnInGameExit.addEventListener("click", () => {
        modals.confirmExit.classList.add("active");
    });

    btnCancelExit.addEventListener("click", () => {
        modals.confirmExit.classList.remove("active");
    });

    btnConfirmExit.addEventListener("click", () => {
        modals.confirmExit.classList.remove("active");
        stopGameLoop();
        if (currentLobby) {
            sendWs("leave_lobby");
            currentLobby = null;
        }
        clearLocalPlayerState();
        showScreen("mainMenu");
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

    // Host Settings Listeners
    selectMode.addEventListener("change", (e) => {
        sendWs("update_lobby_settings", { mode_id: e.target.value });
    });

    selectMaps.addEventListener("change", (e) => {
        sendWs("update_lobby_settings", { amount_of_map: e.target.value });
    });

    // Ready & Start Controls
    btnToggleReady.addEventListener("click", () => {
        sendWs("toggle_ready");
    });

    btnStartMatch.addEventListener("click", () => {
        sendWs("start_match");
    });

    // Post-Match Controls
    btnPlayAgain.addEventListener("click", () => {
        sendWs("play_again");
    });

    btnReturnToLobby.addEventListener("click", () => {
        sendWs("return_to_lobby");
    });

    if (btnResultsExitMenu) {
        btnResultsExitMenu.addEventListener("click", () => {
            stopGameLoop();
            if (currentLobby) {
                sendWs("leave_lobby");
                currentLobby = null;
            }
            clearLocalPlayerState();
            showScreen("mainMenu");
        });
    }

    // Real-Time HUD Activity Feed Helper
    const hudActivityFeed = document.getElementById("hud-activity-feed");
    function addActivityFeedLog(htmlText) {
        if (!hudActivityFeed) return;
        const line = document.createElement("div");
        line.className = "feed-line";
        line.innerHTML = htmlText;
        hudActivityFeed.appendChild(line);

        while (hudActivityFeed.children.length > 3) {
            hudActivityFeed.removeChild(hudActivityFeed.firstChild);
        }

        setTimeout(() => {
            if (line.parentNode) line.parentNode.removeChild(line);
        }, 4000);
    }

    // Real-Time Chat System Listeners
    function sendChatFromInput(inputEl) {
        const text = inputEl.value.trim();
        if (text) {
            sendWs("send_chat_message", { message: text });
            inputEl.value = "";
        }
    }

    btnLobbySendChat.addEventListener("click", () => sendChatFromInput(lobbyChatInput));
    lobbyChatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendChatFromInput(lobbyChatInput);
    });

    btnResultsSendChat.addEventListener("click", () => sendChatFromInput(resultsChatInput));
    resultsChatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendChatFromInput(resultsChatInput);
    });

    function escapeHtml(str) {
        return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function updateLobbyUI() {
        if (!currentLobby) return;

        lobbyIdDisplay.textContent = currentLobby.Lobby_id;
        const isHost = (localPlayerId === currentLobby.host_ID);

        playerListEl.innerHTML = "";
        let allReady = true;

        for (let player of currentLobby.players) {
            if (!player.ready_status) allReady = false;

            const item = document.createElement("li");
            item.className = "player-item";

            const hostBadge = (player.player_id === currentLobby.host_ID) ? `<span class="badge badge-host">HOST</span>` : "";
            const readyBadge = player.ready_status ? `<span class="badge badge-ready">READY</span>` : `<span class="badge badge-not-ready">NOT READY</span>`;

            let kickButtonHtml = "";
            if (isHost && player.player_id !== localPlayerId) {
                kickButtonHtml = `<button class="btn btn-kick btn-danger" data-kick-id="${player.player_id}">KICK</button>`;
            }

            item.innerHTML = `
                <div>
                    <strong>${player.name}</strong> ${hostBadge}
                </div>
                <div style="display: flex; align-items: center;">
                    ${readyBadge}
                    ${kickButtonHtml}
                </div>
            `;
            playerListEl.appendChild(item);
        }

        const kickButtons = playerListEl.querySelectorAll(".btn-kick");
        kickButtons.forEach(btn => {
            btn.addEventListener("click", (e) => {
                const targetId = e.target.getAttribute("data-kick-id");
                if (targetId) {
                    sendWs("kick_player", { targetPlayerId: targetId });
                }
            });
        });

        if (isHost) {
            hostControlsEl.style.display = "block";
            btnStartMatch.style.display = "inline-block";
            selectMode.value = currentLobby.mode_id;
            selectMaps.value = currentLobby.amount_of_map;

            const canStart = (currentLobby.players.length >= 2) && allReady;
            btnStartMatch.disabled = !canStart;
            btnStartMatch.style.opacity = canStart ? "1" : "0.5";
        } else {
            hostControlsEl.style.display = "none";
            btnStartMatch.style.display = "none";
        }

        const myPlayer = currentLobby.players.find(p => p.player_id === localPlayerId);
        if (myPlayer) {
            btnToggleReady.style.display = "block";
            if (myPlayer.ready_status) {
                btnToggleReady.textContent = "UNREADY";
                btnToggleReady.style.background = "#d9534f"; // Red style
                btnToggleReady.style.boxShadow = "0 5px 0 #962d2a";
            } else {
                btnToggleReady.textContent = "READY";
                btnToggleReady.style.background = "#55b02e"; // Green style
                btnToggleReady.style.boxShadow = "0 5px 0 #2b6313";
            }
        }
    }

    function updateResultsHostState() {
        if (!currentLobby) return;
        const isHost = (localPlayerId === currentLobby.host_ID);

        if (isHost) {
            btnPlayAgain.style.display = "inline-block";
            btnReturnToLobby.style.display = "inline-block";
            waitingHostText.style.display = "none";
        } else {
            btnPlayAgain.style.display = "none";
            btnReturnToLobby.style.display = "none";
            waitingHostText.style.display = "block";
        }
        if (btnResultsExitMenu) {
            btnResultsExitMenu.style.display = "inline-block";
        }
    }

    const loadingStatusText = document.getElementById("loading-status-text");

    function updateInventoryUI(itemType) {
        if (!hudInventory) return;
        if (currentLobby && currentLobby.mode_id === "flappy_chained") {
            hudInventory.style.display = "none";
            return;
        }
        hudInventory.style.display = "flex";

        if (itemType) {
            inventoryEmptyLabel.style.display = "none";
            inventoryItemIcon.style.display = "block";
            const itemMap = {
                ink: "assets/images/items/bucket.png",
                shield: "assets/images/items/Absorption_JE3_BE3.png",
                curse: "assets/images/items/Slowness_JE4.png",
                speed: "assets/images/items/SpeedBoost.png",
                swap: "assets/images/items/swap.png",
                deathnote: "assets/images/items/DeathNote.webp",
                ice: "assets/images/items/ice.png"
            };
            inventoryItemIcon.src = itemMap[itemType] || `assets/images/items/item_${itemType}.svg`;
        } else {
            inventoryItemIcon.style.display = "none";
            inventoryEmptyLabel.style.display = "inline";
            inventoryEmptyLabel.innerText = "EMPTY";
        }
    }

    // In-Game Jump & Item Input Listener
    function handleJumpInput() {
        if (!gameLoopRunning) return;
        if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
            return;
        }
        const input = physics.handleLocalJump();
        audioManager.playSFX("wing");
        sendWs("player_input", input);
    }

    window.addEventListener("keydown", (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName : "";
        if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

        if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyX") {
            handleJumpInput();
        }

        if (e.code === "KeyF" || e.key === "f" || e.key === "F") {
            e.preventDefault();
            if (gameLoopRunning && physics.localHeldItem) {
                sendWs("use_item");
            }
        }
    });

    canvas.addEventListener("mousedown", () => {
        handleJumpInput();
    });

    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        handleJumpInput();
    }, { passive: false });

    // 60 FPS Client Game Render & Prediction Loop
    function startGameLoop() {
        gameLoopRunning = true;

        function step(now) {
            if (!gameLoopRunning) return;

            physics.updateLocalPhysics();
            physics.updateRemotePlayers();
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

    // CENTRALIZED NATIVE WEBSOCKET MESSAGE DISPATCHER (ws.onmessage)
    ws.onmessage = (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (err) {
            console.error("[WebSocket] Failed to parse message:", err);
            return;
        }

        const { type, data = {} } = msg;

        switch (type) {
            case "receive_chat_message": {
                const safeName = escapeHtml(data.senderName);
                const safeMsg = escapeHtml(data.message);
                const htmlLine = `<div class="chat-msg-line"><span class="chat-author">${safeName}:</span> ${safeMsg}</div>`;

                if (lobbyChatMessages) lobbyChatMessages.insertAdjacentHTML("beforeend", htmlLine);
                if (resultsChatMessages) resultsChatMessages.insertAdjacentHTML("beforeend", htmlLine);

                if (lobbyChatMessages) lobbyChatMessages.scrollTop = lobbyChatMessages.scrollHeight;
                if (resultsChatMessages) resultsChatMessages.scrollTop = resultsChatMessages.scrollHeight;
                break;
            }

            case "lobby_created":
            case "lobby_joined": {
                clearLocalPlayerState();
                currentLobby = data.lobby;
                localPlayerId = data.playerId;
                physics.setLocalPlayerId(localPlayerId);
                updateLobbyUI();
                showScreen("lobbyRoom");
                break;
            }

            case "lobby_updated": {
                currentLobby = data.lobby;
                updateLobbyUI();
                updateResultsHostState();
                break;
            }

            case "left_lobby": {
                currentLobby = null;
                clearLocalPlayerState();
                showScreen("mainMenu");
                break;
            }

            case "player_kicked": {
                currentLobby = null;
                clearLocalPlayerState();
                alert(data.message || "You have been kicked from the lobby.");
                showScreen("mainMenu");
                break;
            }

            case "error_message": {
                alert(data.message);
                break;
            }

            case "match_loading": {
                stopGameLoop();
                currentLobby = data.lobby;
                showScreen("loadingScreen");
                renderer.setGameData(data.maps, data.checkpoints, data.itemBoxes, data.finishLineX, currentLobby.mode_id);

                if (loadingStatusText) {
                    loadingStatusText.textContent = `Waiting for players... (${data.readyCount}/${data.totalPlayers} Ready)`;
                }

                sendWs("client_ready");
                break;
            }

            case "loading_progress": {
                if (loadingStatusText) {
                    loadingStatusText.textContent = `Waiting for players... (${data.readyCount}/${data.totalPlayers} Ready)`;
                }
                break;
            }

            case "kicked": {
                stopGameLoop();
                currentLobby = null;
                clearLocalPlayerState();
                showScreen("mainMenu");
                alert(data.message || "You have been kicked from the room.");
                break;
            }

            case "match_starting": {
                currentLobby = data.lobby;
                showScreen("gameView");

                renderer.setGameData(data.maps, data.checkpoints, data.itemBoxes, data.finishLineX, currentLobby.mode_id);

                const startChk = data.checkpoints.find(c => c.checkpoint_id === data.lobby.startCheckpointId);
                const startX = startChk ? startChk.respawn_coordinate_x : 100;
                const startY = startChk ? startChk.respawn_coordinate_y : 320;

                let myChainIdx = 0;
                if (currentLobby && currentLobby.players) {
                    const myPlayer = currentLobby.players.find(p => p.player_id === localPlayerId);
                    if (myPlayer && myPlayer.chain_index !== undefined) {
                        myChainIdx = myPlayer.chain_index;
                    }
                }
                const chainedOffset = (currentLobby.mode_id === "flappy_chained") ? (myChainIdx * 60) : 0;

                physics.resetLocalState(startX - chainedOffset, startY);
                physics.isFrozen = true;
                startGameLoop();

                let count = data.countdownSeconds || 3;
                startCountdownEl.style.display = "block";
                startCountdownEl.textContent = count;

                const timer = setInterval(() => {
                    count--;
                    if (count > 0) {
                        startCountdownEl.textContent = count;
                    } else if (count === 0) {
                        startCountdownEl.textContent = "GO!";
                        physics.isFrozen = false;
                        physics.predictedState.velocityY = 0;
                    } else {
                        clearInterval(timer);
                        startCountdownEl.style.display = "none";
                        physics.isFrozen = false;
                        physics.predictedState.velocityY = 0;
                    }
                }, 1000);
                break;
            }

            case "game_snapshot": {
                physics.reconcileServerSnapshot(data);
                updateInventoryUI(physics.localHeldItem);

                if (data.finishCountdown !== null && data.finishCountdown >= 0) {
                    finishTimerBanner.style.display = "block";
                    finishTimerSecondsEl.textContent = data.finishCountdown;
                } else {
                    finishTimerBanner.style.display = "none";
                }
                break;
            }

            case "chained_wipeout": {
                audioManager.playSFX("hit");
                audioManager.playSFX("die");
                break;
            }

            case "item_collected": {
                audioManager.playSFX("point");
                if (data.playerId === localPlayerId && data.acquiredItem) {
                    physics.localHeldItem = data.acquiredItem;
                    updateInventoryUI(data.acquiredItem);
                }
                if (renderer && renderer.itemBoxes) {
                    const targetBox = renderer.itemBoxes.find(b => b.id === data.itemId);
                    if (targetBox) {
                        targetBox.collected = true;
                        targetBox.isActive = false;
                    }
                }
                break;
            }

            case "item_respawned": {
                if (renderer && renderer.itemBoxes && data && data.itemId) {
                    const targetBox = renderer.itemBoxes.find(b => b.id === data.itemId);
                    if (targetBox) {
                        targetBox.collected = false;
                        targetBox.isActive = true;
                    }
                }
                break;
            }

            case "shield_expired": {
                if (data && data.playerId === localPlayerId) {
                    physics.localHasShield = false;
                }
                if (physics.remotePlayers.has(data.playerId)) {
                    physics.remotePlayers.get(data.playerId).hasShield = false;
                }
                break;
            }

            case "invincibility_expired": {
                if (data && data.playerId === localPlayerId) {
                    physics.localIsInvincible = false;
                }
                if (physics.remotePlayers.has(data.playerId)) {
                    physics.remotePlayers.get(data.playerId).isInvincible = false;
                }
                break;
            }

            case "item_used": {
                try {
                    if (!data) break;

                    if (data.userId === localPlayerId) {
                        physics.localHeldItem = null;
                        updateInventoryUI(null);
                    }

                    if (data.wasted) {
                        addActivityFeedLog(`<span style="color: #f7d51d;">${escapeHtml(data.userName)}</span> used ${(data.itemType || "ITEM").toUpperCase()} <span style="color: #888;">(WASTED)</span>`);
                    } else if (data.shieldBlocked) {
                        addActivityFeedLog(`<span style="color: #55b02e;">${escapeHtml(data.targetName)}</span>'s SHIELD blocked <span style="color: #f7d51d;">${escapeHtml(data.userName)}</span>'s ${(data.itemType || "ITEM").toUpperCase()}`);
                    } else {
                        const userStr = `<span style="color: #f7d51d;">${escapeHtml(data.userName)}</span>`;
                        const targetStr = `<span style="color: #ffffff;">${escapeHtml(data.targetName || "Target")}</span>`;

                        if (data.itemType === "speed") {
                            addActivityFeedLog(`${userStr} activated <span style="color: #55b02e;">SPEED BOOST</span>`);
                        } else if (data.itemType === "shield") {
                            addActivityFeedLog(`${userStr} activated <span style="color: #3993d0;">SHIELD</span>`);
                        } else if (data.itemType === "swap") {
                            addActivityFeedLog(`${userStr} <span style="color: #f7d51d;">SWAPPED</span> position with ${targetStr}`);
                        } else if (data.itemType === "ink") {
                            addActivityFeedLog(`${userStr} used <span style="color: #e07629;">BUCKET</span> on ${targetStr}`);
                            if (data.targetId === localPlayerId) {
                                window.localInkUntil = Date.now() + (data.duration || 5000);
                                audioManager.playSFX("swooshing");
                            }
                        } else if (data.itemType === "curse") {
                            addActivityFeedLog(`${userStr} CURSED ${targetStr} <span style="color: #d9534f;">[SLOW]</span>`);
                            if (data.targetId === localPlayerId) audioManager.playSFX("hit");
                        } else if (data.itemType === "deathnote") {
                            addActivityFeedLog(`${userStr} used <span style="color: #d9534f;">DEATH NOTE</span> on ${targetStr}`);
                        } else if (data.itemType === "ice") {
                            addActivityFeedLog(`${userStr} <span style="color: #70c5ce;">FROZE</span> ${targetStr} in ICE`);
                        }
                    }

                    if (data.shieldBlocked && data.targetId === localPlayerId) {
                        audioManager.playSFX("point");
                        physics.localHasShield = false;
                        if (data.invincible) {
                            physics.localIsInvincible = true;
                        }
                    }
                } catch (err) {
                    console.warn("[Client] Safely handled item_used listener error:", err);
                }
                break;
            }

            case "deathnote_announcement": {
                if (!data) break;
                audioManager.playSFX("hit");
                window.deathnoteEffectUntil = Date.now() + 2000;
                window.deathnoteBannerText = `${data.attackerName} used DEATH NOTE on ${data.targetName}!`;
                break;
            }

            case "player_respawned": {
                if (data.playerId === localPlayerId) {
                    audioManager.playSFX("hit");
                    physics.predictedState.x = data.x;
                    physics.predictedState.y = data.y;
                    physics.predictedState.velocityY = 0;
                }
                break;
            }

            case "match_finished": {
                stopGameLoop();
                finishTimerBanner.style.display = "none";
                showScreen("resultsView");

                updateResultsHostState();

                const isChainedMode = (data.mode_id === "flappy_chained");

                if (isChainedMode) {
                    resultsMainHeader.textContent = "FLAPPY CHAINED RESULTS";
                    resultsSubHeader.style.display = "block";
                    resultsSubHeader.textContent = `TEAM TOTAL TIME: ${data.team_total_time || "00:00.00"}`;

                    leaderboardHead.innerHTML = `
                        <tr>
                            <th>PLAYER</th>
                            <th>WIPES CAUSED</th>
                            <th>STATUS</th>
                        </tr>
                    `;

                    leaderboardBody.innerHTML = "";
                    for (let entry of data.leaderboard) {
                        const tr = document.createElement("tr");
                        tr.innerHTML = `
                            <td><strong>${escapeHtml(entry.name)}</strong></td>
                            <td><span style="color: #d9534f; font-weight: bold;">Wipes Caused: ${entry.wipes_caused || 0}</span></td>
                            <td><span class="status-finished">COMPLETED</span></td>
                        `;
                        leaderboardBody.appendChild(tr);
                    }
                } else {
                    resultsMainHeader.textContent = "MATCH RESULTS";
                    resultsSubHeader.style.display = "none";

                    leaderboardHead.innerHTML = `
                        <tr>
                            <th>RANK</th>
                            <th>PLAYER</th>
                            <th>TIME / STATUS</th>
                        </tr>
                    `;

                    leaderboardBody.innerHTML = "";
                    for (let entry of data.leaderboard) {
                        const tr = document.createElement("tr");

                        const rankDisplay = entry.ranking ? `#${entry.ranking}` : "-";
                        const statusDisplay = entry.finish_time 
                            ? `<span class="status-finished">${entry.finish_time}</span>`
                            : `<span class="status-out">${entry.status_text}</span>`;

                        tr.innerHTML = `
                            <td>${rankDisplay}</td>
                            <td><strong>${escapeHtml(entry.name)}</strong></td>
                            <td>${statusDisplay}</td>
                        `;
                        leaderboardBody.appendChild(tr);
                    }
                }
                break;
            }

            case "returned_to_lobby": {
                stopGameLoop();
                currentLobby = data.lobby;
                updateLobbyUI();
                showScreen("lobbyRoom");
                break;
            }

            default:
                console.warn(`[WebSocket] Central router received unknown message type: ${type}`);
        }
    };

    updateCustomizationUI();
});
