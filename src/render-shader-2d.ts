import { BaseShaderProps, Shader } from "./shader";
import { UniformBuffer } from "./shader-buffer";
import { isValidWebGpuVarName } from "./util";

const defaultVertexShader = /*WGSL*/`
struct VertexOutput {
	@builtin(position) Position : vec4<f32>,
	@location(0) fragPosition: vec4<f32>,
}

@vertex
fn main(
	@location(0) position : vec4<f32>,
) -> VertexOutput {
	var output : VertexOutput;
	output.Position = position;
	output.fragPosition = 0.5 * (position + vec4(1.0, 1.0, 1.0, 1.0));
	return output;
}
`

type RenderShader2dProps = BaseShaderProps & {
	canvas: HTMLCanvasElement;
	// blendMode?: 0
} & (
	{
		/**
		 * @default "floats"
		 */
		sizeBufferStyle?: "floats";
		/**
		 * @default "canvas_width"
		 */
		canvasWidthName?: string;
		/**
		 * @default "canvas_height"
		 */
		canvasHeightName?: string;
	} | {
		sizeBufferStyle: "vector";
		/**
		 * @default "canvas_size"
		 */
		canvasSizeName?: string;
	} | {
		sizeBufferStyle: "none";
	}
);

export default class RenderShader2d extends Shader{
	pipeline: GPURenderPipeline;
	// private renderPassDescriptor: GPURenderPassDescriptor;
	private canvasContext: GPUCanvasContext;
	props: RenderShader2dProps;
	vertexBuffer: GPUBuffer;
	widthBuffer: UniformBuffer;
	heightBuffer: UniformBuffer;
	sizeVectorBuffer: UniformBuffer;

	constructor(props: RenderShader2dProps){
		super(props);
		this.props = props;

		{ // Default prop values.
			if(!this.props.sizeBufferStyle) this.props.sizeBufferStyle = "floats";
			if(this.props.sizeBufferStyle == "floats" && !this.props.canvasWidthName) this.props.canvasWidthName = "canvas_width";
			if(this.props.sizeBufferStyle == "floats" && !this.props.canvasHeightName) this.props.canvasHeightName = "canvas_height";
			if(this.props.sizeBufferStyle == "vector" && !this.props.canvasSizeName) this.props.canvasSizeName = "canvas_size";
		}

		{ // Validation
			if(this.props.sizeBufferStyle == "floats"){

				if(this.props.canvasWidthName && !isValidWebGpuVarName(this.props.canvasWidthName)){
					throw new Error("Invalid widthName. Must be a valid WGSL variable name.");
				}
				if(this.props.canvasHeightName && !isValidWebGpuVarName(this.props.canvasHeightName)){
					throw new Error("Invalid heightName. Must be a valid WGSL variable name.");
				}
			}
			else if(this.props.sizeBufferStyle == "vector"){
				if(this.props.canvasSizeName && !isValidWebGpuVarName(this.props.canvasSizeName)){
					throw new Error("Invalid sizeBufferName. Must be a valid WGSL variable name.");
				}
			}
		}

		{ // Defaut buffer setup.

			if(props.sizeBufferStyle == "floats"){
				this.widthBuffer = new UniformBuffer({
					dataType: "f32",
					canCopyDst: true
				});
				this.heightBuffer = new UniformBuffer({
					dataType: "f32",
					canCopyDst: true
				});
			}
			else if(props.sizeBufferStyle == "vector"){
				this.sizeVectorBuffer = new UniformBuffer({
					dataType: "vec2<f32>",
					canCopyDst: true
				});
			}
			else if(props.sizeBufferStyle != "none"){
				throw new Error("Invalid sizeBufferStyle. Must be 'floats', 'vector', or 'none'.");
			}
		}

		{ // Built-in binding setup.
			let bindingW = undefined;
			let bindGroupsW = undefined;
			let bindingH = undefined;
			let bindGroupsH = undefined;

			if(!this.props.bindingLayouts.length || this.props.bindingLayouts[0]["binding"]){
				bindingW = this.widthBuffer;
				bindingH = this.heightBuffer;
			}
			else{
				let groups = this.props.bindingLayouts[0]["bindGroups"];
				bindGroupsW = {};
				bindGroupsH = {};
				Object.keys(groups).forEach((key) => {
					bindGroupsW[key] = this.widthBuffer;
					bindGroupsH[key] = this.heightBuffer;
				});
			}

			if(this.props.sizeBufferStyle == "floats"){

				this.props.bindingLayouts.unshift(
					{
						binding: bindingW,
						// bindGroups: bindGroupsW,
						name: this.props.canvasWidthName,
						type: "uniform",
					},
					{
						binding: bindingH,
						// bindGroups: bindGroupsH,
						name: this.props.canvasHeightName,
						type: "uniform",
					}
				);
			}
			else if(this.props.sizeBufferStyle == "vector"){
				this.props.bindingLayouts.unshift({
					binding: this.sizeVectorBuffer,
					name: this.props.canvasSizeName,
					type: "uniform",
				});
			}
		}

		super._setupShader(GPUShaderStage.FRAGMENT);
	}

