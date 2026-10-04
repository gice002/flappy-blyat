class Player {
    constructor(player_id, name, skin_ID = 0, hat_ID = 0) {
        this.player_id = player_id;
        this.checkpoint_id = null; // FK to Checkpoint
        this.name = name || `Bird_${player_id.substring(0, 4)}`;
        this.skin_ID = skin_ID;
        this.hat_ID = hat_ID;
        this.ready_status = false;

        // Runtime Physics & State
        this.x = 100;
        this.y = 320;
        this.velocityY = 0;
        this.last_processed_input = 0;
        this.is_finished = false;
        this.finish_time = null; // in seconds from match start
        this.last_pipe_passed = 0;
        this.is_alive = true;
        this.crashed_at_pipe = null;
        this.chain_index = 0;
        this.wipes_caused = 0; // Mode B Chained mode wipe tracker

        // Inventory & Power-Up System State
        this.heldItem = null;       // "ink" | "curse" | "shield" | null (Capacity: Max 1)
        this.hasShield = false;     // Buff: active barrier
        this.speedMultiplier = 1.0; // Debuff: 0.9 when cursed, 1.0 normal
        this.curseTimer = null;
    }

    resetForMatch(startX, startY, initialCheckpointId) {
        this.x = startX;
        this.y = startY;
        this.velocityY = 0;
        this.checkpoint_id = initialCheckpointId;
        this.last_processed_input = 0;
        this.is_finished = false;
        this.finish_time = null;
        this.last_pipe_passed = 0;
        this.is_alive = true;
        this.crashed_at_pipe = null;
        this.wipes_caused = 0;

        this.heldItem = null;
        this.hasShield = false;
        this.speedMultiplier = 1.0;
        if (this.curseTimer) clearTimeout(this.curseTimer);
        this.curseTimer = null;
    }
}

module.exports = Player;
