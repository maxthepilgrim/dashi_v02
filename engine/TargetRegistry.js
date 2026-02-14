(function (global) {
  'use strict';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clamp01(value) {
    return clamp(value, 0, 1);
  }

  class TargetRegistry {
    constructor() {
      this._targets = new Map();
      this._order = [];
      this._baseValues = new Map();
    }

    register(definition) {
      if (!definition || typeof definition.id !== 'string' || !definition.id.trim()) {
        throw new Error('TargetRegistry.register requires a valid target id');
      }

      const id = definition.id.trim();
      const min = Number.isFinite(definition.min) ? definition.min : 0;
      const max = Number.isFinite(definition.max) ? definition.max : 1;
      const defaultValue = Number.isFinite(definition.defaultValue)
        ? definition.defaultValue
        : min;

      const normalizedDefinition = {
        id: id,
        label: definition.label || id,
        moduleId: definition.moduleId || 'global',
        min: Math.min(min, max),
        max: Math.max(min, max),
        defaultValue: clamp(defaultValue, Math.min(min, max), Math.max(min, max)),
        curve: definition.curve === 'exp' ? 'exp' : 'linear',
        unit: definition.unit || ''
      };

      const exists = this._targets.has(id);
      this._targets.set(id, normalizedDefinition);
      if (!exists) {
        this._order.push(id);
      }
      if (!this._baseValues.has(id)) {
        this._baseValues.set(id, normalizedDefinition.defaultValue);
      }

      return normalizedDefinition;
    }

    registerMany(definitions) {
      if (!Array.isArray(definitions)) {
        return [];
      }
      return definitions.map((definition) => this.register(definition));
    }

    has(id) {
      return this._targets.has(id);
    }

    get(id) {
      return this._targets.get(id) || null;
    }

    getAll() {
      return this._order
        .map((id) => this._targets.get(id))
        .filter(Boolean);
    }

    getByModule(moduleId) {
      return this.getAll().filter((target) => target.moduleId === moduleId);
    }

    setBaseValue(id, value) {
      const target = this.get(id);
      if (!target) {
        return null;
      }
      const clamped = this.clampValue(id, value);
      this._baseValues.set(id, clamped);
      return clamped;
    }

    setBaseValues(map) {
      if (!map || typeof map !== 'object') {
        return;
      }
      Object.keys(map).forEach((id) => {
        this.setBaseValue(id, map[id]);
      });
    }

    getBaseValue(id) {
      if (!this._baseValues.has(id)) {
        const target = this.get(id);
        return target ? target.defaultValue : null;
      }
      return this._baseValues.get(id);
    }

    getBaseValuesObject() {
      const out = {};
      this._order.forEach((id) => {
        out[id] = this.getBaseValue(id);
      });
      return out;
    }

    resetBaseValues() {
      this._baseValues.clear();
      this._order.forEach((id) => {
        const target = this._targets.get(id);
        if (target) {
          this._baseValues.set(id, target.defaultValue);
        }
      });
    }

    clampValue(id, value) {
      const target = this.get(id);
      if (!target) {
        return value;
      }
      return clamp(Number(value), target.min, target.max);
    }

    toNormalized(id, value) {
      const target = this.get(id);
      if (!target) {
        return clamp01(Number(value));
      }

      const linear = (clamp(Number(value), target.min, target.max) - target.min) /
        (target.max - target.min || 1);

      if (target.curve === 'exp') {
        return Math.sqrt(clamp01(linear));
      }
      return clamp01(linear);
    }

    fromNormalized(id, normalized) {
      const target = this.get(id);
      if (!target) {
        return clamp01(Number(normalized));
      }

      const clamped = clamp01(Number(normalized));
      const curved = target.curve === 'exp' ? clamped * clamped : clamped;
      return target.min + (target.max - target.min) * curved;
    }
  }

  global.TargetRegistry = TargetRegistry;
})(window);
