import { ComputeShader, RenderShader2d, Shader, ShaderBuffer, StorageBuffer, UniformBuffer } from "simple-compute-shaders";
import dftWgsl from "./shaders/dft.compute.wgsl";
import renderWgsl from "./shaders/render.fragment.wgsl";

let canvas = document.createElement('canvas');
canvas.style.backgroundColor = "black";
document.body.appendChild(canvas);

let instructions = document.createElement('p');
instructions.innerHTML = "Click anywhere to begin."
instructions.style.position = "absolute";
instructions.style.color = "white";
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
	dftRenderShader: RenderShader2d;

	audioBuffers: ShaderBuffer[];
	dftBuffer: ShaderBuffer;

	frameCount: any;
	dftComputeShader: ComputeShader;
	// startOffsetBuffer: ShaderBuffer;
	// endOffsetBuffer: ShaderBuffer;
	offsetBuffer: ShaderBuffer;

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

			this.offsetBuffer = new UniformBuffer({
				dataType: "struct",
				structName: "Offsets",
				fields: [
					{
						name: "startOffset",
						dataType: "i32",
					},
					{
						name: "endOffset",
						dataType: "i32",
					}
				],
				initialValue: [0, 0],
				canCopyDst: true
			});

			this.audioBuffers = [
				new StorageBuffer({
					dataType: "array<f32>",
					size: 2048,
					canCopyDst: true
				}),
			];


			this.dftBuffer = new StorageBuffer({
				dataType: "array<f32>",
				size: 1000
			});

			this.dftComputeShader = new ComputeShader({
				code: dftWgsl,
				workgroupCount: [8, 1],
				bindingLayouts: [{
					default: [
						{
							binding: this.audioBuffers[0],
							name: "inputData",
							type: "read-only-storage"
						},
						{
							binding: this.dftBuffer,
							name: "outputData",
							type: "storage"
						},
					]
				}]
			});

			this.dftRenderShader = new RenderShader2d({
				canvas: canvas,
				code: renderWgsl,
				bindingLayouts: [{
					default: [
						{
							type: "read-only-storage",
							name: "audio",
							binding: this.audioBuffers[0],
						},
						{
							type: "read-only-storage",
							name: "dftData",
							binding: this.dftBuffer
						},
						{
							type: "uniform",
							name: "offsets",
							binding: this.offsetBuffer
						},
					]
				}]
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
		
			this.audioData = dataArray;
		}

		// Write all the buffers.
		// The render will draw the DFT and the waveform, but it would be
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

		// this.startOffsetBuffer.write(new Uint32Array([startOffset]));
		// this.endOffsetBuffer.write(new Uint32Array([endOffset]));
		this.offsetBuffer.write(new Uint32Array([startOffset, endOffset]));
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