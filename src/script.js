import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import GUI from "lil-gui";
import { gsap } from "gsap";
import Stats from "stats-js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import loadingVertexShader from "./shaders/loading/vertex.glsl";
import loadingFragmentShader from "./shaders/loading/fragment.glsl";
import matcapVertexShader from "./shaders/matcap/vertex.glsl";
import matcapFragmentShader from "./shaders/matcap/fragment.glsl";
import toonVertexShader from "./shaders/toon/vertex.glsl";
import toonFragmentShader from "./shaders/toon/fragment.glsl";
import bushVertexShader from "./shaders/bush/vertex.glsl";
import bushFragmentShader from "./shaders/bush/fragment.glsl";
import waterVertexShader from "./shaders/water/vertex.glsl";
import waterFragmentShader from "./shaders/water/fragment.glsl";
import groundVertexShader from "./shaders/ground/vertex.glsl";
import groundFragmentShader from "./shaders/ground/fragment.glsl";
import gameData from "./gameData.json";
import { uniform } from "three/examples/jsm/nodes/core/UniformNode";
import { KubEngine } from "./engine.js";

/**
 * Helpers
 */
Math.clamp = (num, min, max) => Math.max(min, Math.min(num, max));

Math.randomRange = (min = 0, max = 1) => Math.random() * (max - min) + min;

const partition = (array, filterFn) => {
  const pass = [];
  const fail = [];
  array.forEach((e, idx, arr) => (filterFn(e, idx, arr) ? pass : fail).push(e));
  return [pass, fail];
};

const _dummyVector = new THREE.Vector3();

const customUniform = (value, config = { attachDebug: false }) => {
  const uniform = new THREE.Uniform(value);
  if (config.attachDebug) {
    uniform.attachDebug = config.attachDebug;
  }
  return uniform;
};

/**
 *
 */

const engine = new KubEngine();

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

const container = document.querySelector("div.container");
const canvasContainer = document.querySelector("div.relative");
const ui = document.querySelector("div.overlay");
const canvas = document.querySelector("canvas.webgl");
const listener = new THREE.AudioListener();
const camera = generateCamera(cameraConfig);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
camera.add(listener);
renderer.setClearColor("#201919");
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.add(camera);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
var stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

/**
 * Loader Setup
 */

THREE.Cache.enabled = true;
const loadingManager = new THREE.LoadingManager();
loadingManager.hasFiles = false;
loadingManager.onStart = () => (loadingManager.hasFiles = true);
const dracoLoader = new DRACOLoader(loadingManager);
const audioLoader = new THREE.AudioLoader(loadingManager);
const gltfLoader = new GLTFLoader(loadingManager);
const fontLoader = new FontLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);
dracoLoader.setDecoderPath("./draco/gltf/");

/**
 * Data
 */

const importData = () => {
  return gameData;
};

