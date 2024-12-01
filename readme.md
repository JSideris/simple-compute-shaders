# Introduction

## Overview
This library is a simplified wrapper around the WebGPU API, designed to make it easier to create and run shaders without dealing with the complex details of the WebGPU setup. It allows developers to initialize WebGPU, create data buffers, write shaders, and execute compute or render passes, all with a streamlined interface. The library is suitable for both beginners who want to experiment with GPU programming and experienced developers looking to speed up prototyping.

Small disclaimer: GPU programming is hard and complex. This library simplifies a great deal of the plumbing needed to do rapid prototyping and even build full-scale applications so that you can focus on writing shader code rather than wasting time on repetative boilerplate code. However, it's no substitute for having the right foundational knowledge on the following concepts. If you're new to graphics programming, I'd recommend having at least a basic understanding of the following things:

- **GPU Basics**: Understanding how a GPU works, including the idea of parallel processing and the role of GPUs in rendering graphics or performing computations.
- **Shader Programming**: Knowledge of what shaders are and how they function, specifically **vertex shaders**, **fragment shaders**, and **compute shaders**. A basic understanding of how to write shader code (e.g., using **WGSL** or similar shader languages) is useful. Try to understand the basics of **workgroups**, **blocks**, and **threads**.
- **WebGPU Concepts**: Familiarity with the basics of **WebGPU** API, such as how it is different from WebGL and its role in accessing GPU functionality from web browsers.
- **Buffers and Textures**: Understanding GPU **buffers** and **textures** and their role in storing vertex data, image data, or other types of data required for rendering or computation.
- **Pipeline and Bind Groups**: Knowledge of how GPU **pipelines** work to connect different shader stages, and how **bind groups** are used to provide data to shaders.

## Features

- Uses the WebGPU API.
- Easily initialize the WebGPU device, adapter, and command encoder with a single function call.
- Abstracts many common actions so that things get done correctly and in the right order.
- Build general-purpose compute shaders and pipelines with minimal plumbing.
- Build 2D fragment shaders, post processing effects, and other pipelines without worrying about vertex shaders/buffers/etc.
- Fully-functional wrappers for `GPUBuffer` objects that are easier to configure, read, and write compared with the ones provided by the WebGPU API.
	- Simplified buffer usage options.
	- Buffer visibility is set automatically based on bindings.
	- Smart buffer sizes and binding types.
	- Better binding management that removes a lot of boilerplate.
- Built-in compiler for adding buffers to shaders.

## Limitations

- Buffer swapping and groups are not supported yet, but are coming soon.
- No vertex shaders or vertex buffers. A significant part of the complexity of GPU programming is dealing with vertex data. This library is for users who want to build compute shaders or do 2D rendering on a quad.
- Only one shader entry point is supported.
- GPUBufferUsage.MAP_WRITE and GPUBufferUsage.MAP_READ are currently unsupported.

## Requirements

- **Browser Support**: This library relies on the WebGPU API, which is relatively widely supported, but still not ubiquitous.
- **WebGPU Enabled**: WebGPU must be enabled in the browser. This may require enabling experimental features or flags.


# Getting Started

## Installation

**NPM Package**

```
npm i simple-compute-shaders
```

## Basic Usage

