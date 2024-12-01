import { ShaderBuffer } from "./shader-buffer";

var shaderInitialized = false;



type BindingLayoutDef = {
	type: "storage" | "read-only-storage" | "uniform" | "write-only-texture" | "var";
	name: string;
	// visibility: number;
} & (
	{
		binding: ShaderBuffer
	} 
	// Not supported yet.
	// | {
	// 	bindGroups: Record<string, ShaderBuffer>
	// }
)

export type BaseShaderProps = {
	code: string;
	bindingLayouts?: Array<BindingLayoutDef>;
}




export abstract class Shader {
	static device: GPUDevice;
	// static commandEncoder: GPUCommandEncoder;
	// static context: GPUCanvasContext;
	// static canvas: HTMLCanvasElement;
	static presentationFormat: GPUTextureFormat;
	static adapter: GPUAdapter;
	allBindingGroupNames: any[];

	// fragmentCode: string;
	// vertexCode: string;
	// computeCode: string;

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

	static _getBindingCode(numb: number, bl: BindingLayoutDef, group: number = 0) {

		let dataType:string;
		if(bl["binding"]){
			dataType = bl["binding"].dataType;
		}
		else{
			dataType = bl["bindGroups"][Object.keys(bl["bindGroups"])[group]]?.dataType;
		}
		// || bl["bindGroups"][Object.keys(bl["bindGroups"])[group]];

		if(!dataType) {
			console.warn(`No data type found for binding ${bl.name}.`);
			return "";
		}

		let newBinding = `@binding(${numb}) @group(${0}) ${bl.type == "var" ? "var" : `var<${bl.type == "read-only-storage" ? "storage, read" : bl.type == "storage" ? "storage, read_write" : bl.type == "write-only-texture" ? "storage, read_write" : "uniform"}>`} ${bl.name}: ${dataType};\r\n`;

		// console.log(newBinding);

		return newBinding;
	}

	bindGroups: Record<string, GPUBindGroup> = {};
	lastBindGroup: string;
	pipeline: GPUComputePipeline | GPURenderPipeline;
	props: BaseShaderProps;

	constructor(props: BaseShaderProps) {

		this.props = props;
		
		this.allBindingGroupNames = [];
		{ // Validation
			// Ensure the shader class has been initialized.
			if (!Shader.isInitialized) throw new Error("Call Shader.initialize before instantiating a shader.");
		
			let isMultiMode = false;
			let groupNamesSet = new Set<string>();
		
			if (props.bindingLayouts?.length) {
				// First pass: Determine if any layout is multi-mode and collect group names
				for (let i = 0; i < props.bindingLayouts.length; i++) {
					let bl = props.bindingLayouts[i];
					if (bl["bindGroups"]) {
						isMultiMode = true;
						let currentBindingNames = Object.keys(bl["bindGroups"]);
						currentBindingNames.forEach(name => groupNamesSet.add(name));
					}
				}
		
				if (isMultiMode) {
					// We are in multi-mode
					this.allBindingGroupNames = Array.from(groupNamesSet);
					// Ensure that "default" is not included
					let defaultIndex = this.allBindingGroupNames.indexOf("default");
					if (defaultIndex >= 0) {
						this.allBindingGroupNames.splice(defaultIndex, 1);
					}
				} else {
					// We are in single-mode
					this.allBindingGroupNames = ["default"];
				}
		
				// Second pass: Validation
				for (let i = 0; i < props.bindingLayouts.length; i++) {
					let bl = props.bindingLayouts[i];
					if (bl["bindGroups"]) {
						// Multi-mode binding layout
						let currentBindingNames = Object.keys(bl["bindGroups"]);
		
						// Check that currentBindingNames match this.allBindingGroupNames
						for (let name of currentBindingNames) {
							if (!this.allBindingGroupNames.includes(name)) {
								throw new Error("All binding groups must have the same names.");
							}
						}
		
						if (currentBindingNames.length != this.allBindingGroupNames.length) {
							throw new Error("All binding groups must have the same number of bindings.");
						}
		
						// Ensure that each binding within the group has the same `dataType`.
						let type = bl["bindGroups"][currentBindingNames[0]]?.dataType;
						for (let j = 0; j < currentBindingNames.length; j++) {
							if (bl["bindGroups"][currentBindingNames[j]]?.dataType != type) {
								throw new Error("All bindings within a group must have the same `dataType`.");
							}
						}
					} else if (bl["binding"]) {
						// Single-mode binding layout
						// No additional validation needed in this context
					} else {
						throw new Error("Binding layout must have either 'binding' or 'bindGroups'.");
					}
				}
			}
		}
		
	}

	_setupShader(bindingVisibility: number) {
		let extraCode = "";

		{ // 1. Initialization

			// We can configure stuff in the shader automatically.

			extraCode += this._initialize(this.props.bindingLayouts);
		}

		let layout: GPUBindGroupLayout;
		{ // 2. Bindings
			layout = //props.bindGroupLayout ?? 
				Shader.device.createBindGroupLayout({
				entries: this.props.bindingLayouts.map((b, i) => {
					return {
						binding: i,
						visibility: bindingVisibility,
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

		{ // 3. Pipeline Configuration
			this._configurePipeline(extraCode, layout);
		}

		{ // 4. Bind groups.

			this.lastBindGroup = this.allBindingGroupNames[0];

			// console.log(allBindingGroupNames);
			Object.keys(this.allBindingGroupNames).forEach((key, i) => {
				let name = this.allBindingGroupNames[key];
				let spec = [];

				// Fill up the spec based on the binding layouts.
				for(let j = 0; j < this.props.bindingLayouts.length; j++){
					let bl = this.props.bindingLayouts[j];
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

	abstract _configurePipeline(extraCode: string, layout: GPUBindGroupLayout): void;
	abstract _initialize(bindingLayouts: Array<BindingLayoutDef>): string;

	abstract pass(props?: { bindGroup?: string });

	dispose(){};
}