const MapData = require("../models/Map");
const Checkpoint = require("../models/Checkpoint");

const THEMES = [
    "classic_day",
    "underwater",
    "volcano",
    "snowy",
    "candyland",
    "desert"
];

function generateMapsAndCheckpoints(amountOfMaps, lobbyId) {
    const maps = [];
    const checkpoints = new Map();
    const itemBoxes = [];

    const pipeWidth = 64;
    const pipeHeight = 512;
    const boardHeight = 640;
    const groundY = 616;

    // BALANCED GAMEPLAY PARAMETERS
    // Increased horizontal distance between pipes (from 250px to 380px) for forgiving item gameplay
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

        // Pick theme from registered themes
        const themeId = THEMES[(m - 1) % THEMES.length];

        const mapSpawnX = (m === 1) ? 100 : (currentX - pipeSpacingX + 100);
        const mapSpawnY = 320;

        for (let i = 1; i <= 10; i++) {
            pipeIndexCounter++;

            // Dynamic Y-Axis Gap Randomization per pipe
            const gapSize = Math.floor(Math.random() * (MAX_GAP - MIN_GAP + 1)) + MIN_GAP;

            // Calculate safe top pipe Y position
            // Min top pipe visible height: 60px, Max top pipe visible height: boardHeight - gapSize - 60px
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

            // Add item boxes in spacious gap between pipes (e.g. pipe 3, 5, 8 of each map)
            if (i === 3 || i === 5 || i === 8) {
                const itemX = currentX + Math.floor(pipeSpacingX / 2);
                const itemY = topY + pipeHeight + Math.floor(gapSize / 2) - 16;
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
