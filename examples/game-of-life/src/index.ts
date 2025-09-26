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

	golComputeShader: ComputeShader;

	startTime = Date.now();
	dataArrayA: Uint32Array;
	dataArrayB: Uint32Array;

	dataBuffers: StorageBuffer[];

	private swapState = 0;

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

			// Configure the compute shader with two groups so we can do buffer swapping.
			this.golComputeShader = new ComputeShader({
				code: dftWgsl,
				workgroupCount: [64, 64],
				bindingLayouts: [{
					group1: [
						{
							binding: this.dataBuffers[0],
							name: "currentState",
							type: "storage"
						},
						{
							binding: this.dataBuffers[1],
							name: "nextState",
							type: "storage"
						},
					],
					group2: [
						{
							binding: this.dataBuffers[1],
							name: "currentState",
							type: "storage"
						},
						{
							binding: this.dataBuffers[0],
							name: "nextState",
							type: "storage"
						},
					]
				}]
			});

			// The render shader uses the same buffers as the compute shader, but in reverse order.
			// We use buffer swapping to make the render shader show the latest data.
			this.renderShader = new RenderShader2d({
				canvas: canvas,
				code: renderWgsl,
				bindingLayouts: [{
					group1: [
						{
							type: "read-only-storage",
							name: "data",
							binding: this.dataBuffers[1],
						},
					],
					group2: [
						{
							type: "read-only-storage",
							name: "data",
							binding: this.dataBuffers[0],
						},
					]
				}],
			});

		}

		// Start the pipeline (audio processing and rendering).
		requestAnimationFrame(() => this.runPipeline());
	}

	runPipeline() {
		// Compute the game of life with swapping.
		this.golComputeShader.dispatch({
			0: this.swapState == 0 ? "group1" : "group2",
		});

		// Render.
		this.renderShader.pass({
			0: this.swapState == 0 ? "group1" : "group2",
		});

		// Swap the state for the next frame.
		this.swapState = 1 - this.swapState;

		requestAnimationFrame(() => this.runPipeline());
	}
}

let pipeline = new Pipeline();

pipeline.start(canvas);