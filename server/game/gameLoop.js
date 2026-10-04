const LeaderboardEntry = require("../models/Leaderboard");
const {
    TICK_RATE,
    TICK_INTERVAL,
    BIRD_WIDTH,
    BIRD_HEIGHT,
    GROUND_Y,
    GRAVITY,
    JUMP_VELOCITY,
    FORWARD_VELOCITY,
    CHAIN_SPACING_X,
    ITEM_RESPAWN_MS
} = require("../config/constants");

class GameEngine {
    constructor(lobby, io) {
        this.lobby = lobby;
        this.io = io;
        this.loopInterval = null;
        this.inputQueues = new Map(); // socketId -> Array of { sequence, action, timestamp }
        this.tickCount = 0;
    }

    start() {
        this.lobby.status = "playing";
        this.lobby.matchStartTime = Date.now();
        this.lobby.finishTimerStart = null;
        this.tickCount = 0;

        // Reset all players to start checkpoint with strict horizontal offset in Chained Mode
        const startCheckpoint = this.lobby.checkpoints.get(this.lobby.startCheckpointId);
        const startX = startCheckpoint ? startCheckpoint.respawn_coordinate_x : 100;
        const startY = startCheckpoint ? startCheckpoint.respawn_coordinate_y : 320;

        let chainIdx = 0;
        for (let player of this.lobby.players.values()) {
            player.chain_index = chainIdx;
            const xOffset = (this.lobby.mode_id === "flappy_chained") ? (chainIdx * CHAIN_SPACING_X) : 0;
            player.resetForMatch(startX - xOffset, startY, this.lobby.startCheckpointId);
            this.inputQueues.set(player.player_id, []);
            chainIdx++;
        }

        this.loopInterval = setInterval(() => {
            this.tick();
        }, TICK_INTERVAL);
    }

    stop() {
        if (this.loopInterval) {
            clearInterval(this.loopInterval);
            this.loopInterval = null;
        }
    }

    queueInput(playerId, inputData) {
        const queue = this.inputQueues.get(playerId);
        if (queue && inputData) {
            queue.push(inputData);
        }
    }

    tick() {
        if (this.lobby.status !== "playing") return;
        this.tickCount++;

        const now = Date.now();
        let anyCollisionInChained = false;
        let highestCheckpointInChained = this.lobby.startCheckpointId;

        // Process physics for each player
        for (let player of this.lobby.players.values()) {
            if (player.is_finished) continue;

            // Process inputs queued for this player
            const inputs = this.inputQueues.get(player.player_id) || [];
            while (inputs.length > 0) {
                const input = inputs.shift();
                if (!input) continue; // CRITICAL FIX: Ignore null or undefined inputs

                if (input.action === "jump" && !player.isFrozenInIce) {
                    player.velocityY = JUMP_VELOCITY;
                }
                player.last_processed_input = input.sequence || player.last_processed_input;
            }

            // Apply strict uniform forward X velocity & individual Y gravity (modified by Curse/Ice debuffs)
            if (player.isFrozenInIce) {
                player.velocityY = 0;
            } else {
                player.x += FORWARD_VELOCITY * (player.speedMultiplier || 1.0);
                player.velocityY += GRAVITY;
                player.y = Math.max(0, player.y + player.velocityY);
            }

            // Check pipe progress and update checkpoint
            this.updatePlayerProgress(player);

            // Collision check
            const collided = this.checkCollisions(player);
            if (collided) {
                // Track culprit player who caused wipeout
                player.wipes_caused = (player.wipes_caused || 0) + 1;

                if (this.lobby.mode_id === "flappy_chained") {
                    anyCollisionInChained = true;
                    // Find highest checkpoint cleared by any player in chain
                    for (let p of this.lobby.players.values()) {
                        if (p.checkpoint_id) {
                            highestCheckpointInChained = p.checkpoint_id;
                        }
                    }
                } else {
                    // Flappy Race mode: individual respawn
                    this.respawnPlayer(player);
                }
            }

            // Item Box collection check
            this.checkItemBoxCollisions(player);

            // Finish Line check
            if (player.x >= this.lobby.finishLineX && !player.is_finished) {
                player.is_finished = true;
                const elapsedSec = ((now - this.lobby.matchStartTime) / 1000).toFixed(2);
                player.finish_time = elapsedSec + "s";

                // Start 10-second finish countdown if first player to finish
                if (this.lobby.finishTimerStart === null) {
                    this.lobby.finishTimerStart = now;
                    this.io.to(this.lobby.Lobby_id).emit("finish_timer_started", {
                        countdownSeconds: 10
                    });
                }
            }
        }

        // Handle shared death in Flappy Chained mode
        if (anyCollisionInChained && this.lobby.mode_id === "flappy_chained") {
            for (let player of this.lobby.players.values()) {
                if (!player.is_finished) {
                    this.respawnPlayerAtCheckpoint(player, highestCheckpointInChained);
                }
            }
            this.io.to(this.lobby.Lobby_id).emit("chained_wipeout", {
                checkpointId: highestCheckpointInChained
            });
        }

        // Check Finish Timer countdown (10s window)
        if (this.lobby.finishTimerStart !== null) {
            const elapsed = (now - this.lobby.finishTimerStart) / 1000;
            const remaining = Math.max(0, Math.ceil(10 - elapsed));

            // Check if all players finished
            let allFinished = true;
            for (let p of this.lobby.players.values()) {
                if (!p.is_finished) allFinished = false;
            }

            if (remaining <= 0 || allFinished) {
                this.endMatch();
                return;
            }
        }

        // Broadcast game snapshot to all clients in room
        this.broadcastSnapshot();
    }

