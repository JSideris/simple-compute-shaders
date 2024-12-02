import { ComputeShader, Shader, StorageBuffer } from "simple-compute-shaders";
import bitonicSortWgsl from "./shaders/bitonic-sort.compute.wgsl";

export default class Pipeline {

    active = false;
    dataBuffer: StorageBuffer;
    sortComputeShader: ComputeShader;
    data: Float32Array;

    constructor() {}

    async start() {
        if (this.active) {
            return; // If the simulation is already active, exit.
        }
        this.active = true;

        // Shader pipeline setup
        await Shader.initialize();

        this.dataBuffer = new StorageBuffer({
            dataType: "array<f32>",
            size: 2048,
            canCopyDst: true,
            canCopySrc: true,
        });

        this.sortComputeShader = new ComputeShader({
            code: bitonicSortWgsl,
            workgroupCount: [32, 1],
            bindingLayouts: [
                {
                    binding: this.dataBuffer,
                    name: "data",
                    type: "storage",
                },
            ],
        });

        // Set up the UI
        this.setupUI();
        this.regenerateData();
    }

    // Set up the UI with two divs and buttons
    setupUI() {

		// Set global font to sans-serif
		document.body.style.fontFamily = "sans-serif";

		const h1 = document.createElement("h1");
		h1.innerText = "Bitonic Sort";
		h1.style.textAlign = "center";
		h1.style.marginTop = "20px";
		document.body.appendChild(h1);

        // Wrapper div
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.justifyContent = "space-between";
        wrapper.style.padding = "20px";

        // Left Div: Unsorted Data with Regenerate Button
        const leftDiv = document.createElement("div");
        leftDiv.id = "unsortedDataDiv";
        leftDiv.style.flex = "1";
        leftDiv.style.marginRight = "20px";
        leftDiv.style.padding = "20px";
        leftDiv.style.border = "1px solid #ccc";
        leftDiv.style.borderRadius = "10px";
        leftDiv.style.backgroundColor = "#f9f9f9";
        leftDiv.style.maxHeight = "80vh";
        leftDiv.style.overflowY = "auto";
		leftDiv.style.fontFamily = "monospace";

        const regenerateButton = document.createElement("button");
        regenerateButton.innerText = "Regenerate";
        regenerateButton.style.display = "block";
        regenerateButton.style.marginBottom = "20px";
        regenerateButton.style.padding = "10px";
        regenerateButton.onclick = () => this.regenerateData();

        leftDiv.appendChild(regenerateButton);
        wrapper.appendChild(leftDiv);

        // Middle Div: Compute Button
        const middleDiv = document.createElement("div");
        middleDiv.style.display = "flex";
        middleDiv.style.alignItems = "center";
        middleDiv.style.margin = "0 20px";

        const computeButton = document.createElement("button");
        computeButton.innerText = "Compute";
        computeButton.style.padding = "15px";
        computeButton.style.fontSize = "16px";
        computeButton.onclick = () => this.runPipeline();

        middleDiv.appendChild(computeButton);
        wrapper.appendChild(middleDiv);

        // Right Div: Sorted Data
        const rightDiv = document.createElement("div");
        rightDiv.id = "sortedDataDiv";
        rightDiv.style.flex = "1";
        rightDiv.style.marginLeft = "20px";
        rightDiv.style.padding = "20px";
        rightDiv.style.border = "1px solid #ccc";
        rightDiv.style.borderRadius = "10px";
        rightDiv.style.backgroundColor = "#f9f9f9";
        rightDiv.style.maxHeight = "80vh";
        rightDiv.style.overflowY = "auto";
		rightDiv.style.fontFamily = "monospace";

        wrapper.appendChild(rightDiv);

        // Append everything to the body
        document.body.appendChild(wrapper);
    }

    // Function to regenerate data and display it in the left div
    regenerateData() {
        this.data = new Float32Array(2048);
        for (let i = 0; i < this.data.length; i++) {
            this.data[i] = Math.random() * 1000;
        }

        const leftDiv = document.getElementById("unsortedDataDiv");
        if (leftDiv) {
            // Clear previous content
            leftDiv.innerHTML = "";

            // Re-add the regenerate button
            const regenerateButton = document.createElement("button");
            regenerateButton.innerText = "Regenerate";
            regenerateButton.style.display = "block";
            regenerateButton.style.marginBottom = "20px";
            regenerateButton.style.padding = "10px";
            regenerateButton.onclick = () => this.regenerateData();

            leftDiv.appendChild(regenerateButton);

            // Add the data
            const dataText = document.createElement("div");
            dataText.innerText = this.data.join(", ");
            leftDiv.appendChild(dataText);
        }

        // Clear the sorted data div
        const rightDiv = document.getElementById("sortedDataDiv");
        if (rightDiv) {
            rightDiv.innerHTML = "";
        }
    }

    // Function to run the pipeline and display sorted results
    async runPipeline() {
        // Write the data to the buffer
        this.dataBuffer.write(this.data);

        // Sort the data
        this.sortComputeShader.dispatch();

        // Read the data back
        let sortedData = await this.dataBuffer.read();

        // Display sorted data in the right div
        const rightDiv = document.getElementById("sortedDataDiv");
        if (rightDiv) {
            rightDiv.innerHTML = sortedData.join(", ");
        }
    }
}

let pipeline = new Pipeline();

pipeline.start();
