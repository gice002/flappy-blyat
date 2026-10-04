# Real-Time Multiplayer Flappy Bird Architecture

An authoritative, real-time multiplayer HTML5 Canvas game built with Node.js, Express, and Socket.IO, featuring client-side prediction, server reconciliation, dynamic asset mapping, and cooperative network game modes.

---

## 1. Project Title & Introduction

**Flappy Bird Online** is a distributed, multi-client real-time web application engineered to demonstrate high-frequency state synchronization, network latency mitigation, and authoritative server design principles. 

Unlike traditional single-player Flappy Bird implementations where obstacles translate leftward across a static entity, this project implements a **World Space Model with a Moving Viewport (Camera)**. Players navigate through procedurally generated or thematic maps with deterministic obstacle sequences, real-time collision dynamics, item interactions, and cooperative tethering physics.

---

## 2. Key Technical Highlights

### 2.1 Network Architecture & Client-Side Prediction with Server Reconciliation

To achieve 60 FPS visual smoothness across high-latency internet environments without sacrificing server authority, the engine implements a **Client-Predicted with Server Reconciliation** network architecture:

```
           +-------------------------------------------------------+
           |                   Authoritative Server                |
           |   (Runs tick @ 60 FPS, validates physics & collisions) |
           +---------------------------+---------------------------+
                                       |
                   Broadcast State     |     Send Input Stream
                   Payload (30 Hz)     |     (Jump Events & Seq)
                                       v
           +-------------------------------------------------------+
           |                     Local Client                      |
           |  - Instant Local Jump Prediction (Zero-Latency)       |
           |  - Local Unacknowledged Input Queue                   |
           |  - Server Snapshot Reconciliation & Error Correction   |
           +-------------------------------------------------------+
```

1. **Client Prediction (Zero-Latency Local Feedback)**:
   - When a player triggers a flap input (`Spacebar`/`Click`), the client immediately applies local vertical impulse velocity (`velocity = -9.0`) and updates local physics deterministically.
   - The jump input is assigned a incremental sequence identifier (`seq`) and appended to a local pending input queue while simultaneously being transmitted to the server via WebSockets.

2. **Authoritative Server Physics Tick**:
   - The Node.js server maintains the canonical game state, executing a fixed-step physics loop (`60 Hz`).
   - The server processes client inputs, applies gravity (`0.45 px/frame^2`), increments forward world position (`x += velocity_x`), and evaluates bounding-box collision geometry against pipe obstacles.

3. **Server Reconciliation**:
   - Server snapshots are broadcast to clients at periodic network ticks.
   - Upon receiving a server state update, the client compares its predicted historical state against the authoritative server snapshot.
   - If position deviation exceeds a tolerance threshold, the client rewinds local state to the server snapshot timestamp and re-applies all unacknowledged inputs remaining in the queue, eliminating visual stutter while enforcing anti-cheat authority.

---

### 2.2 Cooperative Network Synchronization: "Flappy Chained" Mode

**Flappy Chained** is a 4-player cooperative game mode featuring linked player entities:

```
[Player 0 (Base X)] === Chain === [Player 1 (X - 60)] === Chain === [Player 2 (X - 120)] ...
```

1. **Strict X-Axis Kinematic Lock & Spawn Offsets**:
   - Chained players spawn with deterministic horizontal offsets ($\Delta X = 60\text{px} \times \text{index}$).
   - Forward horizontal velocity ($V_x$) is strictly synchronized across all chained entity states. Players maintain constant relative $X$ spacing throughout the flight path.

2. **Synchronized Shared Collision Event & Server Reset**:
   - Collision detection is computed authoritatively per player. If **any single player** in the chain collides with a pipe boundary:
     - The server registers the collision culprit for leaderboards (`wipes_caused++`).
     - The server triggers a **Team Wipe Event**, instantly resetting the spatial state ($X, Y$) of all linked players to the latest cleared checkpoint coordinate ($\text{Checkpoint}_X, \text{Respawn}_Y$).
     - A synchronized `match_sync` packet is broadcast, instructing all clients to purge stale local interpolation buffers and re-align with the checkpoint origin simultaneously.

---

## 3. Tech Stack

- **Frontend & Rendering Engine**: HTML5 Canvas API, Vanilla ES6+ JavaScript, CSS3 (CSS Grid/Flexbox, Pixel Art styling).
- **Backend Architecture**: Node.js runtime, Express.js web application framework.
- **Real-Time Network Transport**: Socket.IO (WebSockets with HTTP long-polling fallback, `trust proxy` enabled for PaaS cloud edge reverse proxies).
- **Asset Pipeline**: Centralized JSON configuration engine supporting dynamic map theme transitions, transparent PNG overlays, and Parallax layers.

---

## 4. Installation & Deployment

### 4.1 Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

### 4.2 Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/your-username/flappy-bird-multiplayer.git
cd flappy-bird-multiplayer

# 2. Install dependencies
npm install

# 3. Start the server (Development mode)
npm start
```

By default, the server listens on **Port 3000**. Open your browser and navigate to:
```
http://localhost:3000
```

### 4.3 Environment Configuration & Production Deployment

The application supports environment configuration via `.env` or process environment variables:

```bash
PORT=8080 NODE_ENV=production npm start
```

- **Cloud PaaS Deployment**: Compatible with Docker, Render, Railway, or Fly.io container platforms. Reverse proxy support is enabled via `app.set('trust proxy', 1)` and Socket.IO secure WebSocket handling (`wss://`).

---

## 5. Project Structure

```
flappy-bird/
├── client/
│   ├── assets/                # Textures, backgrounds, pipes, sound assets
│   │   ├── backgrounds/
│   │   ├── hats/
│   │   └── pipes/
│   ├── config/
│   │   └── assets.json        # Centralized asset configuration registry
│   ├── css/
│   │   └── style.css          # Pixel-art HUD, lobby, and leaderboard styling
│   ├── js/
│   │   ├── app.js             # Main socket handlers and UI event bindings
│   │   ├── audio.js           # BGM / SFX audio controller
│   │   ├── physics.js         # Local client prediction physics loop
│   │   ├── renderer.js        # HTML5 Canvas renderer & parallax camera
│   │   └── ui.js              # HUD layout and UI modal management
│   └── index.html             # Application entry point and DOM screens
├── server/
│   ├── config/
│   │   └── assets.json        # Server asset metadata reference
│   ├── game/
│   │   ├── gameLoop.js        # Authoritative 60Hz server tick loop
│   │   └── mapGenerator.js    # Procedural map & pipe spacing generator
│   ├── models/
│   │   ├── Leaderboard.js     # Results & post-match metrics engine
│   │   ├── Lobby.js           # Room state, migration & kick manager
│   │   └── Player.js          # Player domain entity model
│   └── server.js              # Express app & Socket.IO server initialization
├── .dockerignore              # Docker build exclusions
├── Dockerfile                 # Multi-stage production container setup
├── package.json               # Node.js dependencies and scripts
├── README.md                  # Project technical documentation
└── user_prompts.txt           # Task history prompt log
```

---

## 6. License & Evaluation

Developed for University Network Programming & Distributed Systems course evaluation. All right reserved.