    updatePlayerProgress(player) {
        let allPipes = [];
        for (let mapData of this.lobby.maps) {
            allPipes.push(...mapData.pipes);
        }

        for (let pipe of allPipes) {
            if (player.x > pipe.x + pipe.width) {
                if (pipe.pipeIndex > player.last_pipe_passed) {
                    player.last_pipe_passed = pipe.pipeIndex;
                }
            }
        }

        for (let [chkId, chk] of this.lobby.checkpoints.entries()) {
            if (player.x >= chk.respawn_coordinate_x - 50 && chkId !== this.lobby.startCheckpointId) {
                player.checkpoint_id = chkId;
            }
        }
    }

    checkCollisions(player) {
        if (player.y + BIRD_HEIGHT >= GROUND_Y) {
            return true;
        }

        // Invincibility state bypasses pipe collisions completely
        if (player.isInvincible) {
            return false;
        }

        let allPipes = [];
        for (let mapData of this.lobby.maps) {
            allPipes.push(...mapData.pipes);
        }

        const birdBox = { x: player.x, y: player.y, width: BIRD_WIDTH, height: BIRD_HEIGHT };

        for (let pipe of allPipes) {
            if (pipe.x > player.x + 100 || pipe.x + pipe.width < player.x - 50) continue;

            const topPipeBox = { x: pipe.x, y: pipe.topY, width: pipe.width, height: pipe.height };
            const bottomPipeBox = { x: pipe.x, y: pipe.bottomY, width: pipe.width, height: pipe.height };

            if (this.rectIntersect(birdBox, topPipeBox) || this.rectIntersect(birdBox, bottomPipeBox)) {
                player.crashed_at_pipe = pipe.pipeIndex;
                return true;
            }
        }

        return false;
    }

    checkItemBoxCollisions(player) {
        // Capacity: Players can hold a maximum of 1 item at a time
        if (player.heldItem !== null) return;

        const birdBox = { x: player.x, y: player.y, width: BIRD_WIDTH, height: BIRD_HEIGHT };

        for (let item of this.lobby.itemBoxes) {
            if (item.collected || item.isActive === false) continue;

            const itemBox = { x: item.x, y: item.y, width: item.width, height: item.height };
            if (this.rectIntersect(birdBox, itemBox)) {
                item.collected = true;
                item.isActive = false;
                item.collectedBy = player.player_id;

                const itemTypes = ["ink", "curse", "shield", "speed", "swap", "deathnote", "ice"];
                const acquiredItem = itemTypes[Math.floor(Math.random() * itemTypes.length)];
                player.heldItem = acquiredItem;

                this.io.to(this.lobby.Lobby_id).emit("item_collected", {
                    itemId: item.id,
                    playerId: player.player_id,
                    acquiredItem: acquiredItem
                });

                // Exactly 3 seconds (3000ms) after being collected, the box must reactivate
                if (item.respawnTimer) clearTimeout(item.respawnTimer);
                item.respawnTimer = setTimeout(() => {
                    item.collected = false;
                    item.isActive = true;
                    item.collectedBy = null;
                    item.respawnTimer = null;
                    this.io.to(this.lobby.Lobby_id).emit("item_respawned", {
                        itemId: item.id
                    });
                }, ITEM_RESPAWN_MS);
            }
        }
    }

    rectIntersect(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }

    respawnPlayer(player) {
        const chkId = player.checkpoint_id || this.lobby.startCheckpointId;
        this.respawnPlayerAtCheckpoint(player, chkId);
    }

