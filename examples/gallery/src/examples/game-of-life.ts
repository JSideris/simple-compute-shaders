import { ComputeShader, RenderShader2d, Shader, StorageBuffer } from "simple-compute-shaders";
import { Example } from "../types";
import dftWgsl from "./shaders/gol.compute.wgsl";
import renderWgsl from "./shaders/gol-render.fragment.wgsl";

export const gameOfLife: Example = {
  id: "game-of-life",
  name: "Game of Life",
  description: "GPU implementation of Conway's Game of Life with buffer swapping.",
  start: async (canvas: HTMLCanvasElement, _container: HTMLDivElement) => {
    await Shader.initialize();

    const size = 1024;
    const dataArrayA = new Uint32Array(size * size);
    const dataArrayB = new Uint32Array(size * size);

    const initializeData = (arr: Uint32Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.random() > 0.5 ? 1 : 0;
      }
    };

    initializeData(dataArrayA);

    const dataBuffers = [
      new StorageBuffer({
        dataType: "array<u32>",
        size: size * size,
        canCopyDst: true,
        initialValue: dataArrayA
      }),
      new StorageBuffer({
        dataType: "array<u32>",
        size: size * size,
        canCopyDst: true
      }),
    ];

    const golComputeShader = new ComputeShader({
      code: dftWgsl,
      workgroupCount: [64, 64],
      bindingLayouts: [{
        group1: [
          { binding: dataBuffers[0], name: "currentState", type: "storage" },
          { binding: dataBuffers[1], name: "nextState", type: "storage" },
        ],
        group2: [
          { binding: dataBuffers[1], name: "currentState", type: "storage" },
          { binding: dataBuffers[0], name: "nextState", type: "storage" },
        ]
      }]
    });

    const renderShader = new RenderShader2d({
      canvas: canvas,
      code: renderWgsl,
      bindingLayouts: [{
        group1: [
          { type: "read-only-storage", name: "data", binding: dataBuffers[1] },
        ],
        group2: [
          { type: "read-only-storage", name: "data", binding: dataBuffers[0] },
        ]
      }],
    });

    let swapState = 0;
    let animationFrameId: number;

    const runPipeline = () => {
      golComputeShader.dispatch({
        bindGroups: {
          0: swapState === 0 ? "group1" : "group2",
        }
      });

      renderShader.pass({
        bindGroups: {
          0: swapState === 0 ? "group1" : "group2",
        }
      });

      swapState = 1 - swapState;
      animationFrameId = requestAnimationFrame(runPipeline);
    };

    runPipeline();

    const reset = () => {
      initializeData(dataArrayA);
      dataBuffers[0].write(dataArrayA);
      dataArrayB.fill(0);
      dataBuffers[1].write(dataArrayB);
      swapState = 0;
    };

    canvas.addEventListener('click', reset);

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('click', reset);
      renderShader.dispose();
      golComputeShader.dispose();
      dataBuffers.forEach(b => b.dispose());
    };
  }
};
