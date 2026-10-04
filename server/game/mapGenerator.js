const MapData = require("../models/Map");
const Checkpoint = require("../models/Checkpoint");

const DEFAULT_THEME = "classic_day";
const SUBSEQUENT_THEMES = [
    "underwater",
    "volcano",
    "snowy",
    "candyland",
    "desert",
    "city_night",
    "city_dusk"
];

function generateMapsAndCheckpoints(amountOfMaps, lobbyId, modeId = "flappy_race") {
    const maps = [];
    const checkpoints = new Map();
    const itemBoxes = [];

    const pipeWidth = 64;
    const pipeHeight = 512;
    const groundY = 616;

    // BALANCED GAMEPLAY PARAMETERS
    const pipeSpacingX = 380;
    const startX = 600;

    // Randomized Vertical Opening Gap range (Min 160px, Max 240px)
    const MIN_GAP = 160;
    const MAX_GAP = 240;

    let pipeIndexCounter = 0;
    let currentX = startX;

    // Initial starting checkpoint 0
    const startCheckpointId = `chk_${lobbyId}_0`;
    checkpoints.set(startCheckpointId, new Checkpoint(
        startCheckpointId,
        `map_${lobbyId}_1`,
        100,
        320,
        0
    ));

    for (let m = 1; m <= amountOfMaps; m++) {
        const mapId = `map_${lobbyId}_${m}`;
        const isFinalMap = (m === amountOfMaps);
        const mapPipes = [];
        const itemXList = [];
        const itemYList = [];

        // 1. Map Theme Randomization: Map 1 MUST be default classic_day, subsequent maps are random from pool
        let themeId = DEFAULT_THEME;
        if (m > 1) {
            const randomIndex = Math.floor(Math.random() * SUBSEQUENT_THEMES.length);
            themeId = SUBSEQUENT_THEMES[randomIndex];
        }

        const mapSpawnX = (m === 1) ? 100 : (currentX - pipeSpacingX + 100);
        const mapSpawnY = 320;

        for (let i = 1; i <= 10; i++) {
            pipeIndexCounter++;

            // Dynamic Y-Axis Gap Randomization per pipe
            const gapSize = Math.floor(Math.random() * (MAX_GAP - MIN_GAP + 1)) + MIN_GAP;

            // Calculate safe top pipe Y position
            const maxVisibleTopHeight = groundY - gapSize - 60;
            const minVisibleTopHeight = 60;
            const visibleTopHeight = Math.floor(Math.random() * (maxVisibleTopHeight - minVisibleTopHeight + 1)) + minVisibleTopHeight;

            const topY = visibleTopHeight - pipeHeight;
            const bottomY = topY + pipeHeight + gapSize;

            mapPipes.push({
                pipeIndex: pipeIndexCounter,
                mapSequence: m,
                theme_id: themeId,
                x: currentX,
                width: pipeWidth,
                height: pipeHeight,
                topY: topY,
                bottomY: bottomY,
                topHeight: pipeHeight,
                bottomHeight: pipeHeight,
                gapSize: gapSize
            });

            // 2. Item Spawning: Items MUST ONLY spawn in "flappy_race" mode
            if (modeId !== "flappy_chained" && (i === 3 || i === 5 || i === 8)) {
                const itemX = currentX + Math.floor(pipeSpacingX / 2);

                // Risk/Reward Placement: Offset Y position to top/bottom pipe edges away from safe center
                const isTopRisk = Math.random() < 0.5;
                const itemY = isTopRisk 
                    ? (topY + pipeHeight + 20)      // Near top pipe rim (risk)
                    : (bottomY - 32 - 20);           // Near bottom pipe rim (risk)

                itemXList.push(itemX);
                itemYList.push(itemY);

                itemBoxes.push({
                    id: `item_${lobbyId}_${pipeIndexCounter}`,
                    x: itemX,
                    y: itemY,
                    width: 32,
                    height: 32,
                    collected: false,
                    collectedBy: null
                });
            }

            currentX += pipeSpacingX;
        }

        const checkpointId = `chk_${lobbyId}_${m}`;
        const respawnX = mapPipes[mapPipes.length - 1].x + pipeWidth + 40;
        const respawnY = 320;

        const checkpointObj = new Checkpoint(
            checkpointId,
            mapId,
            respawnX,
            respawnY,
            pipeIndexCounter
        );
        checkpoints.set(checkpointId, checkpointObj);

        const mapObj = new MapData(
            mapId,
            checkpointId,
            `Map ${m}`,
            m,
            isFinalMap,
            mapSpawnX,
            mapSpawnY,
            itemXList,
            itemYList,
            mapPipes,
            themeId
        );

        maps.push(mapObj);
    }

    const lastPipe = maps[maps.length - 1].pipes[9];
    const finishLineX = lastPipe.x + pipeWidth + 20;

    return {
        maps,
        checkpoints,
        itemBoxes,
        startCheckpointId,
        finishLineX,
        totalPipes: amountOfMaps * 10
    };
}

module.exports = { generateMapsAndCheckpoints };
