// Conway's Game of Life - WebGPU Compute Shader (WGSL)

// Uniforms are added at runtime. Don't add them here.

// @group(0) @binding(0)
// var<storage, read> currentState : array<u32>;

// @group(0) @binding(1)
// var<storage, write> nextState : array<u32>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) globalID : vec3<u32>) {
    // Flatten the 2D index (x, y) into a 1D cell index.
    let x = globalID.x;
    let y = globalID.y;
    let cellIndex = y * 1024u + x;

    let arrayIndex = cellIndex;

    let cellValue = currentState[arrayIndex];

    // Calculate neighbor coordinates with wrapping
    let x_left  = (x + 1023u) % 1024u;
    let x_right = (x + 1u) % 1024u;
    let y_up    = (y + 1023u) % 1024u;
    let y_down  = (y + 1u) % 1024u;

    // Count live neighbors
    var liveNeighbors = 0u;
    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            if (dx == 0 && dy == 0) { continue; } // Skip self

            let neighborX = (x + u32(dx) + 1024u) % 1024u;
            let neighborY = (y + u32(dy) + 1024u) % 1024u;
            let neighborIndex = neighborY * 1024u + neighborX;

            liveNeighbors += min(1u, currentState[neighborIndex]);
        }
    }

    // Apply Conway's Game of Life rules
    var newCellValue = cellValue;
    if (cellValue == 1u) {
        if (liveNeighbors < 2u || liveNeighbors > 3u) {
            newCellValue = 0u;
        }
    } else {
        if (liveNeighbors == 3u) {
            newCellValue = 1u;
        }
    }

    // Write the next state
    nextState[arrayIndex] = newCellValue;
}