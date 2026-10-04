const MapData = require("../models/Map");
const Checkpoint = require("../models/Checkpoint");

const THEMES = ["classic_day", "retro_night", "desert_dusk"];

function generateMapsAndCheckpoints(amountOfMaps, lobbyId) {
    const maps = [];
    const checkpoints = new Map();
    const itemBoxes = [];

    const pipeWidth = 64;
    const pipeHeight = 512;
    const openingSpace = 160;
    const pipeSpacingX = 250;
    const startX = 500;

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

        // Assign theme sequence based on map sequence
        const themeId = THEMES[(m - 1) % THEMES.length];

        const mapSpawnX = (m === 1) ? 100 : (currentX - pipeSpacingX + 100);
        const mapSpawnY = 320;

        for (let i = 1; i <= 10; i++) {
            pipeIndexCounter++;
            const randomPipeTopY = -200 - Math.floor(Math.random() * 180);
            const topY = randomPipeTopY;
            const bottomY = randomPipeTopY + pipeHeight + openingSpace;

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
                bottomHeight: pipeHeight
            });

            if (i === 3 || i === 7) {
                const itemX = currentX + Math.floor(pipeSpacingX / 2);
                const itemY = topY + pipeHeight + Math.floor(openingSpace / 2) - 16;
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