1. Configure your project. Install simple-compute-shaders. Set up your project to be able to import WGSL files (or simply hard-code them as JavaScript strings).
2. Write a shader in WGSL. Do not declare bindings - they will be injected by the library. You can just use them. The entry point should be named `main`.
3. Initialize `Shader` by calling `Shader.initialize()`. This is required once per application.
4. Define your GPU buffers (data you'll be passing into or reading from the GPU).
5. Instantiate a `ComputeShader` or `RenderShader2d` object. Pass in your shader code as a string. List binding layouts. For compute shaders, provide a `workgroupCount` (a 2 or 3 dimensional array), and don't forget to specify a `@workgroup_size` inside your shader.
7. Set up a render (or compute) function. Use `requestAnimationFrame` for render shaders. In this function, write all the buffers that need updating, then call `shader.pass()`, where `shader` is your `Shader` instance. Note: swap buffers are currently not supported, but are planned. In the future, if you are doing something fancy like double-buffering, you will also be able to provide a bindGroup name.
8. To cleanup, stop calling the render or compute function. Call the `dispose()` function on your shader and on each buffer.

## Examples

- [Hello Triangle](https://github.com/JSideris/simple-compute-shaders/tree/master/examples/hello-triangle): sipmle render pipeline.
- [Audio Processor](https://github.com/JSideris/simple-compute-shaders/tree/master/examples/audio-processor): compute DFT of an audio signal and render.

# Usage

## Initialization

Use `await Shader.initialize()` once per applicaiton. This is required for the library to get the system's GPU device which is required for all other operations, like creating and running shaders.

## Creating Buffers

Simple Compute Shaders has a number of helper classes for encapsulating buffers. They are all implementations of the abstract class `ShaderBuffer`.

- `StorageBuffer`: Stores general-purpose data, readable and writable by compute or fragment shaders, suitable for large, dynamic, or read-write data.
- `UniformBuffer`: Stores small, constant data shared across shader invocations, typically for values that change frequently, such as transformation matrices or frame numbers.
- `IndirectBuffer`: Stores parameters for indirect drawing commands, allowing the GPU to control rendering without CPU involvement, useful for dynamic and GPU-driven rendering scenarios.

The buffer classes are based on the primary `GPUBufferUsage` values. There are two more classes that are not exposed publicly: `VertexBuffer` and `IndexBuffer`. These are hidden because they are not supported by fragment or compute shaders.

Each buffer wrapper has the same constructor that accepts a `props` argument that contains a `dataType`, a conditional `size` (in elements) an optional `initialValue`, and optional buffer usage flags as booleans.

`new StorageBuffer(props: BufferProps)`, `new UniformBuffer(props: BufferProps)`, `new IndirectBuffer(props: BufferProps)`

Where `BufferProps` contains fields:

- **dataType**: The data type of the buffer that will be generated within WGSL. This is also used to determine the size per element, return types, and more.
- **size** (conditional): The size of the buffer in elements. Only required when using `array` or `texture_2d` data types.
- **initialValue** (optional): An array-like object containing the initial value of the buffer. Note that even `u32`, `i32`, and `f32` types are passed in as an array of length 1.
- **canMapRead** (NOT SUPPORTED): A boolean value indicating that this buffer should use the `GPUBufferUsage.MAP_READ` flag. This allows CPU access to the buffer data for reading purposes.
- **canMapWrite** (NOT SUPPORTED): A boolean value indicating that this buffer should use the `GPUBufferUsage.MAP_WRITE` flag. This allows CPU access to the buffer data for writing purposes.
- **canCopySrc** (optional): A boolean value indicating that this buffer should use the `GPUBufferUsage.COPY_SRC` flag. This allows the buffer data to be copied to other buffers or textures.
- **canCopyDst** (optional): A boolean value indicating that this buffer should use the `GPUBufferUsage.COPY_DST` flag. This allows other buffers or textures to copy their data into this buffer.
- **canQueryResolve** (optional): A boolean value indicating that this buffer should use the `GPUBufferUsage.QUERY_RESOLVE` flag. Typically used for resolving the results of GPU queries.

More details on the `canCopy-` and `canMap-` flags can be found in the `Reading and Writing Buffer Data` section.

Supported values for `dataType` are:

`u32`, `f32`, `i32`, `vec2<u32>`, `vec2<f32>`, `vec2<i32>`, `vec3<u32>`, `vec3<f32>`, `vec3<i32>`, `vec4<u32>`, `vec4<f32>`, `vec4<i32>`, `mat4x4<u32>`, `mat4x4<f32>`, `mat4x4<i32>`, `texture_2d<u32>`, `texture_2d<f32>`, `texture_2d<i32>`, `array<u32>`, `array<f32>`, `array<i32>`, `array<vec2<u32>>`, `array<vec2<f32>>`, `array<vec2<i32>>`, `array<vec3<u32>>`, `array<vec3<f32>>`, `array<vec3<i32>>`, `array<vec4<u32>>`, `array<vec4<f32>>`, `array<vec4<i32>>`, `array<mat4x4<u32>>`, `array<mat4x4<f32>>`, `array<mat4x4<i32>`

If the `dataType` is set to an `array<T>` or a `texture_2d<T>`, you must provide a `size` in array elements or texels. For example, each element of a `array<mat4x4<f32>>` only contributes 1 to `size`, even though it requires 16 float values in the source array, and will occupy 64 bytes of space on the GPU. Simple Compute Shaders will do that conversion for you when setting up the buffer.

## Reading and Writing Buffer Data

There are two distinct ways to read and write data after a shader has been set up: mapping, and copying. These require specific usage flags to be set up. In the buffer's constructor. Here is a guide on how to choose the usage that makes the most sense.

### Writing Data:

- Set `canCopyDst` to true in the buffer's constructor properties.
- Use `await ShaderBuffer.write()` to write data.
- Use when you want to write data to a buffer using queue.writeBuffer().
- Best suited for bulk writes that need to be quickly submitted to the GPU command queue.
- The write operation is non-blocking, meaning it doesn’t require an explicit mapping or unmapping step, making it more efficient for frequent or large data transfers.

`write(value: Float32Array | Uint32Array, offset = 0)`

Writes data to the buffer using COPY_DST, allowing data to be transferred from CPU to GPU.

- **value**: The data to be written to the buffer.
- **offset** (optional): The offset in bytes from the start of the buffer where the data should be written.

### Reading Data:

- Set `canCopySrc` to true in the buffer's constructor properties.
- Use `await ShaderBuffer.read()` to read data.
- Use when you want to read buffer data by copying it to a staging buffer first.
- Best for bulk data reads where the source buffer cannot be mapped directly, or to avoid affecting performance-critical GPU operations.
- Often combined with a staging buffer that is mappable (MAP_READ) for reading on the CPU.

`read(offset:number = 0, length: number = this.sizeElements)`

Asynchronously reads data directly from the buffer by mapping it with MAP_READ usage.

- **offset**: The offset in elements from the start of the buffer where the data should be read from.
- **length**: The size in elements to be read from the buffer.

## Creating Shaders

Once the `Shader` object has been initialized and your buffers are created, you can instantiate a compute shader or a render shader using their respective constructors. 

### Compute Shaders

#### Creating Compute Shaders:

`new ComputeShader(props: ComputeShaderProps)`

Constructs a pipeline for a compute shader. The `ComputeShaderProps` type is used to configure compute shaders. Below is a detailed explanation of each field in `ComputeShaderProps`:

- **computeCode**: `string`. The WGSL code for the compute shader. This code should contain the `@compute` entry point named `main`. The library injects binding layout definitions automatically, so you don't need to declare bindings explicitly.

- **`workgroupCount`**: `[number, number, number]` or `[number, number]`. Specifies the number of workgroups to be dispatched. This can be a 2D or 3D array, depending on the desired compute workload.

- **`bindingLayouts`** (optional): `Array<BindingLayoutDef>`. An array defining the binding layouts used by the compute shader. This includes information such as the type of resource (`storage`, `uniform`, etc.), the data type (e.g., `u32`, `f32`), and the binding group configuration.

#### Example:

```typescript

await Shader.initialize();

let myBuffer = new StorageBuffer({
	dataType: "array<f32>",
	canCopyDst: true,
	initialValue: myData
});

const computeShader = new ComputeShader({
	code: `
		@compute @workgroup_size(8, 8)
		fn main() {
			// Compute logic here
		}
	`,
	workgroupCount: [4, 4],
	bindingLayouts: [
		{ 
			type: "storage", 
			name: "dataBuffer", 
			binding: myBuffer 
		}
	]
});
```

### Render Shaders

#### Creating Render Shaders:

`new RenderShader2d(props: RenderShader2dProps)`

Constructs a new pipeline for a render shader, containing a built-in vertex stage with a managed quad. The `RenderShader2dProps` type is used to configure render shaders. Below is a detailed explanation of each field in `RenderShader2dProps`:

- **code**: `string`. The WGSL code for the fragment shader. This code should contain the `@fragment` entry point named `main`. As with the vertex shader, bindings are injected automatically by the library.

- **bindingLayouts** (optional): `Array<BindingLayoutDef>`. An array defining the binding layouts used by the render shader. This includes information such as the type of resource (`uniform`, `storage`, etc.), the data type (e.g., `f32`, `vec4<f32>`), and the binding group configuration.

- **`canvas`**: `HTMLCanvasElement`. The HTML canvas element that will be used as the rendering target. This canvas is required for rendering the output of the fragment shader to the screen.

#### Example:

```typescript

await Shader.initialize();

let myUniformBuffer = new UniformBuffer({
	dataType: "vec4<f32>",
	canCopyDst: true,
	initialValue: [1,0,0,1] // Red
});

const renderShader = new RenderShader2d({
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
			binding: myUniformBuffer 
		}
	],
	canvas: document.getElementById('myCanvas') as HTMLCanvasElement
});

function render(){
	let now = Date.now() / 1000;
	myUniformBuffer.write(new Float32Array([
		(Math.sin(now) * 0.5 + 0.5),
		(Math.sin(now * 1.667) * 0.5 + 0.5),
		(Math.sin(now * 1.333) * 0.5 + 0.5),
		1
	]));

	renderShader.pass();
	requestAnimationFrame(()=>{render();});
}

requestAnimationFrame(()=>{render();});
```

### BindingLayoutDef

Each binding layout definition in your `bindingLayouts` field must satisfy the `BindingLayoutDef` type, as given:

- **type**: `"storage" | "read-only-storage" | "uniform" | "write-only-texture" | "var"`. The buffer type.

- **name**: `string`. The name of the buffer that will be added to the shader code.

- **binding** (required if bindGroups is not provided, otherwise must be omitted): `ShaderBuffer`. The GPU buffer to be added to the default bind group. If one buffer is using `binding`, they all must.

- **bindGroups** (CURRENTLY NOT SUPPORTED - required if binding is not provided, otherwise must be omitted): `Record<string, ShaderBuffer>`. A collection of `GPUBuffer` objects with strings representing bind group names. This is useful for setting up buffer swapping for things like double-buffering. If one buffer is using `bindGroups`, they all must, and they all must have the same bind group names.

## Shader Code Integration

The easiest way to include WGSL code in your shader is to hard-code it as a JavaScript string. If you're soming a framework like Webpack or Rollup, you can configure it to import wgsl files directly.

For instance, in Webpack, you can add the following under your module rules:

```JavaScript
{
	test: /\.wgsl$/,
	type: "asset/source"
},
```

Then you can import your shader as follows:

```JavaScript
import fragCode from "./frag.wgsl";
```

## Executing Shader Passes

To run a render or compute pass, simply call `shader.pass()`. Compute passes can be run any time and are syncronous. Run renders inside of a `requestAnimationFrame` callback.

## How to Contribute

Building this library to be as robust as possible was challenging, and is an ongoing project. Pull requests welcome.

## Reporting Issues

Feel free to send me an email, reach out to me on [X](https://x.com/joshsideris), or open an issue.

# License

This project is licensed under the MIT License. See the LICENSE file for more details.

