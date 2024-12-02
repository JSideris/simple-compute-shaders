import { ComputeShader, RenderShader2d, Shader, ShaderBuffer, StorageBuffer, UniformBuffer } from "simple-compute-shaders";
import bitonicSortWgsl from "./shaders/bitonic-sort.compute.wgsl";

document.body.style.margin = "0";
document.body.style.overflow = "hidden";

export default class Pipeline {

	active = false;
	dataBuffer: StorageBuffer;
	sortComputeShader: ComputeShader;

	constructor() { }

	async start() {
		{ // Check if the simulation is already active.
			if (this.active) {
				return;
			}
			this.active = true;
		}

		{ // Shader pipeline setup.
			await Shader.initialize();

			this.dataBuffer = new StorageBuffer({
				dataType: "array<f32>",
				size: 2048,
				canCopyDst: true,
				canCopySrc: true
			});

			this.sortComputeShader = new ComputeShader({
				code: bitonicSortWgsl,
				workgroupCount: [32, 1],
				bindingLayouts: [
					{
						binding: this.dataBuffer,
						name: "data",
						type: "storage"
					}
				]
			});

		}
	}

	async runPipeline() {

		// Create a random array of floats.

		let data = new Float32Array(2048);

		for (let i = 0; i < data.length; i++) {
			data[i] = Math.random() * 1000;
		}

		console.log("Unsorted data:", data);

		// Write the data to the buffer.

		this.dataBuffer.write(data);

		// Sort the data.

		this.sortComputeShader.pass();

		// Read the data back.

		let sortedData = await this.dataBuffer.read();

		console.log("Sorted data:", sortedData);
	}
}

let pipeline = new Pipeline();

pipeline.start().then(()=>{
	let button = document.createElement("button");

	button.style.position = "absolute";
	button.style.top = "50%";
	button.style.left = "50%";
	button.style.transform = "translate(-50%, -50%)";
	button.style.padding = "20px";
	button.style.fontSize = "20px";

	button.innerText = "Compute";
	button.onclick = () => pipeline.runPipeline();

	document.body.appendChild(button);
});