const exportData = () => {
  var link = document.createElement("a");
  const fileName = "gameData.json";
  var myFile = new Blob([JSON.stringify(gameData)], {
    type: "application/json",
  });
  link.download = fileName;
  link.setAttribute("href", window.URL.createObjectURL(myFile));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Audio
 */

const audioPool = [];
const buffers = new Map();

const loadSound = (name) => {
  audioLoader.load(`./audio/${name}.mp3`, function (buffer) {
    buffers.set(name, buffer);
  });
};

const playSound = (name) => {
  if (!buffers.has(name)) {
    return;
  }
  const buffer = buffers.get(name);
  let audio = audioPool.filter((a) => !a.isPlaying).pop();
  if (!audio) {
    audio = new THREE.Audio(listener);
  }
  audio.setBuffer(buffer);
  audio.play();
};

/**
 * Models
 */

const baseColorTexture = engine.loadTexture("./texture/baseColor.png", {
  flipY: false,
});
baseColorTexture.flipY = false;
const models = new Map();

const loadModel = (name, material) => {
  gltfLoader.load(`./models/${name}.glb`, (data) => {
    const model = data.scene;
    model.traverse(function (child) {
      if (child instanceof THREE.Mesh) {
        child.material = material;
      }
    });
    model.animations = data.animations;
    models.set(name, model);
  });
};

const getModel = (name) => {
  if (!models.has(name)) {
    return null;
  }
  const rawModel = models.get(name);

  const model = SkeletonUtils.clone(rawModel);
  scene.add(model);

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

/**
 * Window size
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  verticalOffset: 0,
  horizontalOffset: 0,
};

const updateZoom = () => {
  const { customZoom, aspect } = camera;
  if (camera.isOrthographicCamera) {
    const height = customZoom;
    const width = aspect * height;
    console.log(customZoom, height, width);

    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
  } else if (camera.isPerspectiveCamera) {
    camera.position.multiplyScalar(customZoom / camera.position.length());
  }
  camera.updateProjectionMatrix();
};

const updateSize = () => {
  if (window.innerHeight * camera.aspect > window.innerWidth) {
    sizes.width = window.innerWidth;
    sizes.height = window.innerWidth / camera.aspect;
    sizes.verticalOffset = (window.innerHeight - sizes.height) / 2;
    sizes.horizontalOffset = 0;
  } else {
    sizes.width = window.innerHeight * camera.aspect;
    sizes.height = window.innerHeight;
    sizes.verticalOffset = 0;
    sizes.horizontalOffset = (window.innerWidth - sizes.width) / 2;
  }
  canvasContainer.style.top = sizes.verticalOffset.toString() + "px";
  canvasContainer.style.left = sizes.horizontalOffset.toString() + "px";

  renderer.setSize(sizes.width, sizes.height);
  composer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
};
updateSize();

/**
 * Input Manager
 */

const inputManager = {
  mousePos: null,
  mouseButtons: null,
  mouseButtonState: null,
};

/**
 * Mouse tracking
 */

const mousePos = (event) => {
  return new THREE.Vector2(
    ((event.clientX - sizes.horizontalOffset) / sizes.width) * 2 - 1,
    -((event.clientY - sizes.verticalOffset) / sizes.height) * 2 + 1
  );
};

/**
 * Event Handling
 */
const eventLog = [];
const loggedEvents = new Set(["pointerdown", "pointerup"]);
const universalEventHandler = (event) => {
  if (loggedEvents.has(event.type)) {
    eventLog.push([timeTracker.elapsedTime, event]);
  }
  switch (event.type) {
    case "keydown":
      if (event.repeat) {
        break;
      }
      if (event.ctrlKey && event.key === "s") {
        event.preventDefault();
        exportData();
      }
      setSelect(event.key);
      break;
    case "keyup":
      break;
    case "resize":
    case "orientationchange":
      updateSize();
      break;
    case "dblclick":
      if (event.target.className !== "webgl") {
        return;
      }
      const fullscreenElement =
        document.fullscreenElement || document.webkitFullscreenElement;

      if (fullscreenElement) {
        document.exitFullscreen();
      } else {
        container.requestFullscreen();
      }
      break;
    case "wheel":
      camera.customZoom = Math.clamp(
        camera.customZoom + event.deltaY / 100,
        1,
        100
      );
      updateZoom();
      break;
    case "pointerdown":
    case "pointerup":
    case "pointermove":
      if (event.target.className !== "webgl") {
        return;
      }
      inputManager.mousePos = mousePos(event);
      inputManager.mouseButtons = event.buttons;
      inputManager.mouseButtonState = event.type;
      if (event.buttons === 1) {
        addCube();
      }
      if (event.buttons === 2) {
        removeCube();
      }
      break;
    default:
      break;
  }
};

const events = new Set();
for (const key in canvas) {
  if (/^on/.test(key)) {
    const eventType = key.substring(2);
    events.add(eventType);
    window.addEventListener(eventType, universalEventHandler);
  }
}

// Capture right clicks.
window.addEventListener(
  "contextmenu",
  (ev) => {
    ev.preventDefault();
    return false;
  },
  false
);

/**
 * Materials
 */
const materials = new Set();
const debugUUIDs = new Set();
const controllers = new Map();
const references = new Map();

const updateDebugGui = (debugObject) => {
  references.forEach((uniformValues, uniformName) => {
    if (controllers.has(uniformName)) {
      controllers.get(uniformName).destroy();
      controllers.delete(uniformName);
    }
    if (uniformName in debugObject) {
      uniformValues.forEach((u) => {
        if (u.value.isColor) {
          u.value = new THREE.Color(debugObject[uniformName]);
        } else {
          u.value = debugObject[uniformName];
        }
      });
    }
    const sampleValue = uniformValues[0].value;
    debugObject[uniformName] = sampleValue;
    if (sampleValue.isColor) {
      const onChange = (newValue) => {
        uniformValues.forEach((uniform) => {
          uniform.value = newValue;
        });
      };
      controllers.set(
        uniformName,
        gui.addColor(debugObject, uniformName).onChange(onChange)
      );
    } else if (
      typeof sampleValue === "boolean" ||
      typeof sampleValue === "number" ||
      sampleValue.length === 2 ||
      sampleValue.length === 3 ||
      sampleValue.length === 4
    ) {
      const onChange = (newValue) => {
        uniformValues.forEach((uniform) => {
          uniform.value = newValue;
        });
      };
      controllers.set(
        uniformName,
        gui
          .add(debugObject, uniformName)
          .onChange(onChange)
          .min(-1)
          .max(1)
          .step(0.05)
      );
    }
  });
};

const registerMaterial = (material) => {
  const { uuid, uniforms, name } = material;
  if (!uniforms) {
    return;
  }
  if (debugUUIDs.has(uuid)) {
    return;
  }
  debugUUIDs.add(material.uuid);
  materials.add(material);

  // Update debug menu
  for (const property in uniforms) {
    const pName = `${property}`;
    if (!uniforms[pName].attachDebug) {
      continue;
    }
    // We mark all of our uniform properties with 'u' to start.
    if (`${property}`[0] === "u") {
      const debugName = `${name}_${pName}`;
      if (!references.has(debugName)) {
        references.set(debugName, []);
      }
      references.get(debugName).push(uniforms[pName]);
    }
  }

  updateDebugGui(gameData.debugObject);
  material.uniforms.uTime = customUniform(0.0);
};

const updateMaterialSet = () => {
  scene.traverse(function (object) {
    if (object.material) registerMaterial(object.material);
  });
};

const toonMaterial = new THREE.ShaderMaterial({
  lights: true,
  vertexShader: toonVertexShader,
  fragmentShader: toonFragmentShader,
  uniforms: {
    ...THREE.UniformsLib.lights,
    uShadowColor: customUniform(new THREE.Color(75 / 255, 75 / 255, 75 / 255), {
      attachDebug: true,
    }),
    uHalfLitColor: customUniform(new THREE.Color(0.5, 0.5, 0.5), {
      attachDebug: true,
    }),
    uLitColor: customUniform(new THREE.Color(0.9, 0.9, 0.9), {
      attachDebug: true,
    }),
    uShadowThreshold: customUniform(0.1, { attachDebug: true }),
    uHalfLitThreshold: customUniform(0.5, { attachDebug: true }),
    uIsHovered: customUniform(false),
  },
});
const bushMaterial = new THREE.ShaderMaterial({
  lights: true,
  vertexShader: bushVertexShader,
  fragmentShader: bushFragmentShader,
  uniforms: {
    ...THREE.UniformsLib.lights,

    uShadowColor: customUniform(new THREE.Color(61 / 255, 97 / 255, 85 / 255), {
      attachDebug: true,
    }),
    uHalfLitColor: customUniform(
      new THREE.Color(77 / 255, 125 / 255, 85 / 255),
      {
        attachDebug: true,
      }
    ),
    uLitColor: customUniform(new THREE.Color(124 / 255, 175 / 255, 119 / 255), {
      attachDebug: true,
    }),
    uShadowThreshold: customUniform(0.35, { attachDebug: true }),
    uHalfLitThreshold: customUniform(0.5, { attachDebug: true }),
    uIsHovered: customUniform(false),
    uNoise: new THREE.Uniform(
      engine.loadTexture("./texture/noiseTexture.png", {
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
        repeat: new THREE.Vector2(10000, 10000),
      })
    ),
  },
});
bushMaterial.name = "bush";
const hoveredToonMaterial = new THREE.ShaderMaterial({
  lights: true,
  vertexShader: toonVertexShader,
  fragmentShader: toonFragmentShader,
  uniforms: {
    ...THREE.UniformsLib.lights,
    uShadowColor: customUniform(new THREE.Color(75 / 255, 75 / 255, 75 / 255), {
      attachDebug: true,
    }),
    uHalfLitColor: customUniform(new THREE.Color(0.5, 0.5, 0.5), {
      attachDebug: true,
    }),
    uLitColor: customUniform(new THREE.Color(0.9, 0.9, 0.9), {
      attachDebug: true,
    }),
    uShadowThreshold: customUniform(0.1, { attachDebug: true }),
    uHalfLitThreshold: customUniform(0.5, { attachDebug: true }),
    uIsHovered: customUniform(true),
  },
});
const waterMaterial = new THREE.ShaderMaterial({
  lights: true,
  vertexShader: waterVertexShader,
  fragmentShader: waterFragmentShader,
  transparent: true,
  uniforms: {
    ...THREE.UniformsLib.lights,

    uShadowColor: customUniform(new THREE.Color(75 / 255, 75 / 255, 75 / 255), {
      attachDebug: true,
    }),
    uHalfLitColor: customUniform(new THREE.Color(0.5, 0.5, 0.5), {
      attachDebug: true,
    }),
    uLitColor: customUniform(new THREE.Color(0.9, 0.9, 0.9), {
      attachDebug: true,
    }),
    uShadowThreshold: customUniform(0.1, { attachDebug: true }),
    uHalfLitThreshold: customUniform(0.5, { attachDebug: true }),
    uIsHovered: customUniform(false),
    uWaterColor: customUniform(new THREE.Color(0x0000ef), {
      attachDebug: true,
    }),
    uWaveHeight: customUniform(0.15, { attachDebug: true }),
    uWaveFrequency: customUniform(0.1, { attachDebug: true }),
  },
});
waterMaterial.name = "water";
const groundMaterial = new THREE.ShaderMaterial({
  lights: true,
  vertexShader: groundVertexShader,
  fragmentShader: groundFragmentShader,
  uniforms: {
    ...THREE.UniformsLib.lights,
    uShadowColor: customUniform(new THREE.Color(75 / 255, 75 / 255, 75 / 255), {
      attachDebug: true,
    }),
    uHalfLitColor: customUniform(new THREE.Color(0.5, 0.5, 0.5), {
      attachDebug: true,
    }),
    uLitColor: customUniform(new THREE.Color(0.9, 0.9, 0.9), {
      attachDebug: true,
    }),
    uShadowThreshold: customUniform(0.1, { attachDebug: true }),
    uHalfLitThreshold: customUniform(0.5, { attachDebug: true }),
    uIsHovered: customUniform(false),
    uGroundColor: customUniform(new THREE.Color(0xefefef)),
  },
});

/**
 * Debug
 */

const debugObject = {
  timeSpeed: 1.0,
};

const gui = new GUI();
gui.add(debugObject, "timeSpeed").min(0).max(3).step(0.1);
registerMaterial(bushMaterial);
registerMaterial(waterMaterial);

/**
 * Map Tracker
 */

const selectionConfig = {
  current: "tile",
};

const setSelect = (num) => {
  switch (num) {
    case "1":
    default:
      selectionConfig.current = "tile";
      break;
    case "2":
      selectionConfig.current = "bush";
      break;
  }
};

const gameMap = {
  data: importData(),
  graphics: {
    tiles: [],
  },
};

const leafG = new THREE.SphereGeometry(1, 7, 7);

const generateSubbush = (size, position, rotation = 0) => {
  const subbush = new THREE.Mesh(leafG, bushMaterial);
  subbush.receiveShadow = true;
  subbush.castShadow = true;
  subbush.position.copy(position);
  subbush.scale.y = size / 1.5;
  subbush.scale.x = 1.5 * size;
  subbush.scale.z = size;
  subbush.rotateY(rotation);

  return subbush;
};
const generateBush = () => {
  const bush = new THREE.Group();
  const size = 0.2;
  const subbush = generateSubbush(size, new THREE.Vector3(0, size / 4, 0));
  for (let i = 0; i < 10; i++) {
    do {
      _dummyVector.randomDirection().multiply(subbush.scale);
    } while (_dummyVector.y > 0.1 || _dummyVector < -0.2);
    const minibush = generateSubbush(
      size / 2,
      _dummyVector,
      Math.randomRange(-0.1, 0.1)
    );
    bush.add(minibush);
  }
  bush.add(subbush);
  bush.rotateY(Math.randomRange(0, Math.PI * 2));
  return bush;
};

const tileGeometry = new THREE.BoxGeometry(0.9, 1.0, 0.9);

const generateTile = (tile) => {
  const box = new THREE.Mesh(tileGeometry, toonMaterial);
  box.position.x = tile.x;
  box.position.y = tile.height / 2 - 2;
  box.position.z = tile.y;
  box.scale.y = tile.height;
  box.castShadow = true;
  box.receiveShadow = true;
  box.x = tile.x;
  box.y = tile.y;
  box.height = tile.height;
  if (tile.hasBush) {
    const bush = generateBush();
    box.add(bush);
    bush.position.y = tile.height / 2;
  }
  scene.add(box);
  return box;
};

const regenerateMap = (map) => {
  // Clear any removed tiles
  map.graphics.tiles.forEach((v) => {
    scene.remove(v);
  });
  map.graphics.tiles = [];
  map.data.tiles.forEach((tile) => {
    const mesh = generateTile(tile);
    map.graphics.tiles.push(mesh);
  });
};

const updateMap = () => {
  regenerateMap(gameMap);
};

updateMap();

/**
 * Selection
 */

const selectionPlaneG = new THREE.PlaneGeometry(1000, 1000);
const selectionPlane = new THREE.Mesh(
  selectionPlaneG,
  new THREE.MeshBasicMaterial({})
);
selectionPlane.visible = false;
selectionPlane.lookAt(new THREE.Vector3(0, 1, 0));
selectionPlane.position.y = -1;
selectionPlane.castShadow = false;
selectionPlane.receiveShadow = false;
scene.add(selectionPlane);

const raycaster = new THREE.Raycaster();
raycaster.layers.set(1);
selectionPlane.layers.enable(1);

const targetCoordinate = () => {
  if (!inputManager.mousePos) {
    return;
  }
  raycaster.setFromCamera(inputManager.mousePos, camera);

  const intersects = raycaster.intersectObjects(scene.children);

  if (intersects.length > 0) {
    const p = intersects[0].point;
    const x = Math.round(p.x);
    const y = Math.round(p.z);

    return [x, y];
  }
  return null;
};

const updateHighlight = () => {
  const coord = targetCoordinate();
  if (!coord) {
    return;
  }
  const [hit, miss] = partition(gameMap.graphics.tiles, (v) => {
    return coord[0] === v.x && coord[1] === v.y;
  });
  hit.forEach((v) => {
    v.material = hoveredToonMaterial;
  });
  miss.forEach((v) => {
    v.material = toonMaterial;
  });
};

const addCube = () => {
  const coord = targetCoordinate();
  if (!coord) {
    return;
  }
  const idx = gameMap.data.tiles.findIndex(
    (v) => coord[0] === v.x && coord[1] === v.y
  );
  switch (selectionConfig.current) {
    case "tile":
      if (idx >= 0) {
        return;
      }
      gameMap.data.tiles.push({ x: coord[0], y: coord[1], height: 1 });
      break;
    case "bush":
      if (idx < 0) {
        return;
      }
      gameMap.data.tiles[idx].hasBush = true;
      break;
  }

  regenerateMap(gameMap);
};

const removeCube = () => {
  const coord = targetCoordinate();
  if (!coord) {
    return;
  }
  const idx = gameMap.data.tiles.findIndex(
    (v) => coord[0] === v.x && coord[1] === v.y
  );
  switch (selectionConfig.current) {
    case "tile":
      if (idx < 0) {
        return;
      }
      gameMap.data.tiles.splice(idx, 1);
      break;
    case "bush":
      if (idx < 0) {
        return;
      }
      gameMap.data.tiles[idx].hasBush = false;
      break;
  }

  regenerateMap(gameMap);
};

/**
 * Water
 */
const waterPlaneG = new THREE.PlaneGeometry(30, 30);
const waterPlane = new THREE.Mesh(waterPlaneG, waterMaterial);
waterPlane.lookAt(new THREE.Vector3(0, 1, 0));
waterPlane.position.y = -1.5;
waterPlane.castShadow = false;
waterPlane.receiveShadow = false;
scene.add(waterPlane);

const groundPlaneG = new THREE.PlaneGeometry(1000, 1000);
const groundPlane = new THREE.Mesh(groundPlaneG, groundMaterial);
groundPlane.lookAt(new THREE.Vector3(0, 1, 0));
groundPlane.position.y = -2.0;
groundPlane.castShadow = false;
groundPlane.receiveShadow = false;
scene.add(groundPlane);

/**
 * Loading overlay
 */
const loadingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uMinY: { value: 0.0 },
    uWidthY: { value: 0.005 },
    uMaxX: { value: 0.0 },
  },
  vertexShader: loadingVertexShader,
  fragmentShader: loadingFragmentShader,
};

