// Uniforms are injected at runtime. Do not add them here.
// canvas_width: f32
// canvas_height: f32
// data: array<u32> // 32*1024 grid of 32 bit uints.

@fragment
fn main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
    let x = u32(fragCoord.x * (1024.0 / canvas_width));
    let y = u32(fragCoord.y * (1024.0 / canvas_height));

    let row_index = y * 1024 + (x);

    let value = (data[row_index]);

    if (value == 1u) { 
		return vec4f(1.0, 1.0, 1.0, 1.0); 
	} else { 
		return vec4f(0.0, 0.0, 0.0, 1.0);
	}
}

