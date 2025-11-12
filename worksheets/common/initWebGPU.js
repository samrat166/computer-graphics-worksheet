async function initWebGPU(canvasId = "canvas", options = {}) {
  const { alphaMode = "opaque" } = options;
  if (!navigator.gpu) throw new Error("WebGPU not supported.");

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const canvas = document.getElementById(canvasId);
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode,
  });

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  return { device, context, format, canvasHeight, canvasWidth };
}
