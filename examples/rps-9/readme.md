# RPS-9 GPU Simulation

A GPU-accelerated simulation of a 9-player variant of Rock Paper Scissors, running on a 1920x1080 grid.

## The Players

The simulation features 9 types of cells:
- **Rock** (Gray)
- **Paper** (White)
- **Scissors** (Silver)
- **Lizard** (Green)
- **Spock** (Cyan)
- **Spiderman** (Red)
- **Batman** (Black)
- **Wizard** (Purple)
- **Glock** (Gold)

## The Rules

The rules follow a balanced circular competition where each type beats the 4 types preceding it (in a wrap-around sense) and is beaten by the 4 types following it.

Mathematically, type `j` beats type `i` if:
`(j - i + 9) % 9` is in `{1, 2, 3, 4}`

A cell transforms into a neighboring type if at least 3 neighbors of that type beat the current cell.

## Technical Details

- **Compute Shader**: Handles the RPS-9 logic on a 1920x1080 grid.
- **Fragment Shader**: Renders the grid with unique colors for each type.
- **WebGPU**: Utilizes the `simple-compute-shaders` library for easy WebGPU orchestration.

## How to Run

1. `npm install`
2. `npm start`
3. Click anywhere on the canvas to reset the simulation with a new random state.
