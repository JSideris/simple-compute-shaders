
const wgslReservedKeywords = new Set([
	'var', 'let', 'const', 'if', 'else', 'for', 'while', 'return', 'true', 'false',
	'void', 'fn', 'struct', 'uniform', 'storage', 'workgroup', 'texture', 'sampler',
	'array', 'atomic', 'bool', 'f32', 'i32', 'u32'
]);

export function isValidWebGpuVarName(name: string): boolean {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
		return false;
	}
	return !wgslReservedKeywords.has(name);
}
