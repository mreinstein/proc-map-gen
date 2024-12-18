import * as CaveBuilder from './index.js'
import fs               from 'node:fs'
import { PNG }          from 'pngjs'


async function main () {
	const c = CaveBuilder.init()
	CaveBuilder.build(c)
	writePNG('cave_0.png', c)

	colorCaves(c)

	CaveBuilder.connectCaves(c)
	writePNG('cave_connected.png', c)
}


function writePNG (filename, c) {
    const dst = new PNG({ width: c.MapSize[0], height: c.MapSize[1], filterType: 0, bgColor: { red: 255, green: 0, blue: 0, alpha: 255 } })

    for (let cellIndex = 0; cellIndex < c.MapSize[0] * c.MapSize[1]; cellIndex++) {

        const col = cellIndex % c.MapSize[0]
        const row = Math.floor(cellIndex / c.MapSize[0])
        const k = `${col},${row}`

        const v = c.Map[k]
        const color = (v === 1) ? 255 : 0

        dst.data[cellIndex * 4] = color      // r channel
        dst.data[cellIndex * 4 + 1] = color  // g channel
        dst.data[cellIndex * 4 + 2] = color  // b channel
        dst.data[cellIndex * 4 + 3] = 255     // a channel
    }

    const buffer = PNG.sync.write(dst)
    fs.writeFileSync(filename, buffer)
}


function colorCaves (c) {
    const colors = generateDistinctColors(c.Caves.length)
    
    const dst = new PNG({ width: c.MapSize[0], height: c.MapSize[1], filterType: 0, bgColor: { red: 255, green: 0, blue: 0, alpha: 255 } })

    const findCaveIndexForCell = function (col, row) {
        const cell = [ col, row ]

        for (let i=0; i < c.Caves.length; i++) {
            if (CaveContainsCell(c.Caves[i], cell))
                return i
        }

        return -1
    }

    for (let cellIndex = 0; cellIndex < c.MapSize[0] * c.MapSize[1]; cellIndex++) {

        const col = cellIndex % c.MapSize[0]
        const row = Math.floor(cellIndex / c.MapSize[0])

        const caveIdx = findCaveIndexForCell(col, row)

        if (caveIdx >= 0) {
            dst.data[cellIndex * 4] = colors[caveIdx].r      // r channel
            dst.data[cellIndex * 4 + 1] = colors[caveIdx].g  // g channel
            dst.data[cellIndex * 4 + 2] = colors[caveIdx].b  // b channel

        } else {
            const color = (c.Map[`${col},${row}`] === 1) ? 255 : 0

            dst.data[cellIndex * 4] = color      // r channel
            dst.data[cellIndex * 4 + 1] = color  // g channel
            dst.data[cellIndex * 4 + 2] = color  // b channel
        }

        dst.data[cellIndex * 4 + 3] = 255     // a channel

    }

    const buffer = PNG.sync.write(dst)
    fs.writeFileSync('cave_colored.png', buffer)
}


// returns true if the cave includes a given cell
function CaveContainsCell (pCave, p) {
    return !!pCave.find((caveCell) => caveCell[0] === p[0] && caveCell[1] === p[1])
}


/**
 * Generates an array of distinguishable random RGB colors.
 * @param {number} numColors - The number of colors to generate.
 * @returns {Array<string>} - An array of RGB strings like "rgb(255, 0, 0)".
 */
function generateDistinctColors (numColors) {
    const colors = [ ];
    const step = Math.floor(360 / numColors); // Divide the hue range evenly.

    for (let i = 0; i < numColors; i++) {
        // Use evenly spaced hues, fixed saturation and lightness for contrast.
        const h = (i * step) % 360; // Hue
        const s = 70 + Math.random() * 10; // Saturation: 70-80%
        const l = 50; // Lightness: 50% for good contrast
        const rgb = hslToRgb(h, s / 100, l / 100);
        colors.push(rgb);
    }

    return colors;
}


/**
 * Converts HSL color to RGB.
 * @param {number} h - Hue (0-360).
 * @param {number} s - Saturation (0-1).
 * @param {number} l - Lightness (0-1).
 * @returns {Object} - An object with r, g, b values (0-255).
 */
function hslToRgb (h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s; // Chroma
    const x = c * (1 - Math.abs((h / 60) % 2 - 1)); // Secondary color
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
    };
}


main()
