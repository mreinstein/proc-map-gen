import Alea from 'alea'
import * as Random from '@footgun/random-gap'
import fs          from 'node:fs'
import { PNG }     from 'pngjs'


const seed = Math.random() //'0.6904424447426776' //Math.random()
const rng = new Alea(seed)
console.log('seed:', seed)

// TODO: interactive cave building (web page)


// https://web.archive.org/web/20211024235813/http://www.evilscience.co.uk/a-c-algorithm-to-build-roguelike-cave-systems-part-1/
// https://web.archive.org/web/20190829183859/http://www.evilscience.co.uk/an-algorithm-to-build-roguelike-cave-systems-part-2/

// Generic list of points which contain 4 directions      
const Directions = [
    [ 0, -1 ],    //north
    [ 0, 1 ],    //south
    [ 1, 0 ],   //east
    [ -1, 0 ],  //west
]

const Directions1 = [
    [ 0, -1 ],  //north
    [ 0, 1 ],   //south
    [ 1, 0 ],   //east
    [ -1, 0 ],  //west
    [ 1, -1 ],  //northeast
    [ -1, -1 ], //northwest
    [ -1, 1 ],  //southwest
    [ 1, 1 ],   //southeast
    [ 0, 0 ],   //centre
]


export function init (opts={}) {
	//rnd = new Random(12345)

	return {
		// cave generation
		// The number of closed neighbours a cell must have in order to invert it's state
		Neighbours: 4,

		// The number of times to visit cells
	    Iterations: 50000,

	    // The probability of closing a visited cell
	    // 55 tends to produce 1 cave, 40 few and small caves
	    CloseCellProb: 45,

	    // Remove rooms smaller than this value
	    LowerLimit: 16,

	    // Remove rooms larger than this value
	    UpperLimit: 500,

	    // The size of the map [ width (columns), height (rows) ]
		MapSize: [ 100, 100 ],


		// cave cleaning
		// Removes single cells from cave edges: a cell with this number of empty neighbours is removed (smoothing)
		EmptyNeighbours: 3,
		// Fills in holes within caves: an open cell with this number closed neighbours is filled ( filling)
    	EmptyCellNeighbours: 4,


    	// corridor
    	// 
		CorridorSpace: 2,        // The distance a corridor has to be away from a closed cell for it to be built
    	Corridor_MaxTurns: 10,   // Maximum turns
		Corridor_Min: 2,         // Minimum corridor length
    	Corridor_Max: 5,         // Maximum corridor length
		BreakOut: 100000,        // When this value is exceeded, stop attempting to connect caves. Prevents the algorithm from getting stuck.


		Caves: [ ],     // Caves within the map are stored here
		Corridors: [ ], // Corridors within the map stored here
		Map: { },       // contains the map. key is `x,y` value is cell value
	}
}


// build caves, smooth them off and fill in any holes
export function build (c) {
	BuildCaves(c)
	GetCaves(c)
	return c.Caves.length
}


function BuildCaves (c) {
	const { MapSize, Neighbours, CloseCellProb, Iterations, EmptyNeighbours, EmptyCellNeighbours } = c

	const [ width, height ] = MapSize

	//c.Map = new Array(c.MapSize[0] * c.MapSize[1])

    // go through each map cell and randomly determine whether to close it
    // the +5 offsets are to leave an empty border round the edge of the map
    for (let x = 0; x < width; x++)
        for (let y = 0; y < height; y++)
            if (Random.int(0, 99, rng) < CloseCellProb)
                c.Map[`${x},${y}`] = 1

    writePNG('cave_0.png', c)

    let cell

    // pick cells at random
    for (let x = 0; x <= Iterations; x++) {
        cell = [ Random.int(0, width-1, rng), Random.int(0, height-1, rng) ]

        // if the randomly selected cell has more closed neighbours than the property Neighbours
        // set it closed, else open it
        const closedCells = Neighbours_Get1(MapSize, cell).filter((n) => Point_Get(c, n) === 1)
                                                          .length

        //if (Neighbours_Get1(MapSize, cell).Where(n => Point_Get(c, n) == 1).Count() > Neighbours)
        if (closedCells > Neighbours)
            Point_Set(c, cell, 1)
        else
            Point_Set(c, cell, 0)
    }

    writePNG('cave_1.png', c)


    //  Smooth off the rough cave edges and any single blocks by making several 
    //  passes on the map and removing any cells with 3 or more empty neighbours
    for (let ctr = 0; ctr < 5; ctr++) {
        // examine each cell individually
        for (let x = 0; x < width; x++)
            for (let y = 0; y < height; y++) {
                cell = [ x, y ]

                if (Point_Get(c, cell) > 0)
                	//if (Neighbours_Get(MapSize, cell).Where(n => Point_Get(c, n) == 0).Count() >= EmptyNeighbours)
                	if (Neighbours_Get(MapSize, cell).filter((n) => Point_Get(c, n) === 0).length >= EmptyNeighbours)
                		Point_Set(c, cell, 0)
            }
    }

    writePNG('cave_2.png', c)

    //  fill in any empty cells that have 4 full neighbours
    //  to get rid of any holes in an cave
    for (let x = 0; x < width; x++)
        for (let y = 0; y < height; y++) {
            cell = [ x, y ]

            if (Point_Get(c, cell) === 0)
            	//if (Neighbours_Get(MapSize, cell).Where(n => Point_Get(c, n) == 1).Count() >= EmptyCellNeighbours)
            	if (Neighbours_Get(MapSize, cell).filter((n) => Point_Get(c, n) === 1).length >= EmptyCellNeighbours)
            		Point_Set(c, cell, 1)
        }

    writePNG('cave_3.png', c)
}


