import { useEffect, useRef } from "react";

const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform vec3 u_color3;
  uniform float u_colorBalance;
  uniform float u_warpStrength;
  uniform float u_warpFrequency;
  uniform float u_warpSpeed;
  uniform float u_warpAmplitude;
  uniform float u_blendAngle;
  uniform float u_blendSoftness;
  uniform float u_rotationAmount;
  uniform float u_noiseScale;
  uniform float u_grainAmount;
  uniform float u_grainScale;
  uniform float u_grainSeed;
  uniform float u_contrast;
  uniform float u_gamma;
  uniform float u_saturation;
  uniform vec2 u_center;
  uniform float u_zoom;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float total = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      total += valueNoise(p) * amplitude;
      p *= 2.02;
      amplitude *= 0.5;
    }
    return total;
  }

  vec2 rotate(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  }

  void main() {
    vec2 res = u_resolution;
    vec2 uv = (gl_FragCoord.xy - 0.5 * res) / max(min(res.x, res.y), 1.0);
    uv = uv / max(u_zoom, 0.05) - u_center;
    uv = rotate(uv, radians(u_rotationAmount) * 0.1);

    // Domain warping: noise displaces the sampling point before the gradient is read.
    float warpTime = u_time * u_warpSpeed;
    vec2 warpUv = uv * u_warpFrequency;
    vec2 warp = vec2(
      fbm(warpUv + vec2(warpTime * 0.12, warpTime * 0.09)),
      fbm(warpUv + vec2(5.2 - warpTime * 0.1, 1.3 + warpTime * 0.07))
    );
    warp = (warp - 0.5) * (u_warpAmplitude * 0.01) * u_warpStrength;

    vec2 field = (uv + warp) * u_noiseScale;
    float texture = fbm(field + vec2(u_time * 0.05, u_time * -0.04));

    vec2 axis = vec2(cos(radians(u_blendAngle)), sin(radians(u_blendAngle)));
    float gradient = dot(uv + warp, axis) * 0.5 + 0.5;
    float mixer = clamp(gradient * 0.65 + texture * 0.55 + u_colorBalance, 0.0, 1.0);

    float soft = max(u_blendSoftness, 0.001);
    float firstStop = smoothstep(0.5 - soft, 0.5 + soft, mixer);
    float secondStop = smoothstep(0.78 - soft, 0.78 + soft, mixer);

    vec3 color = mix(u_color1, u_color2, firstStop);
    color = mix(color, u_color3, secondStop);

    // Grade: contrast around mid grey, then gamma, then saturation.
    color = (color - 0.5) * u_contrast + 0.5;
    color = pow(max(color, 0.0), vec3(1.0 / max(u_gamma, 0.05)));
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, u_saturation);

    float grain = hash(gl_FragCoord.xy * u_grainScale + u_grainSeed) - 0.5;
    color += grain * u_grainAmount;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function Grainient({
  color1 = "#0a2416",
  color2 = "#2f7d4f",
  color3 = "#d9b64a",
  timeSpeed = 0.25,
  colorBalance = 0.03,
  warpStrength = 1.85,
  warpFrequency = 5.9,
  warpSpeed = 3,
  warpAmplitude = 27,
  blendAngle = 16,
  blendSoftness = 0.05,
  rotationAmount = 300,
  noiseScale = 1.65,
  grainAmount = 0.1,
  grainScale = 1.3,
  grainAnimated = false,
  contrast = 2.2,
  gamma = 1.15,
  saturation = 1.2,
  centerX = 0,
  centerY = 0,
  zoom = 0.8,
  className,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false });
    if (!gl) return undefined;

    const program = gl.createProgram();
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return undefined;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name) => gl.getUniformLocation(program, name);
    const uResolution = uniform("u_resolution");
    const uTime = uniform("u_time");
    const uGrainSeed = uniform("u_grainSeed");

    gl.uniform3fv(uniform("u_color1"), hexToRgb(color1));
    gl.uniform3fv(uniform("u_color2"), hexToRgb(color2));
    gl.uniform3fv(uniform("u_color3"), hexToRgb(color3));
    gl.uniform1f(uniform("u_colorBalance"), colorBalance);
    gl.uniform1f(uniform("u_warpStrength"), warpStrength);
    gl.uniform1f(uniform("u_warpFrequency"), warpFrequency);
    gl.uniform1f(uniform("u_warpSpeed"), warpSpeed);
    gl.uniform1f(uniform("u_warpAmplitude"), warpAmplitude);
    gl.uniform1f(uniform("u_blendAngle"), blendAngle);
    gl.uniform1f(uniform("u_blendSoftness"), blendSoftness);
    gl.uniform1f(uniform("u_rotationAmount"), rotationAmount);
    gl.uniform1f(uniform("u_noiseScale"), noiseScale);
    gl.uniform1f(uniform("u_grainAmount"), grainAmount);
    gl.uniform1f(uniform("u_grainScale"), grainScale);
    gl.uniform1f(uniform("u_contrast"), contrast);
    gl.uniform1f(uniform("u_gamma"), gamma);
    gl.uniform1f(uniform("u_saturation"), saturation);
    gl.uniform2f(uniform("u_center"), centerX, centerY);
    gl.uniform1f(uniform("u_zoom"), zoom);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let running = true;
    const startedAt = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(uResolution, canvas.width, canvas.height);
    };

    const render = (now) => {
      resize();
      const elapsed = reduceMotion ? 0 : ((now - startedAt) / 1000) * timeSpeed;
      gl.uniform1f(uTime, elapsed);
      gl.uniform1f(uGrainSeed, grainAnimated && !reduceMotion ? elapsed * 60.0 : 0.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reduceMotion && running) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    // Stop burning GPU when the hero is scrolled away or the tab is hidden.
    const observer = new IntersectionObserver(([entry]) => {
      const shouldRun = entry.isIntersecting && !document.hidden;
      if (shouldRun && !running && !reduceMotion) {
        running = true;
        frame = requestAnimationFrame(render);
      } else if (!shouldRun) {
        running = false;
        cancelAnimationFrame(frame);
      }
    });
    observer.observe(canvas);

    const resizeObserver = new ResizeObserver(() => {
      if (reduceMotion) requestAnimationFrame(render);
    });
    resizeObserver.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [
    blendAngle,
    blendSoftness,
    centerX,
    centerY,
    color1,
    color2,
    color3,
    colorBalance,
    contrast,
    gamma,
    grainAmount,
    grainAnimated,
    grainScale,
    noiseScale,
    rotationAmount,
    saturation,
    timeSpeed,
    warpAmplitude,
    warpFrequency,
    warpSpeed,
    warpStrength,
    zoom,
  ]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
