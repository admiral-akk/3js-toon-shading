import * as THREE from "three";

Math.clamp = (num, min, max) => Math.max(min, Math.min(num, max));

Math.randomRange = (min = 0, max = 1) => Math.random() * (max - min) + min;

export const partition = (array, filterFn) => {
  const pass = [];
  const fail = [];
  array.forEach((e, idx, arr) => (filterFn(e, idx, arr) ? pass : fail).push(e));
  return [pass, fail];
};

export const customUniform = (value, config = { attachDebug: false }) => {
  const uniform = new THREE.Uniform(value);
  if (config.attachDebug) {
    uniform.attachDebug = config.attachDebug;
  }
  return uniform;
};