const loadingScreen = new ShaderPass(loadingShader);
const loadingUniforms = loadingScreen.material.uniforms;
composer.addPass(loadingScreen);

/**
 * Loading Animation
 */
let progressRatio = 0.0;
let currAnimation = null;
let timeTracker = { enabled: false, deltaTime: 0, elapsedTime: 0.0 };
const updateProgress = (progress) => {
  progressRatio = Math.max(progress, progressRatio);
  if (currAnimation) {
    currAnimation.kill();
  }
  currAnimation = gsap.to(loadingUniforms.uMaxX, {
    duration: 1,
    value: progressRatio,
  });
  if (progressRatio == 1) {
    currAnimation.kill();
    const timeline = gsap.timeline();
    currAnimation = timeline.to(loadingUniforms.uMaxX, {
      duration: 0.2,
      value: progressRatio,
    });
    timeline.set(timeTracker, { enabled: true });
    timeline.to(loadingUniforms.uWidthY, {
      duration: 0.1,
      delay: 0.0,
      value: 0.01,
      ease: "power1.inOut",
    });
    timeline.to(loadingUniforms.uWidthY, {
      duration: 0.1,
      value: 0.0,
      ease: "power1.in",
    });
    timeline.to(loadingUniforms.uMinY, {
      duration: 0.5,
      value: 0.5,
      ease: "power1.in",
    });
  }
};

