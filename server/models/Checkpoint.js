class Checkpoint {
    constructor(checkpoint_id, map_id, respawn_coordinate_x, respawn_coordinate_y, pipe_index = 0) {
        this.checkpoint_id = checkpoint_id;
        this.map_id = map_id;
        this.respawn_coordinate_x = respawn_coordinate_x;
        this.respawn_coordinate_y = respawn_coordinate_y;
        this.pipe_index = pipe_index;
    }
}

module.exports = Checkpoint;
