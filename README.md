# Real-Time Multiplayer Flappy Bird Architecture

An authoritative, real-time multiplayer HTML5 Canvas game built with Node.js, Express, and native WebSockets (`ws`), featuring high-precision fixed timestep physics, client-side prediction, server reconciliation, dynamic asset mapping, items system, and cooperative network game modes.

---

## 1. Project Title & Introduction

**Flappy Bird Online** is a distributed, multi-client real-time web application engineered to demonstrate high-frequency state synchronization, network latency mitigation, and authoritative server design principles. 

Unlike traditional single-player Flappy Bird implementations where obstacles translate leftward across a static entity, this project implements a **World Space Model with a Moving Viewport (Camera)**. Players navigate through procedurally generated or thematic maps with deterministic obstacle sequences, real-time collision dynamics, 7 distinct item interactions, and cooperative tethering physics.

---

## 2. Key Technical Highlights

### 2.1 High-Precision Fixed Timestep Game Loop (60 TPS)

To prevent frame drift caused by Node.js event loop scheduling variations, the game server uses a **High-Precision Fixed Timestep Accumulator Pattern**:

```
        +-------------------------------------------------------+
        |                 High-Precision Timer                  |
        |              (perf_hooks performance.now())           |
        +---------------------------+---------------------------+
                                    |
                    Accumulate Delta Frame Time
                                    v
        +-------------------------------------------------------+
        |         Fixed Timestep Accumulator (16.66ms)          |
        |  - Executes discrete 60 TPS physics tick steps        |
        |  - Clamps max delta (250ms) to prevent lag spikes     |
        |  - Yields dynamically to Node.js event loop           |
        +---------------------------+---------------------------+
                                    |
                   Single-Pass Pre-Serialized Broadcast
                   (Native ws clients: WebSocket.OPEN)
                                    v
        +-------------------------------------------------------+
        |                    Connected Clients                  |
        |  - Instant Local Jump Prediction (Zero-Latency)       |
        |  - Client Snapshot Reconciliation & Position Lerp     |
        +-------------------------------------------------------+
```

1. **Deterministic Physics Steps**:
   - Updates run in discrete `TICK_INTERVAL` steps (`1000 / 60` = 16.66ms).
   - Microsecond timing via `performance.now()` ensures physics calculations remain 100% deterministic regardless of host hardware or timer jitter.

2. **Optimized Native WebSocket Broadcasts**:
   - Snapshot payloads are stringified **once** per tick before iterating over open `ws` client instances (`readyState === 1`).
   - Eliminates redundant per-client JSON serialization overhead.

---

### 2.2 Client-Side Prediction with Server Reconciliation

1. **Client Prediction (Zero-Latency Local Feedback)**:
   - When a player triggers a flap input (`Spacebar`/`Click`), the client immediately applies local vertical impulse velocity (`velocity = -6.0`) and updates local physics.
   - The jump input is assigned an incremental sequence identifier (`seq`) and appended to a local pending input queue while simultaneously being transmitted to the server via WebSockets.

2. **Authoritative Server Physics Tick**:
   - The Node.js server maintains the canonical game state, executing a fixed-step physics loop (`60 Hz`).
   - The server processes client inputs, applies gravity (`0.4 px/frame^2`), increments forward world position (`x += velocity_x * speedMultiplier`), and evaluates bounding-box collision geometry against pipe obstacles.

3. **Server Reconciliation**:
   - Server snapshots are broadcast to clients at periodic network ticks.
   - Upon receiving a server state update, the client compares its predicted historical state against the authoritative server snapshot.
   - Unacknowledged inputs remaining in the queue are re-applied, eliminating visual stutter while enforcing anti-cheat authority.

---

### 2.3 Cooperative Network Synchronization: "Flappy Chained" Mode

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

---

### 2.4 Power-Ups & Item System

Flappy Race mode features 7 distinct item boxes with real-time effects:

| Item | Effect | Graphic Asset |
|---|---|---|
| **Ink Bucket** | Covers 1st place player's screen with ink overlay & bucket head | `bucket.png` / `inbucket.png` |
| **Curse (Slowness)** | Reduces target's forward speed by 35% for 6s | `Slowness_JE4.png` |
| **Shield Bubble** | Grants single-use protection against incoming attacks | `Absorption_JE3_BE3.png` |
| **Speed Boost** | Increases forward movement speed by 50% for 4s | `SpeedBoost.png` |
| **Position Swap** | Swaps positions with a random active opponent | `swap.png` |
| **Death Note** | Instantly respawns 1st place player back to last checkpoint | `DeathNote.webp` |
| **Ice Freeze** | Freezes target mid-air for 2.5s | `ice.png` |

---

## 3. Tech Stack

- **Frontend & Rendering Engine**: HTML5 Canvas API, Vanilla ES6+ JavaScript, CSS3 (CSS Grid/Flexbox, Pixel Art styling).
- **Backend Architecture**: Node.js runtime, Express.js web framework.
- **Real-Time Network Transport**: Native WebSockets (`ws` npm package).
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

---

## 5. Project Structure

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
│   │   ├── app.js             # Main WebSocket handlers and UI event bindings
│   │   ├── audio.js           # BGM / SFX audio controller
│   │   ├── physics.js         # Local client prediction physics loop
│   │   ├── renderer.js        # HTML5 Canvas renderer & parallax camera
│   │   └── ui.js              # HUD layout and UI modal management
│   └── index.html             # Application entry point and DOM screens
├── server/
│   ├── config/
│   │   └── constants.js       # Game physics, tick rates, and item constants
│   ├── game/
│   │   ├── gameLoop.js        # Authoritative 60 TPS high-precision fixed timestep loop
│   │   ├── lobbyManager.js    # Lobby room lifecycle & broadcast manager
│   │   └── mapGenerator.js    # Procedural map & pipe spacing generator
│   ├── models/
│   │   ├── Checkpoint.js      # Map checkpoint data model
│   │   ├── Leaderboard.js     # Results & post-match metrics engine
│   │   ├── Lobby.js           # Room state, migration & kick manager
│   │   ├── Map.js             # Map schema definition
│   │   ├── Mode.js            # Game mode definitions
│   │   └── Player.js          # Player domain entity model
│   ├── sockets/
│   │   └── socketHandler.js   # Native WebSocket event router & connection handler
│   └── server.js              # Express app & WebSocket server initialization
├── Dockerfile                 # Multi-stage production container setup
├── package.json               # Node.js dependencies and scripts
└── README.md                  # Project technical documentation
```

---

## 6. License & Evaluation

Developed for University Network Programming & Distributed Systems course evaluation. All rights reserved.
