import {Shader} from "friendly-webgpu";
import vertWGSL from './vert.wgsl';
import audioRenderWGSL from './frag.wgsl';

export default class Renderer{
	active: boolean = false;
	shader: Shader;
	// simulation: Simulation;

	vertexBuffer: GPUBuffer;
	timeBuffer: GPUBuffer;
	stepBuffer: GPUBuffer;
	audioBuffer: GPUBuffer;

	frameCount: any;
	cameraMatrix: GPUBuffer;
	// camera: Camera;
	// game: Game;

	constructor(){
		// this.game = game;
	}

	async start(canvas: HTMLCanvasElement){
		{ // Check if the simulation is already active.
			if(this.active) {
				console.warn("Warning: Simulation renderer already active.");
				return;
			}
			this.active = true;
		}

		await Shader.initialize();

		this.frameCount = 0;

		const quadVertices = new Float32Array([
			// First triangle
			-1.0,  1.0, 0.0, 1.0, // Top-left
			 1.0, -1.0, 0.0, 1.0, // Bottom-right
			-1.0, -1.0, 0.0, 1.0, // Bottom-left
			
			// Second triangle
			-1.0,  1.0, 0.0, 1.0, // Top-left
			 1.0,  1.0, 0.0, 1.0, // Top-right
			 1.0, -1.0, 0.0, 1.0, // Bottom-right
		]);

		const vertexBuffer = Shader.device.createBuffer({
			size: quadVertices.byteLength,
			usage: GPUBufferUsage.VERTEX,
			mappedAtCreation: true,
		});

		new Float32Array(vertexBuffer.getMappedRange()).set(quadVertices);
		vertexBuffer.unmap();
		this.vertexBuffer = vertexBuffer;

		this.timeBuffer = Shader.makeBuffer(4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
		this.stepBuffer = Shader.makeBuffer(4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

		this.audioBuffer = Shader.makeBuffer(4*4*1000, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,"float", []);

		this.shader = new Shader({
			type: "render",
			canvas: canvas,
			vertexCode: vertWGSL,
			fragmentCode: audioRenderWGSL,
			bindingLayouts: [
				{ 
					visibility: GPUShaderStage.FRAGMENT,
					type: "read-only-storage",
					name: "audio",
					dataType: "array<f32>",
					binding: this.audioBuffer
				},
				{
					type: "uniform",
					name: "time",
					dataType: "f32",
					visibility: GPUShaderStage.FRAGMENT,
					binding: this.timeBuffer
				},
				{
					type: "uniform",
					name: "frame",
					dataType: "u32",
					visibility: GPUShaderStage.FRAGMENT,
					binding: this.stepBuffer
				},
			],
			vertexBuffers: [
				{
					arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT ,
					attributes: [
						{
							shaderLocation: 0,
							format: "float32x4" as "float32x4",
							offset: 0,
						}
					]
				}
			],
		});
		// console.log(this.shader.fragmentCode);

	}

	render(dt, time, frames, audioData){

		// console.log(audioData);
		
		Shader.writeBuffer(this.timeBuffer, new Float32Array([time]));
		Shader.writeBuffer(this.stepBuffer, new Uint32Array([this.frameCount++]));
		Shader.writeBuffer(this.audioBuffer, new Float32Array(audioData));

		this.shader.pass({vertices: this.vertexBuffer});
	}
}