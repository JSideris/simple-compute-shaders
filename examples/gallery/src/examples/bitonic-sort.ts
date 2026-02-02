import { ComputeShader, Shader, StorageBuffer, UniformBuffer } from "simple-compute-shaders";
import { Example } from "../types";
import bitonicSortWgsl from "./shaders/bitonic-sort.compute.wgsl";

export const bitonicSort: Example = {
  id: "bitonic-sort",
  name: "Bitonic Sort",
  description: "GPU-accelerated bitonic sort for large datasets.",
  start: async (canvas: HTMLCanvasElement, container: HTMLDivElement) => {
    // Canvas is not used for rendering here, but we hide it
    canvas.style.display = 'none';
    
    container.style.color = 'white';
    container.style.padding = '20px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.height = '100%';

    const controls = document.createElement('div');
    controls.style.marginBottom = '20px';
    
    const regenerateButton = document.createElement('button');
    regenerateButton.innerText = "Regenerate Data";
    regenerateButton.style.padding = '10px';
    regenerateButton.style.marginRight = '10px';
    
    const computeButton = document.createElement('button');
    computeButton.innerText = "Sort on GPU";
    computeButton.style.padding = '10px';

    controls.appendChild(regenerateButton);
    controls.appendChild(computeButton);
    container.appendChild(controls);

    const dataDisplay = document.createElement('div');
    dataDisplay.style.display = 'flex';
    dataDisplay.style.gap = '20px';
    dataDisplay.style.flex = '1';
    dataDisplay.style.overflow = 'hidden';

    const leftDiv = document.createElement('div');
    leftDiv.style.flex = '1';
    leftDiv.style.overflowY = 'auto';
    leftDiv.style.border = '1px solid #555';
    leftDiv.style.padding = '10px';
    leftDiv.style.backgroundColor = '#1e1e1e';
    leftDiv.innerHTML = '<h3>Unsorted</h3>';
    const leftContent = document.createElement('div');
    leftDiv.appendChild(leftContent);

    const rightDiv = document.createElement('div');
    rightDiv.style.flex = '1';
    rightDiv.style.overflowY = 'auto';
    rightDiv.style.border = '1px solid #555';
    rightDiv.style.padding = '10px';
    rightDiv.style.backgroundColor = '#1e1e1e';
    rightDiv.innerHTML = '<h3>Sorted</h3>';
    const rightContent = document.createElement('div');
    rightDiv.appendChild(rightContent);

    dataDisplay.appendChild(leftDiv);
    dataDisplay.appendChild(rightDiv);
    container.appendChild(dataDisplay);

    await Shader.initialize();

    const dataSize = 2048;

    const paramsBuffer = new UniformBuffer({
      dataType: "vec2<u32>",
      canCopyDst: true,
    });

    const dataBuffer = new StorageBuffer({
      dataType: "array<f32>",
      size: dataSize,
      canCopyDst: true,
      canCopySrc: true,
    });

    const sortComputeShader = new ComputeShader({
      code: bitonicSortWgsl,
      useTimeBuffer: false,
      useExecutionCountBuffer: false,
      workgroupCount: [dataSize / 64, 1], // @workgroup_size(64)
      bindingLayouts: [{
        default: [
          { binding: dataBuffer, name: "data", type: "storage" },
          { binding: paramsBuffer, name: "params", type: "uniform" },
        ]
      }],
    });

    let data = new Float32Array(dataSize);

    const getColor = (val: number) => {
      const v = Math.max(0, Math.min(1000, val));
      let r = 255;
      let g = 150;
      let b = 0;
      if (v <= 500) {
        b = Math.floor((v / 500) * 255);
      } else {
        r = Math.floor(255 - ((v - 500) / 500) * 255);
        b = 255;
      }
      return `rgb(${r}, ${g}, ${b})`;
    };

    const formatData = (dataArray: Float32Array | number[]) => {
      return Array.from(dataArray).map(val => {
        return `<span style="color: ${getColor(val)}">${val.toFixed(1)}</span>`;
      }).join(", ");
    };

    const regenerateData = () => {
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 1000;
      }
      leftContent.innerHTML = formatData(data);
      rightContent.innerHTML = "";
    };

    const runSort = async () => {
      dataBuffer.write(data);
      
      for (let k = 2; k <= dataSize; k *= 2) {
        for (let j = k / 2; j > 0; j /= 2) {
          paramsBuffer.write(new Uint32Array([k, j]));
          sortComputeShader.dispatch();
        }
      }

      const sortedData = await dataBuffer.read();
      rightContent.innerHTML = formatData(sortedData as Float32Array);
    };

    regenerateButton.onclick = regenerateData;
    computeButton.onclick = runSort;

    regenerateData();

    return () => {
      canvas.style.display = 'block';
      sortComputeShader.dispose();
      dataBuffer.dispose();
      paramsBuffer.dispose();
    };
  }
};
