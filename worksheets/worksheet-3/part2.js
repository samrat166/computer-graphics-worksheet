window.addEventListener("load", async () => {
  const { device, context, format } = await initWebGPU("canvas");

  // Full cube vertices
  const vertices = new Float32Array([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
  ]);

  // wireframe indices for 12 edges
  const indices = new Uint16Array([
    0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7,
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

  // Shader
  const shaderCode = `
struct Uniforms { mvp : mat4x4<f32>; };
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VSOut { @builtin(position) Position : vec4<f32>; };

@vertex
fn vs_main(@location(0) pos : vec3<f32>) -> VSOut {
  var out: VSOut;
  out.Position = uniforms.mvp * vec4<f32>(pos,1.0);
  return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return vec4<f32>(0.0,0.0,0.0,1.0);
}
`;

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({ code: shaderCode }),
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 3 * 4,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({ code: shaderCode }),
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: { topology: "line-list", cullMode: "none" },
  });

  // Helper: flatten column-major
  function flattenColumnMajor(m) {
    const fm = new Float32Array(16);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) fm[i + j * 4] = m[i][j];
    return fm;
  }

  // Isometric cube matrices
  const M = mat4(); // identity
  const V = lookAt(vec3(3, 3, 3), vec3(0.5, 0.5, 0.5), vec3(0, 1, 0));
  const P = ortho(-1, 2, -1, 2, 0.1, 10);
  const MVP = mult(P, mult(V, M));

  const mvpBuffer = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(mvpBuffer, 0, flattenColumnMajor(MVP));

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: mvpBuffer } }],
  });

  function render() {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, "uint16");
    pass.drawIndexed(indices.length);
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  render();
});
