import { ComputeShader, Shader, StorageBuffer } from "simple-compute-shaders";
import bitonicSortWgsl from "./shaders/bitonic-sort.compute.wgsl";
import UIHandler from "./ui-handler";

export default class Pipeline {

    active = false;
    dataBuffer: StorageBuffer;
    sortComputeShader: ComputeShader;
    data: Float32Array;
    uiHandler: UIHandler;

    constructor() {
        this.uiHandler = new UIHandler(this);
    }

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
            useTimeBuffer: false,
            useExecutionCountBuffer: false,
            workgroupCount: [32, 1],
            bindingLayouts: [{
                default: [
                    {
                        binding: this.dataBuffer,
                        name: "data",
                        type: "storage",
                    },
                ]
            }],
        });

        // Set up the UI
        this.uiHandler.setupUI();
        this.regenerateData();
    }

    // Function to regenerate data and display it in the left div
    regenerateData() {
        this.data = new Float32Array(2048);
        for (let i = 0; i < this.data.length; i++) {
            this.data[i] = Math.random() * 1000;
        }

        this.uiHandler.updateUnsortedDataDisplay(this.data);

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
        // Not very precise. Consider using device.createQuerySet() and device.getQuerySetResults() for more accurate timing.
        let now1 = performance.now();
        this.sortComputeShader.dispatch();
        let now2 = performance.now();
        let time = now2 - now1;
        // this.uiHandler.updateComputeTimeDisplay(time);

        // Read the data back
        let sortedData = await this.dataBuffer.read();

        // Display sorted data in the right div
        this.uiHandler.updateSortedDataDisplay(sortedData as Float32Array);
    }
}

let pipeline = new Pipeline();

pipeline.start();
