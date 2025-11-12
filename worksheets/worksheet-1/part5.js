window.onload = async function main() {
  const { device, context, format, canvasHeight, canvasWidth } =
    await initWebGPU();

  //  Helper: generate circle vertices
  function createCircleVertices(radius = 0.2, segments = 50) {
    const vertices = [];
    const center = [0, 0];
    for (let i = 0; i < segments; i++) {
      const theta1 = (i / segments) * 2 * Math.PI;
      const theta2 = ((i + 1) / segments) * 2 * Math.PI;

      const x1 = radius * Math.cos(theta1);
      const y1 = radius * Math.sin(theta1);
      const x2 = radius * Math.cos(theta2);
      const y2 = radius * Math.sin(theta2);

      vertices.push(...center, x1, y1, x2, y2);
    }
    return new Float32Array(vertices);
  }

  function createCircleColors(segments = 50, color = [1, 0, 0]) {
    const colors = [];
    for (let i = 0; i < segments; i++) {
      colors.push(...color, ...color, ...color); // 3 vertices per triangle
    }
    return new Float32Array(colors);
  }

  const segments = 50;
  const positions = createCircleVertices(0.2, segments);
  const colors = createCircleColors(segments, [1, 1, 1]); // red

  //  Create GPU buffers
  const positionBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(positionBuffer.getMappedRange()).set(positions);
  positionBuffer.unmap();

  const colorBuffer = device.createBuffer({
    size: colors.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(colorBuffer.getMappedRange()).set(colors);
  colorBuffer.unmap();

  //  Uniform buffer for y-offset
  const uniformBuffer = device.createBuffer({
    size: 4, // single float
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  //  Bind group
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  //  WGSL Shader
  const shaderCode = `
    struct Uniforms {
      yOffset: f32,
    };
    @binding(0) @group(0) var<uniform> uniforms: Uniforms;

    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(0) color: vec3f,
    };

    @vertex
    fn vs_main(@location(0) inPos: vec2f,
               @location(1) inColor: vec3f) -> VertexOutput {
      var output: VertexOutput;
      output.position = vec4f(inPos.x, inPos.y + uniforms.yOffset, 0.0, 1.0);
      output.color = inColor;
      return output;
    }

    @fragment
    fn fs_main(@location(0) fragColor: vec3f) -> @location(0) vec4f {
      return vec4f(fragColor, 1.0);
    }
  `;

  const shaderModule = device.createShaderModule({ code: shaderCode });

  //  Pipeline
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
        {
          arrayStride: 12,
          attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }],
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

  //  Animation loop
  let yOffset = 0;
  let direction = 1; // 1 = down, -1 = up
  const speed = 0.01;

  function frame() {
    yOffset += speed * direction;
    if (yOffset > 0.5 || yOffset < -0.5) direction *= -1;

    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([yOffset]));

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

    const pass = commandEncoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, positionBuffer);
    pass.setVertexBuffer(1, colorBuffer);
    pass.draw(segments * 3); // 3 vertices per triangle
    pass.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
};
