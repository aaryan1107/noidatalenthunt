import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fract = (value) => ((value % 1) + 1) % 1;

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
  uniform vec2 u_atlas_size;
  uniform vec2 u_offset;
  uniform float u_curvature;
  varying vec2 v_uv;

  void main() {
    vec2 centered = v_uv * 2.0 - 1.0;
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 lens = vec2(centered.x * aspect, centered.y);
    float radius = dot(lens, lens) / (aspect * aspect + 1.0);
    float curve = u_curvature * (0.34 * radius + 0.12 * radius * radius);
    vec2 warped = lens / (1.0 + curve);
    vec2 warped_uv = vec2(warped.x / aspect, warped.y) * 0.5 + 0.5;
    vec2 world = vec2(
      warped_uv.x * u_resolution.x - u_offset.x,
      (1.0 - warped_uv.y) * u_resolution.y - u_offset.y
    );
    vec2 atlas_uv = fract(world / u_atlas_size);
    vec4 color = texture2D(u_texture, vec2(atlas_uv.x, 1.0 - atlas_uv.y));
    float edgeShade = clamp(radius * u_curvature * 0.12, 0.0, 0.24);
    color.rgb *= 1.0 - edgeShade;
    gl_FragColor = color;
  }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function drawCoverImage(context, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

// Trims to the widest string that fits, so a long label is never clipped mid-glyph.
function fitText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && context.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function drawPlayBadge(context, x, y, size) {
  context.save();
  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);
  context.fillStyle = "rgba(10,10,10,0.55)";
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.85)";
  context.lineWidth = 1.5;
  context.stroke();
  context.beginPath();
  context.moveTo(x - size * 0.28, y - size * 0.42);
  context.lineTo(x + size * 0.46, y);
  context.lineTo(x - size * 0.28, y + size * 0.42);
  context.closePath();
  context.fillStyle = "rgba(255,255,255,0.95)";
  context.fill();
  context.restore();
}

