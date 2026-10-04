class PhysicsEngine {
    constructor() {
        this.gravity = 0.4;
        this.jumpVelocity = -6;
        this.forwardVelocity = 2.0;
        this.birdWidth = 34;
        this.birdHeight = 24;
        this.groundY = 616;

        this.inputSequence = 0;
        this.pendingInputs = []; // Array of { sequence, action, timestamp }
        
        // Local prediction state
        this.localPlayerId = null;
        this.predictedState = {
            x: 100,
            y: 320,
            velocityY: 0
        };

        // Interpolated remote players state map: playerId -> playerObj
        this.remotePlayers = new Map();
        this.isFrozen = false;
        this.localIsFinished = false;
        this.localSpeedMultiplier = 1.0;
        this.localHasShield = false;
        this.localIsInvincible = false;
        this.localHeldItem = null;
    }

    setLocalPlayerId(id) {
        this.localPlayerId = id;
    }

    clearRemotePlayers() {
        this.remotePlayers.clear();
    }

    resetLocalState(startX, startY) {
        this.predictedState = {
            x: startX,
            y: startY,
            velocityY: 0
        };
        this.inputSequence = 0;
        this.pendingInputs = [];
        this.isFrozen = false;
        this.localIsFinished = false;
        this.localSpeedMultiplier = 1.0;
        this.localHasShield = false;
        this.localIsInvincible = false;
        this.localHeldItem = null;
        this.clearRemotePlayers(); // Enforce strict state wipe on local reset
    }

    // Process local jump input instantly for zero latency
    handleLocalJump() {
        if (this.isFrozen || this.localIsFinished) return null;
        this.inputSequence++;
        const input = {
            sequence: this.inputSequence,
            action: "jump",
            timestamp: Date.now()
        };

        // Apply instant jump locally
        this.predictedState.velocityY = this.jumpVelocity;
        
        // Queue input for reconciliation
        this.pendingInputs.push(input);

        return input;
    }

    // Step local physics frame (at 60 FPS)
    updateLocalPhysics() {
        if (this.isFrozen || this.localIsFinished) {
            this.predictedState.velocityY = 0;
            return;
        }
        const speedMult = (this.localSpeedMultiplier !== undefined && this.localSpeedMultiplier !== null) ? this.localSpeedMultiplier : 1.0;
        this.predictedState.x += this.forwardVelocity * speedMult;
        this.predictedState.velocityY += this.gravity;
        this.predictedState.y = Math.max(0, this.predictedState.y + this.predictedState.velocityY);

        // Ground limit
        if (this.predictedState.y + this.birdHeight > this.groundY) {
            this.predictedState.y = this.groundY - this.birdHeight;
            this.predictedState.velocityY = 0;
        }
    }

    // Reconcile with authoritative Server Snapshot
    reconcileServerSnapshot(snapshot) {
        if (!snapshot || !snapshot.players) return;

        // Build active player ID set from snapshot to prune disconnected / stale ghosts
        const activeServerPlayerIds = new Set(snapshot.players.map(p => p.player_id));

        for (let remoteId of Array.from(this.remotePlayers.keys())) {
            if (!activeServerPlayerIds.has(remoteId)) {
                this.remotePlayers.delete(remoteId); // Remove ghost player
            }
        }

        for (let serverPlayer of snapshot.players) {
            if (serverPlayer.player_id === this.localPlayerId) {
                this.localHasShield = serverPlayer.hasShield || false;
                this.localIsInvincible = serverPlayer.isInvincible || false;
                this.localHeldItem = serverPlayer.heldItem || null;
                this.localSpeedMultiplier = (serverPlayer.speedMultiplier !== undefined && serverPlayer.speedMultiplier !== null) ? serverPlayer.speedMultiplier : 1.0;
                this.localIsFinished = serverPlayer.is_finished || false;

                if (this.localIsFinished) {
                    this.predictedState.x = serverPlayer.x;
                    this.predictedState.y = serverPlayer.y;
                    this.predictedState.velocityY = 0;
                    this.pendingInputs = [];
                    continue;
                }

                // Server baseline position
                let reconciledX = serverPlayer.x;
                let reconciledY = serverPlayer.y;
                let reconciledVY = serverPlayer.velocityY;

                // Remove inputs that the server has already processed
                const lastAck = serverPlayer.last_processed_input || 0;
                this.pendingInputs = this.pendingInputs.filter(input => input.sequence > lastAck);

                const speedMult = this.localSpeedMultiplier;

                // Replay unacknowledged inputs on top of server baseline
                for (let input of this.pendingInputs) {
                    if (input.action === "jump") {
                        reconciledVY = this.jumpVelocity;
                    }
                    reconciledX += this.forwardVelocity * speedMult;
                    reconciledVY += this.gravity;
                    reconciledY = Math.max(0, reconciledY + reconciledVY);
                }
                // Smooth correction / Reconciliation threshold
                const diffX = Math.abs(this.predictedState.x - reconciledX);
                const diffY = Math.abs(this.predictedState.y - reconciledY);

                if (diffX > 50 || diffY > 50) {
                    // Hard snap if major desync
                    this.predictedState.x = reconciledX;
                    this.predictedState.y = reconciledY;
                    this.predictedState.velocityY = reconciledVY;
                } else {
                    // Smooth lerp correction
                    this.predictedState.x += (reconciledX - this.predictedState.x) * 0.3;
                    this.predictedState.y += (reconciledY - this.predictedState.y) * 0.3;
                    this.predictedState.velocityY = reconciledVY;
                }
            } else {
                // Remote Player State handling
                let remote = this.remotePlayers.get(serverPlayer.player_id);
                if (!remote) {
                    remote = {
                        player_id: serverPlayer.player_id,
                        name: serverPlayer.name,
                        skin_ID: serverPlayer.skin_ID,
                        hat_ID: serverPlayer.hat_ID,
                        x: serverPlayer.x,
                        y: serverPlayer.y,
                        velocityY: serverPlayer.velocityY,
                        targetX: serverPlayer.x,
                        targetY: serverPlayer.y,
                        targetVelocityY: serverPlayer.velocityY,
                        is_finished: serverPlayer.is_finished,
                        finish_time: serverPlayer.finish_time,
                        chain_index: serverPlayer.chain_index,
                        hasShield: serverPlayer.hasShield,
                        isInvincible: serverPlayer.isInvincible,
                        heldItem: serverPlayer.heldItem,
                        speedMultiplier: serverPlayer.speedMultiplier
                    };
                    this.remotePlayers.set(serverPlayer.player_id, remote);
                } else {
                    remote.name = serverPlayer.name;
                    remote.skin_ID = serverPlayer.skin_ID;
                    remote.hat_ID = serverPlayer.hat_ID;
                    remote.targetX = serverPlayer.x;
                    remote.targetY = serverPlayer.y;
                    remote.targetVelocityY = serverPlayer.velocityY;
                    remote.is_finished = serverPlayer.is_finished;
                    remote.finish_time = serverPlayer.finish_time;
                    remote.chain_index = serverPlayer.chain_index;
                    remote.hasShield = serverPlayer.hasShield;
                    remote.isInvincible = serverPlayer.isInvincible;
                    remote.heldItem = serverPlayer.heldItem;
                    remote.speedMultiplier = serverPlayer.speedMultiplier;
                }
            }
        }
    }

    // Interpolate remote players towards target positions
    updateRemotePlayers() {
        for (let remote of this.remotePlayers.values()) {
            if (remote.is_finished) {
                remote.x = remote.targetX;
                remote.y = remote.targetY;
                remote.velocityY = 0;
            } else {
                remote.x += (remote.targetX - remote.x) * 0.25;
                remote.y += (remote.targetY - remote.y) * 0.25;
                remote.velocityY = remote.targetVelocityY;
            }
        }
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = PhysicsEngine;
}
