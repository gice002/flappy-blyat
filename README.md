# Real-Time Multiplayer Flappy Bird Architecture

An authoritative, real-time multiplayer HTML5 Canvas game built with Node.js, Express, and native WebSockets (`ws`). Engineered with **Client-Side Prediction**, **Ping-Based Remote Player Interpolation**, **60 TPS Fixed Timestep Physics**, **7 Item Interactions**, and a decoupled **Vercel Edge Frontend + Cloudflare Tunnel Backend Architecture**.

---

## 🚀 Quick Start Guide: Hosting a Game Session for Friends

Whenever you want to host a game session for your friends from your laptop (e.g. Acer Nitro V15):

### Step 1: Start the Local Game Server (Terminal 1)
```bash
cd /home/notsiri/projects/flappy-bird
npm start
```
*(Confirms Node.js server running on port `3000`)*

### Step 2: Open the High-Speed Cloudflare Tunnel (Terminal 2)
```bash
npx cloudflared tunnel --url http://localhost:3000
```
*(Cloudflare connects to your nearest Bangkok `bkk07` edge node and outputs a live URL, e.g., `duration-republic-hey-duties.trycloudflare.com`)*

### Step 3: Share the Game Link with Friends
Send your friends your Vercel URL with your Cloudflare server parameter attached:

👉 **`https://flappy-blyat.vercel.app/?server=wss://xxxx.trycloudflare.com`**
*(Replace `xxxx.trycloudflare.com` with your active Cloudflare URL from Terminal 2)*

---

## 🛠️ Architecture Overview

```
+-----------------------------------+       +------------------------------------+
|       Vercel Edge Network         |       |   Authoritative Node.js Server     |
| (High-Speed Static Client Host)   |       |   (60 TPS Fixed Timestep Engine)   |
|                                   |       |                                    |
| - client/index.html               |       | - server/server.js                 |
| - client/js/ (app, physics, etc)  |       | - server/game/gameLoop.js          |
| - client/assets/ (PNG, WAV, MP3)  |       | - server/game/lobbyManager.js      |
+-----------------+-----------------+       +-----------------+------------------+
                  |                                           |
                  | Fetches Static Assets (HTTP/2)             | WSS Connection
                  v                                           v (60 Hz Snapshots)
        +---------------------------------------------------------------+
        |                     Player Browser Client                     |
        |  - Client-Side Prediction (0ms Input Latency)                 |
        |  - Remote Player Linear Interpolation (Ping Smoothing)        |
        |  - Dynamic WebSocket Server Auto-Discovery                    |
        +---------------------------------------------------------------+
```

---

## ⚡ Key Technical Highlights

### 1. Zero-Latency Client-Side Prediction
* **Instant Local Feedback**: Flap inputs (`Space`, `ArrowUp`, click) apply vertical impulse velocity (`velocityY = -6.0`) instantly on the local screen without waiting for network roundtrips.
* **Input Queue & Reconciliation**: Local jump inputs are assigned incremental sequence IDs (`seq`) and transmitted to the backend over WebSockets. Incoming authoritative server snapshots reconcile position deviations while replaying unacknowledged inputs.

### 2. Ping-Based Remote Player Interpolation (Lerp & Dead-Reckoning)
* **Smooth Gliding Movement**: Remote player positions interpolate frame-by-frame (`lerpFactor = 0.25`) with forward dead-reckoning.
* **Jitter & Lag Absorption**: Network ping spikes manifest as smooth gliding rather than jarring local screen rubber-banding.

### 3. High-Precision Fixed Timestep Game Engine (60 TPS)
* **Deterministic Physics Loop**: Uses `performance.now()` from `perf_hooks` with a fixed-size accumulator pattern (`1000 / 60` ms per tick).
* **Spiral-of-Death Protection**: Clamps max frame time delta (250ms) to maintain stability during background pauses.

### 4. Single-Pass WebSocket Broadcasts & 15s Heartbeat
* **Single Serialization**: State snapshot JSON objects are pre-serialized once per broadcast call for all open native `ws` sockets (`readyState === 1`).
* **15-Second Heartbeat**: Server sends 15s ping/pong keep-alive frames to prevent Cloudflare/Nginx proxy idle connection drops.

---

## 🎮 Game Modes & Item System

### Power-Ups & Debuffs (Flappy Race Mode)

| Item | Effect | Graphic Asset |
|---|---|---|
| **Ink Bucket** | Covers 1st place player's screen with ink overlay & bucket head | `bucket.png` / `inbucket.png` |
| **Curse (Slowness)** | Reduces target's forward speed by 35% for 6s | `Slowness_JE4.png` |
| **Shield Bubble** | Grants single-use protection against incoming attacks | `Absorption_JE3_BE3.png` |
| **Speed Boost** | Increases forward movement speed by 50% for 4s | `SpeedBoost.png` |
| **Position Swap** | Swaps physical positions with a random active opponent | `swap.png` |
| **Death Note** | Instantly respawns 1st place player back to last checkpoint | `DeathNote.webp` |
| **Ice Freeze** | Freezes target mid-air for 2.5s | `ice.png` |

### Cooperative Mode: "Flappy Chained"
* **Linked Kinematic Offsets**: 4 players fly in a chained formation with fixed horizontal offsets ($\Delta X = 60\text{px} \times \text{index}$).
* **Synchronized Team Wipeouts**: If any player collides with a pipe, the entire team respawns at the latest cleared checkpoint simultaneously.

---

## 📁 Project Structure

```
flappy-bird/
├── client/
│   ├── assets/                # Textures, backgrounds, pipes, sound assets, items
│   │   ├── backgrounds/
│   │   ├── hats/
│   │   ├── items/
│   │   └── pipes/
│   ├── config/
│   │   └── assets.json        # Centralized asset configuration registry
│   ├── css/
│   │   ├── style.css          # Pixel-art HUD, lobby, and leaderboard styling
│   │   └── flappybird.css     # Canvas & HUD layout overlays
│   ├── js/
│   │   ├── app.js             # WebSocket client, UI event handlers, HUD, auto-reconnect
│   │   ├── audio.js           # BGM / SFX audio controller
│   │   ├── physics.js         # Client-side prediction & remote interpolation
│   │   ├── renderer.js        # HTML5 Canvas renderer & parallax camera
│   │   └── ui.js              # HUD layout and UI modal management
│   └── index.html             # Application entry point
├── server/
│   ├── config/
│   │   └── constants.js       # Game physics, tick rates, and item constants
│   ├── game/
│   │   ├── gameLoop.js        # Authoritative 60 TPS high-precision fixed timestep loop
│   │   ├── lobbyManager.js    # Lobby room lifecycle & broadcast manager
│   │   └── mapGenerator.js    # Procedural map & pipe spacing generator
│   ├── models/                # Player, Lobby, Leaderboard, Map, Checkpoint, Mode
│   ├── sockets/
│   │   └── socketHandler.js   # Native WebSocket event router & 15s heartbeat
│   └── server.js              # Express app, CORS middleware & WebSocket server
├── Dockerfile                 # Multi-stage production container setup
├── fly.toml                   # Fly.io configuration template
├── package.json               # Node.js dependencies and scripts
├── vercel.json                # Vercel static output configuration
└── README.md                  # Project technical documentation
```

---

## 📄 License & Evaluation

Developed for University Network Programming & Distributed Systems course evaluation. All rights reserved.
