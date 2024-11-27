var shaderInitialized = false;

type WgslPrimative = `${"u" | "f" | "i"}32`;
type WgslVec = `vec${2 | 3 | 4}<${WgslPrimative}>`;
type WgslArray = `array<${WgslPrimative | WgslVec}>`;
type WgslTexture = `texture_2d<${WgslPrimative}>`
type WgslMatrix = `mat4x4<${WgslPrimative}>`

type BindingLayoutDef = {
	type: "storage" | "read-only-storage" | "uniform" | "write-only-texture" | "var";
	name: string;
	visibility: number;
	dataType: WgslPrimative | WgslVec | WgslArray | WgslTexture | WgslMatrix;
} & (
	{
		binding: GPUBuffer
	} 
	| {
		bindGroups: Record<string, GPUBuffer>
	}
)

type BaseShaderProps = {
	// bindGroupLayout?: GPUBindGroupLayout;
	bindingLayouts?: Array<BindingLayoutDef>;
	// bindGroups: Record<string, Array<GPUBuffer>>;
}// & ({bindingLayout: GPUBindGroupLayout;} | {bindingLayouts: Array<BindingLayoutDef>;}) // TODO: this typing is handy but causes drama.

type ComputeShaderProps = BaseShaderProps & {
	type: "compute";
	computeCode: string;
	workgroupCount: [number, number, number] | [number, number];
	blockSize?: number;
}
type RenderShaderProps = BaseShaderProps & {
	type: "render";
	vertexCode: string;
	fragmentCode: string;
	vertexBuffers?: Array<GPUVertexBufferLayout>;
	canvas?: HTMLCanvasElement;
}

export class Shader {
	static device: GPUDevice;
	// static commandEncoder: GPUCommandEncoder;
	// static context: GPUCanvasContext;
	// static canvas: HTMLCanvasElement;
	static presentationFormat: GPUTextureFormat;
	static adapter: GPUAdapter;

	renderPassDescriptor: GPURenderPassDescriptor;
	fragmentCode: string;
	vertexCode: string;
	computeCode: string;
	canvasContext: GPUCanvasContext;

	static get isInitialized() {
		return shaderInitialized;
	};

	static async initialize() {
		if (Shader.isInitialized) return;
		shaderInitialized = true;

		
		Shader.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
		Shader.adapter = await navigator.gpu.requestAdapter();

		if (!Shader.adapter) {
			throw new Error("Failed to initialize WebGPU adapter. Ensure your system and browser support WebGPU.");
		}

		Shader.device = await Shader.adapter.requestDevice();

		if (!Shader.device) {
			throw new Error("Failed to acquire a WebGPU device.");
		}

		return Shader.device;
	}

	static makeBuffer(sizeBytes: number, usage: number, type?: "float" | "int", initialValue?: ArrayLike<number>) {
		let buffer = Shader.device.createBuffer({
			size: sizeBytes,
			usage: usage,
			mappedAtCreation: !!initialValue,
		});

		if (initialValue) {
			if (type == "float") {
				new Float32Array(buffer.getMappedRange()).set(initialValue);
			}
			else if (type == "int") {
				new Uint32Array(buffer.getMappedRange()).set(initialValue);
			}
			buffer.unmap();
		}

		return buffer;
	}

	// TODO: consider using fences to avoid race conditions.
	static async readGPUBufferData(buffer: GPUBuffer, size32: number) {
		// Map the buffer for reading
		await buffer.mapAsync(GPUMapMode.READ);

		// Get the mapped range
		const arrayBuffer = buffer.getMappedRange();

		// Create a Uint32Array from the buffer
		const data = new Uint32Array(arrayBuffer, 0, size32);

		// Create a copy of the data. It seems that the original data becomes unavailable after the buffer is unmapped.
		let data2 = new Uint32Array(data);

		// Unmap the buffer
		buffer.unmap();
		
		return data2;
	}


	static writeBuffer(buffer: GPUBuffer, value: Float32Array | Uint32Array, offset = 0) {
		Shader.device.queue.writeBuffer(buffer, offset, value);
	}

	bindGroups: Record<string, GPUBindGroup> = {};
	lastBindGroup: string;
	pipeline: GPUComputePipeline | GPURenderPipeline;
	workgroupCount: Array<number>;
	type: string;

