// RPS-9 - WebGPU Compute Shader (WGSL)
// 9-player Rock Paper Scissors variant:
// Rock, Paper, Scissors, Lizard, Spock, Spiderman, Batman, Wizard, Glock
// Rules: Type j beats type i if (j - i + 9) % 9 is in {1, 2, 3, 4}

// @group(0) @binding(0)
// var<storage, read> currentState : array<u32>;

// @group(0) @binding(1)
// var<storage, write> nextState : array<u32>;

const WIDTH: u32 = 1920u;
const HEIGHT: u32 = 1080u;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) globalID : vec3<u32>) {
    let x = globalID.x;
    let y = globalID.y;

    if (x >= WIDTH || y >= HEIGHT) {
        return;
    }

    let cellIndex = y * WIDTH + x;
    let currentType = currentState[cellIndex];

    // Count neighbors of each type
    var counts = array<u32, 9>(0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u);

    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            if (dx == 0 && dy == 0) { continue; }

            let nx = (x + u32(dx) + WIDTH) % WIDTH;
            let ny = (y + u32(dy) + HEIGHT) % HEIGHT;
            let neighborIndex = ny * WIDTH + nx;
            let neighborType = currentState[neighborIndex];
            
            if (neighborType < 9u) {
                counts[neighborType]++;
            }
        }
    }

    // A cell transforms if it's "eaten" by enough neighbors that beat it.
    // In RPS-9, type j beats type i if (j - i + 9) % 9 is in {1, 2, 3, 4}.
    
    var nextType = currentType;
    var maxBeatingCount = 0u;
    var winningType = currentType;

    for (var t = 0u; t < 9u; t++) {
        if (t == currentType) { continue; }
        
        // Does type t beat currentType?
        let diff = (t + 9u - currentType) % 9u;
        if (diff >= 1u && diff <= 4u) {
            if (counts[t] > maxBeatingCount) {
                maxBeatingCount = counts[t];
                winningType = t;
            }
        }
    }

    // Threshold for transformation: if 3 or more neighbors beat it, it transforms.
    if (maxBeatingCount >= 3u) {
        nextType = winningType;
    }

    nextState[cellIndex] = nextType;
}
