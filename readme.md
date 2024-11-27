# Introduction

## Overview
This library is a simplified wrapper around the WebGPU API, designed to make it easier to create and run shaders without dealing with the complex details of the WebGPU setup. It allows developers to initialize WebGPU, create data buffers, write shaders, and execute compute or render passes, all with a streamlined interface. The library is suitable for both beginners who want to experiment with GPU programming and experienced developers looking to speed up prototyping.

Small disclaimer: GPU programming is hard and complex. This library simplifies a great deal of the plumbing needed to do rapid prototyping and even build full-scale applications, but it's no substitute for having the right foundational knowledge on the following concepts. 

- **GPU Basics**: Understanding how a GPU works, including the idea of parallel processing and the role of GPUs in rendering graphics or performing computations.
- **Shader Programming**: Knowledge of what shaders are and how they function, specifically **vertex shaders**, **fragment shaders**, and **compute shaders**. A basic understanding of how to write shader code (e.g., using **WGSL** or similar shader languages) is useful. Try to understand the basics of **workgroups**, **blocks**, and **threads**.
- **WebGPU Concepts**: Familiarity with the basics of **WebGPU** API, such as how it is different from WebGL and its role in accessing GPU functionality from web browsers.
- **Buffers and Textures**: Understanding GPU **buffers** and **textures** and their role in storing vertex data, image data, or other types of data required for rendering or computation.
- **Pipeline and Bind Groups**: Knowledge of how GPU **pipelines** work to connect different shader stages, and how **bind groups** are used to provide data to shaders.

## Features
- **Simplified Initialization**: Easily initialize the WebGPU device, adapter, and command encoder with a single function call.
- **Buffer Management**: Create GPU buffers for storage, uniform, and vertex data with minimal code.
- **Flexible Shader Creation**: Support for compute and render shaders, including automatic setup for binding layouts and workgroup configurations.
- **Automated Resource Bindings**: Define binding layouts for buffers and textures without manually creating complex structures.
- **Rendering and Compute Pass Execution**: Execute render or compute passes with ease, specifying bind groups and vertex data where applicable.
- **Static Utility Methods**: Includes utility functions for common tasks like reading GPU buffer data and writing to buffers.

## Requirements
- **Browser Support**: This library relies on the WebGPU API, which is relatively widely supported, but still not ubiquitous.
- **WebGPU Enabled**: WebGPU must be enabled in the browser. This may require enabling experimental features or flags.

# Installation

## NPM Package

```
npm i friendly-webgpu
```

# Getting Started

## Basic Usage

