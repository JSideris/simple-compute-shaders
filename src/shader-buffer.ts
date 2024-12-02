import { Shader } from "./shader";

type WgslPrimative = `${"u" | "f" | "i"}32`;
type WgslVec = `vec${2 | 3 | 4}<${WgslPrimative}>`;
type WgslMatrix = `mat4x4<${WgslPrimative}>`
type WgslArray = `array<${WgslPrimative | WgslVec | WgslMatrix}>`;
type WgslTexture = `texture_2d<${WgslPrimative}>`

/**
 * Describes the buffer usage configuration for a GPU buffer.
 */
type Usage = {
	// /**
	//  * Whether the buffer can be mapped for reading.
	//  * This allows CPU access to the buffer data for reading purposes.
	//  */
	// canMapRead?: boolean;

	// /**
	//  * Whether the buffer can be mapped for writing.
	//  * This allows CPU access to the buffer data for writing purposes.
	//  */
	// canMapWrite?: boolean;

	/**
	 * Whether the buffer can be used as a source for copy operations.
	 * This allows the buffer data to be copied to other buffers or textures.
	 */
	canCopySrc?: boolean;

	/**
	 * Whether the buffer can be used as a destination for copy operations.
	 * This allows other buffers or textures to copy their data into this buffer.
	 */
	canCopyDst?: boolean;

	/**
	 * Whether the buffer can be used for query result resolution.
	 * Typically used for resolving the results of GPU queries.
	 */
	canQueryResolve?: boolean;
};

type BufferProps = {
	initialValue?: ArrayLike<number>,
} & (
		{
			dataType: WgslPrimative | WgslVec | WgslMatrix;

		} | {
			dataType: WgslArray | WgslTexture;
			/**
			 * The number of elements (or texels) in the buffer.
			 */
			size: number,
		}
	) & Usage;

function calculateBufferSize(props: { dataType: string, size?: number }): number {
	let sizeBytes = 4; // Default to the size of a primitive type (u32, i32, f32)

	// Determine size for vector types
	if (props.dataType.startsWith("vec2")) {
		sizeBytes = 8; // 2 * 4 bytes
	} else if (props.dataType.startsWith("vec3")) {
		sizeBytes = 12; // 3 * 4 bytes
	} else if (props.dataType.startsWith("vec4")) {
		sizeBytes = 16; // 4 * 4 bytes
	}

	// Determine size for matrix types
	if (props.dataType.startsWith("mat4x4")) {
		sizeBytes = 64; // 4x4 matrix of f32, which is 16 * 4 bytes
	}

	// Determine size for array types
	if (props.dataType.startsWith("array")) {
		// Extract element type and compute the size of one element
		const elementType = props.dataType.match(/array<(.+)>/)?.[1];
		let elementSize = 4; // Default to the size of a primitive type if unspecified

		if (elementType) {
			if (elementType.startsWith("vec2")) {
				elementSize = 8;
			} else if (elementType.startsWith("vec3")) {
				elementSize = 12;
			} else if (elementType.startsWith("vec4")) {
				elementSize = 16;
			} else if (elementType.startsWith("mat4x4")) {
				elementSize = 64;
			} else if (elementType === "u32" || elementType === "i32" || elementType === "f32") {
				elementSize = 4;
			}
		}

		// Use the `size` property to compute the total array size
		if (props.size) {
			sizeBytes = elementSize * props.size;
		} else {
			throw new Error("Size must be provided for array types");
		}
	}

	// Determine size for texture types (abstract approximation)
	if (props.dataType.startsWith("texture_2d")) {
		// Assuming each texel is represented by the primitive type, which is typically 4 bytes per channel
		sizeBytes = 4 * (props.size ?? 1); // Assuming `size` represents the number of texels
	}

	return sizeBytes;
}

export abstract class ShaderBuffer {

	buffer: GPUBuffer;
	dataType: string;
	baseType: "float" | "int";
	sizeBytes: number;
	sizeElements: number = 1;
	props: BufferProps;

