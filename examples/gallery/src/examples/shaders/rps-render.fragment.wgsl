// RPS-9 Fragment Shader
// Uniforms: canvas_width, canvas_height, data (array<u32>)

const WIDTH: f32 = 1920.0;
const HEIGHT: f32 = 1080.0;

@fragment
fn main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
    let x = u32(fragCoord.x * (WIDTH / canvas_width));
    let y = u32(fragCoord.y * (HEIGHT / canvas_height));

    if (x >= u32(WIDTH) || y >= u32(HEIGHT)) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    }

    let cellIndex = y * u32(WIDTH) + x;
    let value = data[cellIndex];

    var color: vec3f;
    
    if (value == 0u) { color = vec3f(0.5, 0.5, 0.5); }       // Rock (Gray)
    else if (value == 1u) { color = vec3f(1.0, 1.0, 1.0); } // Paper (White)
    else if (value == 2u) { color = vec3f(0.75, 0.75, 0.75); } // Scissors (Silver)
    else if (value == 3u) { color = vec3f(0.0, 1.0, 0.0); } // Lizard (Green)
    else if (value == 4u) { color = vec3f(0.0, 1.0, 1.0); } // Spock (Cyan)
    else if (value == 5u) { color = vec3f(1.0, 0.0, 0.0); } // Spiderman (Red)
    else if (value == 6u) { color = vec3f(0.1, 0.1, 0.1); } // Batman (Black)
    else if (value == 7u) { color = vec3f(0.5, 0.0, 0.5); } // Wizard (Purple)
    else if (value == 8u) { color = vec3f(1.0, 0.84, 0.0); } // Glock (Gold)
    else { color = vec3f(0.0, 0.0, 0.0); }

    return vec4f(color, 1.0);
}
