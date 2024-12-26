import { ComputeShader, RenderShader2d, Shader, ShaderBuffer, StorageBuffer, UniformBuffer } from "simple-compute-shaders";
import dftWgsl from "./shaders/dft.compute.wgsl";
import renderWgsl from "./shaders/render.fragment.wgsl";

let canvas = document.createElement('canvas');
document.body.appendChild(canvas);

let instructions = document.createElement('p');
instructions.innerHTML = "Click anywhere to begin."
instructions.style.position = "absolute";
instructions.style.top = "50%";
instructions.style.left = "50%";
instructions.style.transform = "translate(-50%, -50%)";
document.body.appendChild(instructions);

instructions.onclick = () => {
	instructions.innerHTML = "except here...";
}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.body.style.margin = "0";
document.body.style.overflow = "hidden";

export default class Pipeline {
	active: boolean = false;
	computeFftShader: ComputeShader;
	dftRenderShader: RenderShader2d;

	timeBuffer: ShaderBuffer;
	stepBuffer: ShaderBuffer;
	audioBuffers: ShaderBuffer[];
	fftBuffer: ShaderBuffer;

	frameCount: any;
	dftComputeShader: ComputeShader;
	startOffsetBuffer: ShaderBuffer;
	endOffsetBuffer: ShaderBuffer;

	startTime = Date.now();
	audioContext: AudioContext;
	audioData: any;
	analyser: AnalyserNode;
	dataArray: Float32Array;

	constructor() { 
		window.addEventListener('resize', () => {
			if(canvas){
				canvas.width = window.innerWidth;
				canvas.height = window.innerHeight;
			}
		});
	}

	async start(canvas: HTMLCanvasElement) {
		{ // Check if the simulation is already active.
			if (this.active) {
				console.warn("Warning: Simulation renderer already active.");
				return;
			}
			this.active = true;
		}

		{ // Audio steup.
			
			try {
				this.audioContext = new AudioContext();
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				const source = this.audioContext.createMediaStreamSource(stream);
				const analyser = this.audioContext.createAnalyser();
		
				analyser.fftSize = 2048;
				const dataArray = new Float32Array(analyser.fftSize);
		
				source.connect(analyser);
		
				this.analyser = analyser;
				this.dataArray = dataArray;
			} catch (error) {
				console.error('Error initializing audio:', error);
			}
		}

		{ // Shader pipeline setup.
			await Shader.initialize();

			this.frameCount = 0;

			this.startOffsetBuffer = new UniformBuffer({
				dataType: "i32",
				canCopyDst: true
			});
			this.endOffsetBuffer = new UniformBuffer({
				dataType: "i32",
				canCopyDst: true
			});

			this.timeBuffer = new UniformBuffer({
				dataType: "f32",
				canCopyDst: true
			});

			this.stepBuffer = new UniformBuffer({
				dataType: "u32",
				canCopyDst: true
			});

			this.audioBuffers = [
				new StorageBuffer({
					dataType: "array<f32>",
					size: 2048,
					canCopyDst: true
				}),
				// Coming soon: buffer swapping.
				// new StorageBuffer({
				// 	dataType: "array<f32>",
				// 	size: 2048,
				// 	canCopyDst: true
				// }),
				// new StorageBuffer({
				// 	dataType: "array<f32>",
				// 	size: 2048,
				// 	canCopyDst: true
				// })
			];


			this.fftBuffer = new StorageBuffer({
				dataType: "array<f32>",
				size: 1000
			});

			this.dftComputeShader = new ComputeShader({
				code: dftWgsl,
				workgroupCount: [8, 1],
				bindingLayouts: [
					{
						binding: this.audioBuffers[0],
						// Coming soon:
						// bindGroups: {
						// 	a0: this.audioBuffers[0],
						// 	a1: this.audioBuffers[1],
						// 	a2: this.audioBuffers[2]
						// },
						name: "inputData",
						type: "read-only-storage"
					},
					{
						binding: this.fftBuffer,
						name: "outputData",
						type: "storage"
					},
					{
						type: "uniform",
						name: "time",
						binding: this.timeBuffer
					},
				]
			});

			this.dftRenderShader = new RenderShader2d({
				canvas: canvas,
				code: renderWgsl,
				bindingLayouts: [
					{
						type: "read-only-storage",
						name: "audio",
						binding: this.audioBuffers[0],
						// Coming soon:
						// bindGroups: {
						// 	a0: this.audioBuffers[0],
						// 	a1: this.audioBuffers[1],
						// 	a2: this.audioBuffers[2]
						// },
					},
					{
						type: "read-only-storage",
						name: "dftData",
						binding: this.fftBuffer
					},
					{
						type: "uniform",
						name: "startOffset",
						binding: this.startOffsetBuffer
					},
					{
						type: "uniform",
						name: "endOffset",
						binding: this.endOffsetBuffer
					},
					{
						type: "uniform",
						name: "time",
						binding: this.timeBuffer
					},
					{
						type: "uniform",
						name: "frame",
						binding: this.stepBuffer
					},
				],
			});

		}

		// Start the pipeline (audio processing and rendering).
		requestAnimationFrame(() => this.runPipeline());
	}

	runPipeline() {

		{ // Process audio.
			const analyser = this.analyser;
			const dataArray = this.dataArray;
			if (!analyser || !dataArray) return;
		
			analyser.getFloatTimeDomainData(dataArray);
		
			const options = {
				sampleRate: this.audioContext!.sampleRate,
				bucketWidth: 10,
				numberOfBuckets: 1000,
			};
		
			// console.log(dataArray.length);
		
			// const amplitudes = computeFFT(dataArray, options);
			// console.log(amplitudes);
			this.audioData = dataArray;
		}

		// Write all the buffers.
		// The render will draw the FFT and the waveform, but it would be
		// cool if the start of the waveform could connect to the end.
		// To do this we need to choose a start and end point in the data
		// that's close to 0.
		let startOffset = 0;
		let endOffset = 0;
		let range = 0.01;
		for (let i = 0; i < this.audioData.length / 2; i++) {
			if (this.audioData[i] < range && this.audioData[i] > -range
				&& this.audioData[i] < this.audioData[i + 1]) {
				startOffset = i;
				break;
			}
		}
		for (let i = 0; i < this.audioData.length / 2; i++) {
			if (this.audioData[this.audioData.length - 1 - i] < range && this.audioData[this.audioData.length - 1 - i] > -range
				&& this.audioData[this.audioData.length - 1 - i] > this.audioData[this.audioData.length - 1 - i - 1]) {
				endOffset = i;
				break;
			}
		}

		let timeSinceStart = (Date.now() - this.startTime) / 1000;

		this.startOffsetBuffer.write(new Uint32Array([startOffset]));
		this.endOffsetBuffer.write(new Uint32Array([endOffset]));
		this.timeBuffer.write(new Float32Array([timeSinceStart]));
		this.stepBuffer.write(new Uint32Array([this.frameCount++]));
		this.audioBuffers[0].write(new Float32Array(this.audioData));

		// Compute the DFT.
		this.dftComputeShader.dispatch();

		// Render.
		this.dftRenderShader.pass();

		requestAnimationFrame(() => this.runPipeline());
	}
}

let pipeline = new Pipeline();

let hasStarted = false;
canvas.onclick = () => {
	if (!hasStarted) {
		hasStarted = true;
		instructions.style.display = "none";
		pipeline.start(canvas);
	}
}