	constructor(mainUsage: number, props: BufferProps) {

		this.props = props;

		let bufferUsage = mainUsage;

		this.dataType = props.dataType;

		// if (props.canMapRead) bufferUsage |= GPUBufferUsage.MAP_READ;
		// if (props.canMapWrite) bufferUsage |= GPUBufferUsage.MAP_WRITE;
		if (props.canCopySrc) bufferUsage |= GPUBufferUsage.COPY_SRC;
		if (props.canCopyDst) bufferUsage |= GPUBufferUsage.COPY_DST;
		if (props.canQueryResolve) bufferUsage |= GPUBufferUsage.QUERY_RESOLVE;

		this.sizeElements = props["size"] || 1;

		this.sizeBytes = calculateBufferSize({
			dataType: props.dataType,
			size: this.sizeElements,
		});

		this.buffer = Shader.device.createBuffer({
			size: this.sizeBytes,
			usage: bufferUsage,
			mappedAtCreation: !!props.initialValue,
		});

		if (props.dataType.indexOf("f32") > -1) this.baseType = "float";
		if (props.dataType.indexOf("u32") > -1) this.baseType = "int";
		if (props.dataType.indexOf("i32") > -1) this.baseType = "int";

		if (props.initialValue) {
			if (this.baseType == "float") {
				new Float32Array(this.buffer.getMappedRange()).set(props.initialValue);
			}
			else if (this.baseType == "int") {
				new Uint32Array(this.buffer.getMappedRange()).set(props.initialValue);
			}
			this.buffer.unmap();
		}
	}

	/**
	 * Writes data to the buffer using COPY_DST, allowing data to be transferred from CPU to GPU.
	 * @param {Float32Array | Uint32Array} value - The data to be written to the buffer.
	 * @param {number} [offset=0] - The offset in elements from the start of the buffer where the data should be written.
	 */
	write(value: Float32Array | Uint32Array, offset = 0) {
		if (!this.props.canCopyDst) throw new Error("Buffer is not writable. Set `canCopyDst` to `true` in the buffer props.");
		const offsetBytes = offset * this.sizeBytes / this.sizeElements;
		Shader.device.queue.writeBuffer(this.buffer, offsetBytes, value);
	}

	// /**
	//  * Writes data to the buffer using MAP_WRITE, allowing data to be transferred from CPU to GPU.
	//  * @param {Float32Array | Uint32Array} value - The data to be written to the buffer.
	//  * @param {number} [offset=0] - The offset in elements from the start of the buffer where the data should be written.
	//  */
	// async writeMap(value: Float32Array | Uint32Array, offset = 0) {
	// 	// Ensure that the buffer is set to allow MAP_WRITE
	// 	if (!this.props.canMapWrite) {
	// 		throw new Error("Buffer is not writable. Set `canMapWrite` to `true` in the buffer props.");
	// 	}

	// 	const offsetBytes = offset * this.sizeBytes / this.sizeElements;

	// 	// Map the buffer for writing
	// 	await this.buffer.mapAsync(GPUMapMode.WRITE, offsetBytes, value.byteLength);

	// 	// Get the mapped range and write the data
	// 	const mappedRange = this.buffer.getMappedRange(offsetBytes, value.byteLength);
	// 	if (value instanceof Float32Array) {
	// 		new Float32Array(mappedRange).set(value);
	// 	} else if (value instanceof Uint32Array) {
	// 		new Uint32Array(mappedRange).set(value);
	// 	}

	// 	// Unmap the buffer after writing
	// 	this.buffer.unmap();
	// }

