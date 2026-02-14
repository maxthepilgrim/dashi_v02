(function (global) {
  'use strict';

  const SUPPORTED_STEP_LENGTHS = [8, 16, 32];
  const PATTERN_STORAGE_KEY = 'visualSynthSequencerPatterns';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clamp01(value) {
    return clamp(value, 0, 1);
  }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch (error) {
      return fallback;
    }
  }

  function createSteps(length) {
    const steps = [];
    for (let i = 0; i < length; i += 1) {
      steps.push({
        value: i % 4 === 0 ? 0.85 : 0,
        probability: 1,
        enabled: i % 4 === 0
      });
    }
    return steps;
  }

  function normalizeStep(step) {
    return {
      value: clamp01(Number.isFinite(step && step.value) ? step.value : 0),
      probability: clamp01(Number.isFinite(step && step.probability) ? step.probability : 1),
      enabled: step ? step.enabled !== false : false
    };
  }

  class StepSequencer {
    constructor(options) {
      const config = options || {};
      this.bpm = clamp(Number.isFinite(config.bpm) ? config.bpm : 112, 20, 240);
      this.swing = clamp(Number.isFinite(config.swing) ? config.swing : 0, 0, 60);
      this.stepLength = SUPPORTED_STEP_LENGTHS.includes(config.stepLength) ? config.stepLength : 16;
      this.currentStep = 0;
      this.playing = Boolean(config.playing);
      this.lanes = [];
      this._accumulator = 0;
      this._lastTimeSec = null;
      this._laneClipboard = null;

      const laneCount = Number.isFinite(config.laneCount) ? Math.max(1, Math.floor(config.laneCount)) : 3;
      if (Array.isArray(config.lanes) && config.lanes.length > 0) {
        this.loadLanes(config.lanes);
      } else {
        for (let laneIndex = 0; laneIndex < laneCount; laneIndex += 1) {
          this.lanes.push(this._createLane(laneIndex));
        }
      }
    }

    _createLane(index) {
      return {
        id: `seq-lane-${index + 1}`,
        label: `Lane ${index + 1}`,
        targetId: '',
        amount: 0.35,
        smoothing: 0.2,
        mute: false,
        solo: false,
        steps: createSteps(this.stepLength),
        currentTarget: 0,
        currentValue: 0
      };
    }

    _stepDuration(stepIndex) {
      const base = 60 / this.bpm / 4;
      const swingFactor = (this.swing / 100) * 0.5;
      return stepIndex % 2 === 0
        ? base * (1 - swingFactor)
        : base * (1 + swingFactor);
    }

    _getLaneById(laneId) {
      return this.lanes.find((lane) => lane.id === laneId) || null;
    }

    _advanceStep() {
      this.currentStep = (this.currentStep + 1) % this.stepLength;
      const hasSolo = this.lanes.some((lane) => lane.solo);

      this.lanes.forEach((lane) => {
        const step = lane.steps[this.currentStep] || { value: 0, probability: 1, enabled: false };

        if (lane.mute) {
          lane.currentTarget = 0;
          return;
        }

        if (hasSolo && !lane.solo) {
          lane.currentTarget = 0;
          return;
        }

        if (!step.enabled) {
          lane.currentTarget = 0;
          return;
        }

        const probability = clamp01(step.probability);
        const pass = Math.random() <= probability;
        lane.currentTarget = pass ? clamp01(step.value) : 0;
      });
    }

    _smoothLanes(deltaTimeSec) {
      this.lanes.forEach((lane) => {
        const smoothing = clamp01(lane.smoothing);
        const alpha = smoothing <= 0
          ? 1
          : 1 - Math.exp(-Math.max(deltaTimeSec, 0.0001) / (0.001 + smoothing * 0.45));
        lane.currentValue = lane.currentValue + (lane.currentTarget - lane.currentValue) * alpha;
      });
    }

    _signals() {
      const map = {};
      this.lanes.forEach((lane) => {
        map[lane.id] = clamp01(lane.currentValue);
      });
      return map;
    }

    setTransport(next) {
      if (!next || typeof next !== 'object') return;

      if (Number.isFinite(next.bpm)) {
        this.bpm = clamp(next.bpm, 20, 240);
      }
      if (Number.isFinite(next.swing)) {
        this.swing = clamp(next.swing, 0, 60);
      }
      if (SUPPORTED_STEP_LENGTHS.includes(next.stepLength)) {
        this.setStepLength(next.stepLength);
      }
      if (typeof next.playing === 'boolean') {
        if (next.playing) this.play();
        else this.pause();
      }
    }

    play(nowSec) {
      this.playing = true;
      this._lastTimeSec = Number.isFinite(nowSec) ? nowSec : null;
    }

    pause() {
      this.playing = false;
      this._lastTimeSec = null;
    }

    toggle(nowSec) {
      if (this.playing) {
        this.pause();
      } else {
        this.play(nowSec);
      }
      return this.playing;
    }

    setStepLength(stepLength) {
      if (!SUPPORTED_STEP_LENGTHS.includes(stepLength)) {
        return;
      }
      const previousLength = this.stepLength;
      this.stepLength = stepLength;
      this.currentStep = this.currentStep % stepLength;

      this.lanes.forEach((lane) => {
        const previousSteps = lane.steps.slice();
        const nextSteps = [];

        for (let index = 0; index < stepLength; index += 1) {
          const mappedIndex = Math.floor((index / stepLength) * previousLength);
          nextSteps.push(normalizeStep(previousSteps[mappedIndex] || { value: 0, probability: 1, enabled: false }));
        }

        lane.steps = nextSteps;
      });
    }

    setLanePatch(laneId, patch) {
      const lane = this._getLaneById(laneId);
      if (!lane) return null;

      if (typeof patch.targetId === 'string') lane.targetId = patch.targetId;
      if (Number.isFinite(patch.amount)) lane.amount = clamp(patch.amount, -1, 1);
      if (Number.isFinite(patch.smoothing)) lane.smoothing = clamp01(patch.smoothing);
      if (typeof patch.mute === 'boolean') lane.mute = patch.mute;
      if (typeof patch.solo === 'boolean') lane.solo = patch.solo;

      return lane;
    }

    setStep(laneId, stepIndex, patch) {
      const lane = this._getLaneById(laneId);
      if (!lane) return null;
      if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= this.stepLength) return null;

      const current = normalizeStep(lane.steps[stepIndex]);
      lane.steps[stepIndex] = {
        value: Number.isFinite(patch.value) ? clamp01(patch.value) : current.value,
        probability: Number.isFinite(patch.probability) ? clamp01(patch.probability) : current.probability,
        enabled: typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled
      };

      return lane.steps[stepIndex];
    }

    randomizeLane(laneId, density) {
      const lane = this._getLaneById(laneId);
      if (!lane) return null;
      const activeDensity = clamp01(Number.isFinite(density) ? density : 0.45);

      lane.steps = lane.steps.map(() => {
        const enabled = Math.random() < activeDensity;
        return {
          value: enabled ? clamp01(Math.random() * 0.95 + 0.05) : 0,
          probability: enabled ? clamp01(0.55 + Math.random() * 0.45) : 1,
          enabled
        };
      });

      return lane;
    }

    copyLane(laneId) {
      const lane = this._getLaneById(laneId);
      if (!lane) return null;
      this._laneClipboard = JSON.parse(JSON.stringify(lane));
      return this._laneClipboard;
    }

    pasteLane(laneId) {
      const lane = this._getLaneById(laneId);
      if (!lane || !this._laneClipboard) return null;

      const copied = JSON.parse(JSON.stringify(this._laneClipboard));
      lane.steps = copied.steps.map((step) => normalizeStep(step));
      lane.amount = clamp(copied.amount, -1, 1);
      lane.smoothing = clamp01(copied.smoothing);
      lane.targetId = copied.targetId || lane.targetId;
      lane.mute = false;
      lane.solo = false;
      return lane;
    }

    update(nowSec) {
      const now = Number.isFinite(nowSec) ? nowSec : performance.now() / 1000;
      if (!Number.isFinite(this._lastTimeSec)) {
        this._lastTimeSec = now;
      }

      let deltaTimeSec = Math.max(0, now - this._lastTimeSec);
      this._lastTimeSec = now;

      if (!this.playing) {
        this._smoothLanes(deltaTimeSec);
        return this._signals();
      }

      deltaTimeSec = Math.min(deltaTimeSec, 1.0);
      this._accumulator += deltaTimeSec;

      let guard = 0;
      while (this._accumulator >= this._stepDuration(this.currentStep) && guard < 256) {
        const duration = this._stepDuration(this.currentStep);
        this._accumulator -= duration;
        this._advanceStep();
        guard += 1;
      }

      this._smoothLanes(deltaTimeSec);
      return this._signals();
    }

    getPatternState() {
      return {
        version: 1,
        bpm: this.bpm,
        swing: this.swing,
        stepLength: this.stepLength,
        currentStep: this.currentStep,
        playing: this.playing,
        lanes: this.lanes.map((lane) => ({
          id: lane.id,
          label: lane.label,
          targetId: lane.targetId,
          amount: lane.amount,
          smoothing: lane.smoothing,
          mute: lane.mute,
          solo: lane.solo,
          steps: lane.steps.map((step) => normalizeStep(step))
        }))
      };
    }

    loadLanes(lanes) {
      if (!Array.isArray(lanes) || lanes.length === 0) {
        return;
      }

      this.lanes = lanes.map((lane, index) => {
        const normalizedLane = this._createLane(index);
        normalizedLane.id = lane.id || normalizedLane.id;
        normalizedLane.label = lane.label || normalizedLane.label;
        normalizedLane.targetId = lane.targetId || '';
        normalizedLane.amount = Number.isFinite(lane.amount) ? clamp(lane.amount, -1, 1) : normalizedLane.amount;
        normalizedLane.smoothing = Number.isFinite(lane.smoothing) ? clamp01(lane.smoothing) : normalizedLane.smoothing;
        normalizedLane.mute = lane.mute === true;
        normalizedLane.solo = lane.solo === true;

        if (Array.isArray(lane.steps) && lane.steps.length > 0) {
          const mapped = [];
          for (let stepIndex = 0; stepIndex < this.stepLength; stepIndex += 1) {
            const sourceIndex = Math.floor((stepIndex / this.stepLength) * lane.steps.length);
            mapped.push(normalizeStep(lane.steps[sourceIndex]));
          }
          normalizedLane.steps = mapped;
        }

        return normalizedLane;
      });
    }

    loadPatternState(patternState) {
      if (!patternState || typeof patternState !== 'object') {
        return false;
      }

      this.setTransport({
        bpm: patternState.bpm,
        swing: patternState.swing,
        stepLength: patternState.stepLength,
        playing: patternState.playing
      });

      if (Array.isArray(patternState.lanes) && patternState.lanes.length > 0) {
        this.loadLanes(patternState.lanes);
      }

      this.currentStep = Number.isInteger(patternState.currentStep)
        ? Math.max(0, Math.min(this.stepLength - 1, patternState.currentStep))
        : 0;

      this._accumulator = 0;
      return true;
    }

    savePattern(name) {
      const patternName = String(name || '').trim();
      if (!patternName) return false;
      try {
        const existing = safeParse(localStorage.getItem(PATTERN_STORAGE_KEY), {});
        existing[patternName] = this.getPatternState();
        localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify(existing));
        return true;
      } catch (error) {
        return false;
      }
    }

    loadPattern(name) {
      const patternName = String(name || '').trim();
      if (!patternName) return false;
      try {
        const existing = safeParse(localStorage.getItem(PATTERN_STORAGE_KEY), {});
        if (!existing[patternName]) return false;
        return this.loadPatternState(existing[patternName]);
      } catch (error) {
        return false;
      }
    }

    listPatterns() {
      try {
        const existing = safeParse(localStorage.getItem(PATTERN_STORAGE_KEY), {});
        return Object.keys(existing).sort();
      } catch (error) {
        return [];
      }
    }
  }

  StepSequencer.SUPPORTED_STEP_LENGTHS = SUPPORTED_STEP_LENGTHS;
  StepSequencer.PATTERN_STORAGE_KEY = PATTERN_STORAGE_KEY;

  global.StepSequencer = StepSequencer;
})(window);
