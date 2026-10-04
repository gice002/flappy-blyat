class LeaderboardEntry {
    constructor(leaderboard_id, player_id, lobby_id, finish_time, ranking, name, status_text = "", wipes_caused = 0, skin_ID = 0, hat_ID = 0) {
        this.leaderboard_id = leaderboard_id;
        this.player_id = player_id;
        this.lobby_id = lobby_id;
        this.finish_time = finish_time; // string formatted (e.g. "12.45s") or null
        this.ranking = ranking; // 1, 2, 3... or null if OUT
        this.name = name;
        this.status_text = status_text; // e.g. "FINISHED", "[ OUT ] CRASHED AT PIPE 14"
        this.wipes_caused = wipes_caused;
        this.skin_ID = skin_ID;
        this.hat_ID = hat_ID;
    }
}

module.exports = LeaderboardEntry;
