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
    this.fontLoader = new THREE.TextureLoader(loadingManager);

    this.fonts = new Map();
    this.load = (path) => {
      this.fontLoader.load(`path`, (font) => {
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

export class KubEngine {
  constructor() {
    THREE.Cache.enabled = true;
    const loadingManager = new THREE.LoadingManager();
    loadingManager.hasFiles = false;
    loadingManager.onStart = () => (loadingManager.hasFiles = true);
    const textureManager = new TextureManager(loadingManager);
    const fontManager = new FontManager(loadingManager);
    const audioManager = new AudioManager(loadingManager);

    this.audioManager = audioManager;
    this.loadTexture = textureManager.load;
    this.loadFont = fontManager.load;
    this.getFont = fontManager.get;
    this.loadSound = audioManager.load;
    this.playSound = audioManager.play;
  }
}
