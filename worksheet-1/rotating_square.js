window.onload = async function main() {
  if (!navigator.gpu) {
    alert("WebGPU not supported on this browser.");
    return;
  }

  //  Adapter & Device
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  //  Canvas setup
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device: device,
    format: format,
    alphaMode: "opaque",
  });

  //  Quad vertices (centered at 0,0)
  const positions = new Float32Array([
    -0.5,
    -0.5, // bottom-left
    0.5,
    -0.5, // bottom-right
    -0.5,
    0.5, // top-left
    0.5,
    -0.5, // bottom-right
    0.5,
    0.5, // top-right
    -0.5,
    0.5, // top-left
  ]);

  const colors = new Float32Array([
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  ]);

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

  //  Uniform buffer for rotation
  const uniformBuffer = device.createBuffer({
    size: 4, // single float for angle
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  //  Bind group layout
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

  //  WGSL shader (with rotation)
  const shaderCode = `
    struct Uniforms {
      angle: f32,
    };
    @binding(0) @group(0) var<uniform> uniforms: Uniforms;

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
      let cosA = cos(uniforms.angle);
      let sinA = sin(uniforms.angle);
      let rotated = vec2f(
        inPos.x * cosA - inPos.y * sinA,
        inPos.x * sinA + inPos.y * cosA
      );
      output.position = vec4f(rotated, 0.0, 1.0);
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
  let angle = 0;
  function frame() {
    angle += 0.04; // rotation speed
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([angle]));

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
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, positionBuffer);
    passEncoder.setVertexBuffer(1, colorBuffer);
    passEncoder.draw(6); // 2 triangles
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
};
