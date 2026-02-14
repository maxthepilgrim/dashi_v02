(function (global) {
  'use strict';

  if (!global.TargetRegistry || !global.ModMatrix || !global.StepSequencer || !global.VisualSynthEngine || !global.PresetStore) {
    global.VisualSynthApp = {
      init: function () {
        return false;
      },
      activate: function () {},
      deactivate: function () {},
      open: function () {},
      close: function () {},
      toggle: function () {}
    };
    return;
  }

  const SYNTH_STATE_VERSION = 1;

  const MODULE_UI = {
    gradientSky: {
      title: 'Gradient Sky',
      icon: 'G',
      params: [
        { targetId: 'gradientSky.hueBase', label: 'Hue Base', unit: '' },
        { targetId: 'gradientSky.hueSpread', label: 'Hue Spread', unit: '' },
        { targetId: 'gradientSky.verticalBias', label: 'Vertical Bias', unit: '' },
        { targetId: 'gradientSky.radialCenterX', label: 'Radial X', unit: '' },
        { targetId: 'gradientSky.radialCenterY', label: 'Radial Y', unit: '' },
        { targetId: 'gradientSky.radialStrength', label: 'Radial Strength', unit: '' }
      ],
      extraParams: [
        { targetId: 'gradientSky.opacity', label: 'Opacity', unit: '' }
      ]
    },
    auroraRibbon: {
      title: 'Aurora Ribbon',
      icon: 'A',
      params: [
        { targetId: 'auroraRibbon.ribbonCount', label: 'Ribbon Count', unit: '' },
        { targetId: 'auroraRibbon.ribbonWidth', label: 'Ribbon Width', unit: '' },
        { targetId: 'auroraRibbon.turbulence', label: 'Turbulence', unit: '' },
        { targetId: 'auroraRibbon.driftSpeed', label: 'Drift Speed', unit: '' },
        { targetId: 'auroraRibbon.ribbonTension', label: 'Ribbon Tension', unit: '' },
        { targetId: 'auroraRibbon.hueShift', label: 'Hue Shift', unit: '' },
        { targetId: 'auroraRibbon.alpha', label: 'Alpha', unit: '' }
      ],
      colorParams: [
        { key: 'colorA', label: 'Color A' },
        { key: 'colorB', label: 'Color B' }
      ]
    },
    bloomGlow: {
      title: 'Bloom + Glow',
      icon: 'B',
      params: [
        { targetId: 'bloomGlow.bloomStrength', label: 'Bloom', unit: '' },
        { targetId: 'bloomGlow.threshold', label: 'Threshold', unit: '' },
        { targetId: 'bloomGlow.glowRadius', label: 'Glow Radius', unit: '' },
        { targetId: 'bloomGlow.glowSoftness', label: 'Glow Softness', unit: '' }
      ]
    },
    blendStack: {
      title: 'Blend Stack',
      icon: 'M',
      params: [
        { targetId: 'blendStack.masterBrightness', label: 'Master Bright', unit: '' },
        { targetId: 'blendStack.masterContrast', label: 'Master Contrast', unit: '' },
        { targetId: 'blendStack.gradientOpacity', label: 'Gradient Opacity', unit: '' },
        { targetId: 'blendStack.ribbonOpacity', label: 'Ribbon Opacity', unit: '' }
      ]
    },
    timeMotion: {
      title: 'Time + Motion',
      icon: 'T',
      params: [
        { targetId: 'timeMotion.globalSpeed', label: 'Global Speed', unit: '' },
        { targetId: 'timeMotion.timeWarp', label: 'Time Warp', unit: '' },
        { targetId: 'timeMotion.motionBlur', label: 'Motion Blur', unit: '' }
      ]
    }
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clamp01(value) {
    return clamp(value, 0, 1);
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeDeep(base, patch) {
    if (!patch || typeof patch !== 'object') {
      return base;
    }

    Object.keys(patch).forEach((key) => {
      const patchValue = patch[key];
      if (Array.isArray(patchValue)) {
        base[key] = deepClone(patchValue);
      } else if (patchValue && typeof patchValue === 'object') {
        if (!base[key] || typeof base[key] !== 'object' || Array.isArray(base[key])) {
          base[key] = {};
        }
        mergeDeep(base[key], patchValue);
      } else {
        base[key] = patchValue;
      }
    });

    return base;
  }

  function normalizeName(value, fallback) {
    const text = String(value || '').trim();
    return text || fallback;
  }

  function prettyValue(value, unit) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '-';
    }
    if (Math.abs(numeric) >= 100 || Math.abs(numeric) < 0.01) {
      return `${numeric.toFixed(2)}${unit || ''}`;
    }
    if (Math.abs(numeric) >= 10) {
      return `${numeric.toFixed(1)}${unit || ''}`;
    }
    return `${numeric.toFixed(2)}${unit || ''}`;
  }

  function shouldIgnoreShortcut(event) {
    const tagName = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : '';
    if (event.target && event.target.isContentEditable) {
      return true;
    }
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  }

  function applyLegacyVisualMap(state, legacyVisual) {
    if (!legacyVisual || typeof legacyVisual !== 'object') {
      return state;
    }

    const next = deepClone(state);

    const hue = Number.isFinite(legacyVisual.hue) ? legacyVisual.hue : 0;
    const brightness = Number.isFinite(legacyVisual.brightness) ? legacyVisual.brightness : 80;
    const saturation = Number.isFinite(legacyVisual.saturation) ? legacyVisual.saturation : 100;
    const speed = Number.isFinite(legacyVisual.speed) ? legacyVisual.speed : 25;
    const temperature = Number.isFinite(legacyVisual.temperature) ? legacyVisual.temperature : 0;
    const contrast = Number.isFinite(legacyVisual.contrast) ? legacyVisual.contrast : 40;
    const calmness = Number.isFinite(legacyVisual.calmness) ? legacyVisual.calmness : 35;

    next.modules.gradientSky.params.hueBase = clamp01(0.54 + temperature / 550);
    next.modules.gradientSky.params.hueSpread = clamp01(0.1 + saturation / 280);
    next.modules.gradientSky.params.verticalBias = clamp01(0.48 + calmness / 300);
    next.modules.gradientSky.params.radialStrength = clamp01(0.2 + contrast / 110);

    next.modules.auroraRibbon.params.driftSpeed = clamp(0.08 + speed / 80, 0.05, 1.5);
    next.modules.auroraRibbon.params.ribbonWidth = clamp01(0.2 + saturation / 380);
    next.modules.auroraRibbon.params.turbulence = clamp01(0.18 + (100 - calmness) / 180);
    next.modules.auroraRibbon.params.hueShift = clamp(hue / 90, -1, 1);
    next.modules.auroraRibbon.params.alpha = clamp01(0.5 + contrast / 180);

    next.modules.bloomGlow.params.bloomStrength = clamp01(0.16 + contrast / 120);
    next.modules.bloomGlow.params.threshold = clamp01(0.72 - contrast / 180);
    next.modules.bloomGlow.params.glowRadius = clamp01(0.2 + contrast / 140);

    next.modules.blendStack.params.masterBrightness = clamp(brightness / 100, 0.45, 1.8);
    next.modules.blendStack.params.masterContrast = clamp(0.82 + contrast / 120, 0.5, 1.8);

    next.modules.timeMotion.params.globalSpeed = clamp((speed / 25) * (1.15 - calmness / 150), 0.2, 2.5);
    next.modules.timeMotion.params.timeWarp = clamp((temperature + hue) / 260, -1, 1);

    return next;
  }

  function createDefaultState() {
    return {
      version: SYNTH_STATE_VERSION,
      quality: 'high',
      modules: {
        gradientSky: {
          enabled: true,
          frozen: false,
          freezeTime: null,
          params: {
            hueBase: 0.53,
            hueSpread: 0.16,
            verticalBias: 0.56,
            radialCenterX: 0.5,
            radialCenterY: 0.38,
            radialStrength: 0.44,
            opacity: 0.97
          }
        },
        auroraRibbon: {
          enabled: true,
          frozen: false,
          freezeTime: null,
          params: {
            ribbonCount: 4,
            ribbonWidth: 0.32,
            turbulence: 0.32,
            driftSpeed: 0.26,
            ribbonTension: 0.46,
            colorA: '#4fd2ca',
            colorB: '#8ef0cc',
            hueShift: 0,
            alpha: 0.7
          }
        },
        bloomGlow: {
          enabled: true,
          frozen: false,
          freezeTime: null,
          params: {
            bloomStrength: 0.4,
            threshold: 0.45,
            glowRadius: 0.48,
            glowSoftness: 0.56
          }
        },
        blendStack: {
          enabled: true,
          frozen: false,
          freezeTime: null,
          params: {
            masterBrightness: 1,
            masterContrast: 1.08,
            gradientOpacity: 1,
            ribbonOpacity: 0.9
          }
        },
        timeMotion: {
          enabled: true,
          frozen: false,
          freezeTime: null,
          params: {
            globalSpeed: 1,
            timeWarp: 0,
            motionBlur: 0
          }
        }
      },
      modulators: {
        lfo1: {
          enabled: true,
          shape: 'sine',
          rate: 0.12,
          depth: 0.34,
          phase: 0,
          offset: 0
        }
      },
      modMatrix: [
        {
          id: 'mod-lfo-base',
          sourceId: 'lfo1',
          targetId: 'auroraRibbon.hueShift',
          amount: 0.18,
          polarity: 'bipolar',
          smoothing: 0.15,
          quantizeSteps: 0,
          enabled: true
        }
      ],
      sequencer: {
        bpm: 112,
        swing: 12,
        stepLength: 16,
        playing: true,
        currentStep: 0,
        lanes: [
          {
            id: 'seq-lane-1',
            label: 'Lane 1',
            targetId: 'auroraRibbon.driftSpeed',
            amount: 0.38,
            smoothing: 0.22,
            mute: false,
            solo: false,
            steps: [
              { value: 0.9, probability: 1, enabled: true },
              { value: 0.1, probability: 1, enabled: false },
              { value: 0.45, probability: 1, enabled: true },
              { value: 0.15, probability: 1, enabled: false },
              { value: 0.82, probability: 1, enabled: true },
              { value: 0.05, probability: 1, enabled: false },
              { value: 0.52, probability: 1, enabled: true },
              { value: 0.1, probability: 1, enabled: false },
              { value: 0.88, probability: 1, enabled: true },
              { value: 0.08, probability: 1, enabled: false },
              { value: 0.42, probability: 1, enabled: true },
              { value: 0.15, probability: 1, enabled: false },
              { value: 0.76, probability: 1, enabled: true },
              { value: 0.22, probability: 1, enabled: false },
              { value: 0.56, probability: 1, enabled: true },
              { value: 0.18, probability: 1, enabled: false }
            ]
          },
          {
            id: 'seq-lane-2',
            label: 'Lane 2',
            targetId: 'bloomGlow.bloomStrength',
            amount: 0.24,
            smoothing: 0.26,
            mute: false,
            solo: false,
            steps: [
              { value: 0.22, probability: 1, enabled: true },
              { value: 0.46, probability: 1, enabled: true },
              { value: 0.18, probability: 1, enabled: true },
              { value: 0.55, probability: 1, enabled: true },
              { value: 0.2, probability: 1, enabled: true },
              { value: 0.62, probability: 0.8, enabled: true },
              { value: 0.15, probability: 1, enabled: true },
              { value: 0.52, probability: 1, enabled: true },
              { value: 0.24, probability: 1, enabled: true },
              { value: 0.58, probability: 1, enabled: true },
              { value: 0.2, probability: 1, enabled: true },
              { value: 0.64, probability: 0.75, enabled: true },
              { value: 0.16, probability: 1, enabled: true },
              { value: 0.5, probability: 1, enabled: true },
              { value: 0.22, probability: 1, enabled: true },
              { value: 0.56, probability: 1, enabled: true }
            ]
          },
          {
            id: 'seq-lane-3',
            label: 'Lane 3',
            targetId: 'gradientSky.radialStrength',
            amount: 0.27,
            smoothing: 0.32,
            mute: false,
            solo: false,
            steps: [
              { value: 0.35, probability: 1, enabled: true },
              { value: 0.15, probability: 1, enabled: true },
              { value: 0.68, probability: 1, enabled: true },
              { value: 0.25, probability: 1, enabled: true },
              { value: 0.4, probability: 1, enabled: true },
              { value: 0.12, probability: 1, enabled: true },
              { value: 0.72, probability: 0.9, enabled: true },
              { value: 0.28, probability: 1, enabled: true },
              { value: 0.44, probability: 1, enabled: true },
              { value: 0.18, probability: 1, enabled: true },
              { value: 0.74, probability: 0.88, enabled: true },
              { value: 0.22, probability: 1, enabled: true },
              { value: 0.38, probability: 1, enabled: true },
              { value: 0.14, probability: 1, enabled: true },
              { value: 0.66, probability: 0.92, enabled: true },
              { value: 0.24, probability: 1, enabled: true }
            ]
          }
        ]
      },
      macros: [
        { id: 'macro-1', label: 'Atmos', value: 0.5 },
        { id: 'macro-2', label: 'Drift', value: 0.5 },
        { id: 'macro-3', label: 'Glow', value: 0.5 },
        { id: 'macro-4', label: 'Depth', value: 0.5 },
        { id: 'macro-5', label: 'Spread', value: 0.5 },
        { id: 'macro-6', label: 'Pulse', value: 0.5 },
        { id: 'macro-7', label: 'Shift', value: 0.5 },
        { id: 'macro-8', label: 'Flow', value: 0.5 }
      ],
      presetsMeta: {
        selectedPresetId: ''
      },
      ui: {
        moduleOrder: ['gradientSky', 'auroraRibbon', 'blendStack', 'bloomGlow', 'timeMotion'],
        collapsedModules: {},
        activeTab: 'modules',
        autoQuality: true,
        includeSequencerInPreset: true,
        showPresetCard: false
      }
    };
  }

  const TARGET_DEFINITIONS = [
    { id: 'gradientSky.hueBase', label: 'Hue Base', moduleId: 'gradientSky', min: 0, max: 1, defaultValue: 0.53, curve: 'linear' },
    { id: 'gradientSky.hueSpread', label: 'Hue Spread', moduleId: 'gradientSky', min: 0, max: 1, defaultValue: 0.16, curve: 'linear' },
    { id: 'gradientSky.verticalBias', label: 'Vertical Bias', moduleId: 'gradientSky', min: 0, max: 1, defaultValue: 0.56, curve: 'linear' },
    { id: 'gradientSky.radialCenterX', label: 'Radial Center X', moduleId: 'gradientSky', min: 0, max: 1, defaultValue: 0.5, curve: 'linear' },
    { id: 'gradientSky.radialCenterY', label: 'Radial Center Y', moduleId: 'gradientSky', min: 0, max: 1, defaultValue: 0.38, curve: 'linear' },
    { id: 'gradientSky.radialStrength', label: 'Radial Strength', moduleId: 'gradientSky', min: 0, max: 1, defaultValue: 0.44, curve: 'linear' },
    { id: 'gradientSky.opacity', label: 'Gradient Opacity', moduleId: 'gradientSky', min: 0, max: 1, defaultValue: 0.97, curve: 'linear' },

    { id: 'auroraRibbon.ribbonCount', label: 'Ribbon Count', moduleId: 'auroraRibbon', min: 1, max: 8, defaultValue: 4, curve: 'exp' },
    { id: 'auroraRibbon.ribbonWidth', label: 'Ribbon Width', moduleId: 'auroraRibbon', min: 0.05, max: 1, defaultValue: 0.32, curve: 'linear' },
    { id: 'auroraRibbon.turbulence', label: 'Turbulence', moduleId: 'auroraRibbon', min: 0, max: 1, defaultValue: 0.32, curve: 'linear' },
    { id: 'auroraRibbon.driftSpeed', label: 'Drift Speed', moduleId: 'auroraRibbon', min: 0.05, max: 1.5, defaultValue: 0.26, curve: 'exp' },
    { id: 'auroraRibbon.ribbonTension', label: 'Ribbon Tension', moduleId: 'auroraRibbon', min: 0, max: 1, defaultValue: 0.46, curve: 'linear' },
    { id: 'auroraRibbon.hueShift', label: 'Hue Shift', moduleId: 'auroraRibbon', min: -1, max: 1, defaultValue: 0, curve: 'linear' },
    { id: 'auroraRibbon.alpha', label: 'Alpha', moduleId: 'auroraRibbon', min: 0, max: 1, defaultValue: 0.7, curve: 'linear' },

    { id: 'bloomGlow.bloomStrength', label: 'Bloom Strength', moduleId: 'bloomGlow', min: 0, max: 1, defaultValue: 0.4, curve: 'linear' },
    { id: 'bloomGlow.threshold', label: 'Threshold', moduleId: 'bloomGlow', min: 0, max: 1, defaultValue: 0.45, curve: 'linear' },
    { id: 'bloomGlow.glowRadius', label: 'Glow Radius', moduleId: 'bloomGlow', min: 0, max: 1, defaultValue: 0.48, curve: 'linear' },
    { id: 'bloomGlow.glowSoftness', label: 'Glow Softness', moduleId: 'bloomGlow', min: 0, max: 1, defaultValue: 0.56, curve: 'linear' },

    { id: 'blendStack.masterBrightness', label: 'Master Brightness', moduleId: 'blendStack', min: 0.4, max: 1.8, defaultValue: 1, curve: 'exp' },
    { id: 'blendStack.masterContrast', label: 'Master Contrast', moduleId: 'blendStack', min: 0.5, max: 1.8, defaultValue: 1.08, curve: 'exp' },
    { id: 'blendStack.gradientOpacity', label: 'Gradient Opacity', moduleId: 'blendStack', min: 0, max: 1, defaultValue: 1, curve: 'linear' },
    { id: 'blendStack.ribbonOpacity', label: 'Ribbon Opacity', moduleId: 'blendStack', min: 0, max: 1, defaultValue: 0.9, curve: 'linear' },

    { id: 'timeMotion.globalSpeed', label: 'Global Speed', moduleId: 'timeMotion', min: 0.2, max: 2.5, defaultValue: 1, curve: 'exp' },
    { id: 'timeMotion.timeWarp', label: 'Time Warp', moduleId: 'timeMotion', min: -1, max: 1, defaultValue: 0, curve: 'linear' },
    { id: 'timeMotion.motionBlur', label: 'Motion Blur', moduleId: 'timeMotion', min: 0, max: 1, defaultValue: 0, curve: 'linear' }
  ];

  const VisualSynthApp = {
    initialized: false,
    active: false,
    state: null,
    store: null,
    elements: {},
    targetRegistry: null,
    modMatrix: null,
    sequencer: null,
    engine: null,
    presetStore: null,
    targetById: null,
    paintSession: null,
    saveTimer: null,
    moduleDragId: null,

    init: function (options) {
      if (this.initialized) {
        return true;
      }

      this.store = options && options.store ? options.store : global.Store || null;
      this._cacheElements();

      if (!this.elements.overlay || !this.elements.canvas) {
        return false;
      }

      this.presetStore = new global.PresetStore();

      const defaultState = createDefaultState();
      const lastState = this.presetStore.loadLastState();
      const legacyVisual = this.store && typeof this.store.getVisual === 'function'
        ? this.store.getVisual()
        : null;

      if (lastState && typeof lastState === 'object') {
        this.state = mergeDeep(deepClone(defaultState), lastState);
      } else {
        this.state = applyLegacyVisualMap(defaultState, legacyVisual);
      }

      this.state.version = SYNTH_STATE_VERSION;
      if (!this.state.ui || typeof this.state.ui !== 'object') {
        this.state.ui = {};
      }
      if (!Array.isArray(this.state.ui.moduleOrder)) {
        this.state.ui.moduleOrder = ['gradientSky', 'auroraRibbon', 'blendStack', 'bloomGlow', 'timeMotion'];
      }
      if (!this.state.ui.collapsedModules || typeof this.state.ui.collapsedModules !== 'object') {
        this.state.ui.collapsedModules = {};
      }
      if (typeof this.state.ui.activeTab !== 'string') this.state.ui.activeTab = 'modules';
      if (typeof this.state.ui.autoQuality !== 'boolean') this.state.ui.autoQuality = true;
      if (typeof this.state.ui.includeSequencerInPreset !== 'boolean') this.state.ui.includeSequencerInPreset = true;
      if (typeof this.state.ui.showPresetCard !== 'boolean') this.state.ui.showPresetCard = false;

      this.targetRegistry = new global.TargetRegistry();
      this.targetRegistry.registerMany(TARGET_DEFINITIONS);
      this.targetById = new Map(TARGET_DEFINITIONS.map((definition) => [definition.id, definition]));

      this.modMatrix = new global.ModMatrix();
      this.sequencer = new global.StepSequencer({
        bpm: this.state.sequencer.bpm,
        swing: this.state.sequencer.swing,
        stepLength: this.state.sequencer.stepLength,
        playing: this.state.sequencer.playing,
        lanes: this.state.sequencer.lanes,
        laneCount: 3
      });

      this._syncTargetBaseValuesFromState();

      this.modMatrix.setAssignments(Array.isArray(this.state.modMatrix) ? this.state.modMatrix : []);
      this._syncSequencerRoutes();
      this._syncStateFromEngineModels();

      this.engine = new global.VisualSynthEngine({
        canvas: this.elements.canvas,
        targetRegistry: this.targetRegistry,
        modMatrix: this.modMatrix,
        sequencer: this.sequencer,
        state: this.state,
        onStats: this._handleStats.bind(this)
      });

      this._bindStaticEvents();
      this.renderAll();
      this._scheduleSave();

      this.initialized = true;
      return true;
    },

    _cacheElements: function () {
      this.elements = {
        overlay: document.getElementById('visual-synth-overlay'),
        canvas: document.getElementById('visual-synth-canvas'),
        moduleRack: document.getElementById('vs-module-rack'),
        lanes: document.getElementById('vs-lanes'),
        macros: document.getElementById('vs-macros'),
        presetCard: document.getElementById('vs-panel-presets'),
        statusFps: document.getElementById('vs-status-fps'),
        statusNodes: document.getElementById('vs-status-nodes'),
        statusRender: document.getElementById('vs-status-render'),
        playToggle: document.getElementById('vs-play-toggle'),
        bpm: document.getElementById('vs-bpm'),
        swing: document.getElementById('vs-swing'),
        stepLength: document.getElementById('vs-step-length'),
        quality: document.getElementById('vs-quality'),
        autoQuality: document.getElementById('vs-auto-quality'),
        patternName: document.getElementById('vs-pattern-name'),
        patternSelect: document.getElementById('vs-pattern-select'),
        lfoShape: document.getElementById('vs-lfo-shape'),
        lfoRate: document.getElementById('vs-lfo-rate'),
        lfoDepth: document.getElementById('vs-lfo-depth'),
        lfoPhase: document.getElementById('vs-lfo-phase'),
        lfoOffset: document.getElementById('vs-lfo-offset'),
        presetSelect: document.getElementById('vs-preset-select'),
        presetName: document.getElementById('vs-preset-name'),
        presetIncludeSeq: document.getElementById('vs-preset-include-seq'),
        importInput: document.getElementById('vs-import-input'),
        panelModules: document.getElementById('vs-panel-modules'),
        panelSequencer: document.getElementById('vs-panel-sequencer')
      };
    },

    _syncTargetBaseValuesFromState: function () {
      this.targetRegistry.getAll().forEach((definition) => {
        const path = definition.id.split('.');
        const moduleId = path[0];
        const paramId = path[1];
        const module = this.state.modules[moduleId];
        if (!module || !module.params) return;
        if (!Object.prototype.hasOwnProperty.call(module.params, paramId)) return;
        this.targetRegistry.setBaseValue(definition.id, module.params[paramId]);
      });
    },

    _syncStateFromEngineModels: function () {
      this.state.sequencer = this.sequencer.getPatternState();
      this.state.modMatrix = this.modMatrix.listAssignments();
    },

    _syncSequencerRoutes: function () {
      const laneIds = new Set();
      this.sequencer.lanes.forEach((lane) => {
        laneIds.add(lane.id);
        const routeId = `route-${lane.id}`;

        if (!lane.targetId) {
          this.modMatrix.removeAssignment(routeId);
          return;
        }

        const assignment = {
          id: routeId,
          sourceId: lane.id,
          targetId: lane.targetId,
          amount: lane.amount,
          polarity: 'unipolar',
          smoothing: lane.smoothing,
          quantizeSteps: 0,
          enabled: true
        };

        if (this.modMatrix.listAssignments().some((existing) => existing.id === routeId)) {
          this.modMatrix.updateAssignment(routeId, assignment);
        } else {
          this.modMatrix.addAssignment(assignment);
        }
      });

      this.modMatrix.listAssignments().forEach((assignment) => {
        if (assignment.id.startsWith('route-seq-lane-') && !laneIds.has(assignment.sourceId)) {
          this.modMatrix.removeAssignment(assignment.id);
        }
      });

      this._syncStateFromEngineModels();
    },

    _setModuleParam: function (targetId, value) {
      const definition = this.targetById.get(targetId);
      if (!definition) return;

      const normalizedValue = this.targetRegistry.setBaseValue(targetId, value);
      const path = targetId.split('.');
      const moduleId = path[0];
      const paramId = path[1];

      if (this.state.modules[moduleId] && this.state.modules[moduleId].params) {
        this.state.modules[moduleId].params[paramId] = normalizedValue;
      }

      this._scheduleSave();
    },

    _bindStaticEvents: function () {
      const self = this;

      document.getElementById('vs-btn-close').addEventListener('click', function () {
        self.close();
      });

      document.getElementById('vs-btn-presets').addEventListener('click', function () {
        const isMobile = window.matchMedia('(max-width: 900px)').matches;
        if (isMobile) {
          self.state.ui.activeTab = 'presets';
          self._applyMobileTab();
          return;
        }
        self.state.ui.showPresetCard = !self.state.ui.showPresetCard;
        self._applyMobileTab();
        self._scheduleSave();
      });

      document.getElementById('vs-btn-randomize').addEventListener('click', function () {
        self.randomize();
      });

      document.getElementById('vs-btn-reset').addEventListener('click', function () {
        self.reset();
      });

      document.getElementById('vs-btn-export').addEventListener('click', function () {
        self.exportPresetBank();
      });

      document.getElementById('vs-btn-import').addEventListener('click', function () {
        self.elements.importInput.click();
      });

      this.elements.importInput.addEventListener('change', function (event) {
        self.importPresetBank(event.target.files && event.target.files[0]);
        event.target.value = '';
      });

      document.getElementById('vs-pattern-save').addEventListener('click', function () {
        const name = normalizeName(self.elements.patternName.value, 'Pattern ' + Date.now());
        self.sequencer.savePattern(name);
        self.elements.patternName.value = name;
        self.renderPatternOptions();
        self._scheduleSave();
      });

      document.getElementById('vs-pattern-load').addEventListener('click', function () {
        const patternName = self.elements.patternSelect.value;
        if (!patternName) return;
        if (self.sequencer.loadPattern(patternName)) {
          self._syncSequencerRoutes();
          self.renderLanes();
          self._scheduleSave();
        }
      });

      this.elements.playToggle.addEventListener('click', function () {
        const playing = self.sequencer.toggle(performance.now() / 1000);
        self.state.sequencer.playing = playing;
        self.renderTransport();
        self._scheduleSave();
      });

      this.elements.bpm.addEventListener('input', function () {
        self.sequencer.setTransport({ bpm: Number(self.elements.bpm.value) });
        self.state.sequencer.bpm = self.sequencer.bpm;
        self._scheduleSave();
      });

      this.elements.swing.addEventListener('input', function () {
        self.sequencer.setTransport({ swing: Number(self.elements.swing.value) });
        self.state.sequencer.swing = self.sequencer.swing;
        self._scheduleSave();
      });

      this.elements.stepLength.addEventListener('change', function () {
        self.sequencer.setTransport({ stepLength: Number(self.elements.stepLength.value) });
        self.state.sequencer.stepLength = self.sequencer.stepLength;
        self.renderLanes();
        self._scheduleSave();
      });

      this.elements.quality.addEventListener('change', function () {
        self.engine.setQuality(self.elements.quality.value);
        self.state.quality = self.engine.quality;
        self._scheduleSave();
      });

      this.elements.autoQuality.addEventListener('change', function () {
        self.state.ui.autoQuality = self.elements.autoQuality.checked;
        self._scheduleSave();
      });

      this.elements.lfoShape.addEventListener('change', function () {
        self.state.modulators.lfo1.shape = self.elements.lfoShape.value;
        self._scheduleSave();
      });

      this.elements.lfoRate.addEventListener('input', function () {
        self.state.modulators.lfo1.rate = Number(self.elements.lfoRate.value);
        self._scheduleSave();
      });

      this.elements.lfoDepth.addEventListener('input', function () {
        self.state.modulators.lfo1.depth = Number(self.elements.lfoDepth.value);
        self._scheduleSave();
      });

      this.elements.lfoPhase.addEventListener('input', function () {
        self.state.modulators.lfo1.phase = Number(self.elements.lfoPhase.value);
        self._scheduleSave();
      });

      this.elements.lfoOffset.addEventListener('input', function () {
        self.state.modulators.lfo1.offset = Number(self.elements.lfoOffset.value);
        self._scheduleSave();
      });

      document.getElementById('vs-preset-load').addEventListener('click', function () {
        const presetId = self.elements.presetSelect.value;
        if (!presetId) return;
        self.loadPresetById(presetId);
      });

      document.getElementById('vs-preset-save').addEventListener('click', function () {
        const name = normalizeName(self.elements.presetName.value, 'Custom Preset');
        const includeSequencer = self.elements.presetIncludeSeq.checked;
        self.presetStore.savePreset(name, self.serializeState(), { includeSequencer });
        self.state.ui.includeSequencerInPreset = includeSequencer;
        self.renderPresetOptions();
        self._scheduleSave();
      });

      document.getElementById('vs-preset-delete').addEventListener('click', function () {
        const presetId = self.elements.presetSelect.value;
        if (!presetId) return;
        self.presetStore.deletePreset(presetId);
        self.renderPresetOptions();
        self._scheduleSave();
      });

      document.querySelectorAll('.vs-tab').forEach((tabButton) => {
        tabButton.addEventListener('click', function () {
          self.state.ui.activeTab = tabButton.dataset.tab;
          self._applyMobileTab();
        });
      });

      this.elements.moduleRack.addEventListener('input', function (event) {
        const targetId = event.target.dataset.targetId;
        if (targetId) {
          self._setModuleParam(targetId, Number(event.target.value));
          self._updateKnobVisual(event.target);
          return;
        }

        if (event.target.dataset.colorKey) {
          const moduleId = event.target.dataset.moduleId;
          const colorKey = event.target.dataset.colorKey;
          if (self.state.modules[moduleId]) {
            self.state.modules[moduleId].params[colorKey] = event.target.value;
            self._scheduleSave();
          }
        }
      });

      this.elements.moduleRack.addEventListener('click', function (event) {
        const collapseBtn = event.target.closest('[data-collapse-module]');
        if (collapseBtn) {
          const moduleId = collapseBtn.dataset.collapseModule;
          const collapsed = self.state.ui.collapsedModules[moduleId] === true;
          self.state.ui.collapsedModules[moduleId] = !collapsed;
          self.renderModules();
          self._scheduleSave();
          return;
        }

        const toggle = event.target.closest('[data-toggle-module]');
        if (toggle) {
          const moduleId = toggle.dataset.toggleModule;
          const module = self.state.modules[moduleId];
          if (!module) return;
          module.enabled = !module.enabled;
          self.renderModules();
          self._scheduleSave();
          return;
        }

        const freeze = event.target.closest('[data-freeze-module]');
        if (freeze) {
          const moduleId = freeze.dataset.freezeModule;
          const module = self.state.modules[moduleId];
          if (!module) return;
          module.frozen = !module.frozen;
          if (!module.frozen) {
            module.freezeTime = null;
          }
          self.renderModules();
          self._scheduleSave();
          return;
        }

        const addAssignment = event.target.closest('[data-add-lfo-assignment]');
        if (addAssignment) {
          const moduleId = addAssignment.dataset.moduleId;
          const targetSelect = self.elements.moduleRack.querySelector(`[data-assignment-target="${moduleId}"]`);
          const amountInput = self.elements.moduleRack.querySelector(`[data-assignment-amount="${moduleId}"]`);
          const polaritySelect = self.elements.moduleRack.querySelector(`[data-assignment-polarity="${moduleId}"]`);
          const smoothingInput = self.elements.moduleRack.querySelector(`[data-assignment-smoothing="${moduleId}"]`);
          if (!targetSelect || !targetSelect.value) return;

          self.modMatrix.addAssignment({
            id: `lfo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            sourceId: 'lfo1',
            targetId: targetSelect.value,
            amount: Number(amountInput ? amountInput.value : 0.2),
            polarity: polaritySelect ? polaritySelect.value : 'bipolar',
            smoothing: Number(smoothingInput ? smoothingInput.value : 0.15),
            quantizeSteps: 0,
            enabled: true
          });

          self._syncStateFromEngineModels();
          self.renderModules();
          self._scheduleSave();
          return;
        }

        const removeAssignment = event.target.closest('[data-remove-assignment]');
        if (removeAssignment) {
          self.modMatrix.removeAssignment(removeAssignment.dataset.removeAssignment);
          self._syncStateFromEngineModels();
          self.renderModules();
          self._scheduleSave();
        }
      });

      this.elements.moduleRack.addEventListener('dragstart', function (event) {
        const card = event.target.closest('.visual-synth-module');
        if (!card) return;
        self.moduleDragId = card.dataset.moduleId;
        event.dataTransfer.effectAllowed = 'move';
      });

      this.elements.moduleRack.addEventListener('dragover', function (event) {
        event.preventDefault();
      });

      this.elements.moduleRack.addEventListener('drop', function (event) {
        event.preventDefault();
        const targetCard = event.target.closest('.visual-synth-module');
        if (!targetCard || !self.moduleDragId) return;

        const targetId = targetCard.dataset.moduleId;
        const order = self.state.ui.moduleOrder.slice();
        const fromIndex = order.indexOf(self.moduleDragId);
        const toIndex = order.indexOf(targetId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

        order.splice(fromIndex, 1);
        order.splice(toIndex, 0, self.moduleDragId);
        self.state.ui.moduleOrder = order;
        self.renderModules();
        self._scheduleSave();
      });

      this.elements.lanes.addEventListener('change', function (event) {
        if (event.target.dataset.laneTarget) {
          const laneId = event.target.dataset.laneTarget;
          self.sequencer.setLanePatch(laneId, { targetId: event.target.value });
          self._syncSequencerRoutes();
          self.renderLanes();
          self._scheduleSave();
        }
      });

      this.elements.lanes.addEventListener('input', function (event) {
        if (event.target.dataset.laneAmount) {
          const laneId = event.target.dataset.laneAmount;
          self.sequencer.setLanePatch(laneId, { amount: Number(event.target.value) });
          self._syncSequencerRoutes();
          self._scheduleSave();
        }

        if (event.target.dataset.laneSmoothing) {
          const laneId = event.target.dataset.laneSmoothing;
          self.sequencer.setLanePatch(laneId, { smoothing: Number(event.target.value) });
          self._syncSequencerRoutes();
          self._scheduleSave();
        }
      });

      this.elements.lanes.addEventListener('click', function (event) {
        const muteButton = event.target.closest('[data-lane-mute]');
        if (muteButton) {
          const laneId = muteButton.dataset.laneMute;
          const lane = self.sequencer.lanes.find((entry) => entry.id === laneId);
          self.sequencer.setLanePatch(laneId, { mute: !lane.mute });
          self.renderLanes();
          self._scheduleSave();
          return;
        }

        const soloButton = event.target.closest('[data-lane-solo]');
        if (soloButton) {
          const laneId = soloButton.dataset.laneSolo;
          const lane = self.sequencer.lanes.find((entry) => entry.id === laneId);
          self.sequencer.setLanePatch(laneId, { solo: !lane.solo });
          self.renderLanes();
          self._scheduleSave();
          return;
        }

        const copyButton = event.target.closest('[data-lane-copy]');
        if (copyButton) {
          self.sequencer.copyLane(copyButton.dataset.laneCopy);
          return;
        }

        const pasteButton = event.target.closest('[data-lane-paste]');
        if (pasteButton) {
          self.sequencer.pasteLane(pasteButton.dataset.lanePaste);
          self._syncSequencerRoutes();
          self.renderLanes();
          self._scheduleSave();
          return;
        }

        const randomButton = event.target.closest('[data-lane-random]');
        if (randomButton) {
          self.sequencer.randomizeLane(randomButton.dataset.laneRandom, 0.45);
          self.renderLanes();
          self._scheduleSave();
        }
      });

      this.elements.lanes.addEventListener('pointerdown', function (event) {
        const cell = event.target.closest('.vs-step');
        if (!cell || event.button !== 0) return;
        event.preventDefault();
        self.paintSession = {
          shiftMode: event.shiftKey,
          lastCellKey: null
        };

        self._paintStepFromPointer(event.clientX, event.clientY);

        const moveHandler = function (moveEvent) {
          self._paintStepFromPointer(moveEvent.clientX, moveEvent.clientY);
        };

        const upHandler = function () {
          self.paintSession = null;
          window.removeEventListener('pointermove', moveHandler);
          window.removeEventListener('pointerup', upHandler);
          self._scheduleSave();
        };

        window.addEventListener('pointermove', moveHandler);
        window.addEventListener('pointerup', upHandler);
      });

      this.elements.macros.addEventListener('input', function (event) {
        if (!event.target.dataset.macroId) return;
        const macroId = event.target.dataset.macroId;
        const macro = self.state.macros.find((entry) => entry.id === macroId);
        if (!macro) return;
        macro.value = Number(event.target.value);
        self._applyMacro(macro);
        self._updateKnobVisual(event.target);
        self._scheduleSave();
      });

      document.addEventListener('keydown', this._handleKeydown.bind(this));
    },

    _paintStepFromPointer: function (clientX, clientY) {
      if (!this.paintSession) return;
      const element = document.elementFromPoint(clientX, clientY);
      const cell = element ? element.closest('.vs-step') : null;
      if (!cell) return;

      const laneId = cell.dataset.laneId;
      const stepIndex = Number(cell.dataset.stepIndex);
      if (!laneId || !Number.isInteger(stepIndex)) return;

      const key = `${laneId}:${stepIndex}`;
      if (this.paintSession.lastCellKey === key && this.paintSession.shiftMode) {
        return;
      }

      const lane = this.sequencer.lanes.find((entry) => entry.id === laneId);
      if (!lane) return;

      const currentStep = lane.steps[stepIndex];
      if (!currentStep) return;

      if (this.paintSession.shiftMode) {
        this.sequencer.setStep(laneId, stepIndex, {
          enabled: !currentStep.enabled
        });
      } else {
        const rect = cell.getBoundingClientRect();
        const normalized = clamp01(1 - (clientY - rect.top) / Math.max(1, rect.height));
        this.sequencer.setStep(laneId, stepIndex, {
          enabled: true,
          value: normalized
        });
      }

      this.paintSession.lastCellKey = key;
      this._refreshLaneStepCell(cell, lane.steps[stepIndex], stepIndex);
    },

    _refreshLaneStepCell: function (cell, step, stepIndex) {
      cell.dataset.enabled = step.enabled ? 'true' : 'false';
      cell.style.setProperty('--value', String(step.value));
      cell.title = `Step ${stepIndex + 1} - V:${step.value.toFixed(2)} P:${step.probability.toFixed(2)}`;
    },

    _applyMacro: function (macro) {
      const amount = clamp01(macro.value);
      switch (macro.id) {
        case 'macro-1':
          this._setModuleParam('gradientSky.opacity', 0.7 + amount * 0.3);
          break;
        case 'macro-2':
          this._setModuleParam('auroraRibbon.driftSpeed', 0.06 + amount * 0.95);
          break;
        case 'macro-3':
          this._setModuleParam('bloomGlow.bloomStrength', amount);
          break;
        case 'macro-4':
          this._setModuleParam('blendStack.masterContrast', 0.65 + amount * 1.05);
          break;
        case 'macro-5':
          this._setModuleParam('gradientSky.hueSpread', amount);
          break;
        case 'macro-6':
          this._setModuleParam('auroraRibbon.turbulence', amount);
          break;
        case 'macro-7':
          this._setModuleParam('auroraRibbon.hueShift', -1 + amount * 2);
          break;
        case 'macro-8':
          this._setModuleParam('timeMotion.globalSpeed', 0.2 + amount * 2.3);
          break;
        default:
          break;
      }

      this.renderModules();
    },

    _updateKnobVisual: function (input) {
      const wrapper = input.closest('.vs-knob-dial-wrap');
      if (!wrapper) return;

      const min = Number(input.min || 0);
      const max = Number(input.max || 1);
      const value = Number(input.value || 0);
      const normalized = clamp01((value - min) / (max - min || 1));
      wrapper.style.setProperty('--value', String(normalized));

      const valueEl = wrapper.parentElement.querySelector('.vs-knob-value');
      if (valueEl) {
        valueEl.textContent = prettyValue(value, input.dataset.unit || '');
      }
    },

    _handleStats: function (stats) {
      if (!this.elements.statusFps) return;

      this.elements.statusFps.textContent = `FPS ${Math.round(stats.fps || 0)}`;
      this.elements.statusNodes.textContent = `NODES ${stats.activeNodes || 0}`;
      this.elements.statusRender.textContent = `${String(stats.renderer || 'none').toUpperCase()} / ${String(stats.quality || this.state.quality).toUpperCase()}`;
      this.elements.quality.value = String(stats.quality || this.state.quality || 'high');

      this.elements.playToggle.textContent = this.sequencer.playing ? 'Pause' : 'Play';
      this._highlightCurrentStep(stats.currentStep || 0);
    },

    _highlightCurrentStep: function (currentStep) {
      this.elements.lanes.querySelectorAll('.vs-step').forEach((cell) => {
        const stepIndex = Number(cell.dataset.stepIndex);
        cell.classList.toggle('active-step', stepIndex === currentStep);
      });
    },

    _scheduleSave: function () {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        this._syncStateFromEngineModels();
        this.presetStore.saveLastState(this.serializeState());
      }, 180);
    },

    serializeState: function () {
      const snapshot = deepClone(this.state);
      snapshot.modMatrix = this.modMatrix.listAssignments();
      snapshot.sequencer = this.sequencer.getPatternState();
      return snapshot;
    },

    randomize: function () {
      this.targetRegistry.getAll().forEach((definition) => {
        const randomNorm = Math.random();
        const value = this.targetRegistry.fromNormalized(definition.id, randomNorm);
        this._setModuleParam(definition.id, value);
      });

      Object.keys(this.state.modules).forEach((moduleId) => {
        this.state.modules[moduleId].enabled = true;
      });

      this.sequencer.lanes.forEach((lane) => {
        this.sequencer.randomizeLane(lane.id, 0.35 + Math.random() * 0.4);
      });

      this._syncSequencerRoutes();
      this.renderAll();
      this._scheduleSave();
    },

    reset: function () {
      const defaultState = createDefaultState();
      this.state = defaultState;
      this.targetRegistry.resetBaseValues();
      this._syncTargetBaseValuesFromState();
      this.modMatrix.setAssignments(this.state.modMatrix);
      this.sequencer.loadPatternState(this.state.sequencer);
      this._syncSequencerRoutes();
      this.engine.setState(this.state);
      this.renderAll();
      this._scheduleSave();
    },

    exportPresetBank: function () {
      const payload = this.presetStore.exportPayload();
      payload.currentState = this.serializeState();

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `visual-synth-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    },

    importPresetBank: function (file) {
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result || '{}'));
          if (!this.presetStore.validateImportShape(payload)) {
            alert('Visual synth import rejected: unsupported or invalid schema.');
            return;
          }

          this.presetStore.importPayload(payload, { merge: true });

          if (payload.currentState && typeof payload.currentState === 'object') {
            const merged = mergeDeep(createDefaultState(), payload.currentState);
            this.state = merged;
            this._syncTargetBaseValuesFromState();
            this.modMatrix.setAssignments(Array.isArray(this.state.modMatrix) ? this.state.modMatrix : []);
            this.sequencer.loadPatternState(this.state.sequencer);
            this._syncSequencerRoutes();
            this.engine.setState(this.state);
          }

          this.renderAll();
          this._scheduleSave();
        } catch (error) {
          alert('Visual synth import failed: invalid JSON payload.');
        }
      };

      reader.readAsText(file);
    },

    renderAll: function () {
      this.renderTransport();
      this.renderPatternOptions();
      this.renderLfo();
      this.renderModules();
      this.renderLanes();
      this.renderMacros();
      this.renderPresetOptions();
      this._applyMobileTab();
      this.engine.setState(this.state);
    },

    renderTransport: function () {
      this.elements.playToggle.textContent = this.sequencer.playing ? 'Pause' : 'Play';
      this.elements.bpm.value = String(this.sequencer.bpm);
      this.elements.swing.value = String(this.sequencer.swing);
      this.elements.stepLength.value = String(this.sequencer.stepLength);
      this.elements.quality.value = this.state.quality;
      this.elements.autoQuality.checked = this.state.ui.autoQuality !== false;
    },

    renderPatternOptions: function () {
      const patterns = this.sequencer.listPatterns();
      const current = this.elements.patternSelect.value;

      this.elements.patternSelect.innerHTML = ['<option value="">Pattern...</option>']
        .concat(patterns.map((name) => `<option value="${name}">${name}</option>`))
        .join('');

      if (patterns.includes(current)) {
        this.elements.patternSelect.value = current;
      }
    },

    renderLfo: function () {
      const lfo = this.state.modulators.lfo1;
      this.elements.lfoShape.value = lfo.shape;
      this.elements.lfoRate.value = String(lfo.rate);
      this.elements.lfoDepth.value = String(lfo.depth);
      this.elements.lfoPhase.value = String(lfo.phase);
      this.elements.lfoOffset.value = String(lfo.offset);
    },

    _moduleAssignmentsHtml: function (moduleId) {
      const moduleTargets = this.targetRegistry.getByModule(moduleId);
      const options = moduleTargets
        .map((target) => `<option value="${target.id}">${target.label}</option>`)
        .join('');

      const assignments = this.modMatrix
        .listAssignments()
        .filter((assignment) => assignment.sourceId === 'lfo1' && assignment.targetId.startsWith(`${moduleId}.`));

      const chips = assignments.length === 0
        ? '<span class="vs-footer-note">No LFO routes</span>'
        : assignments.map((assignment) => {
          const definition = this.targetById.get(assignment.targetId);
          const label = definition ? definition.label : assignment.targetId;
          return `<span class="vs-assign-chip">${label} - ${assignment.amount.toFixed(2)}<button type="button" data-remove-assignment="${assignment.id}" aria-label="Remove route">x</button></span>`;
        }).join('');

      return `
        <div class="vs-assign">
          <div class="vs-control-row">
            <select class="vs-select" data-assignment-target="${moduleId}">${options}</select>
            <button class="vs-btn" type="button" data-add-lfo-assignment="true" data-module-id="${moduleId}">Assign</button>
          </div>
          <div class="vs-control-row">
            <input class="vs-range" type="range" min="-1" max="1" step="0.01" value="0.2" data-assignment-amount="${moduleId}">
            <select class="vs-select" data-assignment-polarity="${moduleId}">
              <option value="bipolar">Bi</option>
              <option value="unipolar">Uni</option>
            </select>
          </div>
          <div class="vs-control-row">
            <input class="vs-range" type="range" min="0" max="1" step="0.01" value="0.15" data-assignment-smoothing="${moduleId}">
            <span class="vs-footer-note">LFO Route</span>
          </div>
          <div class="vs-assign-list">${chips}</div>
        </div>
      `;
    },

    _knobHtml: function (targetId, label, unit) {
      const definition = this.targetById.get(targetId);
      if (!definition) return '';
      const value = this.targetRegistry.getBaseValue(targetId);
      const min = definition.min;
      const max = definition.max;
      const normalized = clamp01((value - min) / (max - min || 1));

      return `
        <label class="vs-knob">
          <span class="vs-knob-dial-wrap" style="--value:${normalized.toFixed(4)}">
            <input
              class="vs-knob-input"
              data-target-id="${targetId}"
              data-unit="${unit || ''}"
              type="range"
              min="${min}"
              max="${max}"
              step="${Math.max((max - min) / 200, 0.001)}"
              value="${value}"
            >
            <span class="vs-knob-dial"></span>
          </span>
          <span class="vs-knob-label">${label}</span>
          <span class="vs-knob-value">${prettyValue(value, unit)}</span>
        </label>
      `;
    },

    renderModules: function () {
      const order = Array.isArray(this.state.ui.moduleOrder)
        ? this.state.ui.moduleOrder
        : Object.keys(MODULE_UI);

      const html = order
        .filter((moduleId) => MODULE_UI[moduleId])
        .map((moduleId) => {
          const moduleData = MODULE_UI[moduleId];
          const stateModule = this.state.modules[moduleId];
          const collapsed = this.state.ui.collapsedModules[moduleId] === true;

          const knobs = moduleData.params
            .map((param) => this._knobHtml(param.targetId, param.label, param.unit))
            .join('');

          const extraKnobs = (moduleData.extraParams || [])
            .map((param) => this._knobHtml(param.targetId, param.label, param.unit))
            .join('');

          const colorControls = (moduleData.colorParams || []).length
            ? `<div class="vs-color-row">${moduleData.colorParams.map((color) => `
                <label class="vs-color-field">
                  <span>${color.label}</span>
                  <input type="color" data-module-id="${moduleId}" data-color-key="${color.key}" value="${stateModule.params[color.key]}">
                </label>
              `).join('')}</div>`
            : '';

          return `
            <article class="visual-synth-module ${collapsed ? 'collapsed' : ''}" data-module-id="${moduleId}" data-enabled="${stateModule.enabled ? 'true' : 'false'}" draggable="true">
              <header class="visual-synth-module-header">
                <span class="vs-module-drag" title="Drag to reorder">::</span>
                <button type="button" class="vs-module-head-btn" data-collapse-module="${moduleId}">${moduleData.icon} ${moduleData.title}</button>
                <div class="vs-module-actions">
                  <button class="vs-toggle" data-toggle-module="${moduleId}" data-on="${stateModule.enabled ? 'true' : 'false'}" type="button" title="Enable or disable module"></button>
                  <button class="vs-btn-icon" type="button" data-freeze-module="${moduleId}" title="Freeze module">${stateModule.frozen ? 'F' : 'f'}</button>
                </div>
              </header>
              <div class="visual-synth-module-content">
                <div class="vs-knob-grid">${knobs}${extraKnobs}</div>
                ${colorControls}
                ${this._moduleAssignmentsHtml(moduleId)}
              </div>
            </article>
          `;
        })
        .join('');

      this.elements.moduleRack.innerHTML = html;
    },

    renderLanes: function () {
      const stepCount = this.sequencer.stepLength;
      const targetOptions = this.targetRegistry.getAll()
        .map((target) => `<option value="${target.id}">${target.moduleId} - ${target.label}</option>`)
        .join('');

      const lanesHtml = this.sequencer.lanes.map((lane) => {
        const stepsHtml = lane.steps
          .map((step, stepIndex) => `
            <button
              type="button"
              class="vs-step"
              data-lane-id="${lane.id}"
              data-step-index="${stepIndex}"
              data-enabled="${step.enabled ? 'true' : 'false'}"
              style="--value:${step.value};"
              title="Step ${stepIndex + 1} - V:${step.value.toFixed(2)} P:${step.probability.toFixed(2)}"
            ></button>
          `)
          .join('');

        return `
          <div class="vs-lane" data-lane-id="${lane.id}">
            <div class="vs-lane-head">
              <select class="vs-lane-select" data-lane-target="${lane.id}">
                <option value="">No target</option>
                ${targetOptions}
              </select>
              <div class="vs-lane-controls">
                <button type="button" class="vs-btn" data-lane-copy="${lane.id}">Copy</button>
                <button type="button" class="vs-btn" data-lane-paste="${lane.id}">Paste</button>
              </div>
              <button type="button" class="vs-btn ${lane.mute ? 'is-primary' : ''}" data-lane-mute="${lane.id}">Mute</button>
              <button type="button" class="vs-btn ${lane.solo ? 'is-primary' : ''}" data-lane-solo="${lane.id}">Solo</button>
            </div>

            <div class="vs-lane-mini">
              <label class="vs-field">
                <span>Depth</span>
                <input class="vs-lane-range" type="range" min="-1" max="1" step="0.01" value="${lane.amount}" data-lane-amount="${lane.id}">
              </label>
              <label class="vs-field">
                <span>Smoothing</span>
                <input class="vs-lane-range" type="range" min="0" max="1" step="0.01" value="${lane.smoothing}" data-lane-smoothing="${lane.id}">
              </label>
            </div>

            <div class="vs-lane-controls" style="margin-bottom:8px">
              <button type="button" class="vs-btn" data-lane-random="${lane.id}">Randomize Lane</button>
              <span class="vs-footer-note">Shift+Drag toggles steps</span>
            </div>

            <div class="vs-step-grid" style="--steps:${stepCount}">
              ${stepsHtml}
            </div>
          </div>
        `;
      }).join('');

      this.elements.lanes.innerHTML = lanesHtml;

      this.sequencer.lanes.forEach((lane) => {
        const select = this.elements.lanes.querySelector(`[data-lane-target="${lane.id}"]`);
        if (select) {
          select.value = lane.targetId || '';
        }
      });

      this._highlightCurrentStep(this.sequencer.currentStep || 0);
    },

    renderMacros: function () {
      const html = this.state.macros.map((macro) => `
        <label class="vs-knob">
          <span class="vs-knob-dial-wrap" style="--value:${clamp01(macro.value).toFixed(4)}">
            <input
              class="vs-knob-input"
              data-macro-id="${macro.id}"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value="${macro.value}"
            >
            <span class="vs-knob-dial"></span>
          </span>
          <span class="vs-knob-label">${macro.label}</span>
          <span class="vs-knob-value">${prettyValue(macro.value, '')}</span>
        </label>
      `).join('');

      this.elements.macros.innerHTML = `<div class="vs-macro-grid">${html}</div>`;
    },

    renderPresetOptions: function () {
      const presets = this.presetStore.listPresets();
      const options = ['<option value="">Select preset</option>']
        .concat(presets.map((preset) => `<option value="${preset.id}">${preset.name}${preset.builtIn ? ' - Factory' : ''}</option>`))
        .join('');

      this.elements.presetSelect.innerHTML = options;
      if (this.state.presetsMeta.selectedPresetId) {
        this.elements.presetSelect.value = this.state.presetsMeta.selectedPresetId;
      }

      this.elements.presetIncludeSeq.checked = this.state.ui.includeSequencerInPreset !== false;
    },

    loadPresetById: function (presetId) {
      const preset = this.presetStore.getPreset(presetId);
      if (!preset) return;

      if (preset.state && preset.state.patch) {
        const merged = mergeDeep(this.serializeState(), preset.state.patch);
        this.state = mergeDeep(createDefaultState(), merged);
      } else {
        this.state = mergeDeep(createDefaultState(), preset.state);
      }

      this.state.presetsMeta.selectedPresetId = preset.id;
      this._syncTargetBaseValuesFromState();
      this.modMatrix.setAssignments(Array.isArray(this.state.modMatrix) ? this.state.modMatrix : []);
      this.sequencer.loadPatternState(this.state.sequencer);
      this._syncSequencerRoutes();
      this.engine.setState(this.state);
      this.renderAll();
      this._scheduleSave();
    },

    _applyMobileTab: function () {
      const tab = this.state.ui.activeTab || 'modules';
      const isMobile = window.matchMedia('(max-width: 900px)').matches;

      this.elements.panelModules.classList.toggle('hidden-mobile', tab !== 'modules');
      this.elements.panelSequencer.classList.toggle('hidden-mobile', tab === 'modules');

      const cards = this.elements.panelSequencer.querySelectorAll('.vs-card');
      if (isMobile) {
        cards.forEach((card) => {
          const group = card.dataset.mobileGroup || 'sequencer';
          card.hidden = tab === 'presets' ? group !== 'presets' : group === 'presets';
        });
      } else {
        cards.forEach((card) => {
          const group = card.dataset.mobileGroup || 'sequencer';
          if (group === 'presets') {
            card.hidden = this.state.ui.showPresetCard !== true;
          } else {
            card.hidden = false;
          }
        });
      }

      document.querySelectorAll('.vs-tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tab);
      });
    },

    _handleKeydown: function (event) {
      if (!this.elements.overlay.classList.contains('active')) {
        return;
      }

      if (shouldIgnoreShortcut(event)) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        this.sequencer.toggle(performance.now() / 1000);
        this.renderTransport();
        this._scheduleSave();
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        this.randomize();
        return;
      }

      if (event.key === '0') {
        event.preventDefault();
        this.reset();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    },

    activate: function () {
      if (!this.initialized) {
        this.init({ store: this.store || global.Store });
      }
      if (!this.initialized) return;
      if (!this.active) {
        this.engine.start();
        this.active = true;
      }
      document.body.classList.add('visual-synth-active');
    },

    deactivate: function () {
      if (!this.initialized) {
        document.body.classList.remove('visual-synth-active');
        return;
      }
      this.close();
      this.engine.stop();
      this.active = false;
      document.body.classList.remove('visual-synth-active');
    },

    open: function () {
      if (!this.initialized) {
        this.init({ store: this.store || global.Store });
      }
      if (!this.initialized) return;
      this.activate();
      this.elements.overlay.classList.add('active');
    },

    close: function () {
      if (!this.initialized) return;
      this.elements.overlay.classList.remove('active');
    },

    toggle: function () {
      if (!this.initialized) {
        this.init({ store: this.store || global.Store });
      }
      this.activate();
      if (this.elements.overlay.classList.contains('active')) {
        this.close();
      } else {
        this.open();
      }
    }
  };

  global.VisualSynthApp = VisualSynthApp;
})(window);
