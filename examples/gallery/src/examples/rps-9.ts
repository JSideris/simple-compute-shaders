import { ComputeShader, RenderShader2d, Shader, StorageBuffer } from "simple-compute-shaders";
import { Example } from "../types";
import rpsWgsl from "./shaders/rps.compute.wgsl";
import renderWgsl from "./shaders/rps-render.fragment.wgsl";

const WIDTH = 1920;
const HEIGHT = 1080;
const GRID_SIZE = WIDTH * HEIGHT;

export const rps9: Example = {
  id: "rps-9",
  name: "RPS-9",
  description: "9-way Rock Paper Scissors cellular automaton simulation.",
  start: async (canvas: HTMLCanvasElement, container: HTMLDivElement) => {
    const instructions = document.createElement('div');
    instructions.textContent = "Click to reset simulation.";
    instructions.style.position = "fixed";
    instructions.style.bottom = "40px";
    instructions.style.left = "50%";
    instructions.style.transform = "translateX(-50%)";
    instructions.style.color = "white";
    instructions.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    instructions.style.padding = "10px";
    instructions.style.borderRadius = "5px";
    instructions.style.pointerEvents = "none";
    container.appendChild(instructions);

    await Shader.initialize();

    const dataArrayA = new Uint32Array(GRID_SIZE);
    const dataArrayB = new Uint32Array(GRID_SIZE);

    const initializeData = () => {
      for (let i = 0; i < dataArrayA.length; i++) {
        dataArrayA[i] = Math.floor(Math.random() * 9);
      }
    };

    initializeData();

    const dataBuffers = [
      new StorageBuffer({
        dataType: "array<u32>",
        size: GRID_SIZE,
        canCopyDst: true,
        initialValue: dataArrayA
      }),
      new StorageBuffer({
        dataType: "array<u32>",
        size: GRID_SIZE,
        canCopyDst: true
      }),
    ];

    const rpsComputeShader = new ComputeShader({
      code: rpsWgsl,
      workgroupCount: [120, 68],
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
      rpsComputeShader.dispatch({
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
      initializeData();
      dataBuffers[0].write(dataArrayA);
      dataArrayB.fill(0);
      dataBuffers[1].write(dataArrayB);
      swapState = 0;
    };

    canvas.addEventListener('click', reset);

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('click', reset);
      rpsComputeShader.dispose();
      renderShader.dispose();
      dataBuffers.forEach(b => b.dispose());
    };
  }
};
