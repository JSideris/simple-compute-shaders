import { BaseShaderProps, Shader } from "./shader";
import { UniformBuffer } from "./shader-buffer";

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
}

export default class RenderShader2d extends Shader{
	pipeline: GPURenderPipeline;
	// private renderPassDescriptor: GPURenderPassDescriptor;
	private canvasContext: GPUCanvasContext;
	props: RenderShader2dProps;
	vertexBuffer: GPUBuffer;
	widthBuffer: UniformBuffer;
	heightBuffer: UniformBuffer;

	constructor(props: RenderShader2dProps){
		super(props);
		this.props = props;

		this.widthBuffer = new UniformBuffer({
			dataType: "f32",
			canCopyDst: true
		});
		this.heightBuffer = new UniformBuffer({
			dataType: "f32",
			canCopyDst: true
		});


		if(!this.props.bindingLayouts){
			this.props.bindingLayouts = [];
		}

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

		this.props.bindingLayouts.unshift(
			{
				binding: bindingW,
				// bindGroups: bindGroupsW,
				name: "canvasWidth",
				type: "uniform",
			},
			{
				binding: bindingH,
				// bindGroups: bindGroupsH,
				name: "canvasHeight",
				type: "uniform",
			}
		);

		super._setupShader(GPUShaderStage.FRAGMENT);
	}

	_configurePipeline(extraCode: string, layout: GPUBindGroupLayout): void {
		
		{ // Create the pipeline.
			let fragmentCode = extraCode + this.props.code;

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
				extraFragmentCode += Shader._getBindingCode(fragmentBindingCount++, bl, 1);
			}
		}
		extraFragmentCode += `\r\n`;

		return extraFragmentCode;
	}

	pass(props?: { bindGroup?: string }) {

		this.widthBuffer.writeDst(new Float32Array([this.props.canvas.width]));
		this.heightBuffer.writeDst(new Float32Array([this.props.canvas.height]));

		this.lastBindGroup = props?.bindGroup || this.lastBindGroup;


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

		passEncoder.setBindGroup(0, this.bindGroups[props?.bindGroup ?? this.lastBindGroup]);

		passEncoder.draw(6);
		passEncoder.end();

		Shader.device.queue.submit([commandEncoder.finish()]);

	}

	dispose(): void {
		this.widthBuffer.dispose();
		this.widthBuffer = null;
		this.heightBuffer.dispose();
		this.heightBuffer = null;
		this.vertexBuffer.destroy();
		this.vertexBuffer = null;

		super.dispose();
	}
}