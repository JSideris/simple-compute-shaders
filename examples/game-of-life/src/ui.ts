export function setupUi(props: {
	resetCallback: Function
}){
	let canvas = document.createElement('canvas');
	canvas.style.backgroundColor = "black";
	canvas.id = "main-canvas";
	canvas.style.cursor = "pointer";
	document.body.appendChild(canvas);

	canvas.width = canvas.height = Math.min(window.innerHeight, window.innerWidth);

	document.body.style.margin = "0";
	document.body.style.overflow = "hidden";
	document.body.style.backgroundColor = "#111";
	document.body.style.margin = "auto";
	document.body.style.textAlign = "center";

	// Create instruction text
	let instruction = document.createElement('div');
	instruction.textContent = "Click anywhere to reset.";
	instruction.style.position = "fixed";
	instruction.style.bottom = "40px";
	instruction.style.left = "50%";
	instruction.style.transform = "translateX(-50%)";
	instruction.style.color = "rgb(145, 194, 229)";
	instruction.style.fontSize = "16px";
	instruction.style.fontFamily = "sans-serif";
	instruction.style.zIndex = "1000";
	instruction.style.pointerEvents = "none";
	instruction.style.transition = "opacity 0.3s ease";
	instruction.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
	instruction.style.padding = "10px";
	instruction.style.borderRadius = "5px";
	document.body.appendChild(instruction);

	let hasReset = false;

	canvas.addEventListener('click', () => {
		props.resetCallback();
		
		// Hide instruction after first reset
		if (!hasReset) {
			hasReset = true;
			instruction.style.opacity = "0";
			setTimeout(() => {
				instruction.remove();
			}, 300);
		}
	});

	return {
		canvas
	};
}