export default function FisheyeInfiniteGrid({
  items,
  tileWidth = 300,
  tileHeight = 348,
  gap = 0,
  lensStrength = 0.3,
  hoverNudge = 16,
  inertia = 0.94,
  wheelSensitivity = 0.42,
  onSelect,
  className,
  ariaLabel = "Infinite draggable gallery from the July 2026 edition",
}) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, pointerId: -1, x: 0, y: 0, time: 0, travel: 0 });
  const nudgeRef = useRef(null);
  const reducedMotionRef = useRef(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return undefined;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
    });
    if (!gl) return undefined;

    const program = createProgram(gl);
    if (!program) return undefined;

    const positionBuffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!positionBuffer || !texture) return undefined;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const atlasSizeLocation = gl.getUniformLocation(program, "u_atlas_size");
    const offsetLocation = gl.getUniformLocation(program, "u_offset");
    const curvatureLocation = gl.getUniformLocation(program, "u_curvature");
    const textureLocation = gl.getUniformLocation(program, "u_texture");

    const safeTileWidth = Math.max(140, tileWidth);
    const safeTileHeight = Math.max(150, tileHeight);
    const safeGap = Math.max(0, gap);
    const cellWidth = safeTileWidth + safeGap;
    const cellHeight = safeTileHeight + safeGap;
    const atlasColumns = Math.max(2, Math.min(4, items.length));
    const atlasRows = Math.max(2, Math.ceil(items.length / atlasColumns));
    // World size stays in CSS pixels; the bitmap is oversampled so tiles stay crisp.
    const atlasWorldWidth = atlasColumns * cellWidth;
    const atlasWorldHeight = atlasRows * cellHeight;
    const atlasScale = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
    const atlas = document.createElement("canvas");
    atlas.width = Math.ceil(atlasWorldWidth * atlasScale);
    atlas.height = Math.ceil(atlasWorldHeight * atlasScale);
    const atlasContext = atlas.getContext("2d");
    if (!atlasContext) return undefined;
    atlasContext.scale(atlasScale, atlasScale);
    atlasContext.imageSmoothingEnabled = true;
    atlasContext.imageSmoothingQuality = "high";

    const loadedImages = items.map(() => null);
    let disposed = false;
    let animationFrame = 0;
    let previousFrame = performance.now();
    let viewWidth = 1;
    let viewHeight = 1;

    const uploadAtlas = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    };

    const inset = Math.max(12, Math.round(safeTileWidth * 0.07));
    const footerHeight = Math.max(32, Math.round(safeTileHeight * 0.14));

    const drawAtlas = () => {
      atlasContext.fillStyle = "#141613";
      atlasContext.fillRect(0, 0, atlasWorldWidth, atlasWorldHeight);
      atlasContext.textBaseline = "middle";

      for (let index = 0; index < atlasColumns * atlasRows; index += 1) {
        const item = items[index % items.length];
        const image = loadedImages[index % items.length];
        const column = index % atlasColumns;
        const row = Math.floor(index / atlasColumns);
        const x = column * cellWidth;
        const y = row * cellHeight;
        const imageWidth = safeTileWidth - inset * 2;
        const imageHeight = safeTileHeight - inset * 2 - footerHeight;

        atlasContext.fillStyle = "#1b1e1a";
        atlasContext.fillRect(x, y, safeTileWidth, safeTileHeight);
        atlasContext.strokeStyle = "rgba(255,255,255,0.09)";
        atlasContext.lineWidth = 1;
        atlasContext.beginPath();
        atlasContext.moveTo(x + 0.5, y);
        atlasContext.lineTo(x + 0.5, y + safeTileHeight);
        atlasContext.moveTo(x, y + 0.5);
        atlasContext.lineTo(x + safeTileWidth, y + 0.5);
        atlasContext.stroke();

        atlasContext.fillStyle = "rgba(255,255,255,0.035)";
        atlasContext.fillRect(x + inset, y + inset, imageWidth, imageHeight);
        if (image && image.complete && image.naturalWidth > 0) {
          drawCoverImage(atlasContext, image, x + inset, y + inset, imageWidth, imageHeight);
          atlasContext.fillStyle = "rgba(0,0,0,0.18)";
          atlasContext.fillRect(x + inset, y + inset, imageWidth, imageHeight);
        }

        if (item.instagramId) {
          drawPlayBadge(
            atlasContext,
            x + inset + imageWidth / 2,
            y + inset + imageHeight / 2,
            Math.round(imageWidth * 0.11),
          );
        }

        atlasContext.strokeStyle = "rgba(255,255,255,0.1)";
        atlasContext.strokeRect(x + inset + 0.5, y + inset + 0.5, imageWidth - 1, imageHeight - 1);

        const labelY = y + safeTileHeight - inset - footerHeight / 2 + 5;
        const fontSize = Math.max(9, Math.round(safeTileWidth * 0.042));
        atlasContext.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        const metaText = (item.meta || "").toUpperCase();
        const metaWidth = metaText ? atlasContext.measureText(metaText).width : 0;
        const titleSpace = imageWidth - metaWidth - fontSize;

        atlasContext.fillStyle = item.instagramId
          ? "rgba(242,201,76,0.92)"
          : "rgba(255,255,255,0.62)";
        atlasContext.fillText(
          fitText(atlasContext, (item.title || "").toUpperCase(), titleSpace),
          x + inset,
          labelY,
        );

        if (metaText) {
          atlasContext.textAlign = "right";
          atlasContext.fillStyle = "rgba(255,255,255,0.42)";
          atlasContext.fillText(metaText, x + safeTileWidth - inset, labelY);
          atlasContext.textAlign = "left";
        }
      }

      uploadAtlas();
    };

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => {
      reducedMotionRef.current = motionQuery.matches;
    };
    syncMotionPreference();
    motionQuery.addEventListener("change", syncMotionPreference);

    const safeInertia = clamp(inertia, 0, 0.98);

    const currentNudge = (time) => {
      const nudge = nudgeRef.current;
      if (!nudge) return { x: 0, y: 0, active: false };

      const elapsed = Math.max(0, time - nudge.startedAt);
      const progress = clamp(elapsed / 520, 0, 1);
      const settled = 1 - Math.pow(1 - progress, 3);
      const breathing = 1 + Math.sin(elapsed * 0.0042) * 0.07;
      const amount = settled * breathing;

      return { x: nudge.x * amount, y: nudge.y * amount, active: true };
    };

    const renderGrid = (time) => {
      const nudge = currentNudge(time);
      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, viewWidth, viewHeight);
      gl.uniform2f(atlasSizeLocation, atlasWorldWidth, atlasWorldHeight);
      gl.uniform2f(
        offsetLocation,
        positionRef.current.x + nudge.x,
        positionRef.current.y + nudge.y,
      );
      gl.uniform1f(curvatureLocation, clamp(lensStrength, 0, 2.5));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(textureLocation, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return nudge.active;
    };

    const tick = (time) => {
      const delta = Math.min(32, time - previousFrame);
      previousFrame = time;
      const drag = dragRef.current;
      const velocity = velocityRef.current;

      if (!drag.active && !reducedMotionRef.current) {
        positionRef.current.x += velocity.x * delta;
        positionRef.current.y += velocity.y * delta;
        const decay = Math.pow(safeInertia, delta / 16.667);
        velocity.x *= decay;
        velocity.y *= decay;
      } else if (!drag.active) {
        velocity.x = 0;
        velocity.y = 0;
      }

      const nudgeActive = renderGrid(time);
      const hasVelocity = Math.hypot(velocity.x, velocity.y) > 0.006;

      if (drag.active || hasVelocity || nudgeActive) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        velocity.x = 0;
        velocity.y = 0;
        animationFrame = 0;
      }
    };

    const requestRender = () => {
      if (animationFrame) return;
      previousFrame = performance.now();
      animationFrame = requestAnimationFrame(tick);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      viewWidth = Math.max(1, rect.width);
      viewHeight = Math.max(1, rect.height);
      canvas.width = Math.max(1, Math.round(viewWidth * dpr));
      canvas.height = Math.max(1, Math.round(viewHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      requestRender();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    resize();

    items.forEach((item, index) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        if (disposed) return;
        loadedImages[index] = image;
        drawAtlas();
        requestRender();
      };
      image.onerror = () => {
        if (disposed) return;
        drawAtlas();
        requestRender();
      };
      image.src = item.image;
    });
    drawAtlas();

    // Replays the shader's screen -> world mapping on the CPU so a click resolves to a tile.
    const itemAtPoint = (clientX, clientY) => {
      const rect = root.getBoundingClientRect();
      const uvX = (clientX - rect.left) / rect.width;
      const uvY = 1 - (clientY - rect.top) / rect.height;
      const centeredX = uvX * 2 - 1;
      const centeredY = uvY * 2 - 1;
      const aspect = viewWidth / Math.max(viewHeight, 1);
      const lensX = centeredX * aspect;
      const lensY = centeredY;
      const radius = (lensX * lensX + lensY * lensY) / (aspect * aspect + 1);
      const curve = clamp(lensStrength, 0, 2.5) * (0.34 * radius + 0.12 * radius * radius);
      const warpedX = lensX / (1 + curve);
      const warpedY = lensY / (1 + curve);
      const warpedUvX = (warpedX / aspect) * 0.5 + 0.5;
      const warpedUvY = warpedY * 0.5 + 0.5;
      const worldX = warpedUvX * viewWidth - positionRef.current.x;
      const worldY = (1 - warpedUvY) * viewHeight - positionRef.current.y;
      const atlasX = fract(worldX / atlasWorldWidth) * atlasWorldWidth;
      const atlasY = fract(worldY / atlasWorldHeight) * atlasWorldHeight;
      const column = Math.floor(atlasX / cellWidth);
      const row = Math.floor(atlasY / cellHeight);
      const localX = atlasX - column * cellWidth;
      const localY = atlasY - row * cellHeight;
      const imageHeight = safeTileHeight - inset * 2 - footerHeight;
      const insideArtwork =
        localX >= inset &&
        localX <= safeTileWidth - inset &&
        localY >= inset &&
        localY <= inset + imageHeight;
      if (!insideArtwork) return null;
      return items[(row * atlasColumns + column) % items.length] || null;
    };

    const commitNudge = (time) => {
      const nudge = currentNudge(time);
      if (!nudgeRef.current && !nudge.active) return;
      positionRef.current.x += nudge.x;
      positionRef.current.y += nudge.y;
      nudgeRef.current = null;
    };

    const onPointerEnter = (event) => {
      if (
        event.pointerType !== "mouse" ||
        event.buttons !== 0 ||
        reducedMotionRef.current ||
        dragRef.current.active ||
        hoverNudge <= 0
      ) {
        return;
      }

      const rect = root.getBoundingClientRect();
      const fromLeft = event.clientX < rect.left + rect.width / 2;
      const fromTop = event.clientY < rect.top + rect.height / 2;
      nudgeRef.current = {
        startedAt: performance.now(),
        x: (fromLeft ? 1 : -1) * hoverNudge,
        y: (fromTop ? 1 : -1) * hoverNudge * 0.42,
      };
      requestRender();
    };

    const onPointerLeave = () => {
      if (dragRef.current.active) return;
      commitNudge(performance.now());
    };

    const onPointerDown = (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      commitNudge(performance.now());
      dragRef.current = {
        active: true,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
        travel: 0,
      };
      velocityRef.current = { x: 0, y: 0 };
      root.dataset.dragging = "true";
      root.setPointerCapture(event.pointerId);
      requestRender();
    };

    const onPointerMove = (event) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      const time = performance.now();
      const deltaTime = Math.max(8, time - drag.time);
      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      drag.travel += Math.hypot(deltaX, deltaY);
      positionRef.current.x += deltaX;
      positionRef.current.y += deltaY;
      velocityRef.current.x = clamp(deltaX / deltaTime, -2.4, 2.4);
      velocityRef.current.y = clamp(deltaY / deltaTime, -2.4, 2.4);
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.time = time;
      requestRender();
    };

    const endDrag = (event) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      drag.active = false;
      root.dataset.dragging = "false";
      if (root.hasPointerCapture(event.pointerId)) {
        root.releasePointerCapture(event.pointerId);
      }
      if (drag.travel < 6) {
        const item = itemAtPoint(event.clientX, event.clientY);
        if (item && selectRef.current) selectRef.current(item);
      }
      requestRender();
    };

    const cancelDrag = () => {
      const drag = dragRef.current;
      if (!drag.active) return;
      drag.active = false;
      root.dataset.dragging = "false";
      if (root.hasPointerCapture(drag.pointerId)) {
        root.releasePointerCapture(drag.pointerId);
      }
      requestRender();
    };

    const onKeyDown = (event) => {
      const directions = {
        ArrowLeft: [42, 0],
        ArrowRight: [-42, 0],
        ArrowUp: [0, 42],
        ArrowDown: [0, -42],
      };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      commitNudge(performance.now());
      positionRef.current.x += direction[0];
      positionRef.current.y += direction[1];
      velocityRef.current = { x: 0, y: 0 };
      requestRender();
    };

    // Vertical wheel intentionally falls through to the page so the scroll-driven
    // hand-off into the theatre section still works while the cursor is over the grid.
    const onWheel = (event) => {
      if (dragRef.current.active) return;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      commitNudge(performance.now());

      const modeMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? Math.max(viewHeight, 1) : 1;
      const impulse = Math.max(0, wheelSensitivity) * 0.003;
      velocityRef.current.x = clamp(
        velocityRef.current.x - event.deltaX * modeMultiplier * impulse,
        -1.25,
        1.25,
      );
      requestRender();
    };

    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", cancelDrag);
    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("wheel", onWheel, { passive: false });
    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      motionQuery.removeEventListener("change", syncMotionPreference);
      root.removeEventListener("pointerenter", onPointerEnter);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", endDrag);
      root.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("blur", cancelDrag);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("wheel", onWheel);
      gl.deleteTexture(texture);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
    };
  }, [gap, hoverNudge, inertia, items, lensStrength, tileHeight, tileWidth, wheelSensitivity]);

  return (
    <div
      ref={rootRef}
      role="region"
      tabIndex={0}
      aria-label={ariaLabel}
      data-dragging="false"
      className={cn(
        "relative isolate h-full w-full cursor-grab touch-pan-y select-none overflow-hidden bg-[#0f110e] text-white outline-none",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60 data-[dragging=true]:cursor-grabbing",
        className,
      )}
      style={{ WebkitFontSmoothing: "antialiased" }}
    >
      <span className="sr-only">
        Drag in any direction or use the arrow keys to explore the gallery. Click a tile marked with
        a play badge to open the Instagram post.
      </span>

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />

      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_46%,rgba(0,0,0,0.42)_100%)]" />
    </div>
  );
}
