window.onload = async function main() {
  const { device, context, format, canvasHeight, canvasWidth } =
    await initWebGPU();
  function px(x, y) {
    return [(x / canvasWidth) * 2 - 1, (y / canvasHeight) * -2 + 1];
  }

  const positions = [
    ...px(250, 100), // top vertex
    ...px(150, 300), // bottom-left
    ...px(350, 300), // bottom-right
  ];

  const colors = [
    1.0,
    0.0,
    0.0, // red (top)
    0.0,
    1.0,
    0.0, // green (bottom-left)
    0.0,
    0.0,
    1.0, // blue (bottom-right)
  ];

  const positionBuffer = device.createBuffer({
    size: positions.length * 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(positionBuffer.getMappedRange()).set(positions);
  positionBuffer.unmap();

  const colorBuffer = device.createBuffer({
    size: colors.length * 4,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(colorBuffer.getMappedRange()).set(colors);
  colorBuffer.unmap();

  const shaderCode = `
    struct VertexOutput {
      @builtin(position) position : vec4f,
      @location(0) color : vec3f,
    };

    @vertex
    fn vs_main(
        @location(0) inPos: vec2f,
        @location(1) inColor: vec3f
    ) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4f(inPos, 0.0, 1.0);
        output.color = inColor;
        return output;
    }

    @fragment
    fn fs_main(@location(0) fragColor: vec3f) -> @location(0) vec4f {
        return vec4f(fragColor, 1.0);
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
          arrayStride: 8, // vec2f = 2 floats * 4 bytes
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
        {
          arrayStride: 12, // vec3f = 3 floats * 4 bytes
          attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format: format }],
    },
    primitive: { topology: "triangle-list" },
  });

  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 }, // cornflower blue
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const pass = commandEncoder.beginRenderPass(renderPassDescriptor);

  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, positionBuffer);
  pass.setVertexBuffer(1, colorBuffer);

  pass.draw(3); // 3 vertices

  pass.end();

  device.queue.submit([commandEncoder.finish()]);
};
