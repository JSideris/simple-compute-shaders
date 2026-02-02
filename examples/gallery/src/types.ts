export interface Example {
  id: string;
  name: string;
  description: string;
  start: (canvas: HTMLCanvasElement, container: HTMLDivElement) => Promise<() => void> | (() => void);
}