    respawnPlayerAtCheckpoint(player, checkpointId) {
        const chk = this.lobby.checkpoints.get(checkpointId);
        const xOffset = (this.lobby.mode_id === "flappy_chained") ? (player.chain_index * CHAIN_SPACING_X) : 0;

        if (chk) {
            player.x = chk.respawn_coordinate_x - xOffset;
            player.y = chk.respawn_coordinate_y;
        } else {
            player.x = 100 - xOffset;
            player.y = 320;
        }
        player.velocityY = 0;

        this.io.to(this.lobby.Lobby_id).emit("player_respawned", {
            playerId: player.player_id,
            checkpointId: checkpointId,
            x: player.x,
            y: player.y
        });
    }

    broadcastSnapshot() {
        const playersSnapshot = [];
        for (let p of this.lobby.players.values()) {
            playersSnapshot.push({
                player_id: p.player_id,
                name: p.name,
                skin_ID: p.skin_ID,
                hat_ID: p.hat_ID,
                x: p.x,
                y: p.y,
                velocityY: p.velocityY,
                last_processed_input: p.last_processed_input,
                is_finished: p.is_finished,
                finish_time: p.finish_time,
                last_pipe_passed: p.last_pipe_passed,
                checkpoint_id: p.checkpoint_id,
                chain_index: p.chain_index,
                heldItem: p.heldItem,
                hasShield: p.hasShield,
                isInvincible: p.isInvincible,
                isBucketHead: p.isBucketHead || false,
                isFrozenInIce: p.isFrozenInIce || false,
                speedMultiplier: p.speedMultiplier
            });
        }

        let remainingCountdown = null;
        if (this.lobby.finishTimerStart !== null) {
            const elapsed = (Date.now() - this.lobby.finishTimerStart) / 1000;
            remainingCountdown = Math.max(0, Math.ceil(10 - elapsed));
        }

        const sanitizedItemBoxes = (this.lobby.itemBoxes || []).map(item => ({
            id: item.id,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            collected: item.collected || false,
            isActive: item.isActive !== false,
            collectedBy: item.collectedBy || null
        }));

        this.io.to(this.lobby.Lobby_id).emit("game_snapshot", {
            tick: this.tickCount,
            serverTime: Date.now(),
            players: playersSnapshot,
            itemBoxes: sanitizedItemBoxes,
            finishCountdown: remainingCountdown
        });
    }

    endMatch() {
        this.stop();
        this.lobby.status = "finished";

        const elapsedMs = Date.now() - this.lobby.matchStartTime;
        const minutes = Math.floor(elapsedMs / 60000);
        const seconds = Math.floor((elapsedMs % 60000) / 1000);
        const millis = Math.floor((elapsedMs % 1000) / 10);
        const teamTotalTimeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;

        const playerList = Array.from(this.lobby.players.values());
        
        const finishedPlayers = playerList.filter(p => p.is_finished);
        const dnfPlayers = playerList.filter(p => !p.is_finished);

        finishedPlayers.sort((a, b) => parseFloat(a.finish_time) - parseFloat(b.finish_time));
        dnfPlayers.sort((a, b) => b.last_pipe_passed - a.last_pipe_passed);

        const leaderboardEntries = [];
        let rank = 1;

        for (let p of finishedPlayers) {
            const lbEntry = new LeaderboardEntry(
                `lb_${this.lobby.Lobby_id}_${p.player_id}`,
                p.player_id,
                this.lobby.Lobby_id,
                p.finish_time,
                rank++,
                p.name,
                "FINISHED",
                p.wipes_caused || 0,
                p.skin_ID || 0,
                p.hat_ID || 0
            );
            leaderboardEntries.push(lbEntry);
        }

        for (let p of dnfPlayers) {
            const pipeNum = p.last_pipe_passed || p.crashed_at_pipe || 0;
            const statusStr = `[ OUT ] CRASHED AT PIPE ${pipeNum}`;
            const lbEntry = new LeaderboardEntry(
                `lb_${this.lobby.Lobby_id}_${p.player_id}`,
                p.player_id,
                this.lobby.Lobby_id,
                null,
                null,
                p.name,
                statusStr,
                p.wipes_caused || 0,
                p.skin_ID || 0,
                p.hat_ID || 0
            );
            leaderboardEntries.push(lbEntry);
        }

        this.lobby.leaderboard = leaderboardEntries;

        this.io.to(this.lobby.Lobby_id).emit("match_finished", {
            lobby_id: this.lobby.Lobby_id,
            mode_id: this.lobby.mode_id,
            team_total_time: teamTotalTimeStr,
            leaderboard: leaderboardEntries
        });
    }
}

module.exports = GameEngine;