	/**
	 * Asynchronously reads data from the buffer by copying it to a staging buffer with COPY_SRC usage.
	 * @param {number} [offset=0] - The offset in elements from the start of the buffer where the data should be read from.
	 * @param {number} [length=this.sizeElements] - The number of elements to be read from the buffer.
	 * @returns {Promise<Float32Array | Uint32Array>} - A promise that resolves to the copied data.
	 */
	async read(offset = 0, length: number = this.sizeElements) {
		if (!this.props.canCopySrc) {
			throw new Error("Buffer is not readable. Set `canCopySrc` to `true` in the buffer props.");
		}

		const byteSize = length * this.sizeBytes / this.sizeElements;
		const offsetBytes = offset * this.sizeBytes / this.sizeElements;

		// Create a staging buffer to copy data to
		const stagingBuffer = Shader.device.createBuffer({
			size: byteSize,
			usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
		});

		// Create a command encoder to record the copy command
		const commandEncoder = Shader.device.createCommandEncoder();

		// Copy from the source buffer to the staging buffer
		commandEncoder.copyBufferToBuffer(this.buffer, offset, stagingBuffer, offsetBytes, byteSize);

		// Submit the copy command to the GPU queue
		const commandBuffer = commandEncoder.finish();
		Shader.device.queue.submit([commandBuffer]);

		// Map the staging buffer for reading
		await stagingBuffer.mapAsync(GPUMapMode.READ);

		// Get the mapped range
		const arrayBuffer = stagingBuffer.getMappedRange();

		// Create the appropriate typed array based on the buffer type
		let data: Float32Array | Uint32Array;
		if (this.baseType === "float") {
			data = new Float32Array(new Float32Array(arrayBuffer));
		} else {
			data = new Uint32Array(new Uint32Array(arrayBuffer));
		}

		// Unmap the buffer
		stagingBuffer.unmap();

		// Destroy the staging buffer to release GPU memory
		stagingBuffer.destroy();

		return data;
	}


	// /**
	//  * Asynchronously reads data directly from the buffer by mapping it with MAP_READ usage.
	//  * @param {number} [offset=0] - The offset in elements from the start of the buffer where the data should be read from.
	//  * @param {number} [length=this.sizeElements] - The size in elements to be read from the buffer.
	//  * @returns {Promise<Float32Array | Uint32Array>} - A promise that resolves to the read data.
	//  */
	// async readMap(offset: number = 0, length: number = this.sizeElements) {

	// 	if (!this.props.canMapRead) throw new Error("Buffer is not readable. Set `canMapRead` to `true` in the buffer props.");

	// 	// Map the buffer for reading
	// 	try {
	// 		await this.buffer.mapAsync(GPUMapMode.READ);
	// 	} catch (error) {
	// 		console.error("Failed to map the buffer:", error);
	// 		throw new Error("Buffer mapping failed");
	// 	}

	// 	const byteSize = length * this.sizeBytes / this.sizeElements;
	// 	const offsetBytes = offset * this.sizeBytes / this.sizeElements;

	// 	// Get the mapped range
	// 	let arrayBuffer = this.buffer.getMappedRange();

	// 	let data: Float32Array | Uint32Array;

	// 	// Create a Uint32Array from the buffer
	// 	// Then create a copy of the data. It seems that the original data becomes unavailable after the buffer is unmapped.

	// 	if (this.baseType == "float") {
	// 		data = new Float32Array(new Float32Array(arrayBuffer, offsetBytes, byteSize));
	// 	}
	// 	else {
	// 		data = new Uint32Array(new Uint32Array(arrayBuffer, offsetBytes, byteSize));
	// 	}

	// 	// Unmap the buffer
	// 	await this.buffer.unmap();

	// 	return data;
	// }

	dispose() {
		if (this.buffer) {
			this.buffer.destroy();
			this.buffer = null; // Clear the reference for GC
		}
	}
}

export class StorageBuffer extends ShaderBuffer {
	constructor(props: BufferProps) {
		super(GPUBufferUsage.STORAGE, props);
	}
}

export class UniformBuffer extends ShaderBuffer {
	constructor(props: BufferProps) {
		super(GPUBufferUsage.UNIFORM, props);
	}
}

// Not available for public use.
export class VertexBuffer extends ShaderBuffer {
	constructor(props: BufferProps) {
		super(GPUBufferUsage.VERTEX, props);
	}
}

// Not available for public use.
export class IndexBuffer extends ShaderBuffer {
	constructor(props: BufferProps) {
		super(GPUBufferUsage.INDEX, props);
	}
}

export class IndirectBuffer extends ShaderBuffer {
	constructor(props: BufferProps) {
		super(GPUBufferUsage.INDIRECT, props);
	}
}