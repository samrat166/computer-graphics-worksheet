window.addEventListener("load", async () => {
  const { device, context, format } = await initWebGPU("canvas");

  // -------------------
  // Vertex + Index Data
  // -------------------
  const vertices = new Float32Array([
    -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,

    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
  ]);

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

  // -------------------
  // ANGEL.JS MATRICES
  // -------------------

  const eye = vec3(0.0, 0.0, 3.0);
  const at = vec3(0.0, 0.0, 0.0);
  const up = vec3(0.0, 1.0, 0.0);

  const viewMatrix = lookAt(eye, at, up);
  const projMatrix = perspective(45, canvas.width / canvas.height, 0.1, 100);

  // model = translate(0.5, 0.5, 0)
  const modelMatrix = translate(0.5, 0.5, 0.0);

  // final = projection * view * model
  const mvpMatrix = mult(projMatrix, mult(viewMatrix, modelMatrix));
  const mvpArray = new Float32Array(flatten(mvpMatrix));

  const uniformBuffer = device.createBuffer({
    size: mvpArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, mvpArray);

  // -------------------
  // Render Pipeline
  // -------------------
  const shaderModule = device.createShaderModule({
    code: `
            struct Uniforms {
                mvp : mat4x4f
            };
            @group(0) @binding(0)
            var<uniform> uniforms : Uniforms;

            struct VSOut {
                @builtin(position) Position : vec4f
            };

            @vertex
            fn vs(@location(0) pos : vec3f) -> VSOut {
                var out : VSOut;
                out.Position = uniforms.mvp * vec4f(pos, 1.0);
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
          arrayStride: 3 * 4,
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

  // -------------------
  // Render Loop
  // -------------------
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
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, "uint16");
    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(indices.length);
    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  frame();
});
