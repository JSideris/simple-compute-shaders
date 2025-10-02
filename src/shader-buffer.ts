import { Shader } from "./shader";

type WgslPrimative = `${"u" | "f" | "i"}32` | "bool";
type WgslAtomic = `atomic<${"u32"|"i32"}>`;
type WgslVec = `vec${2 | 3 | 4}<${WgslPrimative}>`;
type WgslMatrix = `mat${2 | 3 | 4}x${2 | 3 | 4}<${WgslPrimative}>`;
type WgslArray = `array<${WgslPrimative | WgslVec | WgslMatrix | WgslAtomic}>`;
type WgslSampler = "sampler" | "sampler_comparison";
type WgslStorageFormat = 
  | "rgba8unorm"      // 8-bit normalized (0.0-1.0)
  | "rgba8snorm"      // 8-bit signed normalized (-1.0-1.0)
  | "rgba8uint"       // 8-bit unsigned integer
  | "rgba8sint"       // 8-bit signed integer
  | "rgba16uint"      // 16-bit unsigned integer
  | "rgba16sint"      // 16-bit signed integer
  | "rgba16float"     // 16-bit float
  | "rgba32uint"      // 32-bit unsigned integer
  | "rgba32sint"      // 32-bit signed integer
  | "rgba32float"     // 32-bit float
type WgslTexture = 
  | `texture_1d<${WgslPrimative}>`
  | `texture_2d<${WgslPrimative}>`
  | `texture_2d_array<${WgslPrimative}>`
  | `texture_3d<${WgslPrimative}>`
  | `texture_cube<${WgslPrimative}>`
  | `texture_cube_array<${WgslPrimative}>`
  | `texture_multisampled_2d<${WgslPrimative}>`
  | "texture_depth_2d"
  | "texture_depth_2d_array"
  | "texture_depth_cube"
  | "texture_depth_cube_array"
  | "texture_depth_multisampled_2d"
  | `texture_storage_1d<${WgslStorageFormat}, ${"read" | "write" | "read_write"}>`
  | `texture_storage_2d<${WgslStorageFormat}, ${"read" | "write" | "read_write"}>`
  | `texture_storage_2d_array<${WgslStorageFormat}, ${"read" | "write" | "read_write"}>`
  | `texture_storage_3d<${WgslStorageFormat}, ${"read" | "write" | "read_write"}>`
  | "texture_external";
type WgslStruct = `struct`; // Special case.

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
		dataType: WgslPrimative | WgslVec | WgslMatrix | WgslAtomic | WgslSampler;

	} | {
		dataType: WgslArray | WgslTexture;
		/**
		 * The number of elements (or texels) in the buffer.
		 */
		size: number,
	} | {
		dataType: WgslStruct;
		structName: string;
		fields: Array<{
			name: string;
			dataType: WgslPrimative | WgslVec | WgslMatrix;
			offset?: number; // for manual alignment control
		}>;
	}
) & Usage;

function calculateBufferSize(props: { dataType: string, size?: number, fields?: Array<{name: string, dataType: string, offset?: number}> }): number {

	// Handle struct types
	if (props.dataType === "struct") {
		if (!props.fields) throw new Error("Fields must be provided for struct types");
		return calculateStructSize(props.fields, props.size || 1);
	}

	let nBytes = 4; // Default to the size of a primitive type (u32, i32, f32)

	// Determine size for vector types
	if (props.dataType.startsWith("vec2")) {
		nBytes = 8; // 2 * 4 bytes
	} else if (props.dataType.startsWith("vec3")) {
		nBytes = 12; // 3 * 4 bytes
	} else if (props.dataType.startsWith("vec4")) {
		nBytes = 16; // 4 * 4 bytes
	}

	// Determine size for matrix types
	if (props.dataType.startsWith("mat4x4")) {
		nBytes = 64; // 4x4 matrix of f32, which is 16 * 4 bytes
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
			nBytes = elementSize * props.size;
		} else {
			throw new Error("Size must be provided for array types");
		}
	}

	// Determine size for texture types (abstract approximation)
	if (props.dataType.startsWith("texture_2d")) {
		// Assuming each texel is represented by the primitive type, which is typically 4 bytes per channel
		nBytes = 4 * (props.size ?? 1); // Assuming `size` represents the number of texels
	}

	return nBytes;
}

function calculateStructSize(fields: Array<{name: string, dataType: string, offset?: number}>, count: number = 1): number {
	let offset = 0;
	
	for (const field of fields) {
		const fieldAlign = getFieldAlignment(field.dataType);
		const fieldSize = getFieldSize(field.dataType);
		
		// Align offset to field alignment
		offset = Math.ceil(offset / fieldAlign) * fieldAlign;
		
		// Use manual offset if provided
		if (field.offset !== undefined) {
			offset = Math.max(offset, field.offset);
		}
		
		offset += fieldSize;
	}
	
	// Struct size must be aligned to largest field alignment
	const structAlign = Math.max(...fields.map(f => getFieldAlignment(f.dataType)));
	const structSize = Math.ceil(offset / structAlign) * structAlign;
	
	return structSize * count;
}

