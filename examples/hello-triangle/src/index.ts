import { RenderShader2d, Shader, UniformBuffer } from "simple-compute-shaders";

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.body.style.margin = "0";
document.body.style.overflow = "hidden";

// Shader code to draw a triangle. 
// Note that no bindings are declared in the code. 
// They will be injected by the library.
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
	// Define three arbitrary coordinates for the triangle in normalized coordinates (0..1 range)
	let v0 = vec2<f32>(0.25 * canvas_width, 0.25 * canvas_height); // Bottom-left
	let v1 = vec2<f32>(0.75 * canvas_width, 0.25 * canvas_height); // Bottom-right
	let v2 = vec2<f32>(0.5 * canvas_width, 0.75 * canvas_height);  // Top-center

	// Get the current fragment position
	let p = fragCoord.xy;

	// Check if the point lies within the triangle
	if (isPointInTriangle(p, v0, v1, v2)) {
		return color; // Inside the triangle, return the given color
	}

	return vec4<f32>(0.0, 0.0, 0.0, 1.0); // Background is black
}
`

class Renderer{
	canvas: HTMLCanvasElement;
	renderShader: RenderShader2d;
	colorBuffer: UniformBuffer;
	constructor(canvas: HTMLCanvasElement){
		this.canvas = canvas;

		window.addEventListener('resize', () => {
			this.canvas.width = window.innerWidth;
			this.canvas.height = window.innerHeight;
		});
	}

	async start(){
		await Shader.initialize();

		this.colorBuffer = new UniformBuffer({
			dataType: "vec4<f32>",
			// canCopyDst: true,
			canCopyDst: true,
			initialValue: [1,0,0,1] // Red
		});
		
		this.renderShader = new RenderShader2d({
			code: shaderCode,
			bindingLayouts: [{
				default: [
					{
						type: "uniform", 
						name: "color", 
						binding: this.colorBuffer 
					}
				]
			}],
			canvas: this.canvas
		});

		requestAnimationFrame(()=>this.render());
	}
	
	render(){
		
		let now = Date.now() / 1000;
		this.colorBuffer.write(new Float32Array([
			(Math.sin(now) * 0.5 + 0.5),
			(Math.sin(now * 1.7) * 0.5 + 0.5),
			(Math.sin(now * 1.3) * 0.5 + 0.5),
			1
		]));

		this.renderShader.pass();

		requestAnimationFrame(()=>this.render());
	}
}

const renderer = new Renderer(canvas);
renderer.start();