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
  const colorMenu = document.getElementById("colorMenu");
  const clearBtn = document.getElementById("clear-btn");
  const pointModeBtn = document.getElementById("point-mode");
  const triangleModeBtn = document.getElementById("triangle-mode");
  const circleModeBtn = document.getElementById("circle-mode");

  let selectedColor = 0;
  let mode = "point";
  let tempPoints = [];
  let points = [];

  function toClipSpace(x, y) {
    return [(x / canvasWidth) * 2 - 1, (y / canvasHeight) * -2 + 1];
  }

  function makeCircle(cx, cy, color, radiusPx, segments = 40) {
    const [r, g, b, a] = color;
    const [centerX, centerY] = toClipSpace(cx, cy);
    const verts = [];
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * 2 * Math.PI;
      const a2 = ((i + 1) / segments) * 2 * Math.PI;
      const [x1, y1] = toClipSpace(
        cx + radiusPx * Math.cos(a1),
        cy + radiusPx * Math.sin(a1)
      );
      const [x2, y2] = toClipSpace(
        cx + radiusPx * Math.cos(a2),
        cy + radiusPx * Math.sin(a2)
      );
      verts.push(
        centerX,
        centerY,
        r,
        g,
        b,
        a,
        x1,
        y1,
        r,
        g,
        b,
        a,
        x2,
        y2,
        r,
        g,
        b,
        a
      );
    }
    return verts;
  }

  const shaderCode = `
    struct VertexOutput {
      @builtin(position) position : vec4f,
      @location(0) color : vec4f
    };
    @vertex
    fn vs_main(@location(0) inPos: vec2f, @location(1) inColor: vec4f) -> VertexOutput {
      var out: VertexOutput;
      out.position = vec4f(inPos, 0.0, 1.0);
      out.color = inColor;
      return out;
    }
    @fragment
    fn fs_main(@location(0) color: vec4f) -> @location(0) vec4f {
      return color;
    }
  `;

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({ code: shaderCode }),
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
      module: device.createShaderModule({ code: shaderCode }),
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list" },
  });

  function drawScene() {
    let drawPoints = [...points];

    // show temporary points
    if (tempPoints.length > 0) {
      for (let p of tempPoints) {
        const color = p.color || colors[selectedColor];
        const [sx, sy] = p.screen || [p.pos[0], p.pos[1]];
        drawPoints.push(...makeSquare(sx, sy, color, toClipSpace, 6));
      }
    }

    const vertexBuffer = device.createBuffer({
      size: drawPoints.length * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(drawPoints);
    vertexBuffer.unmap();

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
    pass.draw(drawPoints.length / 6);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Events
  colorMenu.addEventListener(
    "change",
    (e) => (selectedColor = parseInt(e.target.value))
  );
  pointModeBtn.addEventListener("click", () => {
    mode = "point";
    tempPoints = [];
  });
  triangleModeBtn.addEventListener("click", () => {
    mode = "triangle";
    tempPoints = [];
  });
  circleModeBtn.addEventListener("click", () => {
    mode = "circle";
    tempPoints = [];
  });

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const color = colors[selectedColor];

    if (mode === "point") {
      points.push(...makeSquare(x, y, color, toClipSpace));
    } else if (mode === "triangle") {
      const [nx, ny] = toClipSpace(x, y);
      tempPoints.push({ pos: [nx, ny], screen: [x, y], color });
      if (tempPoints.length === 3) {
        points.push(
          ...tempPoints.flatMap((p) => [p.pos[0], p.pos[1], ...p.color])
        );
        tempPoints = [];
      }
    } else if (mode === "circle") {
      if (tempPoints.length === 0) {
        tempPoints.push({ screen: [x, y] });
      } else {
        const c = tempPoints[0].screen;
        const dx = x - c[0];
        const dy = y - c[1];
        const radius = Math.sqrt(dx * dx + dy * dy);
        points.push(...makeCircle(c[0], c[1], color, radius));
        tempPoints = [];
      }
    }

    drawScene();
  });

  clearBtn.addEventListener("click", () => {
    points = [];
    tempPoints = [];
    drawScene();
  });

  drawScene();
};
