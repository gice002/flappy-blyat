class LeaderboardEntry {
    constructor(leaderboard_id, player_id, lobby_id, finish_time, ranking, name, status_text = "") {
        this.leaderboard_id = leaderboard_id;
        this.player_id = player_id;
        this.lobby_id = lobby_id;
        this.finish_time = finish_time; // string formatted (e.g. "12.45s") or null
        this.ranking = ranking; // 1, 2, 3... or null if OUT
        this.name = name;
        this.status_text = status_text; // e.g. "FINISHED", "[ OUT ] CRASHED AT PIPE 14"
    }
}

module.exports = LeaderboardEntry;
