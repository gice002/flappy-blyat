class CanvasRenderer {
    constructor(canvas, physicsEngine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.physics = physicsEngine;

        this.width = canvas.width;
        this.height = canvas.height;

        // Assets
        this.images = {};
        this.loadAssets();

        this.maps = [];
        this.checkpoints = [];
        this.itemBoxes = [];
        this.finishLineX = 0;
        this.modeId = "flappy_race";

        this.cameraX = 0;
        this.targetFps = 60;
        this.fpsLocked = false;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.currentFps = 60;

        // Animation frame index for bird flapping
        this.animFrame = 0;
        setInterval(() => {
            this.animFrame = (this.animFrame + 1) % 4;
        }, 120);
    }

    loadAssets() {
        const sources = {
            bg: "assets/flappybirdbg.png",
            bird0: "assets/flappybird0.png",
            bird1: "assets/flappybird1.png",
            bird2: "assets/flappybird2.png",
            bird3: "assets/flappybird3.png",
            topPipe: "assets/toppipe.png",
            bottomPipe: "assets/bottompipe.png"
        };

        for (let key in sources) {
            this.images[key] = new Image();
            this.images[key].src = sources[key];
        }
    }

    setGameData(maps, checkpoints, itemBoxes, finishLineX, modeId) {
        this.maps = maps || [];
        this.checkpoints = checkpoints || [];
        this.itemBoxes = itemBoxes || [];
        this.finishLineX = finishLineX || 0;
        this.modeId = modeId || "flappy_race";
    }

    setFpsLock(locked) {
        this.fpsLocked = locked;
    }

    render(now) {
        const frameInterval = 1000 / this.targetFps;
        const delta = now - this.lastFrameTime;

        if (this.fpsLocked && delta < frameInterval - 1) {
            return;
        }

        this.lastFrameTime = now;
        this.frameCount++;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Update Camera position to follow local player
        const localBird = this.physics.predictedState;
        this.cameraX = localBird.x - 150;

        // 1. Render Tiled Parallax Background
        this.renderBackground();

        // 2. Render Checkpoints & Finish Line
        this.renderCheckpointsAndFinish();

        // 3. Render Pipes
        this.renderPipes();

        // 4. Render Item Boxes
        this.renderItemBoxes();

        // 5. Render Birds & Chain (if Flappy Chained mode)
        this.renderChains();
        this.renderBirds();

        // 6. Render Ground Strip
        this.renderGround();
    }

    renderBackground() {
        const bgWidth = 288;
        const bgHeight = 512;
        const bgY = this.height - bgHeight;

        // Calculate parallax offset
        const parallaxX = -(this.cameraX * 0.4) % bgWidth;

        for (let x = parallaxX - bgWidth; x < this.width + bgWidth; x += bgWidth) {
            if (this.images.bg.complete) {
                this.ctx.drawImage(this.images.bg, x, bgY, bgWidth, bgHeight);
            } else {
                this.ctx.fillStyle = "#70c5ce";
                this.ctx.fillRect(0, 0, this.width, this.height);
            }
        }
    }

    renderGround() {
        const groundY = 616;
        const groundHeight = 24;

        this.ctx.fillStyle = "#ded895";
        this.ctx.fillRect(0, groundY, this.width, groundHeight);

        // Grass border on ground
        this.ctx.fillStyle = "#73bf2e";
        this.ctx.fillRect(0, groundY, this.width, 6);
        this.ctx.fillStyle = "#000000";
        this.ctx.fillRect(0, groundY, this.width, 2);
    }

    renderPipes() {
        for (let mapData of this.maps) {
            for (let pipe of mapData.pipes) {
                const screenX = pipe.x - this.cameraX;

                // Culling: check if pipe is visible inside viewport
                if (screenX + pipe.width < -50 || screenX > this.width + 50) continue;

                // Top Pipe
                if (this.images.topPipe.complete) {
                    this.ctx.drawImage(this.images.topPipe, screenX, pipe.topY, pipe.width, pipe.height);
                } else {
                    this.ctx.fillStyle = "#74bf2e";
                    this.ctx.fillRect(screenX, pipe.topY, pipe.width, pipe.height);
                }

                // Bottom Pipe
                if (this.images.bottomPipe.complete) {
                    this.ctx.drawImage(this.images.bottomPipe, screenX, pipe.bottomY, pipe.width, pipe.height);
                } else {
                    this.ctx.fillStyle = "#74bf2e";
                    this.ctx.fillRect(screenX, pipe.bottomY, pipe.width, pipe.height);
                }
            }
        }
    }

    renderCheckpointsAndFinish() {
        // Render Checkpoints
        for (let chk of this.checkpoints) {
            const screenX = chk.respawn_coordinate_x - this.cameraX;
            if (screenX < -50 || screenX > this.width + 50) continue;

            // Render Checkpoint Banner / Line
            this.ctx.save();
            this.ctx.strokeStyle = "#3993d0";
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([8, 8]);
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, 616);
            this.ctx.stroke();

            // Checkpoint Flag / Icon
            this.ctx.fillStyle = "#3993d0";
            this.ctx.fillRect(screenX - 15, 40, 30, 20);
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "8px 'Press Start 2P'";
            this.ctx.textAlign = "center";
            this.ctx.fillText("CHK", screenX, 54);
            this.ctx.restore();
        }

        // Render Finish Line
        if (this.finishLineX > 0) {
            const finishScreenX = this.finishLineX - this.cameraX;
            if (finishScreenX >= -100 && finishScreenX <= this.width + 100) {
                this.ctx.save();

                // Checkered Finish Banner
                const squareSize = 16;
                for (let y = 0; y < 616; y += squareSize) {
                    for (let col = 0; col < 2; col++) {
                        const isWhite = ((y / squareSize) + col) % 2 === 0;
                        this.ctx.fillStyle = isWhite ? "#ffffff" : "#000000";
                        this.ctx.fillRect(finishScreenX + (col * squareSize), y, squareSize, squareSize);
                    }
                }

                // FINISH LINE Text Header
                this.ctx.fillStyle = "#f7d51d";
                this.ctx.strokeStyle = "#000";
                this.ctx.lineWidth = 4;
                this.ctx.font = "14px 'Press Start 2P'";
                this.ctx.textAlign = "center";
                this.ctx.strokeText("FINISH GOAL", finishScreenX + 16, 30);
                this.ctx.fillText("FINISH GOAL", finishScreenX + 16, 30);

                this.ctx.restore();
            }
        }
    }

    renderItemBoxes() {
        for (let item of this.itemBoxes) {
            if (item.collected) continue;
            const screenX = item.x - this.cameraX;
            if (screenX < -50 || screenX > this.width + 50) continue;

            this.ctx.save();

            // Floating oscillation animation
            const floatOffset = Math.sin(performance.now() / 200) * 4;
            const itemY = item.y + floatOffset;

            // Question Box Container
            this.ctx.fillStyle = "#f7d51d";
            this.ctx.fillRect(screenX, itemY, 32, 32);
            this.ctx.strokeStyle = "#000";
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(screenX, itemY, 32, 32);

            // Question mark ?
            this.ctx.fillStyle = "#000";
            this.ctx.font = "16px 'Press Start 2P'";
            this.ctx.textAlign = "center";
            this.ctx.fillText("?", screenX + 16, itemY + 23);

            this.ctx.restore();
        }
    }

    renderChains() {
        if (this.modeId !== "flappy_chained") return;

        // Collect all birds in match and sort by chain_index
        const allBirds = [];
        
        // Local bird
        const localState = this.physics.predictedState;
        allBirds.push({
            id: this.physics.localPlayerId,
            x: localState.x + 17,
            y: localState.y + 12,
            chain_index: 0
        });

        for (let remote of this.physics.remotePlayers.values()) {
            allBirds.push({
                id: remote.player_id,
                x: remote.x + 17,
                y: remote.y + 12,
                chain_index: remote.chain_index || 0
            });
        }

        allBirds.sort((a, b) => a.chain_index - b.chain_index);

        if (allBirds.length < 2) return;

        this.ctx.save();
        this.ctx.strokeStyle = "#a0a0a0";
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([6, 6]);

        for (let i = 0; i < allBirds.length - 1; i++) {
            const birdA = allBirds[i];
            const birdB = allBirds[i + 1];

            const screenXA = birdA.x - this.cameraX;
            const screenYA = birdA.y;
            const screenXB = birdB.x - this.cameraX;
            const screenYB = birdB.y;

            this.ctx.beginPath();
            this.ctx.moveTo(screenXA, screenYA);
            this.ctx.lineTo(screenXB, screenYB);
            this.ctx.stroke();

            // Draw chain link nodes
            const midX = (screenXA + screenXB) / 2;
            const midY = (screenYA + screenYB) / 2;
            this.ctx.fillStyle = "#d0d0d0";
            this.ctx.fillRect(midX - 4, midY - 4, 8, 8);
        }

        this.ctx.restore();
    }

    renderBirds() {
        // 1. Render Remote Birds
        for (let remote of this.physics.remotePlayers.values()) {
            const screenX = remote.x - this.cameraX;
            this.drawSingleBird(
                screenX,
                remote.y,
                remote.velocityY,
                remote.skin_ID,
                remote.hat_ID,
                remote.name,
                false
            );
        }

        // 2. Render Local Bird
        const local = this.physics.predictedState;
        const localScreenX = local.x - this.cameraX;
        this.drawSingleBird(
            localScreenX,
            local.y,
            local.velocityY,
            window.playerSkinId || 0,
            window.playerHatId || 0,
            window.playerName || "YOU",
            true
        );
    }

    drawSingleBird(x, y, velocityY, skinId, hatId, name, isLocal) {
        this.ctx.save();

        // Calculate rotation tilt angle based on velocityY
        let rotationAngle = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (velocityY * 0.1)));

        this.ctx.translate(x + 17, y + 12);
        this.ctx.rotate(rotationAngle);

        // Bird Sprite key based on animation frame
        const birdImgKey = `bird${this.animFrame}`;
        const img = this.images[birdImgKey] || this.images.bird0;

        if (img && img.complete) {
            // Apply Skin Color Tint via Canvas filter or overlay
            this.applySkinFilter(skinId);
            this.ctx.drawImage(img, -17, -12, 34, 24);
        } else {
            this.ctx.fillStyle = this.getSkinColorHex(skinId);
            this.ctx.fillRect(-17, -12, 34, 24);
        }

        // Render Custom Hat on top of bird
        this.drawHat(hatId);

        this.ctx.restore();

        // Render Name Tag & Local Player Arrow (Unrotated)
        this.ctx.save();
        this.ctx.fillStyle = isLocal ? "#f7d51d" : "#ffffff";
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 3;
        this.ctx.font = "8px 'Press Start 2P'";
        this.ctx.textAlign = "center";
        this.ctx.strokeText(name, x + 17, y - 10);
        this.ctx.fillText(name, x + 17, y - 10);

        if (isLocal) {
            // Little indicator arrow overhead
            this.ctx.fillStyle = "#55b02e";
            this.ctx.beginPath();
            this.ctx.moveTo(x + 17, y - 24);
            this.ctx.lineTo(x + 11, y - 32);
            this.ctx.lineTo(x + 23, y - 32);
            this.ctx.closePath();
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    applySkinFilter(skinId) {
        // Skin ID tints: 0: Yellow (normal), 1: Red, 2: Green, 3: Blue, 4: Gold
        switch (skinId) {
            case 1: // Red
                this.ctx.filter = "hue-rotate(140deg) saturate(1.8)";
                break;
            case 2: // Green
                this.ctx.filter = "hue-rotate(240deg) saturate(1.5)";
                break;
            case 3: // Blue
                this.ctx.filter = "hue-rotate(40deg) saturate(1.8)";
                break;
            case 4: // Gold / Purple
                this.ctx.filter = "hue-rotate(90deg) saturate(2.5) brightness(1.2)";
                break;
            default:
                this.ctx.filter = "none";
                break;
        }
    }

    getSkinColorHex(skinId) {
        const colors = ["#f7d51d", "#d9534f", "#55b02e", "#3993d0", "#9b59b6"];
        return colors[skinId] || colors[0];
    }

    drawHat(hatId) {
        if (!hatId || hatId === 0) return;

        this.ctx.save();
        this.ctx.filter = "none"; // Reset filter so hat retains true color

        switch (hatId) {
            case 1: // Golden Crown
                this.ctx.fillStyle = "#f7d51d";
                this.ctx.strokeStyle = "#000000";
                this.ctx.lineWidth = 1;
                // Crown spikes
                this.ctx.beginPath();
                this.ctx.moveTo(-10, -12);
                this.ctx.lineTo(-10, -22);
                this.ctx.lineTo(-5, -16);
                this.ctx.lineTo(0, -24);
                this.ctx.lineTo(5, -16);
                this.ctx.lineTo(10, -22);
                this.ctx.lineTo(10, -12);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                break;

            case 2: // Top Hat
                this.ctx.fillStyle = "#111111";
                // Hat brim
                this.ctx.fillRect(-14, -14, 28, 4);
                // Hat body
                this.ctx.fillRect(-8, -26, 16, 12);
                // Ribbon
                this.ctx.fillStyle = "#d9534f";
                this.ctx.fillRect(-8, -16, 16, 3);
                break;

            case 3: // Red Cap
                this.ctx.fillStyle = "#d9534f";
                // Visor
                this.ctx.fillRect(-6, -14, 20, 3);
                // Dome
                this.ctx.beginPath();
                this.ctx.arc(-2, -14, 10, Math.PI, 0);
                this.ctx.fill();
                break;

            case 4: // Viking Helmet
                this.ctx.fillStyle = "#7f8c8d";
                this.ctx.fillRect(-10, -16, 20, 6);
                // Horns
                this.ctx.fillStyle = "#f39c12";
                // Left horn
                this.ctx.fillRect(-14, -22, 4, 8);
                // Right horn
                this.ctx.fillRect(10, -22, 4, 8);
                break;
        }

        this.ctx.restore();
    }
}