	private getBindingCode(numb: number, bl: BindingLayoutDef, group: number = 0) {
		return `@binding(${numb}) @group(${0}) ${bl.type == "var" ? "var" : `var<${bl.type == "read-only-storage" ? "storage, read" : bl.type == "storage" ? "storage, read_write" : bl.type == "write-only-texture" ? "storage, read_write" : "uniform"}>`} ${bl.name}: ${bl.dataType};\r\n`;
	}

	constructor(props: ComputeShaderProps | RenderShaderProps) {
		
		this.workgroupCount = (props as ComputeShaderProps).workgroupCount;
		this.type = props.type;
		
		let allBindingGroupNames = [];
		{ // 1. Validation
			// Ensure the shader class has been initialized.
			if (!Shader.isInitialized) throw new Error("Call Shader.initialize before instantiating a shader.");

			// Ensure all binding layouts have the same.
			if(props.bindingLayouts?.length){
				let bindGroupType: "single"|"multi" = null;
				let bl0 = props.bindingLayouts[0];
				if(bl0["binding"]){
					bindGroupType = "single";
					allBindingGroupNames = ["default"];
				}
				if(bl0["bindings"]){
					bindGroupType = "multi";
					allBindingGroupNames = Object.keys(bl0["bindings"]);
				}

				for(let i = 0; i < props.bindingLayouts.length; i++){
					let bl = props.bindingLayouts[i];
					if((bindGroupType == "single" && bl["bindings"]) || (bindGroupType == "multi" && bl["binding"])){
						throw new Error("Bindings must either all be single or all be multi.");
					}

					if(bindGroupType == "multi"){
						// Check each binding in the bl and make sure it's name is in allBindingGroupNames.
						let currentBindingNames = Object.keys(bl["bindings"]);
						for(let j = 0; j < currentBindingNames.length; j++){
							if(!allBindingGroupNames.includes(currentBindingNames[j])){
								throw new Error("All binding groups must have the same names.");
							}
						}

						// Also, make sure the binding count is the same.
						if(currentBindingNames.length != allBindingGroupNames.length){
							throw new Error("All binding groups must have the same number of bindings.");
						}
					}
				}
			}

			if(props.type != "compute" && props.type != "render"){
				throw new Error("Shader type must be either 'compute' or 'render'.");
			}

			if(props.type == "render" && !props.canvas){
				throw new Error("Render shaders require a canvas.");
			}
		}

		let extraComputeCode = "";
		let extraVertexCode = "";
		let extraFragmentCode = "";

		{ // 2. Initialization

			// We can configure stuff in the shader automatically.


			if (props.type == "compute") {
				extraComputeCode += `override blockSize = ${props.blockSize ?? 8};\r\n`;
			}

			let computeBindingCount = 0;
			let vertexBindingCount = 0;
			let fragmentBindingCount = 0;
			if (props.bindingLayouts) {
				for (let i = 0; i < props.bindingLayouts.length; i++) {
					let bl = props.bindingLayouts[i];
					if (bl.visibility == GPUShaderStage.COMPUTE) {
						extraComputeCode += this.getBindingCode(computeBindingCount++, bl);
					}
					else if (bl.visibility == GPUShaderStage.VERTEX) {
						extraVertexCode += this.getBindingCode(vertexBindingCount++, bl, 1);
					}
					else if (bl.visibility == GPUShaderStage.FRAGMENT) {
						extraFragmentCode += this.getBindingCode(fragmentBindingCount++, bl, 1);
					}
				}
			}
			extraComputeCode += `\r\n`;
			extraVertexCode += `\r\n`;
			extraFragmentCode += `\r\n`;
		}

		let layout: GPUBindGroupLayout;
		{ // 3. Bindings
			layout = //props.bindGroupLayout ?? 
				Shader.device.createBindGroupLayout({
				entries: props.bindingLayouts.map((b, i) => {
					return {
						binding: i,
						visibility: b.visibility ?? GPUShaderStage.COMPUTE,
						buffer: b.type == "write-only-texture" ? undefined : {
							type: b.type
						},
						// storageTexture: b.type == "write-only-texture" ? {
						// 	access: "write-only",
						// 	format: "rgba8unorm",
						// 	viewDimension: "2d"
						// } : undefined,
						texture: b.type == "write-only-texture" ? {
							sampleType: "float",
							viewDimension: "2d"
						} : undefined
					} as GPUBindGroupLayoutEntry;
				})
			});
		}

		{ // 4. Pipeline Configuration

			if (props.type == "compute") {
				this.computeCode = extraComputeCode + props.computeCode;
				let shaderModule = Shader.device.createShaderModule({ code: this.computeCode });

				this.pipeline = Shader.device.createComputePipeline({
					layout: Shader.device.createPipelineLayout({
						bindGroupLayouts: [layout],
					}),
					compute: {
						module: shaderModule,
						entryPoint: "main",
					},
				});
			}
			else {
				this.vertexCode = extraVertexCode + props.vertexCode;
				this.fragmentCode = extraFragmentCode + props.fragmentCode;

				// console.log(this.fragmentCode);

				let vertexShader = Shader.device.createShaderModule({ code: this.vertexCode });
				let fragmentShader = Shader.device.createShaderModule({ code: this.fragmentCode });

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
						buffers: props.vertexBuffers,
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

				this.renderPassDescriptor = {
					colorAttachments: [
						{
							view: undefined,
							loadOp: "clear" as "clear",
							storeOp: "store" as "store",
							clearValue: { r: 0, g: 0, b: 0, a: 1 }
						},
					],
				};

				// this.canvas = props.canvas;
				this.canvasContext = props.canvas.getContext('webgpu') as GPUCanvasContext;
				this.canvasContext.configure({
					device: Shader.device,
					format: Shader.presentationFormat,
					alphaMode: 'premultiplied',
					// usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
				});
			}
		}

		{ // 5. Bind groups.

			this.lastBindGroup = allBindingGroupNames[0];

			// console.log(allBindingGroupNames);
			Object.keys(allBindingGroupNames).forEach((key, i) => {
				let name = allBindingGroupNames[key];
				let spec = [];

				// Fill up the spec based on the binding layouts.
				for(let j = 0; j < props.bindingLayouts.length; j++){
					let bl = props.bindingLayouts[j];
					if(bl["binding"]){
						spec.push(bl["binding"]);
					}
					else if(bl["bindings"]){
						spec.push(bl["bindings"][name]);
					}
				}

				let bindGroup = Shader.device.createBindGroup({
					// TODO: should this always be hardcoded to 0?
					layout: this.pipeline.getBindGroupLayout(0),
					//layout,
					entries: spec.map((s, i) => {
						return {
							binding: i,
							resource: s instanceof GPUBuffer ? { buffer: s, label: key } : s
						};
					})
				});

				// console.log(key);
				this.bindGroups[name] = bindGroup;
			});
		}

	}

