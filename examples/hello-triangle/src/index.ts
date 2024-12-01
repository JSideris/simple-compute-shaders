import { RenderShader2d, Shader, UniformBuffer } from "simple-compute-shaders";

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.body.style.margin = "0";
document.body.style.overflow = "hidden";

class Renderer{
	canvas: HTMLCanvasElement;
	renderShader: RenderShader2d;
	colorBuffer: UniformBuffer;
	constructor(canvas: HTMLCanvasElement){
		this.canvas = canvas;
	}

	async start(){
		await Shader.initialize();

		this.colorBuffer = new UniformBuffer({
			dataType: "vec4<f32>",
			// canCopyDst: true,
			canMapWrite: true,
			initialValue: [1,0,0,1] // Red
		});
		
		this.renderShader = new RenderShader2d({
			code: `
				@fragment
				fn main() -> @location(0) vec4<f32> {
					return color; // value of the color uniform.
				}
			`,
			bindingLayouts: [
				{
					type: "uniform", 
					name: "color", 
					binding: this.colorBuffer 
				}
			],
			canvas: this.canvas
		});

		requestAnimationFrame(()=>this.render());
	}
	
	render(){
		
		let now = Date.now() / 1000;
		this.colorBuffer.writeMap(new Float32Array([
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