function getFieldAlignment(type: string): number {
	if (type === 'f32' || type === 'u32' || type === 'i32') return 4;
	if (type.startsWith('vec2')) return 8;
	if (type.startsWith('vec3') || type.startsWith('vec4')) return 16;
	if (type.startsWith('mat4x4')) return 16;
	return 4;
}

function getFieldSize(type: string): number {
	if (type === 'f32' || type === 'u32' || type === 'i32') return 4;
	if (type.startsWith('vec2')) return 8;
	if (type.startsWith('vec3')) return 12;
	if (type.startsWith('vec4')) return 16;
	if (type.startsWith('mat4x4')) return 64;
	return 4;
}

export abstract class ShaderBuffer {

	buffer: GPUBuffer;
	dataType: string;
	baseType: "float" | "int" | "uint" | "mixed";
	sizeBytes: number;
	sizeElements: number = 1;
	props: BufferProps;
	structFields?: Array<{name: string, dataType: string, offset?: number}>; // Store for serialization
	structName?: string;

	constructor(mainUsage: number, props: BufferProps) {

		if(!Shader.isInitialized) throw new Error("Call `Shader.initialize()` before creating buffers.");

		this.props = props;

		let bufferUsage = mainUsage;

		this.dataType = props.dataType;

		// if (props.canMapRead) bufferUsage |= GPUBufferUsage.MAP_READ;
		// if (props.canMapWrite) bufferUsage |= GPUBufferUsage.MAP_WRITE;
		if (props.canCopySrc) bufferUsage |= GPUBufferUsage.COPY_SRC;
		if (props.canCopyDst) bufferUsage |= GPUBufferUsage.COPY_DST;
		if (props.canQueryResolve) bufferUsage |= GPUBufferUsage.QUERY_RESOLVE;

		// Handle struct-specific logic
		if (props.dataType === "struct") {
			this.structFields = props.fields;
			this.baseType = this.determineStructBaseType(props.fields);
			this.sizeElements = props["size"] || 1;
			this.structName = props.structName;
		} else {
			this.sizeElements = props["size"] || 1;
		}

		this.sizeBytes = calculateBufferSize({
			dataType: props.dataType,
			size: this.sizeElements,
			fields: this.structFields,
		});

		this.buffer = Shader.device.createBuffer({
			size: this.sizeBytes,
			usage: bufferUsage,
			mappedAtCreation: !!props.initialValue,
		});

		if (props.dataType !== "struct") {
			if (props.dataType.indexOf("f32") > -1) this.baseType = "float";
			else if (props.dataType.indexOf("u32") > -1) this.baseType = "uint";
			else if (props.dataType.indexOf("i32") > -1) this.baseType = "int";
		}


		if (props.initialValue) {
			if (props.dataType === "struct") {
				// For structs, interpret the ArrayLike as a flattened representation
				const buffer = this.serializeStructFromArray(props.initialValue, this.structFields!);
				new Uint8Array(this.buffer.getMappedRange()).set(new Uint8Array(buffer));
			} else {
				if (this.baseType == "float") {
					new Float32Array(this.buffer.getMappedRange()).set(props.initialValue);
				}
				else if (this.baseType == "uint") {
					new Uint32Array(this.buffer.getMappedRange()).set(props.initialValue);
				}
				else if (this.baseType == "int") {
					new Int32Array(this.buffer.getMappedRange()).set(props.initialValue);
				}
			}
			this.buffer.unmap();
		}
	}

	private serializeStructFromArray(data: ArrayLike<number>, fields: Array<{name: string, dataType: string, offset?: number}>): ArrayBuffer {
		const buffer = new ArrayBuffer(this.sizeBytes);
		const view = new DataView(buffer);
		let dataIndex = 0;
		let offset = 0;

		for (const field of fields) {
			const fieldAlign = getFieldAlignment(field.dataType);
			offset = Math.ceil(offset / fieldAlign) * fieldAlign;
			
			if (field.offset !== undefined) {
				offset = Math.max(offset, field.offset);
			}

			const fieldSize = this.getFieldElementCount(field.dataType);
			const values = Array.from(data).slice(dataIndex, dataIndex + fieldSize);
			
			this.writeFieldToBuffer(view, offset, field.dataType, values);
			
			dataIndex += fieldSize;
			offset += getFieldSize(field.dataType);
		}

		return buffer;
	}

