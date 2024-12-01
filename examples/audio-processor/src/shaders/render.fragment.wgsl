@fragment
fn main(@location(0) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {

	let smallerSize = min(canvasWidth, canvasHeight);
	let electricR = smallerSize * 0.25;

	let cx = (fragCoord.x * canvasWidth);
	let cy = (fragCoord.y * canvasHeight);

	let relativeX = cx - canvasWidth / 2.0;
	let relativeY = cy - canvasHeight / 2.0;

	let r = sqrt(relativeX * relativeX + relativeY * relativeY) - electricR;

	let fullDataLength = 2048i;
	let dataLength = fullDataLength - (startOffset) - (endOffset);
	let angleIndex: i32 = (startOffset) + ((i32((((atan2(relativeY, relativeX) / 3.141592653589793) + 1.0) / 2.0) * f32(dataLength)) + dataLength * 3 / 4) % dataLength);
	let nextDataIndex = ((angleIndex - startOffset + 1) % dataLength) + startOffset;
	let prevDataIndex = ((angleIndex - startOffset - 1 + dataLength) % dataLength) + startOffset;
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
    // let screenWidth = 1.0; // Example width, replace with dynamic value if available.
    let numBars = 128;
    let barWidth = 1.0 / f32(numBars);

    // Calculate which audio bucket this fragment belongs to.
    let bucketIndex = i32(x / barWidth);
    if (bucketIndex < 0 || bucketIndex >= i32(1000)) {
        return vec4<f32>(0.0, 0.0, 0.0, 1.0); // Background color (black).
    } 

    // Get the amplitude for this bucket and scale it.
    let amplitude = dftData[bucketIndex];
    let scaledAmplitude = amplitude * 10.0;

    // Calculate the height of the bar on the screen.
    let barHeight = scaledAmplitude / 1000.0;
    if (fragCoord.y < barHeight) {
        return vec4<f32>(
			min(1.0, max(0.0, 1.0-fragCoord.x * 2.0)), 
			fragCoord.y, 
			min(1.0, max(0.0, fragCoord.x * 2.0)), 
			1.0
		); // Color of the bar (green).
    }

	var sum = 0.0;
	for (var i: i32 = 0; i < 10; i = i + 1) {
		sum = sum + dftData[i];
	}
	sum = (sum / 500.0) - 0.5;

    return vec4<f32>(sum, sum, sum, 1.0); // Background color (black).

}