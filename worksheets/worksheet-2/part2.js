const colors = {
  0: [0.0, 0.0, 0.0, 1.0], // Black
  1: [1.0, 0.0, 0.0, 1.0], // Red
  2: [1.0, 1.0, 0.0, 1.0], // Yellow
  3: [0.0, 1.0, 0.0, 1.0], // Green
  4: [0.0, 0.0, 1.0, 1.0], // Blue
  5: [1.0, 0.0, 1.0, 1.0], // Magenta
};

window.onload = async function main() {
  const { device, context, format, canvasHeight, canvasWidth } =
    await initWebGPU();

  const canvas = document.getElementById("canvas");
  const clearBtn = document.getElementById("clear-btn");
  const colorMenu = document.getElementById("colorMenu");

  let selectedColor = 0;
  colorMenu.value = "0";

  colorMenu.addEventListener(
    "change",
    (e) => (selectedColor = parseInt(e.target.value))
  );

  function toClipSpace(x, y) {
    return [(x / canvasWidth) * 2 - 1, (y / canvasHeight) * -2 + 1];
  }

  let points = [];

  const shaderCode = `
    struct VertexOutput {
      @builtin(position) position : vec4f,
      @location(0) color : vec4f
    };

    @vertex
    fn vs_main(@location(0) inPos : vec2f, @location(1) inColor : vec4f) -> VertexOutput {
      var output : VertexOutput;
      output.position = vec4f(inPos, 0.0, 1.0);
      output.color = inColor;
      return output;
    }

    @fragment
    fn fs_main(@location(0) color : vec4f) -> @location(0) vec4f {
      return color;
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
          arrayStride: 24,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            { shaderLocation: 1, offset: 8, format: "float32x4" },
          ],
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
    pass.draw(points.length / 6);
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const color = colors[selectedColor];
    points.push(...makeSquare(x, y, color, toClipSpace));
    drawScene();
  });

  clearBtn.addEventListener("click", () => {
    points = [];
    drawScene();
  });

  drawScene();
};