	private getFieldElementCount(type: string): number {
		if (type === 'f32' || type === 'u32' || type === 'i32') return 1;
		if (type.startsWith('vec2')) return 2;
		if (type.startsWith('vec3')) return 3;
		if (type.startsWith('vec4')) return 4;
		if (type.startsWith('mat4x4')) return 16;
		return 1;
	}

	private writeFieldToBuffer(view: DataView, offset: number, type: string, values: number[]) {
		values.forEach((value, i) => {
			if (type.includes('f32')) {
				view.setFloat32(offset + i * 4, value, true);
			} else if (type.includes('u32')) {
				view.setUint32(offset + i * 4, value, true);
			} else if (type.includes('i32')) {
				view.setInt32(offset + i * 4, value, true);
			}
		});
	}

	private determineStructBaseType(fields: Array<{name: string, dataType: string, offset?: number}>): "float" | "int" | "uint" | "mixed" {
		const types = new Set(fields.map(f => {
			if (f.dataType.includes('f32')) return 'float';
			if (f.dataType.includes('u32')) return 'uint';
			if (f.dataType.includes('i32')) return 'int';
			return 'unknown';
		}));
		
		return types.size === 1 ? Array.from(types)[0] as any : 'mixed';
	}

	/**
	 * Writes data to the buffer using COPY_DST, allowing data to be transferred from CPU to GPU.
	 * @param {Float32Array | Uint32Array | Int32Array} value - The data to be written to the buffer.
	 * @param {number} [offset=0] - The offset in elements from the start of the buffer where the data should be written.
	 */
	write(value: Float32Array | Uint32Array | Int32Array, offset = 0) {
		if (!this.props.canCopyDst) throw new Error("Buffer is not writable. Set `canCopyDst` to `true` in the buffer props.");
		const offsetBytes = offset * this.sizeBytes / this.sizeElements;
		Shader.device.queue.writeBuffer(this.buffer, offsetBytes, value as BufferSource);
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
	 * @returns {Promise<Float32Array | Uint32Array | Int32Array>} - A promise that resolves to the copied data.
	 */
	async read(offset = 0, length: number = this.sizeElements): Promise<Float32Array | Uint32Array | Int32Array> {
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
		let data: Float32Array | Uint32Array | Int32Array;
		if (this.dataType === "struct") {
			// For structs, return a flattened array representation
			data = this.deserializeStructToArray(arrayBuffer, this.structFields!);
		} else if (this.baseType === "float") {
			data = new Float32Array(new Float32Array(arrayBuffer));
		} 
		else if (this.baseType === "uint") {
			data = new Uint32Array(new Uint32Array(arrayBuffer));
		}
		else if (this.baseType === "int") {
			data = new Int32Array(new Int32Array(arrayBuffer));
		}

		// Unmap the buffer
		stagingBuffer.unmap();

		// Destroy the staging buffer to release GPU memory
		stagingBuffer.destroy();

		return data;
	}

	private deserializeStructToArray(buffer: ArrayBuffer, fields: Array<{name: string, dataType: string, offset?: number}>): Float32Array | Uint32Array | Int32Array {
		const view = new DataView(buffer);
		const result: number[] = [];
		let offset = 0;

		for (const field of fields) {
			const fieldAlign = getFieldAlignment(field.dataType);
			offset = Math.ceil(offset / fieldAlign) * fieldAlign;
			
			if (field.offset !== undefined) {
				offset = Math.max(offset, field.offset);
			}

			const values = this.readFieldFromBuffer(view, offset, field.dataType);
			result.push(...(Array.isArray(values) ? values : [values]));
			offset += getFieldSize(field.dataType);
		}

		// Return appropriate typed array based on struct's predominant type
		if (this.baseType === "float") {
			return new Float32Array(result);
		} else if (this.baseType === "uint") {
			return new Uint32Array(result);
		} else if (this.baseType === "int") {
			return new Int32Array(result);
		} else {
			// Mixed type - default to Float32Array
			return new Float32Array(result);
		}
	}

	private readFieldFromBuffer(view: DataView, offset: number, type: string): number | number[] {
		if (type === 'f32') {
			return view.getFloat32(offset, true);
		} else if (type === 'u32') {
			return view.getUint32(offset, true);
		} else if (type === 'i32') {
			return view.getInt32(offset, true);
		} else if (type.startsWith('vec')) {
			const componentCount = parseInt(type[3]);
			const components = [];
			for (let i = 0; i < componentCount; i++) {
				if (type.includes('f32')) {
					components.push(view.getFloat32(offset + i * 4, true));
				} else if (type.includes('u32')) {
					components.push(view.getUint32(offset + i * 4, true));
				} else if (type.includes('i32')) {
					components.push(view.getInt32(offset + i * 4, true));
				}
			}
			return components;
		}
		
		return 0;
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