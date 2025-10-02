# Simple Compute Shaders

## Installation
```
npm i simple-compute-shaders
```

## Core Setup Pattern
```typescript
// 1. Initialize once per app
await Shader.initialize();

// 2. Create buffers
const buffer = new StorageBuffer({
    dataType: "array<f32>",  // Required: specify WGSL type
    size: 1024,               // Required for arrays/textures
    initialValue: data,       // Optional: initial data
    canCopyDst: true,        // Optional: allow writing
    canCopySrc: true         // Optional: allow reading
});

// 3. Create shader with bindings
const shader = new ComputeShader({
    code: wgslCode,
    workgroupCount: [16, 1],  // 2D or 3D workgroup dispatch
    bindingLayouts: [{
        default: [
            {
                binding: buffer,
                name: "myBuffer",     // Name used in WGSL
                type: "storage"       // or "uniform", "read-only-storage"
            }
        ]
    }]
});

// 4. Execute
await buffer.write(data);
shader.dispatch();
const result = await buffer.read();
```

## Buffer Types

### Buffer Classes
- `StorageBuffer`: Read/write data in shaders
- `UniformBuffer`: Small constant data
- `IndirectBuffer`: GPU-driven parameters

### Supported Data Types
**Primitives**: `u32`, `f32`, `i32`
**Vectors**: `vec2<T>`, `vec3<T>`, `vec4<T>` where T is u32/f32/i32
**Matrices**: `mat4x4<T>`
**Arrays**: `array<T>` (requires `size` parameter)
**Textures**: `texture_2d<T>` (requires `size` parameter)
**Structs**: Use `dataType: "struct"` with:
```typescript
{
    structName: "MyStruct",
    fields: [
        { name: "field1", dataType: "f32" },
        { name: "field2", dataType: "vec3<f32>" }
    ]
}
```

## Shader Types

### ComputeShader
```typescript
new ComputeShader({
    code: string,                    // WGSL with @compute fn main()
    workgroupCount: [x, y] | [x, y, z],
    bindingLayouts: BindingLayoutDef[],
    useExecutionCountBuffer?: boolean,  // Default: true, adds execution_count
    useTimeBuffer?: boolean             // Default: true, adds time
})
```

### RenderShader2d
```typescript
new RenderShader2d({
    code: string,                    // WGSL with @fragment fn main()
    canvas: HTMLCanvasElement,
    bindingLayouts: BindingLayoutDef[],
    sizeBufferStyle?: "floats" | "vector" | "none",  // Default: "floats"
    useExecutionCountBuffer?: boolean,
    useTimeBuffer?: boolean
})
```

## Binding Layout Structure
```typescript
bindingLayouts: [
    {
        default: [  // Group name (usually "default")
            {
                binding: bufferInstance,
                name: "bufferName",     // Name in WGSL
                type: "storage" | "uniform" | "read-only-storage" | "write-only-texture"
            }
        ]
    }
]
```

## Buffer Swapping (Double Buffering)

For ping-pong patterns or double buffering, create multiple groups within a layout with swapped buffer assignments:

```typescript
// Create two buffers for swapping
const bufferA = new StorageBuffer({ dataType: "array<f32>", size: 1024 });
const bufferB = new StorageBuffer({ dataType: "array<f32>", size: 1024 });

// Configure shader with swappable groups
const shader = new ComputeShader({
    code: wgslCode,
    workgroupCount: [16, 1],
    bindingLayouts: [{
        group1: [
            { binding: bufferA, name: "input", type: "storage" },
            { binding: bufferB, name: "output", type: "storage" }
        ],
        group2: [
            { binding: bufferB, name: "input", type: "storage" },
            { binding: bufferA, name: "output", type: "storage" }
        ]
    }]
});

// Execute with group swapping
let currentGroup = 0;
function compute() {
    shader.dispatch({
        0: currentGroup === 0 ? "group1" : "group2"  // 0 is the layout index
    });
    currentGroup = 1 - currentGroup;  // Toggle between 0 and 1
}
```

In WGSL, always use the same names (`input` and `output`). The library handles the actual buffer swapping based on the group you specify.

## Buffer Operations
```typescript
// Write data
await buffer.write(typedArray, offset?);

// Read data  
const data = await buffer.read(offset?, length?);
```

## Execution
```typescript
// Compute shader
computeShader.dispatch();

// Render shader (in animation loop)
function render() {
    renderShader.pass();
    requestAnimationFrame(render);
}
```

## Key Notes
- Don't declare bindings in WGSL - they're auto-injected
- Entry point must be named `main`
- Built-in uniforms available: `execution_count`, `time`, `canvas_width`, `canvas_height` (for render shaders)
- Arrays use element count for size, not byte size
- When using buffer swapping, all groups in a layout must have matching binding names and types in the same order