	pass(props?: { bindGroup?: string, vertices?: GPUBuffer }) {

		this.lastBindGroup = props?.bindGroup || this.lastBindGroup;

		if (this.type == "compute") {
			let commandEncoder = Shader.device.createCommandEncoder();
			let passEncoder = commandEncoder.beginComputePass();

			passEncoder.setPipeline(this.pipeline as GPUComputePipeline);
			passEncoder.setBindGroup(0, this.bindGroups[props.bindGroup ?? this.lastBindGroup]);
			passEncoder.dispatchWorkgroups(
				this.workgroupCount[0], this.workgroupCount[1], this.workgroupCount[2]
			);
			passEncoder.end();

			Shader.device.queue.submit([commandEncoder.finish()]);
		}
		else if (this.type == "render") {


			// TODO: try not creating the view each frame.
			let view = this.canvasContext.getCurrentTexture().createView();
			this.renderPassDescriptor.colorAttachments[0].view = view;

			let commandEncoder = Shader.device.createCommandEncoder();
			let passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
			passEncoder.setPipeline(this.pipeline as GPURenderPipeline);
			if (props?.vertices) passEncoder.setVertexBuffer(0, props.vertices);

			passEncoder.setBindGroup(0, this.bindGroups[props.bindGroup ?? this.lastBindGroup]);

			// TODO: this really isn't clean.
			// we're assuming quad vertices.
			// also vertices are not required to be passed in.
			// Some thought should go into this.
			let size = props?.vertices?.size;
			if(size){
				size = size / 4;
			}
			else{
				size = 6;
			}

			passEncoder.draw(size);
			passEncoder.end();

			Shader.device.queue.submit([commandEncoder.finish()]);
		}
		else {
			console.warn("Unknown shader type.");
		}

	}
}