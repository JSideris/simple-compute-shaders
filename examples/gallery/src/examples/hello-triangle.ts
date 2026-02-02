import { RenderShader2d, Shader, UniformBuffer } from "simple-compute-shaders";
import { Example } from "../types";

const shaderCode = /*WGSL*/`
fn isPointInTriangle(p: vec2<f32>, v0: vec2<f32>, v1: vec2<f32>, v2: vec2<f32>) -> bool {
	let dX = p.x - v2.x;
	let dY = p.y - v2.y;
	let dX21 = v2.x - v1.x;
	let dY12 = v1.y - v2.y;
	let D = dY12 * (v0.x - v2.x) + dX21 * (v0.y - v2.y);
	let s = dY12 * dX + dX21 * dY;
	let t = (v2.y - v0.y) * dX + (v0.x - v2.x) * dY;
	
	if (D < 0.0) {
		return s <= 0.0 && t <= 0.0 && s + t >= D;
	}
	return s >= 0.0 && t >= 0.0 && s + t <= D;
}

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
	let v0 = vec2<f32>(0.25 * canvas_width, 0.25 * canvas_height);
	let v1 = vec2<f32>(0.75 * canvas_width, 0.25 * canvas_height);
	let v2 = vec2<f32>(0.5 * canvas_width, 0.75 * canvas_height);

	let p = fragCoord.xy;

	if (isPointInTriangle(p, v0, v1, v2)) {
		return color;
	}

	return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}
`;

export const helloTriangle: Example = {
  id: "hello-triangle",
  name: "Hello Triangle",
  description: "A simple 2D render shader that draws a animated triangle.",
  start: async (canvas: HTMLCanvasElement, _container: HTMLDivElement) => {
    await Shader.initialize();

    const colorBuffer = new UniformBuffer({
      dataType: "vec4<f32>",
      canCopyDst: true,
      initialValue: [1, 0, 0, 1]
    });

    const renderShader = new RenderShader2d({
      code: shaderCode,
      bindingLayouts: [{
        default: [
          {
            type: "uniform",
            name: "color",
            binding: colorBuffer
          }
        ]
      }],
      canvas: canvas
    });

    let animationFrameId: number;

    const render = () => {
      let now = Date.now() / 1000;
      colorBuffer.write(new Float32Array([
        (Math.sin(now) * 0.5 + 0.5),
        (Math.sin(now * 1.7) * 0.5 + 0.5),
        (Math.sin(now * 1.3) * 0.5 + 0.5),
        1
      ]));

      renderShader.pass();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      renderShader.dispose();
      colorBuffer.dispose();
    };
  }
};
