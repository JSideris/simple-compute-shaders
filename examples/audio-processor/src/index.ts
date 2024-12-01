const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const context = canvas.getContext('2d');
if (context) {
  context.fillStyle = 'blue';
  context.fillRect(0, 0, canvas.width, canvas.height);
}

console.log('Simple example app running...');
