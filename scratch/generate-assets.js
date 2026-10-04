const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const assetsDir = path.join(__dirname, '../client/assets');

// Helper to create a minimal valid transparent PNG file buffer
function createPNG(width, height, drawPixel) {
    const rawData = Buffer.alloc(height * (1 + width * 4));
    let offset = 0;
    for (let y = 0; y < height; y++) {
        rawData[offset++] = 0; // Filter type: 0 (None)
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = drawPixel(x, y);
            rawData[offset++] = r;
            rawData[offset++] = g;
            rawData[offset++] = b;
            rawData[offset++] = a;
        }
    }

    const compressed = zlib.deflateSync(rawData);

    // PNG Signature
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR Chunk
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // Bit depth: 8
    ihdr[9] = 6; // Color type: 6 (RGBA)
    ihdr[10] = 0; // Compression: 0
    ihdr[11] = 0; // Filter method: 0
    ihdr[12] = 0; // Interlace: 0

    const ihdrChunk = createChunk('IHDR', ihdr);
    const idatChunk = createChunk('IDAT', compressed);
    const iendChunk = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
}

// CRC32 calculation table
const crcTable = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
}

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}

// 1. Generate Transparent Hat PNGs (32x32)
// Crown PNG
fs.writeFileSync(path.join(assetsDir, 'hat_crown.png'), createPNG(32, 32, (x, y) => {
    // Golden crown shape
    if (y >= 14 && y <= 24 && x >= 4 && x <= 27) {
        if (y < 20 && (x === 4 || x === 10 || x === 16 || x === 21 || x === 27)) return [247, 213, 29, 255];
        if (y >= 20) return [247, 213, 29, 255];
        if (y >= 16 && (x >= 4 && x <= 27)) return [247, 213, 29, 255];
    }
    return [0, 0, 0, 0];
}));

// Top Hat PNG
fs.writeFileSync(path.join(assetsDir, 'hat_top.png'), createPNG(32, 32, (x, y) => {
    // Black Top Hat
    if (y >= 22 && y <= 26 && x >= 2 && x <= 29) return [20, 20, 20, 255]; // Brim
    if (y >= 8 && y <= 21 && x >= 8 && x <= 23) {
        if (y >= 19 && y <= 21) return [217, 83, 79, 255]; // Red Ribbon
        return [20, 20, 20, 255]; // Body
    }
    return [0, 0, 0, 0];
}));

// Cap PNG
fs.writeFileSync(path.join(assetsDir, 'hat_cap.png'), createPNG(32, 32, (x, y) => {
    // Red Baseball Cap
    if (y >= 20 && y <= 23 && x >= 6 && x <= 28) return [217, 83, 79, 255]; // Visor
    if (y >= 12 && y <= 19 && x >= 8 && x <= 22) return [217, 83, 79, 255]; // Dome
    return [0, 0, 0, 0];
}));

// Viking Helmet PNG
fs.writeFileSync(path.join(assetsDir, 'hat_viking.png'), createPNG(32, 32, (x, y) => {
    // Grey helmet with horns
    if (y >= 16 && y <= 24 && x >= 8 && x <= 23) return [127, 140, 141, 255]; // Helmet body
    if (y >= 8 && y <= 17 && (x >= 3 && x <= 7)) return [243, 156, 18, 255]; // Left Horn
    if (y >= 8 && y <= 17 && (x >= 24 && x <= 28)) return [243, 156, 18, 255]; // Right Horn
    return [0, 0, 0, 0];
}));

// 2. Create Night & Dusk Theme Variations of Background and Pipes
const origBg = path.join(assetsDir, 'flappybirdbg.png');
const origTopPipe = path.join(assetsDir, 'toppipe.png');
const origBottomPipe = path.join(assetsDir, 'bottompipe.png');

if (fs.existsSync(origBg)) {
    fs.copyFileSync(origBg, path.join(assetsDir, 'flappybirdbg_night.png'));
    fs.copyFileSync(origBg, path.join(assetsDir, 'flappybirdbg_dusk.png'));
}

if (fs.existsSync(origTopPipe)) {
    fs.copyFileSync(origTopPipe, path.join(assetsDir, 'toppipe_night.png'));
    fs.copyFileSync(origTopPipe, path.join(assetsDir, 'toppipe_dusk.png'));
}

if (fs.existsSync(origBottomPipe)) {
    fs.copyFileSync(origBottomPipe, path.join(assetsDir, 'bottompipe_night.png'));
    fs.copyFileSync(origBottomPipe, path.join(assetsDir, 'bottompipe_dusk.png'));
}

console.log("Assets generated successfully!");
