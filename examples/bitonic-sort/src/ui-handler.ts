import type Pipeline from ".";

export default class UIHandler {
    pipeline: Pipeline;

    constructor(pipeline: Pipeline) {
        this.pipeline = pipeline;
    }

    setupUI() {

        // Set global font to sans-serif
		document.body.style.fontFamily = "sans-serif";
		document.body.style.backgroundColor = "#222";

		const h1 = document.createElement("h1");
		h1.innerText = "Bitonic Sort";
		h1.style.textAlign = "center";
		h1.style.marginTop = "20px";
		h1.style.color = "white";
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
        regenerateButton.onclick = () => this.pipeline.regenerateData();

        leftDiv.appendChild(regenerateButton);
        wrapper.appendChild(leftDiv);

        // Middle Div: Compute Button
        const middleDiv = document.createElement("div");
        middleDiv.style.display = "flex";
        middleDiv.style.flexDirection = "column";
        middleDiv.style.alignItems = "center";
        middleDiv.style.margin = "0 20px";
        middleDiv.style.justifyContent = "center";

        const computeButton = document.createElement("button");
        computeButton.innerText = "Compute";
        computeButton.style.padding = "15px";
        computeButton.style.fontSize = "16px";
        computeButton.style.display = "block";
        computeButton.onclick = () => this.pipeline.runPipeline();

        const computeTimeLabel = document.createElement("div");
        computeTimeLabel.style.textAlign = "center";
        computeTimeLabel.style.width = "100%";
        computeTimeLabel.style.color = "white";
        computeTimeLabel.id = "comute-time-label";

        middleDiv.appendChild(computeButton);
        middleDiv.appendChild(document.createElement("br"));
        middleDiv.appendChild(computeTimeLabel);
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

    updateUnsortedDataDisplay(data: Float32Array) {
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
            regenerateButton.onclick = () => this.pipeline.regenerateData();

            leftDiv.appendChild(regenerateButton);

            // Add the data
            const dataText = document.createElement("div");
            dataText.innerText = data.join(", ");
            leftDiv.appendChild(dataText);
        }
    }

    updateSortedDataDisplay(sortedData: Float32Array) {
        const rightDiv = document.getElementById("sortedDataDiv");
        if (rightDiv) {
            rightDiv.innerHTML = sortedData.join(", ");
        }
    }

    updateComputeTimeDisplay(time: number) {
        const computeTimeLabel = document.getElementById("comute-time-label")!;
        computeTimeLabel.innerText = `${time.toFixed(4)}ms.`;
    }
}