1. Configure your project. Install friendly-webgpu. Set up your project to be able to import WGSL files (or simply hard-code them as JavaScript strings).
2. Write a shader in WGSL. Do not declare bindings - they will be injected by the library. You can just use them. The entry point should be named `main`.
3. Initialize `Shader`. This is required once per application.
4. Define your GPU buffers (data you'll be passing into the GPU or reading).
5. If you are rendering graphics, create a vertex shader. For 2D graphics with no vertices, use a quad or a large triangle.
6. Instantiate a `Shader` object, setting the type as "render" or "compute". Pass in your shader code as a string. List binding layouts. For render shaders, provide `vertexBuffers`. For compute shaders, provide a `workgroupCount` (a 2 or 3 dimensional array), and a `blockSize`.
7. Set up a render (or compute) function. Use `requestAnimationFrame` for render shaders. In this function, write all the buffers that need updating, then call `shader.pass()`, where `shader` is your `Shader` instance. If you are doing something fancy like double-buffering, you can also provide a bindGroup name.
8. To cleanup, stop calling the render or compute function. You will need to manually free up all your buffers and other resources.

## Quick Start Example

Check the examples folder for your specific needs.

# Initialization

## Initializing the Shader Class

Use `await Shader.initialize()` once per applicaiton. This is required for the library to get the system's GPU device which is required for all other operations, like creating and running shaders.

You can call this funciton as many times as you want. You can check if this function has already been called by calling `Shader.isInitialized()`.

# Creating Buffers

## Using `makeBuffer`

Friendly-webgpu has a helper method to help you make buffers.

### `Shader.makeBuffer(sizeBytes: number, usage: number, type?: "float" | "int", initialValue?: ArrayLike<number>): GPUBuffer`

This method simplifies the process of creating GPU buffers, allowing you to specify the size, usage, and optionally, an initial value for the buffer.

#### Parameters:
- **`sizeBytes`**: The size of the buffer in bytes. This defines how much GPU memory will be allocated.
- **`usage`**: The usage type of the buffer, specified using WebGPU constants such as `GPUBufferUsage.STORAGE` or `GPUBufferUsage.UNIFORM`. This indicates how the buffer will be used (e.g., for storage, as a vertex buffer, etc.).
- **`type`** (optional): The data type of the initial value, either `"float"` or `"int"`. This is used to correctly map the data to the buffer when `initialValue` is provided.
- **`initialValue`** (optional): An array-like object containing the initial data to populate the buffer. This value is optional, and if provided, the buffer will be mapped at creation and initialized with the given values.

#### Returns:
- A `GPUBuffer` object that can be used within shaders or to interact with the GPU.

#### Example Usage:
```typescript
// Create a buffer of 256 bytes for storage usage without initial values
const buffer = Shader.makeBuffer(256, GPUBufferUsage.STORAGE);

// Create a buffer of 128 bytes, initialized with float data
const initialData = new Float32Array([0.0, 1.0, 2.0, 3.0]);
const bufferWithInitialValues = Shader.makeBuffer(128, GPUBufferUsage.UNIFORM, "float", initialData);
```

This utility method abstracts away the complexity of mapping and unmapping buffers manually, making buffer creation straightforward and easy to use. You can always bypass this method and create your own buffers using `Shader.device.createBuffer()`.

The utility method supports floats and ints, which map to Float32Array and Uint32Array, respectively.

Understanding the different buffer **usage** values is really important, but it's out of scope for this documentation. Check out [MDN's documentation](https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/usage) for detailed info.

## Reading and Writing Buffer Data

### `Shader.readGPUBufferData(buffer: GPUBuffer, size32: number): Promise<Uint32Array>`
This method reads data from a `GPUBuffer` and returns it as a `Uint32Array`. It handles the buffer mapping and unmapping process, making reading from the GPU more convenient.

#### Parameters:
- **`buffer`**: The `GPUBuffer` to read from. This buffer must have the `GPUBufferUsage.MAP_READ` usage flag set.
- **`size32`**: The size (in 32-bit units) of the data to be read from the buffer.

#### Returns:
- A `Promise` that resolves to a `Uint32Array` containing the data read from the buffer.

#### Example Usage:
```typescript
// Assume `buffer` is a GPUBuffer with usage GPUBufferUsage.MAP_READ
const data = await Shader.readGPUBufferData(buffer, 64);
console.log(data); // Logs the contents of the buffer as a Uint32Array
```

This utility method abstracts the complexity of mapping and unmapping GPU buffers, making it straightforward to read data from the GPU for inspection or processing.

### `Shader.writeBuffer(buffer: GPUBuffer, value: Float32Array | Uint32Array, offset?: number): void`
This method writes data to a `GPUBuffer` using the GPU's queue. It is useful for updating buffer contents before executing a shader pass.

#### Parameters:
- **`buffer`**: The `GPUBuffer` to write data to. This buffer must have the `GPUBufferUsage.COPY_DST` usage flag set.
- **`value`**: The data to write to the buffer. This can be either a `Float32Array` or `Uint32Array`.
- **`offset`** (optional): The byte offset in the buffer at which to start writing. Defaults to `0`.

#### Example Usage:
```typescript
// Assume `buffer` is a GPUBuffer with usage GPUBufferUsage.COPY_DST
const newData = new Float32Array([1.0, 2.0, 3.0, 4.0]);
Shader.writeBuffer(buffer, newData);
```

This utility method simplifies the process of updating GPU buffers, making it easy to modify data before passing it to a shader.

# Creating Shaders

Once the `Shader` object has been initiarized and your buffers are created, you can instantiate `Shader` using `new Shader(props)`. We'll go into each prop field, but please also check out the specific usage examples for more details.

## Shader Types

### Compute Shaders

The `ComputeShaderProps` type is used to configure compute shaders. Below is a detailed explanation of each field in `ComputeShaderProps`:

#### Fields:

- **`type`**: 
  - **Description**: This field must be set to `"compute"` to indicate that this shader is a compute shader.
  - **Type**: `"compute"` (literal string).

- **`computeCode`**: 
  - **Description**: The WGSL code for the compute shader. This code should contain the `@compute` entry point named `main`. The library injects binding layout definitions automatically, so you don't need to declare bindings explicitly.
  - **Type**: `string`.

- **`workgroupCount`**: 
  - **Description**: Specifies the number of workgroups to be dispatched. This can be a 2D or 3D array, depending on the desired compute workload.
  - **Type**: `[number, number, number]` or `[number, number]`.
  - **Example**: `[4, 4, 1]` for a 4x4 workgroup in 3D space.

- **`blockSize`** (optional): 
  - **Description**: The size of each workgroup block. This value defaults to `8` if not provided and helps determine how many threads are in each workgroup.
  - **Type**: `number`.
  - **Example**: `16` to use a block size of 16 threads.

- **`bindingLayouts`** (optional): 
  - **Description**: An array defining the binding layouts used by the compute shader. This includes information such as the type of resource (`storage`, `uniform`, etc.), the data type (e.g., `u32`, `f32`), and the binding group configuration.
  - **Type**: `Array<BindingLayoutDef>`.
  - **Example**: Define various resources like buffers or textures that the compute shader will use.

#### Example Usage:

```typescript
const computeShaderProps = {
  type: "compute",
  computeCode: `
    @compute @workgroup_size(8, 8)
    fn main() {
      // Compute logic here
    }
  `,
  workgroupCount: [4, 4],
  blockSize: 8,
  bindingLayouts: [
    { type: "storage", name: "dataBuffer", visibility: GPUShaderStage.COMPUTE, dataType: "array<f32>", binding: myBuffer }
  ]
};

const computeShader = new Shader(computeShaderProps);
```

This configuration allows you to create a compute shader, define its workgroup dispatch, and bind necessary resources such as storage buffers or uniform data.

### Render Shaders

The `RenderShaderProps` type is used to configure render shaders. Below is a detailed explanation of each field in `RenderShaderProps`:

#### Fields:

- **`type`**: 
  - **Description**: This field must be set to `"render"` to indicate that this shader is a render shader.
  - **Type**: `"render"` (literal string).

- **`vertexCode`**: 
  - **Description**: The WGSL code for the vertex shader. This code should contain the `@vertex` entry point named `main`. The library injects binding layout definitions automatically, so you don't need to declare bindings explicitly.
  - **Type**: `string`.

- **`fragmentCode`**: 
  - **Description**: The WGSL code for the fragment shader. This code should contain the `@fragment` entry point named `main`. As with the vertex shader, bindings are injected automatically by the library.
  - **Type**: `string`.

- **`vertexBuffers`** (optional): 
  - **Description**: An array specifying the layout of vertex buffers used by the render pipeline. This includes attributes such as the format of vertex data, which helps the GPU understand how to interpret the vertex buffer.
  - **Type**: `Array<GPUVertexBufferLayout>`.
  - **Example**: Define attributes like position, color, or texture coordinates.

- **`bindingLayouts`** (optional): 
  - **Description**: An array defining the binding layouts used by the render shader. This includes information such as the type of resource (`uniform`, `storage`, etc.), the data type (e.g., `f32`, `vec4<f32>`), and the binding group configuration.
  - **Type**: `Array<BindingLayoutDef>`.
  - **Example**: Define various resources like uniform buffers or textures that the render shader will use.

- **`canvas`** (optional): 
  - **Description**: The HTML canvas element that will be used as the rendering target. This canvas is required for rendering the output of the fragment shader to the screen.
  - **Type**: `HTMLCanvasElement`.

#### Example Usage:

```typescript
const renderShaderProps = {
  type: "render",
  vertexCode: `
    @vertex
    fn main(@builtin(vertex_index) VertexIndex: u32) -> @builtin(position) vec4<f32> {
      // Vertex logic here
    }
  `,
  fragmentCode: `
    @fragment
    fn main() -> @location(0) vec4<f32> {
      return vec4<f32>(1.0, 0.0, 0.0, 1.0); // Red color
    }
  `,
  vertexBuffers: [
    {
      arrayStride: 8,
      attributes: [
        {
          shaderLocation: 0,
          format: "float32x2",
          offset: 0,
        },
      ],
    },
  ],
  bindingLayouts: [
    { type: "uniform", name: "transform", visibility: GPUShaderStage.VERTEX, dataType: "mat4x4<f32>", binding: myUniformBuffer }
  ],
  canvas: document.getElementById('myCanvas') as HTMLCanvasElement
};

const renderShader = new Shader(renderShaderProps);
```

This configuration allows you to create a render shader, define vertex and fragment logic, and bind necessary resources such as uniform data and textures. The `canvas` parameter allows you to specify where the final rendered output will be displayed.

## BindingLayoutDef

Each binding layout definition in your `bindingLayouts` field must satisfy the `BindingLayoutDef` type, as given:

### Fields:

- **`type`**: 
  - **Description**: The buffer type. Supported types are `"storage"`, `"read-only-storage"`, `"uniform"`, `"write-only-texture"`, and `"var"`.
  - **Type**: `"storage" | "read-only-storage" | "uniform" | "write-only-texture" | "var"` (literal string).

- **`name`**: 
  - **Description**: The name of the buffer that will be added to the shader code.
  - **Type**: `string`.

- **`visibility`**: 
  - **Description**: A flag that indicates which part of the pipeline the buffer will be visible for. Flag values are `GPUShaderStage.FRAGMENT`, `GPUShaderStage.VERTEX`, and `GPUShaderStage.COMPUTE`.
  - **Type**: `number`.

- **`dataType`**: 
  - **Description**: The data type that this buffer will be set to in the shader. Supported types include primative WGSL data types, vectors, arrays, textures, and matrices. 
  - **Type**: `string`.

- **`binding`** (required if bindGroups is not provided, otherwise must be omitted): 
  - **Description**: The GPU buffer to be added to the default bind group. If one buffer is using `binding`, they all must.
  - **Type**: `GPUBuffer`.

- **`bindGroups`** (required if binding is not provided, otherwise must be omitted): 
  - **Description**: A collection of `GPUBuffer` objects with strings representing bind group names. This is useful for setting up buffer swapping for things like double-buffering. If one buffer is using `bindGroups`, they all must, and they all must have the same bind group names.
  - **Type**: `Record<string, GPUBuffer>`.

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

# Executing Shader Passes

## Using the `pass` Method

To run a render or compute pass, simply call `shader.pass()`. Compute passes can be run any time and are syncronous. Run renders inside of a `requestAnimationFrame` callback.

If you are using buffer swapping, you can specify the bind group name by passing that into `pass` as the `bindGroup` filed.

If you need to update the vertex buffer, you can also pass `vertices` into `pass`, which basically does a `setVertexBuffer` call via the pass encoder.

# API Reference

## Class: `Shader`

### Static Properties
- `Shader.device`
- `Shader.commandEncoder`
- `Shader.presentationFormat`
- `Shader.adapter`

### Static Methods
- `Shader.initialize()`
- `Shader.makeBuffer(sizeBytes, usage, type?, initialValue?)`
- `Shader.readGPUBufferData(buffer, size32)`
- `Shader.writeBuffer(buffer, value, offset?)`

### Instance Properties
- `shader.pipeline`
- `shader.bindGroups`
- `shader.type`

### Constructor
Parameters and usage for creating a new `Shader` instance.

### Methods
- `shader.pass(props?)`

# Type Definitions

## WGSL Types
- `WgslPrimative`
- `WgslVec`
- `WgslArray`
- `WgslTexture`
- `WgslMatrix`

## Shader Property Types
- `BindingLayoutDef`
- `BaseShaderProps`
- `ComputeShaderProps`
- `RenderShaderProps`

# Contribution Guidelines

## How to Contribute

Building this library to be as robust as possible was challenging, and is an ongoing project. Pull requests welcome.

## Reporting Issues

Feel free to send me an email, reach out to me on [X](https://x.com/joshsideris), or open an issue.

# License

This project is licensed under the MIT License. See the LICENSE file for more details.

