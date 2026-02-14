(function (global) {
  'use strict';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clamp01(value) {
    return clamp(value, 0, 1);
  }

  function clamp11(value) {
    return clamp(value, -1, 1);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function safeNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function hexToRgb(hex, fallback) {
    const source = String(hex || '').trim();
    const clean = source.startsWith('#') ? source.slice(1) : source;
    const fallbackColor = fallback || [0.4, 0.8, 0.75];

    if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(clean)) {
      return fallbackColor;
    }

    const normalized = clean.length === 3
      ? clean.split('').map((char) => char + char).join('')
      : clean;

    const value = parseInt(normalized, 16);
    return [
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255
    ];
  }

  class Canvas2DRenderer {
    constructor(canvas) {
      this.type = 'canvas2d';
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      this._postCanvas = document.createElement('canvas');
      this._postCtx = this._postCanvas.getContext('2d', { alpha: false });
      this._bloomCanvas = document.createElement('canvas');
      this._bloomCtx = this._bloomCanvas.getContext('2d', { alpha: false });
      this._previousCanvas = document.createElement('canvas');
      this._previousCtx = this._previousCanvas.getContext('2d', { alpha: false });

      if (!this.ctx || !this._postCtx || !this._bloomCtx || !this._previousCtx) {
        throw new Error('Canvas2D renderer could not initialize contexts');
      }
    }

    resize(width, height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this._postCanvas.width = width;
      this._postCanvas.height = height;
      this._bloomCanvas.width = width;
      this._bloomCanvas.height = height;
      this._previousCanvas.width = width;
      this._previousCanvas.height = height;
    }

    _drawGradient(frame, gradient, timeValue) {
      if (!gradient.enabled) return;
      const width = frame.width;
      const height = frame.height;
      const ctx = this.ctx;

      const hueDegrees = ((gradient.hueBase || 0.5) * 360 + timeValue * 4) % 360;
      const spreadDegrees = (gradient.hueSpread || 0) * 220;
      const topHue = hueDegrees - spreadDegrees * 0.35;
      const bottomHue = hueDegrees + spreadDegrees * 0.65;
      const verticalBias = clamp01(gradient.verticalBias);

      const linear = ctx.createLinearGradient(0, 0, 0, height);
      linear.addColorStop(0, `hsl(${topHue.toFixed(2)}deg, 56%, ${lerp(18, 44, 1 - verticalBias).toFixed(2)}%)`);
      linear.addColorStop(1, `hsl(${bottomHue.toFixed(2)}deg, 64%, ${lerp(12, 30, verticalBias).toFixed(2)}%)`);

      ctx.globalAlpha = clamp01(gradient.opacity);
      ctx.fillStyle = linear;
      ctx.fillRect(0, 0, width, height);

      const radialCenterX = clamp01(gradient.radialCenterX) * width;
      const radialCenterY = clamp01(gradient.radialCenterY) * height;
      const radialStrength = clamp01(gradient.radialStrength);
      const radius = Math.max(width, height) * lerp(0.4, 1.2, radialStrength);
      const radial = ctx.createRadialGradient(radialCenterX, radialCenterY, 0, radialCenterX, radialCenterY, radius);
      radial.addColorStop(0, `hsla(${(hueDegrees + 20).toFixed(2)}deg, 72%, 72%, ${lerp(0.06, 0.28, radialStrength).toFixed(3)})`);
      radial.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }

    _drawAurora(frame, aurora, timeValue) {
      if (!aurora.enabled) return;

      const width = frame.width;
      const height = frame.height;
      const ctx = this.ctx;

      const ribbonCount = Math.max(1, Math.round(aurora.ribbonCount || 1));
      const ribbonWidth = clamp01(aurora.ribbonWidth);
      const turbulence = clamp01(aurora.turbulence);
      const driftSpeed = safeNumber(aurora.driftSpeed, 0.25);
      const tension = clamp01(aurora.ribbonTension);
      const alpha = clamp01(aurora.alpha) * clamp01(aurora.opacity);
      const colorA = hexToRgb(aurora.colorA, [0.28, 0.85, 0.8]);
      const colorB = hexToRgb(aurora.colorB, [0.64, 0.96, 0.78]);
      const hueShift = clamp11(aurora.hueShift);

      const centerY = height * 0.5;
      const verticalSpread = height * lerp(0.12, 0.38, ribbonWidth);
      const lineWidth = Math.max(1.2, width * lerp(0.0012, 0.0048, ribbonWidth));
      const sampleStep = Math.max(6, Math.floor(width / 160));

      for (let ribbonIndex = 0; ribbonIndex < ribbonCount; ribbonIndex += 1) {
        const lane = ribbonCount <= 1 ? 0.5 : ribbonIndex / (ribbonCount - 1);
        const laneMix = lerp(0, 1, lane);

        const color = [
          lerp(colorA[0], colorB[0], laneMix),
          lerp(colorA[1], colorB[1], laneMix),
          lerp(colorA[2], colorB[2], laneMix)
        ];

        const shiftedHueColor = [
          clamp01(color[0] + hueShift * 0.12),
          clamp01(color[1] + hueShift * 0.08),
          clamp01(color[2] - hueShift * 0.1)
        ];

        ctx.strokeStyle = `rgba(${Math.round(shiftedHueColor[0] * 255)}, ${Math.round(shiftedHueColor[1] * 255)}, ${Math.round(shiftedHueColor[2] * 255)}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = lineWidth;
        ctx.shadowBlur = lerp(8, 42, ribbonWidth);
        ctx.shadowColor = ctx.strokeStyle;

        ctx.beginPath();

        for (let x = 0; x <= width + sampleStep; x += sampleStep) {
          const xUnit = x / width;
          const drift = timeValue * driftSpeed * (0.6 + lane * 0.8);
          const waveA = Math.sin((xUnit * (4 + tension * 6) + drift + ribbonIndex * 0.8) * Math.PI * 2);
          const waveB = Math.sin((xUnit * (7.5 + tension * 4) - drift * 1.4 + ribbonIndex * 1.1) * Math.PI * 2);
          const turbulenceOffset = (waveA * 0.6 + waveB * 0.4) * verticalSpread * (0.2 + turbulence * 0.8);
          const laneOffset = (lane - 0.5) * verticalSpread * 1.8;
          const y = centerY + laneOffset + turbulenceOffset;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }

    _applyBloom(frame, bloom) {
      if (!bloom.enabled) return;

      const width = frame.width;
      const height = frame.height;
      const radiusPx = lerp(8, 42, clamp01(bloom.glowRadius));
      const strength = clamp01(bloom.bloomStrength);
      const threshold = clamp01(bloom.threshold);
      const softness = clamp01(bloom.glowSoftness);

      const bloomCtx = this._bloomCtx;
      bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
      bloomCtx.clearRect(0, 0, width, height);
      bloomCtx.drawImage(this.canvas, 0, 0);

      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.filter = `blur(${radiusPx.toFixed(2)}px) brightness(${(1 + strength * 0.8).toFixed(3)}) contrast(${(1 + softness * 0.55).toFixed(3)})`;
      this.ctx.globalAlpha = lerp(0.08, 0.65, strength) * lerp(0.5, 1, 1 - threshold);
      this.ctx.drawImage(this._bloomCanvas, 0, 0, width, height);
      this.ctx.restore();
      this.ctx.filter = 'none';
      this.ctx.globalAlpha = 1;
    }

    _finalGrade(frame, blend, timeMotion) {
      const width = frame.width;
      const height = frame.height;

      const masterBrightness = safeNumber(blend.masterBrightness, 1);
      const masterContrast = safeNumber(blend.masterContrast, 1);
      const motionBlur = clamp01(safeNumber(timeMotion.motionBlur, 0));

      this._postCtx.setTransform(1, 0, 0, 1, 0, 0);
      this._postCtx.clearRect(0, 0, width, height);
      this._postCtx.drawImage(this.canvas, 0, 0);

      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, width, height);

      if (motionBlur > 0.001) {
        this.ctx.globalAlpha = motionBlur * 0.42;
        this.ctx.drawImage(this._previousCanvas, 0, 0, width, height);
      }

      this.ctx.globalAlpha = 1;
      this.ctx.filter = `brightness(${masterBrightness.toFixed(3)}) contrast(${masterContrast.toFixed(3)})`;
      this.ctx.drawImage(this._postCanvas, 0, 0, width, height);
      this.ctx.filter = 'none';

      this._previousCtx.setTransform(1, 0, 0, 1, 0, 0);
      this._previousCtx.clearRect(0, 0, width, height);
      this._previousCtx.drawImage(this.canvas, 0, 0);
    }

    render(frame) {
      const ctx = this.ctx;
      const width = frame.width;
      const height = frame.height;
      const time = frame.time;
      const modules = frame.modules;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#041015';
      ctx.fillRect(0, 0, width, height);

      this._drawGradient(frame, modules.gradientSky, frame.moduleTimes.gradientSky || time);
      this._drawAurora(frame, modules.auroraRibbon, frame.moduleTimes.auroraRibbon || time);
      this._applyBloom(frame, modules.bloomGlow);
      this._finalGrade(frame, modules.blendStack, modules.timeMotion);
    }
  }

  class WebGL2Renderer {
    constructor(canvas) {
      this.type = 'webgl2';
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      });

      if (!this.gl) {
        throw new Error('WebGL2 not available');
      }

      this._program = this._createProgram();
      this._uniforms = this._collectUniforms();
      this._vao = this.gl.createVertexArray();
      this.gl.bindVertexArray(this._vao);
    }

    _compileShader(type, source) {
      const shader = this.gl.createShader(type);
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);
      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        const message = this.gl.getShaderInfoLog(shader) || 'Shader compilation failed';
        this.gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    }

    _createProgram() {
      const vertex = `#version 300 es
      precision highp float;
      const vec2 positions[3] = vec2[](
        vec2(-1.0, -1.0),
        vec2( 3.0, -1.0),
        vec2(-1.0,  3.0)
      );
      void main() {
        gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
      }
      `;

      const fragment = `#version 300 es
      precision highp float;

      out vec4 outColor;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_timeGradient;
      uniform float u_timeAurora;

      uniform float u_gradientEnabled;
      uniform float u_hueBase;
      uniform float u_hueSpread;
      uniform float u_verticalBias;
      uniform vec2 u_radialCenter;
      uniform float u_radialStrength;
      uniform float u_gradientOpacity;

      uniform float u_auroraEnabled;
      uniform float u_ribbonCount;
      uniform float u_ribbonWidth;
      uniform float u_turbulence;
      uniform float u_driftSpeed;
      uniform float u_tension;
      uniform vec3 u_colorA;
      uniform vec3 u_colorB;
      uniform float u_hueShift;
      uniform float u_ribbonAlpha;
      uniform float u_ribbonOpacity;

      uniform float u_bloomEnabled;
      uniform float u_bloomStrength;
      uniform float u_bloomThreshold;
      uniform float u_glowRadius;
      uniform float u_glowSoftness;

      uniform float u_masterBrightness;
      uniform float u_masterContrast;

      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        rgb = rgb * rgb * (3.0 - 2.0 * rgb);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / max(u_resolution.y, 1.0);

        float t = u_time;
        vec3 color = vec3(0.02, 0.08, 0.1);

        if (u_gradientEnabled > 0.5) {
          float vertical = mix(uv.y, 1.0 - uv.y, clamp(u_verticalBias, 0.0, 1.0));
          float dist = distance(uv, u_radialCenter);
          float radial = exp(-dist * mix(1.0, 7.5, clamp(u_radialStrength, 0.0, 1.0)));
          float hue = fract(u_hueBase + (vertical - 0.5) * u_hueSpread + radial * 0.08 + u_timeGradient * 0.003);
          vec3 gradient = hsv2rgb(vec3(hue, 0.45 + radial * 0.25, 0.14 + vertical * 0.6 + radial * 0.2));
          color = mix(color, gradient, clamp(u_gradientOpacity, 0.0, 1.0));
        }

        if (u_auroraEnabled > 0.5) {
          vec3 ribbon = vec3(0.0);
          float ribbonCount = max(1.0, u_ribbonCount);
          for (int i = 0; i < 8; i++) {
            float fi = float(i);
            if (fi >= ribbonCount) {
              break;
            }
            float lane = ribbonCount <= 1.0 ? 0.5 : fi / (ribbonCount - 1.0);
            float drift = u_timeAurora * u_driftSpeed * (0.55 + lane * 0.85);
            float warp = fbm(vec2(p.x * (2.0 + u_tension * 4.0) + fi * 1.2, drift * 0.2 + p.y * 0.6)) * u_turbulence;
            float wave = sin((p.x + warp + lane * 1.2) * (2.5 + u_tension * 5.0) + drift + fi * 0.9);
            float laneOffset = (lane - 0.5) * (0.7 + u_ribbonWidth * 1.1);
            float distanceToRibbon = abs(p.y - (wave * (0.08 + u_ribbonWidth * 0.22) + laneOffset));
            float mask = exp(-distanceToRibbon * (10.0 + (1.0 - u_ribbonWidth) * 20.0));

            vec3 palette = mix(u_colorA, u_colorB, lane + 0.1 * sin(t * 0.3 + fi));
            palette = clamp(palette + vec3(u_hueShift * 0.12, u_hueShift * 0.08, -u_hueShift * 0.1), 0.0, 1.0);
            ribbon += palette * mask;
          }

          ribbon *= u_ribbonAlpha * u_ribbonOpacity;
          color += ribbon;
        }

        if (u_bloomEnabled > 0.5) {
          float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
          float bloomMask = smoothstep(u_bloomThreshold, 1.0, lum);
          float bloom = bloomMask * u_bloomStrength;
          vec3 bloomTint = mix(vec3(0.62, 0.95, 0.9), color, 0.45 + u_glowSoftness * 0.25);
          color += bloomTint * bloom * (0.35 + u_glowRadius * 0.45);
        }

        color = (color - 0.5) * u_masterContrast + 0.5;
        color *= u_masterBrightness;
        color = clamp(color, 0.0, 1.0);

        outColor = vec4(color, 1.0);
      }
      `;

      const program = this.gl.createProgram();
      const vertShader = this._compileShader(this.gl.VERTEX_SHADER, vertex);
      const fragShader = this._compileShader(this.gl.FRAGMENT_SHADER, fragment);

      this.gl.attachShader(program, vertShader);
      this.gl.attachShader(program, fragShader);
      this.gl.linkProgram(program);

      this.gl.deleteShader(vertShader);
      this.gl.deleteShader(fragShader);

      if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        const message = this.gl.getProgramInfoLog(program) || 'Program link failed';
        this.gl.deleteProgram(program);
        throw new Error(message);
      }

      return program;
    }

    _collectUniforms() {
      const uniformNames = [
        'u_resolution',
        'u_time',
        'u_timeGradient',
        'u_timeAurora',
        'u_gradientEnabled',
        'u_hueBase',
        'u_hueSpread',
        'u_verticalBias',
        'u_radialCenter',
        'u_radialStrength',
        'u_gradientOpacity',
        'u_auroraEnabled',
        'u_ribbonCount',
        'u_ribbonWidth',
        'u_turbulence',
        'u_driftSpeed',
        'u_tension',
        'u_colorA',
        'u_colorB',
        'u_hueShift',
        'u_ribbonAlpha',
        'u_ribbonOpacity',
        'u_bloomEnabled',
        'u_bloomStrength',
        'u_bloomThreshold',
        'u_glowRadius',
        'u_glowSoftness',
        'u_masterBrightness',
        'u_masterContrast'
      ];

      const uniforms = {};
      uniformNames.forEach((name) => {
        uniforms[name] = this.gl.getUniformLocation(this._program, name);
      });
      return uniforms;
    }

    resize(width, height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }

    render(frame) {
      const gl = this.gl;
      const modules = frame.modules;

      gl.useProgram(this._program);
      gl.bindVertexArray(this._vao);
      gl.viewport(0, 0, frame.width, frame.height);

      gl.uniform2f(this._uniforms.u_resolution, frame.width, frame.height);
      gl.uniform1f(this._uniforms.u_time, frame.time);
      gl.uniform1f(this._uniforms.u_timeGradient, frame.moduleTimes.gradientSky || frame.time);
      gl.uniform1f(this._uniforms.u_timeAurora, frame.moduleTimes.auroraRibbon || frame.time);

      gl.uniform1f(this._uniforms.u_gradientEnabled, modules.gradientSky.enabled ? 1 : 0);
      gl.uniform1f(this._uniforms.u_hueBase, modules.gradientSky.hueBase);
      gl.uniform1f(this._uniforms.u_hueSpread, modules.gradientSky.hueSpread);
      gl.uniform1f(this._uniforms.u_verticalBias, modules.gradientSky.verticalBias);
      gl.uniform2f(this._uniforms.u_radialCenter, modules.gradientSky.radialCenterX, modules.gradientSky.radialCenterY);
      gl.uniform1f(this._uniforms.u_radialStrength, modules.gradientSky.radialStrength);
      gl.uniform1f(this._uniforms.u_gradientOpacity, modules.gradientSky.opacity);

      gl.uniform1f(this._uniforms.u_auroraEnabled, modules.auroraRibbon.enabled ? 1 : 0);
      gl.uniform1f(this._uniforms.u_ribbonCount, modules.auroraRibbon.ribbonCount);
      gl.uniform1f(this._uniforms.u_ribbonWidth, modules.auroraRibbon.ribbonWidth);
      gl.uniform1f(this._uniforms.u_turbulence, modules.auroraRibbon.turbulence);
      gl.uniform1f(this._uniforms.u_driftSpeed, modules.auroraRibbon.driftSpeed);
      gl.uniform1f(this._uniforms.u_tension, modules.auroraRibbon.ribbonTension);
      gl.uniform3fv(this._uniforms.u_colorA, modules.auroraRibbon.colorA);
      gl.uniform3fv(this._uniforms.u_colorB, modules.auroraRibbon.colorB);
      gl.uniform1f(this._uniforms.u_hueShift, modules.auroraRibbon.hueShift);
      gl.uniform1f(this._uniforms.u_ribbonAlpha, modules.auroraRibbon.alpha);
      gl.uniform1f(this._uniforms.u_ribbonOpacity, modules.auroraRibbon.opacity);

      gl.uniform1f(this._uniforms.u_bloomEnabled, modules.bloomGlow.enabled ? 1 : 0);
      gl.uniform1f(this._uniforms.u_bloomStrength, modules.bloomGlow.bloomStrength);
      gl.uniform1f(this._uniforms.u_bloomThreshold, modules.bloomGlow.threshold);
      gl.uniform1f(this._uniforms.u_glowRadius, modules.bloomGlow.glowRadius);
      gl.uniform1f(this._uniforms.u_glowSoftness, modules.bloomGlow.glowSoftness);

      gl.uniform1f(this._uniforms.u_masterBrightness, modules.blendStack.masterBrightness);
      gl.uniform1f(this._uniforms.u_masterContrast, modules.blendStack.masterContrast);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  class VisualSynthEngine {
    constructor(options) {
      const config = options || {};

      if (!config.canvas) {
        throw new Error('VisualSynthEngine requires a canvas element');
      }

      this.canvas = config.canvas;
      this.targetRegistry = config.targetRegistry;
      this.modMatrix = config.modMatrix;
      this.sequencer = config.sequencer;
      this.onStats = typeof config.onStats === 'function' ? config.onStats : null;
      this.state = config.state || null;

      this._qualityOrder = ['high', 'medium', 'low'];
      this._qualityScale = {
        low: 0.5,
        medium: 0.75,
        high: 1
      };

      this.quality = this.state && this.state.quality ? this.state.quality : 'high';
      this.renderer = null;
      this.rendererType = 'none';

      this.running = false;
      this._rafId = null;
      this._lastFrameSec = null;
      this._startedAtSec = null;

      this._fpsFrames = 0;
      this._fpsElapsed = 0;
      this._fps = 60;
      this._lowFpsDuration = 0;
      this._lastStatEmit = 0;

      this._lfoHold = 0;
      this._lfoHoldIndex = -1;

      this._handleResize = this.resize.bind(this);
      window.addEventListener('resize', this._handleResize, { passive: true });

      this._initRenderer();
      this.resize();
    }

    _initRenderer() {
      const fallback = () => {
        this.renderer = new Canvas2DRenderer(this.canvas);
        this.rendererType = this.renderer.type;
      };

      try {
        this.renderer = new WebGL2Renderer(this.canvas);
        this.rendererType = this.renderer.type;
      } catch (error) {
        fallback();
      }
    }

    destroy() {
      this.stop();
      window.removeEventListener('resize', this._handleResize);
    }

    setState(state) {
      this.state = state;
      if (state && state.quality) {
        this.quality = state.quality;
        this.resize();
      }
    }

    setQuality(quality) {
      if (!this._qualityScale[quality]) return;
      this.quality = quality;
      if (this.state) this.state.quality = quality;
      this.resize();
    }

    _degradeQuality() {
      const index = this._qualityOrder.indexOf(this.quality);
      if (index === -1 || index >= this._qualityOrder.length - 1) return;
      this.setQuality(this._qualityOrder[index + 1]);
      this._lowFpsDuration = 0;
    }

    resize() {
      const scale = this._qualityScale[this.quality] || 1;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, Math.floor(window.innerWidth * dpr * scale));
      const height = Math.max(240, Math.floor(window.innerHeight * dpr * scale));

      this.canvas.style.width = '100vw';
      this.canvas.style.height = '100vh';
      this.renderer.resize(width, height);
    }

    start() {
      if (this.running) return;
      this.running = true;
      this._lastFrameSec = null;
      this._startedAtSec = null;
      this._rafId = requestAnimationFrame(this._frame.bind(this));
    }

    stop() {
      this.running = false;
      if (this._rafId != null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    }

    _activeNodeCount() {
      if (!this.state || !this.state.modules) return 0;

      let count = 0;
      Object.keys(this.state.modules).forEach((moduleId) => {
        if (this.state.modules[moduleId] && this.state.modules[moduleId].enabled) {
          count += 1;
        }
      });

      if (this.state.modulators && this.state.modulators.lfo1 && this.state.modulators.lfo1.enabled) {
        count += 1;
      }

      if (this.modMatrix && typeof this.modMatrix.listAssignments === 'function') {
        count += this.modMatrix.listAssignments().filter((assignment) => assignment.enabled).length;
      }

      return count;
    }

    _resolveModuleTimes(currentTimeSec) {
      const output = {};
      if (!this.state || !this.state.modules) return output;

      Object.keys(this.state.modules).forEach((moduleId) => {
        const module = this.state.modules[moduleId];
        if (!module) return;

        if (module.frozen) {
          if (!Number.isFinite(module.freezeTime)) {
            module.freezeTime = currentTimeSec;
          }
          output[moduleId] = module.freezeTime;
          return;
        }

        module.freezeTime = null;
        output[moduleId] = currentTimeSec;
      });

      return output;
    }

    _computeLfoSignal(timeSec) {
      const lfo = this.state && this.state.modulators ? this.state.modulators.lfo1 : null;
      if (!lfo || !lfo.enabled) {
        return 0;
      }

      const rate = Math.max(0.0001, safeNumber(lfo.rate, 0.1));
      const phaseOffset = safeNumber(lfo.phase, 0);
      const depth = clamp01(safeNumber(lfo.depth, 0));
      const offset = clamp11(safeNumber(lfo.offset, 0));

      const phase = (timeSec * rate + phaseOffset) % 1;
      let signal;

      switch (lfo.shape) {
        case 'triangle':
          signal = 1 - 4 * Math.abs(phase - 0.5);
          break;
        case 'square':
          signal = phase < 0.5 ? 1 : -1;
          break;
        case 'random': {
          const holdIndex = Math.floor(timeSec * rate);
          if (holdIndex !== this._lfoHoldIndex) {
            this._lfoHoldIndex = holdIndex;
            this._lfoHold = Math.random() * 2 - 1;
          }
          signal = this._lfoHold;
          break;
        }
        case 'sine':
        default:
          signal = Math.sin(phase * Math.PI * 2);
          break;
      }

      return clamp11(signal * depth + offset);
    }

    _readResolvedTargets(nowSec, deltaSec, sequencerSignals) {
      const sourceSignals = {};
      const seqSignals = sequencerSignals || {};
      Object.keys(seqSignals).forEach((key) => {
        sourceSignals[key] = seqSignals[key];
      });

      sourceSignals.lfo1 = this._computeLfoSignal(nowSec);

      return this.modMatrix.resolve(this.targetRegistry, sourceSignals, deltaSec);
    }

    _collectRenderModules(moduleTimes, resolvedTargets) {
      const read = (targetId, fallback) => {
        if (resolvedTargets && Number.isFinite(resolvedTargets[targetId])) {
          return resolvedTargets[targetId];
        }
        if (this.targetRegistry && this.targetRegistry.has(targetId)) {
          const value = this.targetRegistry.getBaseValue(targetId);
          if (Number.isFinite(value)) return value;
        }
        return fallback;
      };

      const modulesState = this.state && this.state.modules ? this.state.modules : {};
      const gradientModule = modulesState.gradientSky || { enabled: false, params: {} };
      const auroraModule = modulesState.auroraRibbon || { enabled: false, params: {} };
      const bloomModule = modulesState.bloomGlow || { enabled: false, params: {} };
      const blendModule = modulesState.blendStack || { enabled: true, params: {} };
      const motionModule = modulesState.timeMotion || { enabled: true, params: {} };

      const gradientEnabled = gradientModule.enabled === true;
      const auroraEnabled = auroraModule.enabled === true;
      const bloomEnabled = bloomModule.enabled === true;

      return {
        gradientSky: {
          enabled: gradientEnabled,
          hueBase: read('gradientSky.hueBase', 0.5),
          hueSpread: read('gradientSky.hueSpread', 0.2),
          verticalBias: read('gradientSky.verticalBias', 0.5),
          radialCenterX: read('gradientSky.radialCenterX', 0.5),
          radialCenterY: read('gradientSky.radialCenterY', 0.35),
          radialStrength: read('gradientSky.radialStrength', 0.45),
          opacity: read('gradientSky.opacity', 1)
        },
        auroraRibbon: {
          enabled: auroraEnabled,
          ribbonCount: read('auroraRibbon.ribbonCount', 4),
          ribbonWidth: read('auroraRibbon.ribbonWidth', 0.32),
          turbulence: read('auroraRibbon.turbulence', 0.3),
          driftSpeed: read('auroraRibbon.driftSpeed', 0.3),
          ribbonTension: read('auroraRibbon.ribbonTension', 0.45),
          colorA: hexToRgb(auroraModule.params.colorA, [0.28, 0.84, 0.8]),
          colorB: hexToRgb(auroraModule.params.colorB, [0.62, 0.95, 0.78]),
          hueShift: read('auroraRibbon.hueShift', 0),
          alpha: read('auroraRibbon.alpha', 0.68),
          opacity: read('blendStack.ribbonOpacity', 1)
        },
        bloomGlow: {
          enabled: bloomEnabled,
          bloomStrength: read('bloomGlow.bloomStrength', 0.4),
          threshold: read('bloomGlow.threshold', 0.45),
          glowRadius: read('bloomGlow.glowRadius', 0.5),
          glowSoftness: read('bloomGlow.glowSoftness', 0.55)
        },
        blendStack: {
          enabled: blendModule.enabled === true,
          masterBrightness: read('blendStack.masterBrightness', 1),
          masterContrast: read('blendStack.masterContrast', 1),
          gradientOpacity: read('blendStack.gradientOpacity', 1),
          ribbonOpacity: read('blendStack.ribbonOpacity', 1)
        },
        timeMotion: {
          enabled: motionModule.enabled === true,
          globalSpeed: read('timeMotion.globalSpeed', 1),
          timeWarp: read('timeMotion.timeWarp', 0),
          motionBlur: read('timeMotion.motionBlur', 0)
        }
      };
    }

    _frame(timestampMs) {
      if (!this.running || !this.state) {
        return;
      }

      const nowSec = timestampMs / 1000;
      if (!Number.isFinite(this._startedAtSec)) {
        this._startedAtSec = nowSec;
      }
      if (!Number.isFinite(this._lastFrameSec)) {
        this._lastFrameSec = nowSec;
      }

      const deltaSec = Math.max(0, Math.min(0.25, nowSec - this._lastFrameSec));
      this._lastFrameSec = nowSec;

      this._fpsFrames += 1;
      this._fpsElapsed += deltaSec;

      if (this._fpsElapsed >= 0.5) {
        this._fps = this._fpsFrames / this._fpsElapsed;
        this._fpsFrames = 0;
        this._fpsElapsed = 0;

        if (this.state.ui && this.state.ui.autoQuality !== false && this._fps < 50) {
          this._lowFpsDuration += 0.5;
        } else {
          this._lowFpsDuration = 0;
        }

        if (this._lowFpsDuration >= 3) {
          this._degradeQuality();
        }
      }

      const sequencerSignals = this.sequencer ? this.sequencer.update(nowSec) : {};
      const resolvedTargets = this._readResolvedTargets(nowSec, deltaSec, sequencerSignals);
      const moduleTimes = this._resolveModuleTimes(nowSec - this._startedAtSec);
      const modules = this._collectRenderModules(moduleTimes, resolvedTargets);

      const speed = modules.timeMotion.enabled ? modules.timeMotion.globalSpeed : 1;
      const timeWarp = modules.timeMotion.enabled ? modules.timeMotion.timeWarp : 0;
      const renderTime = (nowSec - this._startedAtSec) * speed + timeWarp;

      this.renderer.render({
        width: this.canvas.width,
        height: this.canvas.height,
        time: renderTime,
        modules,
        moduleTimes,
        resolvedTargets
      });

      if (this.onStats && nowSec - this._lastStatEmit > 0.2) {
        this._lastStatEmit = nowSec;
        this.onStats({
          fps: this._fps,
          activeNodes: this._activeNodeCount(),
          renderer: this.rendererType,
          quality: this.quality,
          currentStep: this.sequencer ? this.sequencer.currentStep : 0
        });
      }

      this._rafId = requestAnimationFrame(this._frame.bind(this));
    }
  }

  global.VisualSynthEngine = VisualSynthEngine;
})(window);
