class MapData {
    constructor(map_id, checkpoint_id, map_name, map_sequence, is_final_map, spawn_coordinate_x, spawn_coordinate_y, item_spawn_cords_x, item_spawn_cords_y, pipes = [], theme_id = "classic_day") {
        this.map_id = map_id;
        this.checkpoint_id = checkpoint_id;
        this.map_name = map_name;
        this.map_sequence = map_sequence;
        this.is_final_map = is_final_map;
        this.spawn_coordinate_x = spawn_coordinate_x;
        this.spawn_coordinate_y = spawn_coordinate_y;
        this.item_spawn_cords_x = item_spawn_cords_x; // array of X coordinates for item boxes
        this.item_spawn_cords_y = item_spawn_cords_y; // array of Y coordinates for item boxes
        this.pipes = pipes; // list of pipe pairs
        this.theme_id = theme_id; // theme configuration identifier
    }
}

module.exports = MapData;
