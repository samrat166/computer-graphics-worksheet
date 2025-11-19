// ---------------------------
// Cube Data
// ---------------------------
const vertices = new Float32Array(
  flatten([
    vec3(-0.5, -0.5, 0.5),
    vec3(-0.5, 0.5, 0.5),
    vec3(0.5, 0.5, 0.5),
    vec3(0.5, -0.5, 0.5),
    vec3(-0.5, -0.5, -0.5),
    vec3(-0.5, 0.5, -0.5),
    vec3(0.5, 0.5, -0.5),
    vec3(0.5, -0.5, -0.5),
  ])
);

const indices = new Uint16Array([
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  0, // front
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  4, // back
  0,
  4,
  1,
  5,
  2,
  6,
  3,
  7, // sides
]);

// ---------------------------
// Projection Helper for WebGPU
// ---------------------------
function convertToWebGPUProjection(p) {
  const r = new Float32Array(16);
  for (let i = 0; i < 16; i++) r[i] = p[i];
  // fix depth range -1..1 => 0..1
  r[10] = (p[10] + p[14]) * 0.5;
  r[14] = p[14] * 0.5;
  return r;
}

// ---------------------------
// Main
// ---------------------------
window.addEventListener("load", async () => {
  const { device, context, format } = await initWebGPU("canvas");

  // ---------------------------
  // Geometry Data
  // ---------------------------
  const vertices = new Float32Array(
    flatten([
      vec3(-0.5, -0.5, 0.5),
      vec3(-0.5, 0.5, 0.5),
      vec3(0.5, 0.5, 0.5),
      vec3(0.5, -0.5, 0.5),
      vec3(-0.5, -0.5, -0.5),
      vec3(-0.5, 0.5, -0.5),
      vec3(0.5, 0.5, -0.5),
      vec3(0.5, -0.5, -0.5),
    ])
  );

  const indices = new Uint16Array([
    1, 0, 1, 2, 3, 0, 3, 2, 2, 6, 6, 5, 5, 1, 0, 4, 4, 5, 6, 7, 7, 3, 4, 7,
  ]);

  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertices);

  const indexBuffer = device.createBuffer({
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indices);

  // ---------------------------
  // ANGEL JS MATRICES
  // ---------------------------
  const fovy = 45;
  const aspect = canvas.width / canvas.height;
  const near = 1; // FIXED
  const far = 10; // FIXED

  const at = vec3(0.0, 0.0, 0.0);
  const up = vec3(0.0, 1.0, 0.0);
  const eye = vec3(0.0, 0.0, -6.0);

  const viewMatrix = lookAt(eye, at, up);
  const projMatrix = perspective(fovy, aspect, near, far);

  const modelMatrices = [
    translate(0.0, 0.0, 0.0),
    translate(1.5, 0.0, 0.0),
    mult(translate(-1.5, 0.0, 0.0), rotateX(35)), // ANGEL.js 4x4
  ];

  // Flattened buffer for 3 MVP matrices
  const MVP_SIZE = 16 * 4;
  const uniformBuffer = device.createBuffer({
    size: MVP_SIZE * 3,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  function updateUniforms() {
    for (let i = 0; i < 3; i++) {
      const mvp = mult(projMatrix, mult(viewMatrix, modelMatrices[i]));
      device.queue.writeBuffer(
        uniformBuffer,
        MVP_SIZE * i,
        new Float32Array(flatten(mvp))
      );
    }
  }
  updateUniforms();

  // ---------------------------
  // WebGPU Shader
  // ---------------------------
  const shaderModule = device.createShaderModule({
    code: `
      struct MVP {
        mvp : mat4x4f
      };

      @group(0) @binding(0)
      var<uniform> u_mvp : array<MVP, 3>;

      struct Output {
        @builtin(position) Position : vec4f
      };

      @vertex
      fn vs(
        @builtin(instance_index) inst: u32,
        @location(0) pos : vec3f
      ) -> Output {
        var out : Output;
        out.Position = u_mvp[inst].mvp * vec4f(pos, 1.0);
        return out;
      }

      @fragment
      fn fs() -> @location(0) vec4f {
        return vec4f(1.0, 1.0, 1.0, 1.0);
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vs",
      buffers: [
        {
          arrayStride: 12,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs",
      targets: [{ format }],
    },
    primitive: {
      topology: "line-list",
    },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  function frame() {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1 },
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, "uint16");

    pass.drawIndexed(indices.length, 3); // 3 cube instances

    pass.end();
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(frame);
  }

  frame();
});
