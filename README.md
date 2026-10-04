# 🐦 Flappy Bird Online - Real-Time Multiplayer Network Game

A real-time multiplayer HTML5 Canvas game built with **Node.js**, **Express.js**, and **Socket.IO**. Refactored from the original single-player mechanics into a high-performance, netcoded multiplayer game using a **Client-Predicted with Server Reconciliation** network model.

---

## 🌟 Key Features

* **⚡ Zero-Latency Client Prediction & Server Reconciliation**: Instant jump simulation at 60 FPS on the client for smooth input response, while the authoritative server validates physics, detects collisions, and reconciles state discrepancies.
* **🎥 Static World with Moving Camera**: Engine redesigned from static bird/moving pipes to a static world coordinate system where birds move forward and the camera tracks the local player's bird.
* **🏁 Map & Checkpoint System**: Supports 1, 3, or 5 maps (10 pipes per map). Features checkpoints placed strictly every 10 pipes with instant respawn upon obstacle collision.
* **🎮 2 Game Modes**:
  * **Flappy Race (Default)**: Race against other players to reach the finish line. Positions are ranked purely by finish time. Includes item box collision placeholders.
  * **Flappy Chained**: 4-player coop mode where birds are connected by a visual chain. Features **Shared Death** — if any single bird hits an obstacle, all birds wipe out and respawn together.
* **🎨 Networked Customization**: Choose custom bird skin colors and hats (Crown, Top Hat, Red Cap, Viking Helmet) visible to all connected players.
* **🏆 Live Match Flow & Leaderboard**: First player to cross the finish line triggers a global 10-second countdown. Finished players are ranked by time, while DNF players display detailed `[ OUT ] CRASHED AT PIPE X` status text.
* **🔊 Audio & Video Settings**: Local client volume sliders for BGM (`bgm_mario.mp3`) and SFX (`wing`, `hit`, `die`, `point`), plus an optional 60 FPS lock toggle.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5 Canvas, Vanilla JavaScript (ES6+), CSS3.
* **Backend & Networking**: Node.js, Express.js, Socket.IO.
* **Assets**: Retro pixel art sprites and classic 8-bit sound effects.

---

## 📁 Project Structure

```text
flappy-bird/
├── client/
│   ├── assets/          # Images (birds, pipes, background) and Audio (BGM, SFX)
│   ├── css/
│   │   └── style.css    # Retro UI styles and canvas layout
│   ├── js/
│   │   ├── app.js       # Client network app controller & UI screen management
│   │   ├── audio.js     # BGM and SFX audio manager
│   │   ├── physics.js   # Client prediction & server reconciliation physics engine
│   │   └── renderer.js  # Canvas renderer with moving camera & visual effects
│   └── index.html       # Single Page Application HTML structure
├── server/
│   ├── game/
│   │   ├── gameLoop.js    # Authoritative 60 FPS server game loop & collision engine
│   │   ├── lobbyManager.js# Socket.IO lobby state & room management
│   │   └── mapGenerator.js# Dynamic map, pipe, checkpoint, and item box generator
│   ├── models/            # Entity models (Player, Lobby, Mode, Map, Checkpoint, Leaderboard)
│   └── server.js          # Express server and Socket.IO entry point
├── Dockerfile             # Production containerization build setup
├── .dockerignore          # Docker build exclusion rules
├── .env.example           # Environment variables template
├── package.json           # Dependencies and npm scripts
└── README.md              # Documentation
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v16+ recommended) installed on your machine.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ImKennyYip/flappy-bird.git
   cd flappy-bird
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

### Running the Server

Start the Node.js server:

```bash
npm start
```

Or run directly with Node:

```bash
node server/server.js
```

You should see output similar to:
```text
====================================================
 Flappy Bird Multiplayer Server running on port 3000
 Environment: development
 Open http://localhost:3000 in your browser.
====================================================
```

> **Note**: If port `3000` is already in use by another application, the server will automatically detect it and bind to `3001` or the next available port.

---

## ☁️ Production Deployment & Cloud Hosting

This repository is pre-configured for cloud PaaS hosting (Render, Railway, Fly.io, Heroku, DigitalOcean) and containerized deployment via Docker.

### Key Production Configurations

* **WSS & Reverse Proxy**: Configured with `app.set('trust proxy', 1)` and Socket.IO WebSocket transport fallbacks required for cloud SSL reverse proxies.
* **Environment Variables**: Managed via `.env` file with graceful fallbacks if `PORT` is not defined:
  ```env
  PORT=3000
  NODE_ENV=production
  CORS_ORIGIN=*
  ```
* **Health Check Endpoint**: Includes `/health` route returning HTTP 200 for cloud container readiness probes.

### Deploying via Docker

1. **Build Docker image**:
   ```bash
   docker build -t flappy-bird-online .
   ```

2. **Run Docker container**:
   ```bash
   docker run -p 3000:3000 --env-file .env flappy-bird-online
   ```

---

## 🎮 How to Play

1. Open your browser and navigate to `http://localhost:3000`.
2. **Set your Name & Customization**: Choose a player name, select a bird color skin, and equip a hat.
3. **Create or Join a Room**:
   * Click **CREATE ROOM** to host a new lobby and copy your 6-character room code.
   * Or click **JOIN ROOM** and enter an existing room code.
4. **Lobby Setup**:
   * **Host Controls**: Choose the Game Mode (*Flappy Race* or *Flappy Chained*) and Map Amount (*1 Map*, *3 Maps*, or *5 Maps*).
   * **Ready System**: Minimum of 2 players required. All players must click **TOGGLE READY** before the Host can start the match.
5. **Gameplay Controls**:
   * **Jump**: `Spacebar`, `Up Arrow`, `X Key`, `Left Mouse Click`, or `Mobile Touch`.
6. **Goal**:
   * Clear pipes, trigger checkpoints every 10 pipes, and reach the finish goal at the end of the final map!

---

## 🧪 Multiplayer Testing (Local)

To test multiplayer locally on a single machine:
1. Open `http://localhost:3000` in **Tab 1** -> Click **CREATE ROOM**.
2. Copy the room code displayed in the lobby.
3. Open `http://localhost:3000` in an **Incognito / Private Window** (or second browser window) -> Click **JOIN ROOM** -> Paste the code.
4. Toggle **READY** on both clients and click **START MATCH** on the host client!

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
