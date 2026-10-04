const MapData = require("../models/Map");
const Checkpoint = require("../models/Checkpoint");
const {
    DEFAULT_THEME,
    SUBSEQUENT_THEMES,
    PIPE_WIDTH,
    PIPE_HEIGHT,
    GROUND_Y,
    PIPE_SPACING_X,
    START_X,
    MIN_GAP,
    MAX_GAP
} = require("../config/constants");

function generateMapsAndCheckpoints(amountOfMaps, lobbyId, modeId = "flappy_race") {
    const maps = [];
    const checkpoints = new Map();
    const itemBoxes = [];

    const pipeWidth = PIPE_WIDTH;
    const pipeHeight = PIPE_HEIGHT;
    const groundY = GROUND_Y;

    // BALANCED GAMEPLAY PARAMETERS
    const pipeSpacingX = PIPE_SPACING_X;
    const startX = START_X;

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

        // 1. Map Theme Randomization: Map 1 MUST be default "classic_day", subsequent maps are random from pool
        let themeId = DEFAULT_THEME;
        if (m > 1) {
            const randomIndex = Math.floor(Math.random() * SUBSEQUENT_THEMES.length);
            themeId = SUBSEQUENT_THEMES[randomIndex];
        }

        const checkpointId = `chk_${lobbyId}_${m}`;
        const mapSpawnX = (m === 1) ? 100 : (currentX - pipeSpacingX + 100);
        const mapSpawnY = 320;

        for (let i = 1; i <= 10; i++) {
            pipeIndexCounter++;

            if (i === 10) {
                // 10th pipe slot is REPLACED by a dedicated Checkpoint Zone (no pipe obstacle)
                const respawnX = currentX + Math.floor(pipeSpacingX / 2);
                const respawnY = 320;

                // Pre-Checkpoint Item Column
                if (modeId !== "flappy_chained") {
                    const preChkItemX = respawnX - 140;
                    for (let boxIdx = 0; boxIdx < 6; boxIdx++) {
                        const boxY = 160 + (boxIdx * 40);

                        itemXList.push(preChkItemX);
                        itemYList.push(boxY);

                        itemBoxes.push({
                            id: `item_${lobbyId}_chk_pre_${m}_${boxIdx}`,
                            x: preChkItemX,
                            y: boxY,
                            width: 32,
                            height: 32,
                            collected: false,
                            isActive: true,
                            collectedBy: null
                        });
                    }
                }

                const checkpointObj = new Checkpoint(
                    checkpointId,
                    mapId,
                    respawnX,
                    respawnY,
                    pipeIndexCounter
                );
                checkpoints.set(checkpointId, checkpointObj);

                // Expand Checkpoint Zone spacing to PIPE_SPACING_X * 2 (760px)
                currentX += pipeSpacingX * 2;
                continue;
            }

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
            if (modeId !== "flappy_chained" && (i === 2 || i === 4 || i === 7 || i === 9)) {
                const itemX = currentX + Math.floor(pipeSpacingX / 2);
                const centerGapY = topY + pipeHeight + Math.floor(gapSize / 2);

                for (let boxIdx = 0; boxIdx < 6; boxIdx++) {
                    const boxY = centerGapY - 100 + (boxIdx * 40);

                    itemXList.push(itemX);
                    itemYList.push(boxY);

                    itemBoxes.push({
                        id: `item_${lobbyId}_${pipeIndexCounter}_${boxIdx}`,
                        x: itemX,
                        y: boxY,
                        width: 32,
                        height: 32,
                        collected: false,
                        isActive: true,
                        collectedBy: null
                    });
                }
            }

            currentX += pipeSpacingX;
        }

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

    const lastMapPipes = maps[maps.length - 1].pipes;
    const lastPipe = lastMapPipes[lastMapPipes.length - 1];
    const finishLineX = lastPipe ? (lastPipe.x + pipeWidth + 380) : currentX;

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
