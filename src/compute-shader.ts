import { BaseShaderProps, Shader } from "./shader";

type ComputeShaderProps = BaseShaderProps & {
	workgroupCount: [number, number, number] | [number, number];
}

export default class ComputeShader extends Shader{

	pipeline: GPUComputePipeline;
	props: ComputeShaderProps;

	constructor(props: ComputeShaderProps){
		super(props);
		this.props = props;

		super._setupShader(GPUShaderStage.COMPUTE);
	}

	pass(props?: { bindGroup?: string, vertices?: GPUBuffer }) {

		this.lastBindGroup = props?.bindGroup || this.lastBindGroup;

		let commandEncoder = Shader.device.createCommandEncoder();
		let passEncoder = commandEncoder.beginComputePass();

		passEncoder.setPipeline(this.pipeline as GPUComputePipeline);
		passEncoder.setBindGroup(0, this.bindGroups[props?.bindGroup ?? this.lastBindGroup]);
		passEncoder.dispatchWorkgroups(
			this.props.workgroupCount[0], this.props.workgroupCount[1], this.props.workgroupCount[2]
		);
		passEncoder.end();

		Shader.device.queue.submit([commandEncoder.finish()]);


	}

	_configurePipeline(extraCode: string, layout: GPUBindGroupLayout): void {
		let code = extraCode + this.props.code;
		let shaderModule = Shader.device.createShaderModule({ code: code });

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

	_initialize(bindingLayouts): string{
		let extraComputeCode = "";

		let computeBindingCount = 0;
		if (bindingLayouts) {
			for (let i = 0; i < bindingLayouts.length; i++) {
				let bl = bindingLayouts[i];
				extraComputeCode += Shader._getBindingCode(computeBindingCount++, bl);
			}
		}
		extraComputeCode += `\r\n`;

		return extraComputeCode;
	}
}