// Locate all the caves within the map and place each one into the generic list Caves
function GetCaves (c) {
	const { MapSize, Caves, LowerLimit, UpperLimit } = c
	const [ width, height ] = MapSize

    Caves.length = 0

    let cell

    // examine each cell in the map...
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            cell = [ x, y ]

            // if the cell is closed, and that cell doesn't occur in the list of caves..
            if (Point_Get(c, cell) > 0 && !Caves.find((s) => CaveContainsCell(s, cell))) {
            //if (Point_Get(c, cell) > 0 && Caves.Count(s => s.Contains(cell)) == 0) {
            
                const Cave = [ ]

                // launch the recursive
                LocateCave(c, cell, Cave)

                // check that cave falls with the specified size range...
                if (Cave.length <= LowerLimit || Cave.length > UpperLimit) {
                    // it does, so bin it
                    for (const p of Cave)
                        Point_Set(c, p, 0)
                }
                else {
                    Caves.push(Cave)
                }
            }
        }
    }

    writePNG('cave_4.png', c)
}


// returns true if the cave includes a given cell
function CaveContainsCell (pCave, p) {
    return !!pCave.find((caveCell) => caveCell[0] === p[0] && caveCell[1] === p[1])
}


/// Recursive method to locate the cells comprising a cave, 
/// based on flood fill algorithm
/// <param name="pCell">Cell being examined</param>
/// <param name="pCave">List containing all the cells in the cave</param>
function LocateCave (c, pCell, pCave) {

    for (const p of Neighbours_Get(c.MapSize, pCell)) {
        if (Point_Get(c, p) > 0 && !CaveContainsCell(pCave, p)) {
            //pCave.push(p)
            pCave.push([ p[0], p[1] ]) // make a copy of the cell
            LocateCave(c, p, pCave) 
        }
    }

    /*
    foreach (Point p in Neighbours_Get(MapSize, pCell).Where(n => Point_Get(n) > 0)) {
        if (!pCave.Contains(p)) {
            pCave.Add(p)
            LocateCave(c, p, pCave)
        }
    }
    */
}


// return a list of the valid neighbouring cells of the provided point
// using north, south, east, west
function Neighbours_Get (MapSize, p)
{
	return Directions.map((d) => [ p[0] + d[0], p[1] + d[1] ])
	                 .filter((tmp) => Point_Check(MapSize, tmp))
	/*
    return Directions.Select(d => new Point(p.X + d.X, p.Y + d.Y))
            .Where(d => Point_Check(d)).ToList()
    */
}


// return a list of the valid neighbouring cells of the provided point
// using north, south, east, west, ne, nw, se, sw
function Neighbours_Get1 (MapSize, p)
{
	return Directions1.map((d) => [ p[0] + d[0], p[1] + d[1] ])
	                  .filter((tmp) => Point_Check(MapSize, tmp))

	/*
    return Directions1.Select(d => [ p.X + d.X, p.Y + d.Y ])
                      .Where(d => Point_Check(MapSize, d))
                      .ToList()
    */
}


// cell related functions

