import { ComputeShader, RenderShader2d, Shader, StorageBuffer, UniformBuffer } from "simple-compute-shaders";
import { Example } from "../types";
import dftWgsl from "./shaders/audio-dft.compute.wgsl";
import renderWgsl from "./shaders/audio-render.fragment.wgsl";

export const audioProcessor: Example = {
  id: "audio-processor",
  name: "Audio Processor",
  description: "Real-time audio DFT (Discrete Fourier Transform) on the GPU.",
  start: async (canvas: HTMLCanvasElement, container: HTMLDivElement) => {
    const instructions = document.createElement('div');
    instructions.innerHTML = "Click to start audio processing";
    instructions.style.position = "absolute";
    instructions.style.top = "50%";
    instructions.style.left = "50%";
    instructions.style.transform = "translate(-50%, -50%)";
    instructions.style.color = "white";
    instructions.style.padding = "20px";
    instructions.style.backgroundColor = "rgba(0,0,0,0.7)";
    instructions.style.borderRadius = "10px";
    instructions.style.cursor = "pointer";
    container.appendChild(instructions);

    let audioContext: AudioContext;
    let animationFrameId: number;
    let dftComputeShader: ComputeShader;
    let dftRenderShader: RenderShader2d;
    let audioBuffer: StorageBuffer;
    let dftBuffer: StorageBuffer;
    let offsetBuffer: UniformBuffer;

    const startAudio = async () => {
      instructions.style.display = "none";
      
      try {
        audioContext = new AudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        const dataArray = new Float32Array(analyser.fftSize);
        source.connect(analyser);

        await Shader.initialize();

        offsetBuffer = new UniformBuffer({
          dataType: "struct",
          structName: "Offsets",
          fields: [
            { name: "startOffset", dataType: "i32" },
            { name: "endOffset", dataType: "i32" }
          ],
          initialValue: [0, 0],
          canCopyDst: true
        });

        audioBuffer = new StorageBuffer({
          dataType: "array<f32>",
          size: 2048,
          canCopyDst: true
        });

        dftBuffer = new StorageBuffer({
          dataType: "array<f32>",
          size: 1000
        });

        dftComputeShader = new ComputeShader({
          code: dftWgsl,
          workgroupCount: [8, 1],
          bindingLayouts: [{
            default: [
              { binding: audioBuffer, name: "inputData", type: "read-only-storage" },
              { binding: dftBuffer, name: "outputData", type: "storage" },
            ]
          }]
        });

        dftRenderShader = new RenderShader2d({
          canvas: canvas,
          code: renderWgsl,
          bindingLayouts: [{
            default: [
              { type: "read-only-storage", name: "audio", binding: audioBuffer },
              { type: "read-only-storage", name: "dftData", binding: dftBuffer },
              { type: "uniform", name: "offsets", binding: offsetBuffer },
            ]
          }]
        });

        const runPipeline = () => {
          analyser.getFloatTimeDomainData(dataArray);
          
          let startOffset = 0;
          let endOffset = 0;
          const range = 0.01;
          for (let i = 0; i < dataArray.length / 2; i++) {
            if (dataArray[i] < range && dataArray[i] > -range && dataArray[i] < dataArray[i + 1]) {
              startOffset = i;
              break;
            }
          }
          for (let i = 0; i < dataArray.length / 2; i++) {
            const idx = dataArray.length - 1 - i;
            if (dataArray[idx] < range && dataArray[idx] > -range && dataArray[idx] > dataArray[idx - 1]) {
              endOffset = i;
              break;
            }
          }

          offsetBuffer.write(new Int32Array([startOffset, endOffset]));
          audioBuffer.write(dataArray);

          dftComputeShader.dispatch();
          dftRenderShader.pass();

          animationFrameId = requestAnimationFrame(runPipeline);
        };

        runPipeline();
      } catch (error) {
        console.error('Error initializing audio:', error);
        instructions.style.display = "block";
        instructions.innerHTML = "Error accessing microphone. Make sure you are on HTTPS.";
      }
    };

    instructions.onclick = startAudio;

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext) audioContext.close();
      if (dftComputeShader) dftComputeShader.dispose();
      if (dftRenderShader) dftRenderShader.dispose();
      if (audioBuffer) audioBuffer.dispose();
      if (dftBuffer) dftBuffer.dispose();
      if (offsetBuffer) offsetBuffer.dispose();
    };
  }
};
