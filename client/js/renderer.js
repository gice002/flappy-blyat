class CanvasRenderer {
    constructor(canvas, physicsEngine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.physics = physicsEngine;

        this.width = canvas.width;
        this.height = canvas.height;

        // Config & Assets
        this.assetsConfig = null;
        this.themeImages = {}; // theme_id -> { bg: Image, topPipe: Image, bottomPipe: Image }
        this.hatImages = {};   // hat_id -> Image
        this.images = {};

        // Parallax & Transition State
        this.currentThemeId = "classic_day";
        this.targetThemeId = "classic_day";
        this.fadeAlpha = 1.0;
        this.isFading = false;

        this.loadAssetsConfig();

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

        this.animFrame = 0;
        setInterval(() => {
            this.animFrame = (this.animFrame + 1) % 4;
        }, 120);

        // Visual Effects, Death Animations & Particle Systems
        this.particles = [];
        this.teleportRings = [];
        this.floatingTexts = [];
        this.deathEntities = [];
        this.screenFlashes = [];
        this.screenShakeTimer = 0;
        this.screenShakeIntensity = 0;
        this.isShaking = false;
    }

    drawFallbackPngBox(x, y, width, height, text = "PNG") {
        this.ctx.save();
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillRect(x, y, width, height);
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.fillStyle = "#000000";
        this.ctx.font = "7px 'Press Start 2P'";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(text, x + width / 2, y + height / 2);
        this.ctx.restore();
    }

    async loadAssetsConfig() {
        const sources = {
            bird0: "assets/images/flappybird0.png",
            bird1: "assets/images/flappybird1.png",
            bird2: "assets/images/flappybird2.png",
            bird3: "assets/images/flappybird3.png",
            bg: "assets/images/flappybirdbg.png",
            topPipe: "assets/images/toppipe.png",
            bottomPipe: "assets/images/bottompipe.png",
            buble: "assets/images/buble.png",
            slowness: "assets/images/items/Slowness_JE4.png",
            bucket: "assets/images/items/bucket.png",
            absorption: "assets/images/items/Absorption_JE3_BE3.png",
            inbucket: "assets/images/items/inbucket.png",
            checkpointflag: "assets/images/checkpointflag.png",
            winflag: "assets/images/winflag.png"
        };

        for (let key in sources) {
            this.images[key] = new Image();
            this.images[key].src = sources[key];
        }

        try {
            const res = await fetch("config/assets.json");
            this.assetsConfig = await res.json();
            this.preloadConfiguredAssets();
        } catch (e) {
            console.warn("[Renderer] Failed to load config/assets.json, using fallback theme assets:", e);
        }
    }

    preloadConfiguredAssets() {
        if (!this.assetsConfig) return;

        if (this.assetsConfig.map_themes) {
            for (let theme of this.assetsConfig.map_themes) {
                const bgImg = new Image();
                bgImg.src = theme.bg_src;

                const topImg = new Image();
                topImg.src = theme.pipe_top_src || theme.pipe_src;

                const botImg = new Image();
                botImg.src = theme.pipe_bottom_src || theme.pipe_src;

                this.themeImages[theme.theme_id] = {
                    bg: bgImg,
                    topPipe: topImg,
                    bottomPipe: botImg
                };
            }
        }

        // Fallback for new_underwater_map theme
        if (!this.themeImages["new_underwater_map"]) {
            const uwBg = new Image();
            uwBg.src = "assets/images/backgrounds/new_underwater_map.png";
            const topImg = new Image();
            topImg.src = "assets/images/pipes/toppipe_underwater.png";
            const botImg = new Image();
            botImg.src = "assets/images/pipes/bottompipe_underwater.png";
            this.themeImages["new_underwater_map"] = { bg: uwBg, topPipe: topImg, bottomPipe: botImg };
        }

        if (this.assetsConfig.hats) {
            for (let hat of this.assetsConfig.hats) {
                if (hat.src) {
                    const hatImg = new Image();
                    hatImg.src = hat.src;
                    this.hatImages[hat.id] = hatImg;
                }
            }
        }

        this.itemImages = {};
        if (this.assetsConfig.items) {
            for (let key in this.assetsConfig.items) {
                const itemImg = new Image();
                itemImg.src = this.assetsConfig.items[key];
                this.itemImages[key] = itemImg;
            }
        }

        if (!this.itemImages.buble) {
            this.itemImages.buble = this.images.buble;
        }

        if (!this.itemImages.inbucket) {
            this.itemImages.inbucket = this.images.inbucket;
        }
    }

    setGameData(maps, checkpoints, itemBoxes, finishLineX, modeId) {
        this.maps = maps || [];
        this.checkpoints = checkpoints || [];
        this.itemBoxes = itemBoxes || [];
        this.finishLineX = finishLineX || 0;
        this.modeId = modeId || "flappy_race";

        if (this.maps.length > 0 && this.maps[0].theme_id) {
            this.currentThemeId = this.maps[0].theme_id;
            this.targetThemeId = this.maps[0].theme_id;
            this.fadeAlpha = 1.0;
            this.isFading = false;
        }
    }

    setFpsLock(locked) {
        this.fpsLocked = locked;
    }

    applyScreenShake() {
        if (this.screenShakeTimer > Date.now()) {
            const shakeX = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
            const shakeY = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
            this.ctx.save();
            this.ctx.translate(shakeX, shakeY);
            this.isShaking = true;
        } else {
            this.isShaking = false;
        }
    }

    restoreScreenShake() {
        if (this.isShaking) {
            this.ctx.restore();
            this.isShaking = false;
        }
    }

    triggerScreenShake(intensity = 8, durationMs = 300) {
        this.screenShakeIntensity = intensity;
        this.screenShakeTimer = Date.now() + durationMs;
    }

    triggerScreenFlash(color = "rgba(231, 76, 60, 0.45)", durationMs = 350) {
        this.screenFlashes.push({
            color: color,
            until: Date.now() + durationMs,
            duration: durationMs
        });
    }

    triggerDeathEffect(worldX, worldY, isLocal = false, labelText = "CRASH!") {
        // 1. Screen Shake & Red Screen Flash if local player died
        if (isLocal) {
            this.triggerScreenShake(10, 350);
            this.triggerScreenFlash("rgba(231, 76, 60, 0.45)", 400);
        } else {
            this.triggerScreenShake(4, 200);
        }

        // 2. Exploding Burst Particles (Feathers, Smoke & Energy Sparkles)
        const particleColors = isLocal ? ["#e74c3c", "#f39c12", "#ffffff", "#c0392b"] : ["#e67e22", "#f1c40f", "#ecf0f1", "#95a5a6"];
        for (let i = 0; i < 35; i++) {
            const angle = (Math.PI * 2 * i) / 35 + (Math.random() - 0.5);
            const speed = 2 + Math.random() * 6;
            this.particles.push({
                x: worldX,
                y: worldY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                size: 3 + Math.random() * 5,
                color: particleColors[Math.floor(Math.random() * particleColors.length)],
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.02,
                gravity: 0.2,
                rotation: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.3
            });
        }

        // 3. Upward Bouncing Death Entity (short upward jump then rapid 360° spin fall)
        this.deathEntities.push({
            x: worldX,
            y: worldY,
            vx: (Math.random() - 0.5) * 2,
            vy: -6, // Short upward bounce impulse
            rotation: 0,
            vr: (Math.random() > 0.5 ? 1 : -1) * 0.35, // Rapid spin speed
            alpha: 1.0,
            decay: 0.02,
            isLocal: isLocal
        });

        // 4. Floating Death Label Text
        this.floatingTexts.push({
            x: worldX,
            y: worldY - 15,
            vy: -1.2,
            text: labelText,
            color: "#e74c3c",
            alpha: 1.0,
            decay: 0.02
        });
    }

    triggerSwapEffect(x1, y1, x2, y2, p1Name = "", p2Name = "") {
        // 1. Purple Magic Screen Flash
        this.triggerScreenFlash("rgba(155, 89, 182, 0.4)", 450);
        this.triggerScreenShake(6, 250);

        const positions = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        const magicColors = ["#9b59b6", "#8e44ad", "#3498db", "#00ffff", "#f1c40f", "#ffffff"];

        positions.forEach((pos) => {
            // Expanding Teleport Shockwave Rings
            this.teleportRings.push({
                x: pos.x,
                y: pos.y,
                radius: 5,
                maxRadius: 45,
                color: "#9b59b6",
                alpha: 1.0,
                lineWidth: 4,
                decay: 0.03
            });
            this.teleportRings.push({
                x: pos.x,
                y: pos.y,
                radius: 2,
                maxRadius: 35,
                color: "#00ffff",
                alpha: 1.0,
                lineWidth: 2,
                decay: 0.04
            });

            // Magic Vortex Particle Swirl Burst
            for (let i = 0; i < 30; i++) {
                const angle = (Math.PI * 2 * i) / 30;
                const speed = 2 + Math.random() * 5;
                this.particles.push({
                    x: pos.x,
                    y: pos.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 3 + Math.random() * 4,
                    color: magicColors[Math.floor(Math.random() * magicColors.length)],
                    alpha: 1.0,
                    decay: 0.025,
                    gravity: 0,
                    rotation: angle,
                    vr: 0.1
                });
            }

            // Floating "SWAPPED!" Text
            this.floatingTexts.push({
                x: pos.x,
                y: pos.y - 20,
                vy: -1.5,
                text: "SWAPPED! ⇄",
                color: "#f1c40f",
                alpha: 1.0,
                decay: 0.02
            });
        });
    }

    renderParticleEffects() {
        this.ctx.save();

        // 1. Render & Update Teleport Shockwave Rings
        for (let i = this.teleportRings.length - 1; i >= 0; i--) {
            const ring = this.teleportRings[i];
            ring.radius += (ring.maxRadius - ring.radius) * 0.15;
            ring.alpha -= ring.decay;

            if (ring.alpha <= 0 || ring.radius >= ring.maxRadius - 1) {
                this.teleportRings.splice(i, 1);
                continue;
            }

            const screenX = ring.x - this.cameraX;
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, ring.alpha);
            this.ctx.strokeStyle = ring.color;
            this.ctx.lineWidth = ring.lineWidth;
            this.ctx.beginPath();
            this.ctx.arc(screenX, ring.y, ring.radius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        }

        // 2. Render & Update Burst & Magic Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.gravity) p.vy += p.gravity;
            p.alpha -= p.decay;
            p.rotation += p.vr;

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            const screenX = p.x - this.cameraX;
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, p.alpha);
            this.ctx.translate(screenX, p.y);
            this.ctx.rotate(p.rotation);
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();
        }

        // 3. Render & Update Death Entities (Upward bounce + rapid spin fall)
        for (let i = this.deathEntities.length - 1; i >= 0; i--) {
            const d = this.deathEntities[i];
            d.x += d.vx;
            d.vy += 0.45; // Gravity pull
            d.y += d.vy;
            d.rotation += d.vr;
            d.alpha -= d.decay;

            if (d.alpha <= 0 || d.y > this.height + 100) {
                this.deathEntities.splice(i, 1);
                continue;
            }

            const screenX = d.x - this.cameraX;
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, d.alpha);
            this.ctx.translate(screenX, d.y);
            this.ctx.rotate(d.rotation);

            // Draw spinning red death bird shape
            this.ctx.fillStyle = d.isLocal ? "#e74c3c" : "#e67e22";
            this.ctx.fillRect(-17, -12, 34, 24);
            this.ctx.strokeStyle = "#ffffff";
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(-17, -12, 34, 24);

            // Draw "X" eyes for death feedback
            this.ctx.strokeStyle = "#ffffff";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(4, -6); this.ctx.lineTo(10, 0);
            this.ctx.moveTo(10, -6); this.ctx.lineTo(4, 0);
            this.ctx.stroke();

            this.ctx.restore();
        }

        // 4. Render & Update Floating Texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy;
            ft.alpha -= ft.decay;

            if (ft.alpha <= 0) {
                this.floatingTexts.splice(i, 1);
                continue;
            }

            const screenX = ft.x - this.cameraX;
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, ft.alpha);
            this.ctx.fillStyle = ft.color;
            this.ctx.strokeStyle = "#000000";
            this.ctx.lineWidth = 3;
            this.ctx.font = "bold 13px 'Press Start 2P', 'Kanit', sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.strokeText(ft.text, screenX, ft.y);
            this.ctx.fillText(ft.text, screenX, ft.y);
            this.ctx.restore();
        }

        this.ctx.restore();
    }

    renderScreenFlashes() {
        const now = Date.now();
        for (let i = this.screenFlashes.length - 1; i >= 0; i--) {
            const flash = this.screenFlashes[i];
            if (now > flash.until) {
                this.screenFlashes.splice(i, 1);
                continue;
            }

            const remaining = flash.until - now;
            const alphaRatio = Math.min(1.0, remaining / flash.duration);
            this.ctx.save();
            this.ctx.fillStyle = flash.color;
            this.ctx.globalAlpha = alphaRatio;
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.restore();
        }
    }

    render(now) {
        const frameInterval = 1000 / 60; // Strictly synced to 60 FPS (16.6ms) physics tick
        const delta = now - this.lastFrameTime;

        if (delta < frameInterval - 1) {
            return;
        }

        this.lastFrameTime = now;
        this.frameCount++;

        this.ctx.clearRect(0, 0, this.width, this.height);

        const localBird = this.physics.predictedState;
        this.cameraX = localBird.x - 150;

        // Apply Screen Shake if active
        this.applyScreenShake();

        // 1. Render Dynamic Parallax Background with Cross-Fade Transitions
        this.renderBackground();

        // 2. Render Checkpoints & Finish Line
        this.renderCheckpointsAndFinish();

        // 3. Render Pipes
        this.renderPipes();

        // 4. Render Item Boxes
        this.renderItemBoxes();

        // 5. Render Birds & Chain
        this.renderChains();
        this.renderBirds();

        // 5.5. Render Particle Systems & Death Entities
        this.renderParticleEffects();

        // 6. Render Ground Strip
        this.renderGround();

        // 7. Render Screen Flash Overlays
        this.renderScreenFlashes();

        // 8. Render Ink Splat Attack Screen Overlay
        this.renderInkOverlay();

        // 9. Render Real-time Shaking Death Note Book Effect
        this.renderDeathNoteEffect();

        // 10. Render Racing Progress Bar HUD (Track Tracker)
        this.renderRacingProgressBar();

        // Restore screen shake
        this.restoreScreenShake();
    }

    renderDeathNoteEffect() {
        if (!window.deathnoteEffectUntil || Date.now() > window.deathnoteEffectUntil) return;
        this.ctx.save();
        const shakeX = (Math.random() - 0.5) * 12;
        const shakeY = (Math.random() - 0.5) * 12;

        const centerX = this.width / 2 + shakeX;
        const centerY = this.height / 2 + shakeY;

        // Dark aura vignette overlay
        this.ctx.fillStyle = "rgba(10, 0, 0, 0.45)";
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Shaking Death Note Book Icon / Box
        this.ctx.fillStyle = "#111111";
        this.ctx.fillRect(centerX - 36, centerY - 48, 72, 96);
        this.ctx.strokeStyle = "#d9534f";
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(centerX - 36, centerY - 48, 72, 96);

        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "8px 'Press Start 2P'";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("DEATH", centerX, centerY - 12);
        this.ctx.fillText("NOTE", centerX, centerY + 12);

        // Banner Text
        this.ctx.fillStyle = "#f7d51d";
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 4;
        this.ctx.font = "11px 'Press Start 2P'";
        this.ctx.textAlign = "center";
        const bannerMsg = window.deathnoteBannerText || "DEATH NOTE ACTIVATED!";
        this.ctx.strokeText(bannerMsg, centerX, centerY + 76);
        this.ctx.fillText(bannerMsg, centerX, centerY + 76);

        this.ctx.restore();
    }

    renderInkOverlay() {
        if (!window.localInkUntil || Date.now() > window.localInkUntil) return;
        this.ctx.save();
        const remaining = window.localInkUntil - Date.now();
        const alpha = Math.min(1.0, remaining / 300);
        this.ctx.globalAlpha = alpha;

        const bucketOverlayImg = (this.itemImages && (this.itemImages.inbucket || this.itemImages.ink_splat)) || this.images.inbucket;
        if (bucketOverlayImg && bucketOverlayImg.complete) {
            this.ctx.drawImage(bucketOverlayImg, 0, 0, this.width, this.height);
        } else {
            this.ctx.fillStyle = "rgba(12, 11, 16, 0.85)";
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        this.ctx.restore();
    }

    getCurrentMapTheme() {
        const localX = this.physics.predictedState.x;
        for (let mapData of this.maps) {
            if (mapData.pipes && mapData.pipes.length > 0) {
                const firstPipeX = mapData.pipes[0].x - 300;
                const lastPipeX = mapData.pipes[mapData.pipes.length - 1].x + 300;
                if (localX >= firstPipeX && localX <= lastPipeX) {
                    return mapData.theme_id || "classic_day";
                }
            }
        }
        return (this.maps[0] && this.maps[0].theme_id) ? this.maps[0].theme_id : "classic_day";
    }

    renderBackground() {
        const activeThemeId = this.getCurrentMapTheme();

        // Check theme transition
        if (activeThemeId !== this.targetThemeId) {
            this.targetThemeId = activeThemeId;
            this.fadeAlpha = 0.0;
            this.isFading = true;
        }

        const bgWidth = 288;

        // Parallax X offset: moves 0.15x camera speed (much slower than pipes for 2D depth illusion)
        const parallaxX = -(this.cameraX * 0.15) % bgWidth;

        // Draw helper for a given theme_id
        const drawThemeBg = (themeId, alpha) => {
            this.ctx.save();
            this.ctx.globalAlpha = alpha;

            const themeAsset = this.themeImages[themeId];
            const bgImg = (themeAsset && themeAsset.bg.complete) ? themeAsset.bg : this.images.bg;

            for (let x = parallaxX - bgWidth; x < this.width + bgWidth; x += bgWidth) {
                if (bgImg && bgImg.complete) {
                    this.ctx.drawImage(bgImg, x, 0, bgWidth, this.height);
                } else {
                    this.ctx.fillStyle = "#70c5ce";
                    this.ctx.fillRect(0, 0, this.width, this.height);
                }
            }
            this.ctx.restore();
        };

        if (this.isFading) {
            // Draw old background
            drawThemeBg(this.currentThemeId, 1.0);

            // Advance cross-fade alpha blend
            this.fadeAlpha += 0.025;
            if (this.fadeAlpha >= 1.0) {
                this.fadeAlpha = 1.0;
                this.currentThemeId = this.targetThemeId;
                this.isFading = false;
            }

            // Draw new background over old background with alpha
            drawThemeBg(this.targetThemeId, this.fadeAlpha);
        } else {
            drawThemeBg(this.currentThemeId, 1.0);
        }
    }

    renderGround() {
        const groundY = 616;
        const groundHeight = 24;

        this.ctx.fillStyle = "#ded895";
        this.ctx.fillRect(0, groundY, this.width, groundHeight);

        this.ctx.fillStyle = "#73bf2e";
        this.ctx.fillRect(0, groundY, this.width, 6);
        this.ctx.fillStyle = "#000000";
        this.ctx.fillRect(0, groundY, this.width, 2);
    }

    renderPipes() {
        for (let mapData of this.maps) {
            const themeId = mapData.theme_id || "classic_day";
            const themeAsset = this.themeImages[themeId];

            const topImg = (themeAsset && themeAsset.topPipe.complete) ? themeAsset.topPipe : this.images.topPipe;
            const botImg = (themeAsset && themeAsset.bottomPipe.complete) ? themeAsset.bottomPipe : this.images.bottomPipe;

            for (let pipe of mapData.pipes) {
                const screenX = pipe.x - this.cameraX;

                if (screenX + pipe.width < -50 || screenX > this.width + 50) continue;

                if (topImg && topImg.complete) {
                    this.ctx.drawImage(topImg, screenX, pipe.topY, pipe.width, pipe.height);
                } else {
                    this.ctx.fillStyle = "#74bf2e";
                    this.ctx.fillRect(screenX, pipe.topY, pipe.width, pipe.height);
                }

                if (botImg && botImg.complete) {
                    this.ctx.drawImage(botImg, screenX, pipe.bottomY, pipe.width, pipe.height);
                } else {
                    this.ctx.fillStyle = "#74bf2e";
                    this.ctx.fillRect(screenX, pipe.bottomY, pipe.width, pipe.height);
                }
            }
        }
    }

    renderCheckpointsAndFinish() {
        for (let chk of this.checkpoints) {
            const screenX = chk.respawn_coordinate_x - this.cameraX;
            if (screenX < -50 || screenX > this.width + 50) continue;

            this.ctx.save();
            this.ctx.strokeStyle = "#3993d0";
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([8, 8]);
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, 616);
            this.ctx.stroke();

            this.ctx.fillStyle = "#3993d0";
            this.ctx.fillRect(screenX - 15, 40, 30, 20);
            this.ctx.fillStyle = "#ffffff";
            this.ctx.font = "8px 'Press Start 2P'";
            this.ctx.textAlign = "center";
            this.ctx.fillText("CHK", screenX, 54);
            this.ctx.restore();
        }

        if (this.finishLineX > 0) {
            const finishScreenX = this.finishLineX - this.cameraX;
            if (finishScreenX >= -100 && finishScreenX <= this.width + 100) {
                this.ctx.save();

                const squareSize = 16;
                for (let y = 0; y < 616; y += squareSize) {
                    for (let col = 0; col < 2; col++) {
                        const isWhite = ((y / squareSize) + col) % 2 === 0;
                        this.ctx.fillStyle = isWhite ? "#ffffff" : "#000000";
                        this.ctx.fillRect(finishScreenX + (col * squareSize), y, squareSize, squareSize);
                    }
                }

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
            if (item.collected || item.isActive === false) continue;
            const screenX = item.x - this.cameraX;
            if (screenX < -50 || screenX > this.width + 50) continue;

            this.ctx.save();

            const floatOffset = Math.sin(performance.now() / 200) * 4;
            const itemY = item.y + floatOffset;

            const boxImg = this.itemImages && this.itemImages.box;
            if (boxImg && boxImg.complete) {
                this.ctx.drawImage(boxImg, screenX, itemY, 32, 32);
            } else {
                this.ctx.fillStyle = "#f7d51d";
                this.ctx.fillRect(screenX, itemY, 32, 32);
                this.ctx.strokeStyle = "#000";
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(screenX, itemY, 32, 32);

                this.ctx.fillStyle = "#000";
                this.ctx.font = "16px 'Press Start 2P'";
                this.ctx.textAlign = "center";
                this.ctx.fillText("?", screenX + 16, itemY + 23);
            }

            this.ctx.restore();
        }
    }

    renderChains() {
        if (this.modeId !== "flappy_chained") return;

        const allBirds = [];
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

            const midX = (screenXA + screenXB) / 2;
            const midY = (screenYA + screenYB) / 2;
            this.ctx.fillStyle = "#d0d0d0";
            this.ctx.fillRect(midX - 4, midY - 4, 8, 8);
        }

        this.ctx.restore();
    }

    renderBirds() {
        for (let remote of this.physics.remotePlayers.values()) {
            const screenX = remote.x - this.cameraX;
            this.drawSingleBird(
                screenX,
                remote.y,
                remote.velocityY,
                remote.skin_ID,
                remote.hat_ID,
                remote.name,
                false,
                remote.hasShield,
                remote.speedMultiplier,
                remote.isInvincible,
                remote.isBucketHead,
                remote.isFrozenInIce
            );
        }

        const local = this.physics.predictedState;
        const localScreenX = local.x - this.cameraX;
        this.drawSingleBird(
            localScreenX,
            local.y,
            local.velocityY,
            window.playerSkinId || 0,
            window.playerHatId || 0,
            window.playerName || "YOU",
            true,
            this.physics.localHasShield,
            this.physics.localSpeedMultiplier,
            this.physics.localIsInvincible,
            this.physics.localIsBucketHead,
            this.physics.localIsFrozenInIce
        );
    }

    drawSingleBird(x, y, velocityY, skinId, hatId, name, isLocal, hasShield = false, speedMultiplier = 1.0, isInvincible = false, isBucketHead = false, isFrozenInIce = false) {
        this.ctx.save();

        // If Bucket Head active (Ink hit), render bucket.png above bird head (visible to all players)
        if (isBucketHead) {
            this.ctx.save();
            const bucketImg = (this.itemImages && (this.itemImages.ink || this.itemImages.bucket)) || this.images.bucket;
            if (bucketImg && bucketImg.complete) {
                this.ctx.drawImage(bucketImg, x + 17 - 16, y - 38, 32, 32);
            } else {
                this.drawFallbackPngBox(x + 17 - 14, y - 36, 28, 20, "PNG");
            }
            this.ctx.restore();
        }

        // If Speed Boost active (speedMultiplier > 1.0), draw SpeedBoost icon trailing behind bird
        if (speedMultiplier > 1.0) {
            this.ctx.save();
            const speedIcon = this.itemImages && this.itemImages.speed;
            if (speedIcon && speedIcon.complete) {
                this.ctx.drawImage(speedIcon, x - 16, y + 4, 20, 20);
            }
            this.ctx.restore();
        }

        // If Cursed (speedMultiplier < 1.0), draw Slowness_JE4 icon at bird's tail
        if (speedMultiplier < 1.0) {
            this.ctx.save();
            const slownessIcon = (this.itemImages && (this.itemImages.curse || this.itemImages.slowness)) || this.images.slowness;
            if (slownessIcon && slownessIcon.complete) {
                this.ctx.drawImage(slownessIcon, x - 12, y + 6, 16, 16);
            } else {
                this.ctx.fillStyle = "rgba(138, 43, 226, 0.7)";
                this.ctx.beginPath();
                this.ctx.arc(x - 4, y + 12, 6, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        }

        // If Shield Active, draw buble.png encapsulating bird
        if (hasShield) {
            this.ctx.save();
            const bubbleImg = (this.images && this.images.buble) || (this.itemImages && (this.itemImages.buble || this.itemImages.shield));
            if (bubbleImg && bubbleImg.complete) {
                this.ctx.drawImage(bubbleImg, x + 17 - 28, y + 12 - 28, 56, 56);
            } else {
                this.ctx.strokeStyle = "#40e0d0";
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(x + 17, y + 12, 24, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.fillStyle = "rgba(64, 224, 208, 0.25)";
                this.ctx.fill();
            }
            this.ctx.restore();
        }

        // If Invincible (post-shield block), draw Blinking Golden Star Aura
        if (isInvincible) {
            const isBlinkVisible = Math.floor(Date.now() / 150) % 2 === 0;
            if (isBlinkVisible) {
                this.ctx.save();
                this.ctx.strokeStyle = "#f1c40f";
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.arc(x + 17, y + 12, 28, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.fillStyle = "rgba(241, 196, 15, 0.4)";
                this.ctx.fill();
                this.ctx.restore();
            }
        }

        // If Frozen in Ice, render Ice Block overlay over bird
        if (isFrozenInIce) {
            this.ctx.save();
            const iceImg = this.itemImages && this.itemImages.ice;
            if (iceImg && iceImg.complete) {
                this.ctx.drawImage(iceImg, x + 17 - 24, y + 12 - 24, 48, 48);
            } else {
                this.ctx.fillStyle = "rgba(112, 197, 206, 0.6)";
                this.ctx.strokeStyle = "#3993d0";
                this.ctx.lineWidth = 3;
                this.ctx.fillRect(x + 17 - 22, y + 12 - 20, 44, 40);
                this.ctx.strokeRect(x + 17 - 22, y + 12 - 20, 44, 40);
                this.ctx.fillStyle = "#ffffff";
                this.ctx.font = "8px 'Press Start 2P'";
                this.ctx.textAlign = "center";
                this.ctx.strokeText("ICE", x + 17, y + 16);
                this.ctx.fillText("ICE", x + 17, y + 16);
            }
            this.ctx.restore();
        }

        let rotationAngle = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (velocityY * 0.1)));

        this.ctx.translate(x + 17, y + 12);
        this.ctx.rotate(rotationAngle);

        const birdImgKey = `bird${this.animFrame}`;
        const img = this.images[birdImgKey] || this.images.bird0;

        if (img && img.complete) {
            this.applySkinFilter(skinId);
            this.ctx.drawImage(img, -17, -12, 34, 24);
        } else {
            this.ctx.fillStyle = this.getSkinColorHex(skinId);
            this.ctx.fillRect(-17, -12, 34, 24);
        }

        this.drawHat(hatId);

        this.ctx.restore();

        this.ctx.save();
        this.ctx.fillStyle = isLocal ? "#f7d51d" : "#ffffff";
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 3;
        this.ctx.font = "bold 11px 'Press Start 2P', 'Kanit', sans-serif";
        this.ctx.textAlign = "center";

        let labelName = name;
        if (speedMultiplier < 1.0) labelName += " [SLOW]";
        if (speedMultiplier > 1.0) labelName += " [FAST]";
        if (isInvincible) labelName += " [STAR]";
        if (isFrozenInIce) labelName += " [ICE]";
        this.ctx.strokeText(labelName, x + 17, y - 10);
        this.ctx.fillText(labelName, x + 17, y - 10);

        if (isLocal) {
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

    // TOP-LEFT RACING PROGRESS BAR UI (Mario Kart Track Tracker style)
    renderRacingProgressBar() {
        this.ctx.save();

        const trackX = 16;
        const trackY = 24;
        const trackWidth = 260;
        const trackHeight = 14;

        // Background Track Box
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 3;
        this.ctx.fillRect(trackX, trackY, trackWidth, trackHeight);
        this.ctx.strokeRect(trackX, trackY, trackWidth, trackHeight);

        // Inner Track Bar
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        this.ctx.fillRect(trackX + 2, trackY + 2, trackWidth - 4, trackHeight - 4);

        // Collect all active players
        const playersList = [];
        const local = this.physics.predictedState;
        playersList.push({
            id: this.physics.localPlayerId,
            x: local.x,
            skin_ID: window.playerSkinId || 0,
            isLocal: true
        });

        for (let remote of this.physics.remotePlayers.values()) {
            playersList.push({
                id: remote.player_id,
                x: remote.x,
                skin_ID: remote.skin_ID || 0,
                isLocal: false
            });
        }

        // Sort by progression X descending to calculate rank indicators (1st, 2nd, 3rd, 4th)
        playersList.sort((a, b) => b.x - a.x);
        const rankLabels = ["1st", "2nd", "3rd", "4th"];

        const effectiveFinishLineX = (this.finishLineX && this.finishLineX > 500) 
            ? this.finishLineX 
            : ((this.checkpoints && this.checkpoints.length > 0) 
                ? (this.checkpoints[this.checkpoints.length - 1].respawn_coordinate_x + 600) 
                : 4000);
        const totalDist = Math.max(1, effectiveFinishLineX - 100);

        // Render Checkpoint Flags at relative positions along the track
        if (this.checkpoints && this.checkpoints.length > 0) {
            const chkFlagImg = (this.images && this.images.checkpointflag) || (this.itemImages && this.itemImages.checkpointflag);
            for (let chk of this.checkpoints) {
                const chkX = chk.respawn_coordinate_x || 0;
                if (chkX <= 100 || chkX >= effectiveFinishLineX) continue;

                const ratio = Math.max(0, Math.min(1, (chkX - 100) / totalDist));
                const flagX = trackX + (ratio * (trackWidth - 20));

                if (chkFlagImg && chkFlagImg.complete) {
                    this.ctx.drawImage(chkFlagImg, flagX, trackY - 14, 16, 16);
                } else {
                    this.ctx.fillStyle = "#3993d0";
                    this.ctx.fillRect(flagX + 6, trackY - 4, 4, 18);
                }
            }
        }

        for (let i = 0; i < playersList.length; i++) {
            const p = playersList[i];
            const ratio = Math.max(0, Math.min(1, (p.x - 100) / totalDist));
            const iconX = trackX + (ratio * (trackWidth - 20));
            const iconY = trackY - 2;

            // Mini Bird Icon (16x12 px)
            this.ctx.fillStyle = this.getSkinColorHex(p.skin_ID);
            this.ctx.strokeStyle = "#000000";
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(iconX, iconY, 16, 12);
            this.ctx.strokeRect(iconX, iconY, 16, 12);

            // Mini Eye dot
            this.ctx.fillStyle = "#ffffff";
            this.ctx.fillRect(iconX + 10, iconY + 2, 4, 4);

            // Rank Indicator Badge (1st, 2nd, 3rd, 4th) - NO NAMES ON BAR
            const rankStr = rankLabels[i] || `${i + 1}th`;
            this.ctx.fillStyle = p.isLocal ? "#f7d51d" : "#ffffff";
            this.ctx.strokeStyle = "#000000";
            this.ctx.lineWidth = 2;
            this.ctx.font = "6px 'Press Start 2P'";
            this.ctx.textAlign = "center";
            this.ctx.strokeText(rankStr, iconX + 8, iconY - 4);
            this.ctx.fillText(rankStr, iconX + 8, iconY - 4);
        }

        // Finish Line Flag Icon at 100% mark (far right end of track)
        const winFlagImg = (this.images && this.images.winflag) || (this.itemImages && this.itemImages.winflag);
        if (winFlagImg && winFlagImg.complete) {
            this.ctx.drawImage(winFlagImg, trackX + trackWidth - 16, trackY - 14, 20, 20);
        } else {
            this.ctx.fillStyle = "#f7d51d";
            this.ctx.fillRect(trackX + trackWidth - 6, trackY - 4, 6, 22);
        }

        this.ctx.restore();
    }

    applySkinFilter(skinId) {
        switch (Number(skinId)) {
            case 1:
                this.ctx.filter = "hue-rotate(140deg) saturate(1.8)";
                break;
            case 2:
                this.ctx.filter = "hue-rotate(240deg) saturate(1.5)";
                break;
            case 3:
                this.ctx.filter = "hue-rotate(40deg) saturate(1.8)";
                break;
            case 4:
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
        if (!hatId || hatId === 0 || hatId === "none") return;

        this.ctx.save();
        this.ctx.filter = "none";

        const hatKeys = ["none", "crown", "top_hat", "cap", "viking"];
        const hatKey = (typeof hatId === "number") ? hatKeys[hatId] : hatId;
        const hatImg = this.hatImages[hatKey];

        if (hatImg && hatImg.complete) {
            this.ctx.drawImage(hatImg, -16, -36, 32, 32);
        } else {
            this.drawProceduralHatFallback(hatId);
        }

        this.ctx.restore();
    }

    drawProceduralHatFallback(hatId) {
        const idNum = Number(hatId);
        switch (idNum) {
            case 1:
                this.ctx.fillStyle = "#f7d51d";
                this.ctx.strokeStyle = "#000000";
                this.ctx.lineWidth = 1;
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

            case 2:
                this.ctx.fillStyle = "#111111";
                this.ctx.fillRect(-14, -14, 28, 4);
                this.ctx.fillRect(-8, -26, 16, 12);
                this.ctx.fillStyle = "#d9534f";
                this.ctx.fillRect(-8, -16, 16, 3);
                break;

            case 3:
                this.ctx.fillStyle = "#d9534f";
                this.ctx.fillRect(-6, -14, 20, 3);
                this.ctx.beginPath();
                this.ctx.arc(-2, -14, 10, Math.PI, 0);
                this.ctx.fill();
                break;

            case 4:
                this.ctx.fillStyle = "#7f8c8d";
                this.ctx.fillRect(-10, -16, 20, 6);
                this.ctx.fillStyle = "#f39c12";
                this.ctx.fillRect(-14, -22, 4, 8);
                this.ctx.fillRect(10, -22, 4, 8);
                break;
        }
    }
}
