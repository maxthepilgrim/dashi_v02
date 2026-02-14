(function (global) {
  'use strict';

  const PRESET_SCHEMA_VERSION = 1;
  const PRESET_BANK_KEY = 'visualSynthPresetBank';
  const LAST_STATE_KEY = 'visualSynthLastState';

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function clamp01(value) {
    return Math.min(1, Math.max(0, value));
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const CuratedPresets = [
    {
      id: 'preset-icebound-halo',
      name: 'Icebound Halo',
      description: 'Clean teal sky with narrow energetic ribbons.',
      patch: {
        quality: 'high',
        modules: {
          gradientSky: { params: { hueBase: 0.54, hueSpread: 0.13, verticalBias: 0.62, radialStrength: 0.42 } },
          auroraRibbon: { params: { ribbonCount: 3, ribbonWidth: 0.24, turbulence: 0.26, driftSpeed: 0.22, ribbonTension: 0.48, hueShift: -0.08, alpha: 0.66 } },
          bloomGlow: { params: { bloomStrength: 0.34, threshold: 0.52, glowRadius: 0.4, glowSoftness: 0.52 } },
          blendStack: { params: { masterBrightness: 1.02, masterContrast: 1.08, gradientOpacity: 0.98, ribbonOpacity: 0.82 } }
        }
      }
    },
    {
      id: 'preset-magnetic-dawn',
      name: 'Magnetic Dawn',
      description: 'Bright sky with faster ribbon drift and soft bloom.',
      patch: {
        quality: 'high',
        modules: {
          gradientSky: { params: { hueBase: 0.5, hueSpread: 0.2, verticalBias: 0.48, radialStrength: 0.58 } },
          auroraRibbon: { params: { ribbonCount: 5, ribbonWidth: 0.34, turbulence: 0.4, driftSpeed: 0.38, ribbonTension: 0.41, hueShift: 0.05, alpha: 0.74 } },
          bloomGlow: { params: { bloomStrength: 0.52, threshold: 0.44, glowRadius: 0.55, glowSoftness: 0.6 } }
        }
      }
    },
    {
      id: 'preset-subzero-silk',
      name: 'Subzero Silk',
      description: 'Slow-moving ribbons and heavy contrast for depth.',
      patch: {
        quality: 'medium',
        modules: {
          gradientSky: { params: { hueBase: 0.6, hueSpread: 0.09, verticalBias: 0.67, radialStrength: 0.34 } },
          auroraRibbon: { params: { ribbonCount: 2, ribbonWidth: 0.45, turbulence: 0.2, driftSpeed: 0.12, ribbonTension: 0.6, hueShift: -0.16, alpha: 0.64 } },
          bloomGlow: { params: { bloomStrength: 0.27, threshold: 0.58, glowRadius: 0.36, glowSoftness: 0.43 } },
          blendStack: { params: { masterBrightness: 0.92, masterContrast: 1.18, gradientOpacity: 1, ribbonOpacity: 0.78 } },
          timeMotion: { params: { globalSpeed: 0.76, timeWarp: -0.16 } }
        }
      }
    },
    {
      id: 'preset-vitreous-current',
      name: 'Vitreous Current',
      description: 'Balanced cinematic profile with clear ribbon stacks.',
      patch: {
        quality: 'high',
        modules: {
          gradientSky: { params: { hueBase: 0.52, hueSpread: 0.16, verticalBias: 0.53, radialStrength: 0.5 } },
          auroraRibbon: { params: { ribbonCount: 4, ribbonWidth: 0.31, turbulence: 0.37, driftSpeed: 0.3, ribbonTension: 0.52, hueShift: 0.02, alpha: 0.71 } },
          bloomGlow: { params: { bloomStrength: 0.43, threshold: 0.47, glowRadius: 0.49, glowSoftness: 0.57 } },
          blendStack: { params: { masterBrightness: 1.01, masterContrast: 1.12, gradientOpacity: 0.96, ribbonOpacity: 0.9 } }
        }
      }
    },
    {
      id: 'preset-latent-pulse',
      name: 'Latent Pulse',
      description: 'High ribbon count profile with animated movement.',
      patch: {
        quality: 'high',
        modules: {
          auroraRibbon: { params: { ribbonCount: 7, ribbonWidth: 0.21, turbulence: 0.48, driftSpeed: 0.44, ribbonTension: 0.35, hueShift: 0.12, alpha: 0.7 } },
          bloomGlow: { params: { bloomStrength: 0.45, threshold: 0.38, glowRadius: 0.62, glowSoftness: 0.65 } },
          timeMotion: { params: { globalSpeed: 1.2, timeWarp: 0.12 } }
        }
      }
    },
    {
      id: 'preset-aquifer-light',
      name: 'Aquifer Light',
      description: 'Soft, low-contrast ambience with broad gradients.',
      patch: {
        quality: 'medium',
        modules: {
          gradientSky: { params: { hueBase: 0.47, hueSpread: 0.25, verticalBias: 0.44, radialStrength: 0.66 } },
          auroraRibbon: { params: { ribbonCount: 3, ribbonWidth: 0.39, turbulence: 0.29, driftSpeed: 0.19, ribbonTension: 0.46, hueShift: 0.03, alpha: 0.58 } },
          bloomGlow: { params: { bloomStrength: 0.31, threshold: 0.63, glowRadius: 0.32, glowSoftness: 0.48 } },
          blendStack: { params: { masterBrightness: 1.08, masterContrast: 0.95, gradientOpacity: 1, ribbonOpacity: 0.75 } }
        }
      }
    },
    {
      id: 'preset-neon-fjord',
      name: 'Neon Fjord',
      description: 'Sharper bloom and heightened contrast for drama.',
      patch: {
        quality: 'high',
        modules: {
          gradientSky: { params: { hueBase: 0.58, hueSpread: 0.11, verticalBias: 0.57, radialStrength: 0.45 } },
          auroraRibbon: { params: { ribbonCount: 5, ribbonWidth: 0.27, turbulence: 0.44, driftSpeed: 0.36, ribbonTension: 0.38, hueShift: -0.12, alpha: 0.8 } },
          bloomGlow: { params: { bloomStrength: 0.6, threshold: 0.35, glowRadius: 0.65, glowSoftness: 0.7 } },
          blendStack: { params: { masterBrightness: 0.95, masterContrast: 1.28, gradientOpacity: 0.92, ribbonOpacity: 1 } }
        }
      }
    },
    {
      id: 'preset-meridian-breath',
      name: 'Meridian Breath',
      description: 'Meditative tempo with slow harmonic movements.',
      patch: {
        quality: 'medium',
        modules: {
          gradientSky: { params: { hueBase: 0.5, hueSpread: 0.14, verticalBias: 0.63, radialStrength: 0.36 } },
          auroraRibbon: { params: { ribbonCount: 4, ribbonWidth: 0.33, turbulence: 0.23, driftSpeed: 0.14, ribbonTension: 0.58, hueShift: 0, alpha: 0.62 } },
          bloomGlow: { params: { bloomStrength: 0.29, threshold: 0.57, glowRadius: 0.42, glowSoftness: 0.52 } },
          timeMotion: { params: { globalSpeed: 0.64, timeWarp: -0.08 } }
        }
      }
    },
    {
      id: 'preset-verdant-lumen',
      name: 'Verdant Lumen',
      description: 'Brighter palette with rich radial spread.',
      patch: {
        quality: 'high',
        modules: {
          gradientSky: { params: { hueBase: 0.45, hueSpread: 0.23, verticalBias: 0.5, radialStrength: 0.71 } },
          auroraRibbon: { params: { ribbonCount: 6, ribbonWidth: 0.29, turbulence: 0.34, driftSpeed: 0.33, ribbonTension: 0.5, hueShift: 0.08, alpha: 0.68 } },
          bloomGlow: { params: { bloomStrength: 0.49, threshold: 0.41, glowRadius: 0.57, glowSoftness: 0.64 } },
          blendStack: { params: { masterBrightness: 1.11, masterContrast: 1.06, gradientOpacity: 1, ribbonOpacity: 0.93 } }
        }
      }
    },
    {
      id: 'preset-midnight-shear',
      name: 'Midnight Shear',
      description: 'Low-light tone with deep contrast and focused ribbons.',
      patch: {
        quality: 'low',
        modules: {
          gradientSky: { params: { hueBase: 0.64, hueSpread: 0.08, verticalBias: 0.72, radialStrength: 0.26 } },
          auroraRibbon: { params: { ribbonCount: 3, ribbonWidth: 0.22, turbulence: 0.31, driftSpeed: 0.2, ribbonTension: 0.64, hueShift: -0.19, alpha: 0.67 } },
          bloomGlow: { params: { bloomStrength: 0.23, threshold: 0.66, glowRadius: 0.28, glowSoftness: 0.4 } },
          blendStack: { params: { masterBrightness: 0.83, masterContrast: 1.34, gradientOpacity: 0.88, ribbonOpacity: 0.84 } },
          timeMotion: { params: { globalSpeed: 0.56, timeWarp: -0.18 } }
        }
      }
    }
  ];

  class PresetStore {
    constructor(options) {
      const opts = options || {};
      this.bankKey = opts.bankKey || PRESET_BANK_KEY;
      this.lastStateKey = opts.lastStateKey || LAST_STATE_KEY;
    }

    _readBank() {
      return safeParse(localStorage.getItem(this.bankKey), null);
    }

    _writeBank(bank) {
      localStorage.setItem(this.bankKey, JSON.stringify(bank));
    }

    _normalizeBank(raw) {
      const normalized = {
        version: PRESET_SCHEMA_VERSION,
        updatedAt: Date.now(),
        presets: []
      };

      if (!raw || typeof raw !== 'object') {
        return normalized;
      }

      const sourcePresets = Array.isArray(raw.presets) ? raw.presets : [];
      normalized.presets = sourcePresets
        .map((preset) => this._normalizePreset(preset))
        .filter(Boolean);

      return normalized;
    }

    _normalizePreset(preset) {
      if (!preset || typeof preset !== 'object') return null;

      const id = String(preset.id || `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const name = String(preset.name || '').trim();
      if (!name) return null;

      const state = preset.state && typeof preset.state === 'object'
        ? deepClone(preset.state)
        : null;
      if (!state) return null;

      return {
        id,
        name,
        description: String(preset.description || ''),
        createdAt: Number.isFinite(preset.createdAt) ? preset.createdAt : Date.now(),
        updatedAt: Number.isFinite(preset.updatedAt) ? preset.updatedAt : Date.now(),
        builtIn: preset.builtIn === true,
        state,
        schemaVersion: Number.isFinite(preset.schemaVersion) ? preset.schemaVersion : PRESET_SCHEMA_VERSION
      };
    }

    _ensureCuratedDefaults() {
      const rawBank = this._readBank();
      const bank = this._normalizeBank(rawBank);
      const existingIds = new Set(bank.presets.map((preset) => preset.id));
      let changed = false;

      CuratedPresets.forEach((curated) => {
        if (existingIds.has(curated.id)) return;
        changed = true;
        bank.presets.push({
          id: curated.id,
          name: curated.name,
          description: curated.description,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          builtIn: true,
          state: { patch: deepClone(curated.patch) },
          schemaVersion: PRESET_SCHEMA_VERSION
        });
      });

      if (changed || !rawBank) {
        bank.updatedAt = Date.now();
        this._writeBank(bank);
      }
      return bank;
    }

    getBank() {
      return this._ensureCuratedDefaults();
    }

    listPresets() {
      return this.getBank().presets.slice().sort((a, b) => a.name.localeCompare(b.name));
    }

    getPreset(id) {
      const bank = this.getBank();
      return bank.presets.find((preset) => preset.id === id) || null;
    }

    savePreset(name, state, options) {
      const presetName = String(name || '').trim();
      if (!presetName || !state || typeof state !== 'object') {
        return null;
      }

      const opts = options || {};
      const includeSequencer = opts.includeSequencer !== false;
      const normalizedState = deepClone(state);

      if (!includeSequencer && normalizedState.sequencer) {
        delete normalizedState.sequencer;
      }

      const bank = this.getBank();
      const existing = bank.presets.find((preset) => preset.name.toLowerCase() === presetName.toLowerCase() && !preset.builtIn);

      if (existing) {
        existing.state = normalizedState;
        existing.updatedAt = Date.now();
        existing.schemaVersion = PRESET_SCHEMA_VERSION;
        this._writeBank(bank);
        return existing;
      }

      const nextPreset = {
        id: `preset-user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: presetName,
        description: String(opts.description || ''),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        builtIn: false,
        state: normalizedState,
        schemaVersion: PRESET_SCHEMA_VERSION
      };

      bank.presets.push(nextPreset);
      bank.updatedAt = Date.now();
      this._writeBank(bank);
      return nextPreset;
    }

    deletePreset(id) {
      const bank = this.getBank();
      const before = bank.presets.length;
      bank.presets = bank.presets.filter((preset) => !(preset.id === id && !preset.builtIn));
      if (bank.presets.length === before) return false;
      bank.updatedAt = Date.now();
      this._writeBank(bank);
      return true;
    }

    saveLastState(state) {
      if (!state || typeof state !== 'object') return;
      const payload = {
        version: PRESET_SCHEMA_VERSION,
        updatedAt: Date.now(),
        state: deepClone(state)
      };
      localStorage.setItem(this.lastStateKey, JSON.stringify(payload));
    }

    loadLastState() {
      const payload = safeParse(localStorage.getItem(this.lastStateKey), null);
      if (!payload || !payload.state || typeof payload.state !== 'object') {
        return null;
      }
      return deepClone(payload.state);
    }

    exportPayload() {
      return {
        version: PRESET_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        presetBank: this.getBank(),
        lastState: safeParse(localStorage.getItem(this.lastStateKey), null)
      };
    }

    importPayload(payload, options) {
      const opts = options || {};
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid visual synth import payload');
      }

      const incomingBank = this._normalizeBank(payload.presetBank || payload);
      const existing = this.getBank();

      if (opts.merge === false) {
        this._writeBank(incomingBank);
      } else {
        const byId = new Map();
        existing.presets.forEach((preset) => byId.set(preset.id, preset));
        incomingBank.presets.forEach((preset) => byId.set(preset.id, preset));

        const merged = {
          version: PRESET_SCHEMA_VERSION,
          updatedAt: Date.now(),
          presets: Array.from(byId.values())
        };

        this._writeBank(merged);
      }

      if (payload.lastState && payload.lastState.state) {
        localStorage.setItem(this.lastStateKey, JSON.stringify(payload.lastState));
      }

      return this.getBank();
    }

    validateImportShape(payload) {
      if (!payload || typeof payload !== 'object') return false;
      const version = Number.isFinite(payload.version) ? payload.version : PRESET_SCHEMA_VERSION;
      if (version > PRESET_SCHEMA_VERSION) return false;
      if (payload.presetBank && typeof payload.presetBank !== 'object') return false;
      return true;
    }
  }

  global.PRESET_SCHEMA_VERSION = PRESET_SCHEMA_VERSION;
  global.PresetStore = PresetStore;
  global.CuratedPresets = CuratedPresets;
  global.VisualSynthPresetKeys = {
    PRESET_BANK_KEY,
    LAST_STATE_KEY
  };
})(window);
