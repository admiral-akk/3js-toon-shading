/**
 * It takes a genius to read through and understand this code.
 *
 * Thankfully, it only takes an idiot to write it, so I'm making progress.
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { FontLoader } from "three/addons/loaders/FontLoader.js";

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
 * Input Handler
 * - Tracks mouse/keyboard and keeps some more useful facts about what's active?
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

class FontManager {
  constructor(loadingManager) {
    this.fontLoader = new FontLoader(loadingManager);

    this.fonts = new Map();
    this.load = (path) => {
      this.fontLoader.load(path, (font) => {
        this.fonts.set(path, font);
      });
    };
    this.get = (path) => this.fonts.get(path);
  }
}

class TextureManager {
  constructor(loadingManager) {
    this.textureLoader = new THREE.TextureLoader(loadingManager);

    this.load = (path, config = {}) => {
      const texture = this.textureLoader.load(path);
      for (const param in config) {
        texture[`${param}`] = config.param;
      }
      return texture;
    };
  }
}

class AudioManager {
  constructor(loadingManager) {
    this.audioLoader = new THREE.AudioLoader(loadingManager);
    this.audioPool = [];
    this.buffers = new Map();

    this.load = (path) => {
      this.audioLoader.load(path, (buffer) => {
        this.buffers.set(path, buffer);
      });
    };

    this.play = (path, listener) => {
      if (!this.buffers.has(path)) {
        return;
      }
      const buffer = this.buffers.get(path);
      const audio = this.audioPool.filter((audio) => !audio.isPlaying).pop();
      if (!audio) {
        audio = new THREE.Audio(listener);
      }
      audio.setBuffer(buffer);
      audio.play();
    };
  }
}

class ModelManager {
  constructor(loadingManager) {
    const dracoLoader = new DRACOLoader(loadingManager);
    const gltfLoader = new GLTFLoader(loadingManager);
    gltfLoader.setDRACOLoader(dracoLoader);
    dracoLoader.setDecoderPath("./draco/gltf/");

    this.models = new Map();

    this.load = (path, material = null) => {
      gltfLoader.load(path, (data) => {
        const model = data.scene;
        if (material) {
          model.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
              child.material = material;
            }
          });
        }
        model.animations = data.animations;
        models.set(path, model);
      });
    };

    this.get = (path) => {
      if (!this.models.has(path)) {
        return null;
      }
      const rawModel = this.models.get(path);

      const model = SkeletonUtils.clone(rawModel);
      if (rawModel.animations) {
        model.mixer = new THREE.AnimationMixer(model);
        model.mixer.clips = rawModel.animations;
        model.mixer.playAnimation = (name, loopMode = THREE.LoopOnce) => {
          model.mixer.stopAllAction();
          const action = model.mixer.clipAction(name);
          action.setLoop(loopMode);
          action.play();
        };
      }
      return model;
    };
  }
}

/**
 * Core objects
 */
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

class RenderManager {
  constructor() {
    const canvas = document.querySelector("canvas.webgl");
    this.scene = new THREE.Scene();
    const camera = generateCamera(cameraConfig);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setClearColor("#201919");
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(this.scene, camera);
    composer.addPass(renderPass);

    this.renderer = renderer;
    this.composer = composer;
    this.camera = camera;
  }
}

export class KubEngine {
  constructor() {
    THREE.Cache.enabled = true;
    const loadingManager = new THREE.LoadingManager();
    loadingManager.hasFiles = false;
    loadingManager.onStart = () => (loadingManager.hasFiles = true);
    const textureManager = new TextureManager(loadingManager);
    const fontManager = new FontManager(loadingManager);
    const audioManager = new AudioManager(loadingManager);
    const modelManager = new ModelManager(loadingManager);
    const renderManager = new RenderManager();

    this.loadingManager = loadingManager;
    this.loadTexture = textureManager.load;
    this.loadFont = fontManager.load;
    this.getFont = fontManager.get;
    this.loadSound = audioManager.load;
    this.playSound = audioManager.play;
    this.loadModel = modelManager.load;
    this.getModel = modelManager.get;
    this.scene = renderManager.scene;
    this.renderer = renderManager.renderer;
    this.composer = renderManager.composer;
    this.camera = renderManager.camera;
  }
}