// Check if the provided point is valid
// @param Point p to check
function Point_Check (MapSize, p) {
	const [ width, height ] = MapSize
    return p[0] >= 0 & p[0] < width & p[1] >= 0 & p[1] < height
}


// Set the map cell to the specified value
// <param name="p"></param>
// <param name="val"></param>
function Point_Set (c, p, val) {
    c.Map[`${p[0]},${p[1]}`] = val
}


// Get the value of the provided point
// <param name="p"></param>
// <returns></returns>
function Point_Get (c, p) {
    return c.Map[`${p[0]},${p[1]}`] || 0
}


const c = init()
build(c)
colorCaves(c)
connectCaves(c)

writePNG('cave_connected.png', c)


// Attempt to connect the caves together
export function connectCaves (c) {
    const { BreakOut, Caves, Corridors } = c

    if (Caves.length == 0)
        return false

    let currentcave
    const ConnectedCaves = [ ]
    let cor_point = [ 0, 0 ]
    let cor_direction = [ 0, 0 ]
    let potentialcorridor = [ ]
    let breakoutctr = 0
    c.Corridors.length = 0 // built corridors stored here


    // get started by randomly selecting a cave..
    const caveIdx = Random.int(0, Caves.length-1, rng)
    currentcave = Caves[caveIdx]
    ConnectedCaves.push(currentcave)
    Caves.splice(caveIdx, 1)

    // starting builder
    do {

        // no corridors are present, so build off a cave
        if (c.Corridors.length === 0) {
            currentcave = ConnectedCaves[Random.int(0, ConnectedCaves.length-1, rng)]
            Cave_GetEdge(c, currentcave, cor_point, cor_direction)
        }
        else if (Random.int(0, 99, rng) > 50) {
            // corridors are present, so randomly choose whether to get a start
            // point from a corridor or cave
            currentcave = ConnectedCaves[Random.int(0, ConnectedCaves.length-1, rng)]
            Cave_GetEdge(c, currentcave, cor_point, cor_direction)
        }
        else {
            currentcave = null;
            Corridor_GetEdge(c, cor_point, cor_direction)
        }

        // using the points we've determined above attempt to build a corridor off it
        potentialcorridor = Corridor_Attempt(c,
                                             cor_point,
                                             cor_direction,
                                             true)

        // if not null, a solid object has been hit
        if (potentialcorridor !== null) {
            // examine all the caves
            for (let ctr = 0; ctr < Caves.length; ctr++) {

                // check if the last point in the corridor list is in a cave
                if (CaveContainsCell(Caves[ctr], potentialcorridor.at(-1))) {
                //if (Caves[ctr].Contains(potentialcorridor.Last())) {

                    if (
                            currentcave === null // we've built off a corridor
                            || currentcave != Caves[ctr] // or built off a room
                        )
                    {
                        
                        // the last corridor point intrudes on the room, so remove it
                        potentialcorridor.pop()
                        //potentialcorridor.Remove(potentialcorridor.Last());

                        // add the corridor to the corridor collection
                        c.Corridors = c.Corridors.concat(potentialcorridor)
                        // write it to the map
                        for (const p of potentialcorridor)
                            Point_Set(c, p, 1)

                        // the room reached is added to the connected list...
                        ConnectedCaves.push(Caves[ctr])
                        // ...and removed from the Caves list
                        Caves.splice(ctr, 1)

                        break;
                    }
                }
            }
        }
    
        if (breakoutctr++ > BreakOut)
            return false

    } while (Caves.length > 0);

    c.Caves = c.Caves.concat(ConnectedCaves)
    //ConnectedCaves.length = 0
    return true
}


function clonePoint (p) {
    return [ p[0], p[1] ]
}


