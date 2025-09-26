
@compute @workgroup_size(16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let k = global_id.x;

    if (k >= 2048u) {
        return;
    }

    var real: f32 = 0.0;
    var imag: f32 = 0.0;

    let pi: f32 = 3.141592653589793;
    let n = f32(2048u);

    for (var t: u32 = 0u; t < 2048u; t++) {
        let angle = 2.0 * pi * f32(k * t) / n;
        real += inputData[t] * cos(angle);
        imag -= inputData[t] * sin(angle);
    }

	// Combine real and actual components to get the absolute amount:
	let mag = sqrt(real * real + imag * imag);

    if(mag > outputData[k]) {
		outputData[k] = mag;
	}
	else{
		outputData[k] = outputData[k] * 0.95 + mag * 0.05;
	}
}