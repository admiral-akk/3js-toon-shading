/**
 * It takes a genius to read through and understand this code.
 *
 * Thankfully, it only takes an idiot to write it, so I'm making progress.
 */

import * as THREE from "three";
import Stats from "stats-js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

//

/**
 * There are going to be a few components here.
 *
 * Infrastructure logic
 * - stuff like fetching data from external sources.
 * - Exists for the lifetime of the program.
 *
 *
 * Game Config
 * - data that is loaded to define the game itself
 * - HP values, enemy types, map looks like?
 *
 * Game State
 * - data that describes the current state of the game
 * - where is the player standing? what have they done, etc
 *
 * Renderer
 * - controls what goes on the screen, the camera, etc.
 *
 * Editor Mode
 * - Can mutate Game Config
 *
 * Game Mode
 * - Can mutate Game State
 */

// things should be broken out into editor and game logic
// within that,
/**
 * Helpers
 */

Math.clamp = (num, min, max) => Math.max(min, Math.min(num, max));

Math.randomRange = (min = 0, max = 1) => Math.random() * (max - min) + min;

export const partition = (array, filterFn) => {
  const pass = [];
  const fail = [];
  array.forEach((e, idx, arr) => (filterFn(e, idx, arr) ? pass : fail).push(e));
  return [pass, fail];
};

const perspectiveConfig = {
  type: "perspective",
  fov: 75,
  zoom: 5,
};

const orthographicConfig = {
  type: "orthographic",
  zoom: 10,
};

const cameraConfig = {
  subtypeConfig: orthographicConfig,
  aspectRatio: 16 / 9,
  near: 0.001,
  position: new THREE.Vector3(5, 7, 5),
};

export const customUniform = (value, config = { attachDebug: false }) => {
  const uniform = new THREE.Uniform(value);
  if (config.attachDebug) {
    uniform.attachDebug = config.attachDebug;
  }
  return uniform;
};

const generateCamera = ({ aspectRatio, subtypeConfig, near, position }) => {
  let camera;
  switch (subtypeConfig.type) {
    case "perspective":
      camera = new THREE.PerspectiveCamera(
        subtypeConfig.fov,
        cameraConfig.aspectRatio
      );
      camera.customZoom = subtypeConfig.zoom;
      break;
    case "orthographic":
      const height = subtypeConfig.zoom;
      const width = aspectRatio * height;

      camera = new THREE.OrthographicCamera(
        -width / 2,
        width / 2,
        height / 2,
        -height / 2,
        near
      );
      camera.customZoom = subtypeConfig.zoom;
      break;
    default:
      throw new Error("unknown camera type");
  }
  camera.position.x = position.x;
  camera.position.y = position.y;
  camera.position.z = position.z;
  camera.aspect = aspectRatio;
  camera.near = near;
  camera.lookAt(new THREE.Vector3());
  return camera;
};

export class KubEngine {
  constructor() {
    this.canvas = document.querySelector("canvas.webgl");
    this.container = document.querySelector("div.container");
    this.canvasContainer = document.querySelector("div.relative");
    this.ui = document.querySelector("div.overlay");
    const listener = new THREE.AudioListener();
    const camera = generateCamera(cameraConfig);
    camera.add(listener);
    this.camera = camera;
    this.listener = listener;
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    renderer.setClearColor("#201919");
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(renderPass);
    this.composer = composer;
    this.renderPass = renderPass;
    composer.addPass(renderPass);
    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
    this.stats = stats;
  }
}
