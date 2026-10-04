class Mode {
    constructor(mode_id, mode_name) {
        this.mode_id = mode_id;
        this.mode_name = mode_name;
    }
}

const MODES = {
    FLAPPY_RACE: new Mode("flappy_race", "Flappy Race"),
    FLAPPY_CHAINED: new Mode("flappy_chained", "Flappy Chained")
};

module.exports = { Mode, MODES };
