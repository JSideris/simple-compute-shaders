// Uniforms are injected at runtime. Do not add them here.

struct Offsets {
    startOffset: i32,
    endOffset: i32
}

@fragment
fn main(@location(0) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {

	let smallerSize = min(canvas_width, canvas_height);
	let electricR = smallerSize * 0.25;

	let cx = (fragCoord.x * canvas_width);
	let cy = (fragCoord.y * canvas_height);

	let relativeX = cx - canvas_width / 2.0;
	let relativeY = cy - canvas_height / 2.0;

	let r = sqrt(relativeX * relativeX + relativeY * relativeY) - electricR;

	let fullDataLength = 2048i;
	let dataLength = fullDataLength - (offsets.startOffset) - (offsets.endOffset);
	let angleIndex: i32 = (offsets.startOffset) + ((i32((((atan2(relativeY, relativeX) / 3.141592653589793) + 1.0) / 2.0) * f32(dataLength)) + dataLength * 3 / 4) % dataLength);
	let nextDataIndex = ((angleIndex - offsets.startOffset + 1) % dataLength) + offsets.startOffset;
	let prevDataIndex = ((angleIndex - offsets.startOffset - 1 + dataLength) % dataLength) + offsets.startOffset;
	let audio0 = f32(sign(prevDataIndex)) * audio[prevDataIndex];
	let audio1 = f32(sign(angleIndex)) * audio[angleIndex];
	let audio2 = f32(sign(nextDataIndex)) * audio[nextDataIndex];

	let minAudio = min(audio0, min(audio1, audio2));
	let maxAudio = max(audio0, max(audio1, audio2));

	let scaleFactor = 1.5;
	let minThreshold = sign(minAudio) * log(1.0 + abs(minAudio) * scaleFactor) * 500.0 / scaleFactor;
	let maxThreshold = sign(maxAudio) * log(1.0 + abs(maxAudio) * scaleFactor) * 500.0 / scaleFactor;

	if(r < maxThreshold + 1.0 && r > minThreshold - 1.0){
		return vec4<f32>(0.2, 0.4, 1.0, 1.0);
	}

	let x = fragCoord.x;
	let numBars = 128;
	let barWidth = 1.0 / f32(numBars);
	let bucketIndex = i32(x / barWidth);
	if (bucketIndex < 0 || bucketIndex >= i32(1000)) {
		return vec4<f32>(0.0, 0.0, 0.0, 1.0);
	} 

	let amplitude = dftData[bucketIndex];
	let scaledAmplitude = amplitude * 10.0;

	// Quantize the amplitude to create blocky frequency bars.
	let blockSize = barWidth * canvas_width / canvas_height;
	let quantizedHeight = floor(scaledAmplitude / (blockSize * 1000.0));
	let blockY = floor(fragCoord.y / blockSize);
	let nextBlockThreshold = (blockY + 1.0) * blockSize * 1000.0;
	let alpha = clamp((scaledAmplitude - nextBlockThreshold) / (blockSize * 1000.0), 0.0, 1.0);


	var sum = 0.0;
	for (var i: i32 = 0; i < 10; i = i + 1) {
		sum = sum + dftData[i];
	}
	sum = (sum / 500.0) - 0.5;

	if (blockY < quantizedHeight) {
		return vec4<f32>(
			alpha * min(1.0, max(0.0, 1.0 - fragCoord.x * 2.0)) + (1.0 - alpha) * sum, 
			alpha * fragCoord.y + (1.0 - alpha) * sum, 
			alpha * min(1.0, max(0.0, fragCoord.x * 2.0)) + (1.0 - alpha) * sum, 
			1.0
		);
	}

	return vec4<f32>(sum, sum, sum, 1.0);
}
