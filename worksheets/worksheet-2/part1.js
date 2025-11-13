window.onload = async function main() {
  const { device, context, format, canvasHeight, canvasWidth } =
    await initWebGPU();

  const canvas = document.getElementById("canvas");
  const clearBtn = document.getElementById("clear-btn");

  function px(x, y) {
    return [(x / canvasWidth) * 2 - 1, (y / canvasHeight) * -2 + 1];
  }

  // List of all squares (each one is made of 6 vertices)
  let points = [];

  const shaderCode = `
    @vertex
    fn vs_main(@location(0) inPos : vec2f) -> @builtin(position) vec4f {
      return vec4f(inPos, 0.0, 1.0);
    }

    @fragment
    fn fs_main() -> @location(0) vec4f {
      return vec4f(0.0, 0.0, 0.0, 1.0); // Black
    }
  `;

  const shaderModule = device.createShaderModule({ code: shaderCode });

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
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list" },
  });

  let vertexBuffer = device.createBuffer({
    size: 0,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  function drawScene() {
    const buffer = device.createBuffer({
      size: points.length * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(points);
    buffer.unmap();
    vertexBuffer = buffer;

    // Create encoder & pass
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 }, 
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(points.length / 2);
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const size = 10; // 20px square
    const [x0, y0] = px(x - size / 2, y - size / 2); // bottom-left
    const [x1, y1] = px(x + size / 2, y - size / 2); // bottom-right
    const [x2, y2] = px(x - size / 2, y + size / 2); // top-left
    const [x3, y3] = px(x + size / 2, y + size / 2); // top-right

    // Two triangles per square
    points.push(x0, y0, x1, y1, x2, y2, x1, y1, x3, y3, x2, y2);

    drawScene();
  });

  drawScene();
};
