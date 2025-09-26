import { ShaderBuffer, UniformBuffer } from "./shader-buffer";
import type { BaseShaderProps, BindingDef } from "./shader-types";
import { isValidWebGpuVarName } from "./util";

var shaderInitialized = false;

export abstract class Shader {
	static device: GPUDevice;
	static presentationFormat: GPUTextureFormat;
	static adapter: GPUAdapter;
	// allBindingGroupNames: any[];

	executionCountBuffer: UniformBuffer;
	timeBuffer: UniformBuffer;
	executionCount = 0;
	time = 0;
	lastTime = 0;

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

	_bindGroupsByLayout: Record<string, GPUBindGroup>[] = [];
	_lastBindGroup: string;
	pipeline: GPUComputePipeline | GPURenderPipeline;
	props: BaseShaderProps;

	constructor(props: BaseShaderProps) {

		this.props = props;

		{ // Default props
			if(this.props.useExecutionCountBuffer !== false) this.props.useExecutionCountBuffer = true;
			if(this.props.useTimeBuffer !== false) this.props.useTimeBuffer = true;
			if(this.props.useExecutionCountBuffer && !this.props.executionCountBufferName) this.props.executionCountBufferName = "execution_count";
			if(this.props.useTimeBuffer && !this.props.timeBufferName) this.props.timeBufferName = "time";
			if(!this.props.bindingLayouts) this.props.bindingLayouts = [];
		}
		
		// this.allBindingGroupNames = [];
		{ // Validation
			// Ensure the shader class has been initialized.
			if (!Shader.isInitialized) throw new Error("Call Shader.initialize() before instantiating a shader pipeline.");
		
			// let isMultiMode = false;
			let groupNamesSet = new Set<string>();
		
			if (this.props.bindingLayouts?.length) {
				// Ensure that all binding layouts have compatible bindings.
				for (let i = 0; i < props.bindingLayouts.length; i++) {
					let bl = props.bindingLayouts[i];

					// Make sure that each bind group within this layout has compatible bindings.
					let firstGroup = Object.keys(bl)[0];
					for (let group of Object.keys(bl)) {
						for (let b = 0; b < bl[group].length; b++) {
							let binding = bl[group][b];
							if (binding.type != bl[firstGroup][b].type) {
								throw new Error(`Binding type mismatch in group ${group}: expected '${bl[firstGroup][b].type}', got '${binding.type}'`);
							}

							if (binding.name != bl[firstGroup][b].name) {
								throw new Error(`Binding name mismatch in group ${group}: expected '${bl[firstGroup][b].name}', got '${binding.name}'`);
							}

							if (binding.binding.baseType != bl[firstGroup][b].binding.baseType) {
								throw new Error(`Binding baseType mismatch in group ${group}: expected '${bl[firstGroup][b].binding.baseType}', got '${binding.binding.baseType}'`);
							}

							if (binding.binding.dataType != bl[firstGroup][b].binding.dataType) {
								throw new Error(`Binding dataType mismatch in group ${group}: expected '${bl[firstGroup][b].binding.dataType}', got '${binding.binding.dataType}'`);
							}
						}
					}
				}
			}

			if(this.props.useExecutionCountBuffer && !isValidWebGpuVarName(this.props.executionCountBufferName)){
				throw new Error("Invalid executionCountBufferName. Must be a valid WGSL variable name.");
			}
			if(this.props.useTimeBuffer && !isValidWebGpuVarName(this.props.timeBufferName)){
				throw new Error("Invalid timeBufferName. Must be a valid WGSL variable name.");
			}
		}
	}

	_setupShader(bindingVisibility: number) {
		let code = "";

		{ // 1. Shader Code Construction

			// We can configure stuff in the shader automatically.

			// This adds all the binding stuff to the shader code.
			let extraCode = this._initialize();
			code = extraCode + (
				typeof this.props.code === "string" ? this.props.code : this.props.code.join("\n")
			);
		}

		let layouts: GPUBindGroupLayout[] = [];
		{ // 2. Binding Layouts
			for(let i = 0; i < this.props.bindingLayouts.length; i++){
				this._bindGroupsByLayout.push({});

				let bg = this.props.bindingLayouts[i][Object.keys(this.props.bindingLayouts[i])[0]];
				let layout = Shader.device.createBindGroupLayout({
					entries: bg.map((b, bi) => {
						return {
							binding: bi,
							visibility: bindingVisibility,
							buffer: b.type == "write-only-texture" ? undefined : {
								type: b.type
							},
							texture: b.type == "write-only-texture" ? {
								sampleType: "float",
								viewDimension: "2d"
							} : undefined
						} as GPUBindGroupLayoutEntry;
					})
				});

				layouts.push(layout);
			}
		}

		{ // 3. Pipeline Configuration
			this._configurePipeline(code, layouts);
		}

		{ // 4. Bind groups.

			for(let i = 0; i < this.props.bindingLayouts.length; i++){
				let bl = this.props.bindingLayouts[i];
				let groupNames = Object.keys(bl);
				for(let j = 0; j < groupNames.length; j++){
					let name = groupNames[j];
					let spec = bl[name];

					let bindGroup = Shader.device.createBindGroup({
						layout: layouts[i],
						entries: spec.map((s, bi) => {
							return {
								binding: bi,
								resource: { buffer: s.binding.buffer, label: name }
							} as GPUBindGroupEntry;
						})
					});

					this._bindGroupsByLayout[i][name] = bindGroup;
				}
			}
		}
	}

	private _initialize(): string{
		let extraCode = "";

		let codeStr = typeof this.props.code === "string" ? this.props.code : this.props.code.join("\n");
	
		// Parse binding mappings from the obfuscated shader code
		let bindingMap: { [originalName: string]: string } = {};
		{
			let lines = codeStr.split("\n");
			for (let line of lines) {
				let trimmedLine = line.trim();
				if (trimmedLine.startsWith("//#!binding")) {
					let parts = trimmedLine.split(" ");
					if (parts.length >= 3) {
						let originalName = parts[1];
						let obfuscatedName = parts[2];
						bindingMap[originalName] = obfuscatedName;
					}
				}
			}
		}

		if (this.props.bindingLayouts) {
			for (let bl = 0; bl < this.props.bindingLayouts.length; bl++) {
				// Just get the first group. All groups should be the same (aside from specific buffers/uniforms).
				let bg = this.props.bindingLayouts[bl][Object.keys(this.props.bindingLayouts[bl])[0]];
				if(bg){
					for(let b = 0; b < bg.length; b++){

						// Determine the name to inject: obfuscated if available, original otherwise
						let originalName = bg[b].name;
						let nameToUse = bindingMap[originalName] || originalName;

						// Extract the data type (unchanged from your original code)
						let dataType: string = bg[b].binding?.dataType;
					
						if (!dataType) {
							console.warn(`No data type found for binding ${originalName}.`);
							continue;
						}

						let type = bg[b].type;
						let newBinding = `@group(${bl}) @binding(${b}) ${type == "var" ? "var" : `var<${type == "read-only-storage" ? "storage, read" : type == "storage" ? "storage, read_write" : type == "write-only-texture" ? "storage, read_write" : "uniform"}>`} ${nameToUse}: ${dataType};\r\n`;

						extraCode += newBinding;
						
					}
				}
			}
		}
		extraCode += `\r\n`;

		return extraCode;
	}

	abstract _configurePipeline(extraCode: string, layouts: GPUBindGroupLayout[]): void;

	dispose(){};
}