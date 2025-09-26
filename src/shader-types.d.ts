export type BindingDef = {
	type: "storage" | "read-only-storage" | "uniform" | "write-only-texture" | "var";
	name: string;
	binding: ShaderBuffer
};

export type BindingGroupDef = Record<string, BindingDef[]>;

export type BaseShaderProps = {
	code: string|Array<string>;
	/**
	 * @default "execution_counter"
	 */
	executionCountBufferName?: string;
	/**
	 * @default true
	 */
	useExecutionCountBuffer?: boolean;

	/**
	 * @default "time"
	 */
	timeBufferName?: string;
	/**
	 * @default true
	 */
	useTimeBuffer?: boolean;

	/**
	 * @default []
	 * @description An array of binding layouts. Each binding layout is a record of binding groups. Each group must have a matching set of bindings.
	 * @example
	 * {
	 * 	bindingGroups: [{
	 * 		group1: [uniform1, binding1, texture1],
	 * 		group2: [uniform1, binding2, texture2]
	 * 	}, {
	 *      default: [uniform2, uniform3, texture3, texture4]
	 * }]
	 * }
	 */
	bindingLayouts: BindingGroupDef[];
};