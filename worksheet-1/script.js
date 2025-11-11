window.onload = async function main() {
  if (!navigator.gpu) {
    alert("WebGPU not supported on this browser.");
    return;
  }

  // Get GPU adapter & device
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  // Configure the canvas
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device: device,
    format: format,
    alphaMode: "opaque",
  });

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  function px(x, y) {
    return [(x / canvasWidth) * 2 - 1, (y / canvasHeight) * -2 + 1];
  }

  // 3 small squares of length 20 at different spots:
  const points = [
    ...px(250, 100),
    ...px(270, 100),
    ...px(250, 120),
    ...px(270, 100),
    ...px(270, 120),
    ...px(250, 120),

    ...px(150, 300),
    ...px(170, 300),
    ...px(150, 320),
    ...px(170, 300),
    ...px(170, 320),
    ...px(150, 320),

    ...px(350, 300),
    ...px(370, 300),
    ...px(350, 320),
    ...px(370, 300),
    ...px(370, 320),
    ...px(350, 320),
  ];

  const vertexBuffer = device.createBuffer({
    size: points.length * 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });

  new Float32Array(vertexBuffer.getMappedRange()).set(points);
  vertexBuffer.unmap();

  const shaderCode = `
    @vertex
    fn vs_main(@location(0) inPos : vec2f) -> @builtin(position) vec4f {
      return vec4f(inPos, 0.0, 1.0);
    }

    @fragment
    fn fs_main() -> @location(0) vec4f {
      return vec4f(0.0, 0.0, 0.0, 1.0); // constant black
    }
  `;

  const shaderModule = device.createShaderModule({ code: shaderCode });

  //  Create the render pipeline
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format: format }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  // Create a command encoder and render pass
  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.draw(points.length / 2);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
};
