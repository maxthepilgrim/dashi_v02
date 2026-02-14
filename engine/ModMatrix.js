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

  function toBipolar(raw) {
    const value = Number(raw);
    if (!Number.isFinite(value)) return 0;
    if (value >= 0 && value <= 1) {
      return clamp11(value * 2 - 1);
    }
    return clamp11(value);
  }

  function toUnipolar(raw) {
    const value = Number(raw);
    if (!Number.isFinite(value)) return 0;
    if (value >= -1 && value <= 1) {
      return clamp01((value + 1) * 0.5);
    }
    return clamp01(value);
  }

  function quantize(value, steps, min, max) {
    if (!Number.isFinite(steps) || steps <= 1) return value;
    const clamped = clamp(value, min, max);
    const unit = (clamped - min) / (max - min || 1);
    const snapped = Math.round(unit * (steps - 1)) / (steps - 1);
    return min + snapped * (max - min);
  }

  class ModMatrix {
    constructor() {
      this._assignments = new Map();
      this._order = [];
      this._smoothingState = new Map();
    }

    _normalizeAssignment(assignment) {
      if (!assignment || typeof assignment !== 'object') {
        throw new Error('Invalid modulation assignment');
      }

      const id = assignment.id || `mod-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      return {
        id,
        sourceId: String(assignment.sourceId || ''),
        targetId: String(assignment.targetId || ''),
        amount: Number.isFinite(assignment.amount) ? assignment.amount : 0,
        polarity: assignment.polarity === 'unipolar' ? 'unipolar' : 'bipolar',
        smoothing: clamp01(Number.isFinite(assignment.smoothing) ? assignment.smoothing : 0),
        quantizeSteps: Number.isFinite(assignment.quantizeSteps) ? Math.max(0, Math.floor(assignment.quantizeSteps)) : 0,
        enabled: assignment.enabled !== false
      };
    }

    setAssignments(assignments) {
      this.clear();
      if (!Array.isArray(assignments)) {
        return;
      }
      assignments.forEach((assignment) => this.addAssignment(assignment));
    }

    addAssignment(assignment) {
      const normalized = this._normalizeAssignment(assignment);
      const exists = this._assignments.has(normalized.id);
      this._assignments.set(normalized.id, normalized);
      if (!exists) {
        this._order.push(normalized.id);
      }
      return normalized;
    }

    updateAssignment(id, patch) {
      if (!this._assignments.has(id)) {
        return null;
      }
      const next = this._normalizeAssignment({
        ...this._assignments.get(id),
        ...patch,
        id
      });
      this._assignments.set(id, next);
      return next;
    }

    removeAssignment(id) {
      if (!this._assignments.has(id)) {
        return false;
      }
      this._assignments.delete(id);
      this._smoothingState.delete(id);
      this._order = this._order.filter((entryId) => entryId !== id);
      return true;
    }

    clear() {
      this._assignments.clear();
      this._smoothingState.clear();
      this._order = [];
    }

    listAssignments() {
      return this._order
        .map((id) => this._assignments.get(id))
        .filter(Boolean);
    }

    getAssignmentsForTarget(targetId) {
      return this.listAssignments().filter((assignment) => assignment.targetId === targetId);
    }

    resolve(targetRegistry, sourceSignals, deltaTimeSec) {
      const assignments = this.listAssignments();
      const targetDefs = targetRegistry.getAll();
      const aggregate = new Map();

      targetDefs.forEach((target) => aggregate.set(target.id, 0));

      assignments.forEach((assignment) => {
        if (!assignment.enabled) return;
        if (!targetRegistry.has(assignment.targetId)) return;

        const rawSignal = sourceSignals[assignment.sourceId];
        if (!Number.isFinite(rawSignal)) return;

        let signal = assignment.polarity === 'unipolar'
          ? toUnipolar(rawSignal)
          : toBipolar(rawSignal);

        if (assignment.quantizeSteps > 1) {
          if (assignment.polarity === 'unipolar') {
            signal = quantize(signal, assignment.quantizeSteps, 0, 1);
          } else {
            signal = quantize(signal, assignment.quantizeSteps, -1, 1);
          }
        }

        const previous = this._smoothingState.has(assignment.id)
          ? this._smoothingState.get(assignment.id)
          : signal;

        const smoothing = clamp01(assignment.smoothing);
        const alpha = smoothing <= 0
          ? 1
          : 1 - Math.exp(-Math.max(0.0001, deltaTimeSec || 0.016) / (0.001 + smoothing * 0.5));

        const smoothSignal = previous + (signal - previous) * alpha;
        this._smoothingState.set(assignment.id, smoothSignal);

        const contribution = smoothSignal * assignment.amount;
        aggregate.set(
          assignment.targetId,
          (aggregate.get(assignment.targetId) || 0) + contribution
        );
      });

      const resolved = {};

      targetDefs.forEach((target) => {
        const baseValue = targetRegistry.getBaseValue(target.id);
        const baseNormalized = targetRegistry.toNormalized(target.id, baseValue);
        const modulationNormalized = aggregate.get(target.id) || 0;
        const finalNormalized = clamp01(baseNormalized + modulationNormalized);
        resolved[target.id] = targetRegistry.clampValue(
          target.id,
          targetRegistry.fromNormalized(target.id, finalNormalized)
        );
      });

      return resolved;
    }
  }

  global.ModMatrix = ModMatrix;
})(window);
