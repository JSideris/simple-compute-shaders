import { ComputeShader, RenderShader2d, Shader, ShaderBuffer, StorageBuffer, UniformBuffer } from "simple-compute-shaders";
import dftWgsl from "./shaders/gol.compute.wgsl";
import renderWgsl from "./shaders/render.fragment.wgsl";

let canvas = document.createElement('canvas');
canvas.style.backgroundColor = "black";
document.body.appendChild(canvas);

canvas.width = canvas.height = Math.min(window.innerHeight, window.innerWidth);

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.backgroundColor = "#111";
document.body.style.margin = "auto";
document.body.style.textAlign = "center";

export default class Pipeline {
	active: boolean = false;
	renderShader: RenderShader2d;

	timeBuffer: ShaderBuffer;
	stepBuffer: ShaderBuffer;

	frameCount: any;
	golComputeShader: ComputeShader;

	startTime = Date.now();
	dataArrayA: Uint32Array;
	dataArrayB: Uint32Array;

	dataBuffers: StorageBuffer[];

	constructor() { 
		window.addEventListener('resize', () => {
			if(canvas){
				canvas.width = canvas.height = Math.min(window.innerHeight, window.innerWidth);
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

		{ // Steup.
			
			this.dataArrayA = new Uint32Array(1024*1024);
			this.dataArrayB = new Uint32Array(1024*1024);

			for (let i = 0; i < this.dataArrayA.length; i++) {
				if(Math.random() > 0.5) this.dataArrayA[i] = 1;
				else this.dataArrayA[i] = 0;
			}
		}

		{ // Shader pipeline setup.
			await Shader.initialize();

			this.frameCount = 0;

			this.timeBuffer = new UniformBuffer({
				dataType: "f32",
				canCopyDst: true
			});

			this.stepBuffer = new UniformBuffer({
				dataType: "u32",
				canCopyDst: true
			});

			this.dataBuffers = [
				new StorageBuffer({
					dataType: "array<u32>",
					size: 1024*1024,
					canCopyDst: true,
					initialValue: this.dataArrayA
				}),
				new StorageBuffer({
					dataType: "array<u32>",
					size: 1024*1024,
					canCopyDst: true
				}),
			];

			this.golComputeShader = new ComputeShader({
				code: dftWgsl,
				workgroupCount: [64, 64],
				bindingLayouts: [
					{
						binding: this.dataBuffers[0],
						// Coming soon:
						// bindGroups: {
						// 	a0: this.audioBuffers[0],
						// 	a1: this.audioBuffers[1],
						// 	a2: this.audioBuffers[2]
						// },
						name: "currentState",
						type: "storage"
					},
					{
						binding: this.dataBuffers[1],
						name: "nextState",
						type: "storage"
					},
					{
						type: "uniform",
						name: "time",
						binding: this.timeBuffer
					},
					{
						type: "uniform",
						name: "step",
						binding: this.stepBuffer
					},
				]
			});

			this.renderShader = new RenderShader2d({
				canvas: canvas,
				code: renderWgsl,
				bindingLayouts: [
					{
						type: "read-only-storage",
						name: "data",
						binding: this.dataBuffers[0],
						// Coming soon:
						// bindGroups: {
						// 	a0: this.audioBuffers[0],
						// 	a1: this.audioBuffers[1],
						// 	a2: this.audioBuffers[2]
						// },
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

		let timeSinceStart = (Date.now() - this.startTime) / 1000;

		this.timeBuffer.write(new Float32Array([timeSinceStart]));
		
		// Compute the game of life.
		this.stepBuffer.write(new Uint32Array([this.frameCount++]));
		this.golComputeShader.dispatch();
		this.stepBuffer.write(new Uint32Array([this.frameCount++]));
		this.golComputeShader.dispatch();

		// Render.
		this.renderShader.pass();

		requestAnimationFrame(() => this.runPipeline());
	}
}

let pipeline = new Pipeline();

pipeline.start(canvas);