	_configurePipeline(extraCode: string, layout: GPUBindGroupLayout): void {
		
		{ // Create the pipeline.
			let fragmentCode = extraCode + (
				typeof this.props.code === "string" ? this.props.code : this.props.code.join("\n")
			);

			let vertexShader = Shader.device.createShaderModule({ code: defaultVertexShader });
			let fragmentShader = Shader.device.createShaderModule({ code: fragmentCode });

			this.pipeline = Shader.device.createRenderPipeline({
				// layout: "auto",
				layout: Shader.device.createPipelineLayout({
					bindGroupLayouts: [layout],
				}),
				primitive: {
					// topology: 'triangle-strip',
					topology: 'triangle-list',
				},
				vertex: {
					module: vertexShader,
					entryPoint: 'main',
					buffers: [
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
				},
				fragment: {
					module: fragmentShader,
					entryPoint: 'main',
					targets: [
						{
							format: Shader.presentationFormat,
							// TODO: add blend mode support.
							// blend: {
							// 	color: {
							// 		srcFactor: 'src-alpha',
							// 		dstFactor: 'one-minus-src-alpha',
							// 		operation: 'add',
							// 	},
							// 	alpha: {
							// 		srcFactor: 'src-alpha',
							// 		dstFactor: 'one-minus-src-alpha',
							// 		operation: 'add',
							// 	},
							// }
						},
					],
				},

			});
		}

		// this.canvas = props.canvas;
		{ // Get and configure the canvas context.
			this.canvasContext = this.props.canvas.getContext('webgpu') as GPUCanvasContext;
			this.canvasContext.configure({
				device: Shader.device,
				format: Shader.presentationFormat,
				alphaMode: 'premultiplied',
				// usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
			});
		}

		{ // Set the vertex buffer.
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
	
			this.vertexBuffer = Shader.device.createBuffer({
				size: quadVertices.byteLength,
				usage: GPUBufferUsage.VERTEX,
				mappedAtCreation: true,
			});
	
			new Float32Array(this.vertexBuffer.getMappedRange()).set(quadVertices);
			this.vertexBuffer.unmap();
			
			// let commandEncoder = Shader.device.createCommandEncoder();
			// let passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
			// passEncoder.setPipeline(this.pipeline as GPURenderPipeline);
			// passEncoder.setVertexBuffer(0, vertexBuffer);
		}
	}

	_initialize(bindingLayouts): string {

		let extraFragmentCode = "";

		let fragmentBindingCount = 0;
		if (bindingLayouts) {
			for (let i = 0; i < bindingLayouts.length; i++) {
				let bl = bindingLayouts[i];
				extraFragmentCode += Shader._getBindingCode(this.props.code, fragmentBindingCount++, bl, 1);
			}
		}
		extraFragmentCode += `\r\n`;

		return extraFragmentCode;
	}

	pass() {

		{ // Update built-in buffers
			if(this.widthBuffer) this.widthBuffer.write(new Float32Array([this.props.canvas.width]));
			if(this.heightBuffer) this.heightBuffer.write(new Float32Array([this.props.canvas.height]));
			if(this.sizeVectorBuffer) this.sizeVectorBuffer.write(new Float32Array([this.props.canvas.width, this.props.canvas.height]));
			
			if(this.props.useExecutionCountBuffer) this.executionCountBuffer.write(new Uint32Array([this.executionCount++]));
			if(this.props.useTimeBuffer) {
				// Time in seconds:
				let now = performance ? (performance.now() / 1000) : (Date.now() / 1000);
				if(!this.lastTime) this.lastTime = now;
				this.time += now - this.lastTime;
				this.lastTime = now;

				this.timeBuffer.write(new Float32Array([this.time]));
			}
		}

		// TODO: try not creating the view each frame.
		let view = this.canvasContext.getCurrentTexture().createView();

		let renderPassDescriptor = {
			colorAttachments: [
				{
					view: this.canvasContext.getCurrentTexture().createView(),
					loadOp: "clear" as "clear",
					storeOp: "store" as "store",
					clearValue: { r: 0, g: 0, b: 0, a: 1 }
				},
			],
		};

		renderPassDescriptor.colorAttachments[0].view = view;

		let commandEncoder = Shader.device.createCommandEncoder();
		let passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(this.pipeline as GPURenderPipeline);

		passEncoder.setVertexBuffer(0, this.vertexBuffer);

		passEncoder.setBindGroup(0, this._bindGroups[this._lastBindGroup]);

		passEncoder.draw(6);
		passEncoder.end();

		Shader.device.queue.submit([commandEncoder.finish()]);

	}

	dispose(): void {
		if(this.widthBuffer){
			this.widthBuffer.dispose();
			this.widthBuffer = null;
		}
		if(this.heightBuffer){
			this.heightBuffer.dispose();
			this.heightBuffer = null;
		}
		if(this.sizeVectorBuffer){
			this.sizeVectorBuffer.dispose();
			this.sizeVectorBuffer = null;
		}
		this.vertexBuffer.destroy();
		this.vertexBuffer = null;

		super.dispose();
	}
}