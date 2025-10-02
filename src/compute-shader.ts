import { Shader } from "./shader";
import { UniformBuffer } from "./shader-buffer";
import type { BaseShaderProps, BindingGroupDef } from "./shader-types";

type ComputeShaderProps = BaseShaderProps & {
	workgroupCount: [number, number, number] | [number, number];
}

export default class ComputeShader extends Shader{

	pipeline: GPUComputePipeline;
	props: ComputeShaderProps;

	constructor(props: ComputeShaderProps){
		super(props);
		this.props = props;

		{ // Internal binding layout.
			if(this.props.useTimeBuffer){
				this.timeBuffer = new UniformBuffer({
					dataType: "f32",
					canCopyDst: true
				});
			}
			if(this.props.useExecutionCountBuffer){
				this.executionCountBuffer = new UniformBuffer({
					dataType: "u32",
					canCopyDst: true
				});
			}

			if(this.timeBuffer || this.executionCountBuffer){
				let bindings = [];

				if(this.timeBuffer){
					bindings.push({
						type: "uniform",
						name: this.props.timeBufferName,
						binding: this.timeBuffer
					});
				}
				if(this.executionCountBuffer){
					bindings.push({
						type: "uniform",
						name: this.props.executionCountBufferName,
						binding: this.executionCountBuffer
					});
				}

				this.props.bindingLayouts.push({
					default: bindings
				});
			}
		}

		super._setupShader(GPUShaderStage.COMPUTE);
	}

	dispatch(props?: {
		bindGroups?: Record<number, string>
	}) {

		{ // Update built-in buffers
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

		// this.lastBindGroup = props?.bindGroup || this.lastBindGroup;

		let commandEncoder = Shader.device.createCommandEncoder();
		let passEncoder = commandEncoder.beginComputePass();

		passEncoder.setPipeline(this.pipeline as GPUComputePipeline);
		
		for(let i = 0; i < this._bindGroupsByLayout.length; i++){
			let bl = this._bindGroupsByLayout[i];
			let groupToSet: GPUBindGroup = bl[props?.bindGroups?.[i] ? props?.bindGroups?.[i] : Object.keys(bl)[0]];

			if(!groupToSet){
				console.warn(`Bind group ${props?.bindGroups?.[i] ? props?.bindGroups?.[i] : Object.keys(bl)[0]} not found for layout ${i}.`);
				continue;
			}
			passEncoder.setBindGroup(i, groupToSet);
		}

		passEncoder.dispatchWorkgroups(
			this.props.workgroupCount[0], this.props.workgroupCount[1], this.props.workgroupCount[2]
		);
		passEncoder.end();

		Shader.device.queue.submit([commandEncoder.finish()]);
	}

	_configurePipeline(code: string, layouts: GPUBindGroupLayout[]): void {
		let shaderModule = Shader.device.createShaderModule({ code: code });

		this.pipeline = Shader.device.createComputePipeline({
			layout: Shader.device.createPipelineLayout({
				bindGroupLayouts: layouts,
			}),
			compute: {
				module: shaderModule,
				entryPoint: "main",
			},
		});
	}
}