/// Attempt to build a corridor
/// <param name="pStart"></param>
/// <param name="pDirection"></param>
/// <param name="pPreventBackTracking"></param>
/// <returns></returns>
function Corridor_Attempt (c, pStart, pDirection, pPreventBackTracking) {

    const { Corridor_MaxTurns, Corridor_Min, Corridor_Max } = c
    
    let lPotentialCorridor = [ clonePoint(pStart) ]

    let corridorlength = 0
    const startdirection = [ pDirection[0], pDirection[1] ]

    let pTurns = Corridor_MaxTurns
    
    while (pTurns >= 0) {
        pTurns--

        corridorlength = Random.int(Corridor_Min, Corridor_Max-1, rng)

        // build corridor
        while (corridorlength > 0) {
            corridorlength--

            // make a point and offset it
            pStart[0] += pDirection[0]
            pStart[1] += pDirection[1]
            //pStart.Offset(pDirection)

            if (Point_Check(c.MapSize, pStart) && Point_Get(c, pStart) === 1) {
                lPotentialCorridor.push(clonePoint(pStart))
                return lPotentialCorridor
            }

            if (!Point_Check(c.MapSize, pStart))
                return null
            else if (!Corridor_PointTest(c, pStart, pDirection))
                return null

            lPotentialCorridor.push(clonePoint(pStart))
        }

        if (pTurns > 1)
            if (!pPreventBackTracking)
                pDirection = Direction_Get(pDirection)
            else
                pDirection = Direction_Get(pDirection, startdirection)
    }

    return null
}


function Corridor_PointTest (c, pPoint, pDirection) {
    const { CorridorSpace } = c
    
    // using the property corridor space, check that number of cells on
    // either side of the point are empty
    const start = -CorridorSpace
    const end = start + 2 * CorridorSpace + 1

    // -2, 5  -2, -1, 0, 1, 2
    for (let r=start; r<end; r++) {
    //for (int r in Enumerable.Range(-CorridorSpace, 2 * CorridorSpace + 1).ToList()) {
        if (pDirection[0] === 0) { // north or south
            if (Point_Check(c.MapSize, [ pPoint[0] + r, pPoint[1] ]))
                if (Point_Get(c, [ pPoint[0] + r, pPoint[1] ]) !== 0)
                    return false
        }
        else if (pDirection[1] === 0) { // east west
            if (Point_Check(c.MapSize, [ pPoint[0], pPoint[1] + r ]))
                if (Point_Get(c, [ pPoint[0], pPoint[1] + r ]) !== 0)
                    return false
        }
    }

    return true
}


/// Locate the edge of the specified cave
/// <param name="pCaveNumber">Cave to examine</param>
/// <param name="pCavePoint">Point on the edge of the cave</param>
/// <param name="pDirection">Direction to start formting the tunnel</param>
/// <returns>Boolean indicating if an edge was found</returns>
function Cave_GetEdge (c, pCave, pCavePoint, pDirection) {
    do {
        // random point in cave
        let tmp = pCave[Random.int(0, pCave.length-1, rng)]

        pCavePoint[0] = tmp[0]
        pCavePoint[1] = tmp[1]

        tmp = Direction_Get(pDirection)
        pDirection[0] = tmp[0]
        pDirection[1] = tmp[1]

        do {
            pCavePoint[0] += pDirection[0]
            pCavePoint[1] += pDirection[1]
            //pCavePoint.Offset(pDirection)

            if (!Point_Check(c.MapSize, pCavePoint))
                break;
            else if (Point_Get(c, pCavePoint) === 0)
                return;

        } while (true);

    } while (true);
}


/// Randomly get a point on an existing corridor
/// <param name="Location">Out: location of point</param>
/// <returns>Bool indicating success</returns>
function Corridor_GetEdge (c, pLocation, pDirection) {
    const { Corridors } = c
   const validdirections = [ ]

    do {
        // the modifiers below prevent the first of last point being chosen
        const tmp = Corridors[Random.int(1, Corridors.length-2, rng)]
        pLocation[0] = tmp[0]
        pLocation[1] = tmp[1]

        // attempt to locate all the empy map points around the location
        // using the directions to offset the randomly chosen point
        for (const p of Directions)
            if (Point_Check(c.MapSize, [ pLocation[0] + p[0], pLocation[1] + p[1] ]))
                if (Point_Get(c, [ pLocation[0] + p[0], pLocation[1] + p[1] ]) === 0)
                    validdirections.push(p)


    } while (validdirections.length === 0);

    const tmp = validdirections[Random.int(0, validdirections.length-1, rng)]
    pDirection[0] = tmp[0]
    pDirection[1] = tmp[1]

    pLocation[0] += pDirection[0]
    pLocation[1] += pDirection[1]
    //pLocation.Offset(pDirection)
}


// Get a random direction, provided it isn't equal to the opposite one provided
/// <param name="p"></param>
function Direction_Get (p) {
    let newdir
    do {
        newdir = Directions[Random.int(0, Directions.length-1, rng)]
    } while (newdir[0] !== -p[0] && newdir[1] !== -p[1])

    return newdir
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