const initLoadingAnimation = () => {
  loadingManager.onProgress = (_, itemsLoaded, itemsTotal) => {
    updateProgress(itemsLoaded / itemsTotal);
  };
  if (!loadingManager.hasFiles) {
    updateProgress(1);
  }
};

/**
 * Loaded Objects
 */

engine.loadTexture("./texture/matcap01.png");
engine.loadTexture("https://source.unsplash.com/random/100x100?sig=1");
loadSound("swoosh01");
loadFont("helvetiker_regular.typeface");

/**
 *  Box
 */
const boxG = new THREE.SphereGeometry(1, 200, 200);
const boxMesh = new THREE.Mesh(boxG, toonMaterial);
scene.add(boxMesh);
boxMesh.castShadow = true;
boxMesh.receiveShadow = true;
boxMesh.material.shading = THREE.SmoothShading;

const rotateBox = (time) => {
  boxMesh.setRotationFromEuler(new THREE.Euler(0, time, 0));
};

const plane = new THREE.PlaneGeometry(10, 10);
const planeMesh = new THREE.Mesh(plane, toonMaterial);
planeMesh.visible = false;
boxMesh.visible = false;
planeMesh.position.y = -2;
planeMesh.lookAt(boxMesh.position);
scene.add(planeMesh);
planeMesh.castShadow = true;
planeMesh.receiveShadow = true;

