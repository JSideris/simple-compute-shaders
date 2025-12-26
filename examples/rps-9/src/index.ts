import { ComputeShader, RenderShader2d, Shader, ShaderBuffer, StorageBuffer, UniformBuffer } from "simple-compute-shaders";
import rpsWgsl from "./shaders/rps.compute.wgsl";
import renderWgsl from "./shaders/render.fragment.wgsl";
import { setupUi } from "./ui";

const WIDTH = 1920;
const HEIGHT = 1080;
const GRID_SIZE = WIDTH * HEIGHT;

export default class Pipeline {
	active: boolean = false;
	renderShader: RenderShader2d;

	rpsComputeShader: ComputeShader;

	startTime = Date.now();
	dataArrayA: Uint32Array;
	dataArrayB: Uint32Array;

	dataBuffers: StorageBuffer[];

	private swapState = 0;

	constructor() { 
		window.addEventListener('resize', () => {
			if(canvas){
				const aspect = WIDTH / HEIGHT;
				const winAspect = window.innerWidth / window.innerHeight;
				if (winAspect > aspect) {
					canvas.height = window.innerHeight;
					canvas.width = window.innerHeight * aspect;
				} else {
					canvas.width = window.innerWidth;
					canvas.height = window.innerWidth / aspect;
				}
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

		{ // Setup.
			
			this.dataArrayA = new Uint32Array(GRID_SIZE);
			this.dataArrayB = new Uint32Array(GRID_SIZE);

			this.initializeData();
		}

		{ // Shader pipeline setup.
			await Shader.initialize();

			this.dataBuffers = [
				new StorageBuffer({
					dataType: "array<u32>",
					size: GRID_SIZE,
					canCopyDst: true,
					initialValue: this.dataArrayA
				}),
				new StorageBuffer({
					dataType: "array<u32>",
					size: GRID_SIZE,
					canCopyDst: true
				}),
			];

			// Configure the compute shader with two groups so we can do buffer swapping.
			this.rpsComputeShader = new ComputeShader({
				code: rpsWgsl,
				workgroupCount: [120, 68],
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

		// Start the pipeline.
		requestAnimationFrame(() => this.runPipeline());
	}

	initializeData() {
		for (let i = 0; i < this.dataArrayA.length; i++) {
			this.dataArrayA[i] = Math.floor(Math.random() * 9);
		}
	}

	reset() {
		// Reinitialize the data with random values
		this.initializeData();
		
		// Write the new data to the GPU buffers
		this.dataBuffers[0].write(this.dataArrayA);
		
		// Clear the second buffer
		this.dataArrayB.fill(0);
		this.dataBuffers[1].write(this.dataArrayB);
		
		// Reset the swap state
		this.swapState = 0;
		
		console.log("Simulation reset");
	}

	runPipeline() {
		// Compute the RPS state with swapping.
		this.rpsComputeShader.dispatch({
			bindGroups: 
				{
				0: this.swapState == 0 ? "group1" : "group2",
			}
		});

		// Render.
		this.renderShader.pass({
			bindGroups: {
				0: this.swapState == 0 ? "group1" : "group2",
			}
		});

		// Swap the state for the next frame.
		this.swapState = 1 - this.swapState;

		requestAnimationFrame(() => this.runPipeline());
	}
}

let pipeline = new Pipeline();

let {canvas} = setupUi({
	resetCallback: () => {
		console.log("Resetting simulation");
		pipeline.reset();
	}
});

pipeline.start(canvas);