/**
 * Light
 */

const makeDirectionalLight = (targetDirection = THREE.Object3D.DEFAULT_UP) => {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 5);

  directionalLight.position.x = -targetDirection.x;
  directionalLight.position.y = -targetDirection.y;
  directionalLight.position.z = -targetDirection.z;

  directionalLight.castShadow = true;
  directionalLight.shadow.bias = -0.001;
  directionalLight.shadow.mapSize.width = 1 << 12;
  directionalLight.shadow.mapSize.height = 1 << 12;
  directionalLight.shadow.camera.near = 0; // same as the camera
  directionalLight.shadow.camera.far = 40; // same as the camera
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.bottom = -10;
  directionalLight.shadow.camera.left = 10;
  directionalLight.shadow.camera.right = -10;
  scene.add(directionalLight);
  return directionalLight;
};

makeDirectionalLight(new THREE.Vector3(-10, -10, 5));

/**
 * Animation
 */
const clock = new THREE.Clock();
const tick = () => {
  stats.begin();
  updateHighlight();
  updateMaterialSet();
  if (timeTracker.enabled) {
    timeTracker.elapsedTime =
      timeTracker.elapsedTime + debugObject.timeSpeed * clock.getDelta();
    materials.forEach((material) => {
      if (material.uniforms && material.uniforms.uTime) {
        material.uniforms.uTime.value = timeTracker.elapsedTime;
      }
    });
  }
  // update controls
  // controls.update();

  // Render scene
  rotateBox(timeTracker.elapsedTime);
  composer.render();

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
  stats.end();
};

initLoadingAnimation();
tick();
