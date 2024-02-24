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
import mapData from "./data/map.json";

/**
 * Helpers
 */
Math.clamp = (num, min, max) => Math.max(min, Math.min(num, max));

const partition = (array, filterFn) => {
  const pass = [];
  const fail = [];
  array.forEach((e, idx, arr) => (filterFn(e, idx, arr) ? pass : fail).push(e));
  return [pass, fail];
};

/**
 * Core objects
 */
const container = document.querySelector("div.container");
const canvasContainer = document.querySelector("div.relative");
const ui = document.querySelector("div.overlay");
const canvas = document.querySelector("canvas.webgl");
const aspectRatio = 16 / 9;
const camera = new THREE.PerspectiveCamera(75, aspectRatio);
camera.near = 0.001;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
const listener = new THREE.AudioListener();
camera.add(listener);
renderer.setClearColor("#201919");
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
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
const textureLoader = new THREE.TextureLoader(loadingManager);
const dracoLoader = new DRACOLoader(loadingManager);
const audioLoader = new THREE.AudioLoader(loadingManager);
const gltfLoader = new GLTFLoader(loadingManager);
const fontLoader = new FontLoader(loadingManager);
gltfLoader.setDRACOLoader(dracoLoader);
dracoLoader.setDecoderPath("./draco/gltf/");

/**
 * Data
 */

const jsonData = new Map();

const loadJson = (name) => {
  const texture = textureLoader.load(`./texture/${name}.png`);
  textures.set(name, texture);
  return texture;
};

/**
 * Textures
 */
const textures = new Map();

const loadTextureFromUrl = (url) => {
  const texture = textureLoader.load(url);
  textures.set(url, texture);
  return texture;
};

const loadTexture = (name) => {
  const texture = textureLoader.load(`./texture/${name}.png`);
  textures.set(name, texture);
  return texture;
};

/**
 * Fonts
 */
const fonts = new Map();

const loadFont = (name) => {
  fontLoader.load(`./fonts/${name}.json`, function (font) {
    fonts.set(name, font);
  });
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

const baseColorTexture = loadTexture("baseColor");
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
    case "pointerdown":
    case "pointerup":
    case "pointermove":
      if (event.target.className !== "webgl") {
        return;
      }
      console.log(event);
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
 * Setup camera
 */
camera.position.x = 5;
camera.position.y = 5;
camera.position.z = 5;
scene.add(camera);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false;

/**
 * Materials
 */

const toonMaterial = new THREE.ShaderMaterial({
  lights: true,
  vertexShader: toonVertexShader,
  fragmentShader: toonFragmentShader,
  uniforms: {
    ...THREE.UniformsLib.lights,
    uShadowColor: new THREE.Uniform(new THREE.Vector3(0.1, 0.1, 0.1)),
    uHalfLitColor: new THREE.Uniform(new THREE.Vector3(0.5, 0.5, 0.5)),
    uLitColor: new THREE.Uniform(new THREE.Vector3(0.9, 0.9, 0.9)),
    uShadowThreshold: new THREE.Uniform(0.1),
    uHalfLitThreshold: new THREE.Uniform(0.5),
    uIsHovered: new THREE.Uniform(false),
  },
});
const hoveredToonMaterial = new THREE.ShaderMaterial({
  lights: true,
  vertexShader: toonVertexShader,
  fragmentShader: toonFragmentShader,
  uniforms: {
    ...THREE.UniformsLib.lights,
    uShadowColor: new THREE.Uniform(new THREE.Vector3(0.1, 0.1, 0.1)),
    uHalfLitColor: new THREE.Uniform(new THREE.Vector3(0.5, 0.5, 0.5)),
    uLitColor: new THREE.Uniform(new THREE.Vector3(0.9, 0.9, 0.9)),
    uShadowThreshold: new THREE.Uniform(0.1),
    uHalfLitThreshold: new THREE.Uniform(0.5),
    uIsHovered: new THREE.Uniform(true),
  },
});

/**
 * Debug
 */

const debugObject = {
  timeSpeed: 1.0,
  shadowColor: new THREE.Color(0x0f0f0f),
  halfLitColor: new THREE.Color(0x8f8f8f),
  litColor: new THREE.Color(0xefefef),
  shadowThreshold: 0.0,
  halfLitThreshold: 0.5,
  width: 10,
  depth: 10,
};

const updateToonMaterial = () => {
  toonMaterial.uniforms.uShadowColor.value = debugObject.shadowColor;
  toonMaterial.uniforms.uHalfLitColor.value = debugObject.halfLitColor;
  toonMaterial.uniforms.uLitColor.value = debugObject.litColor;
  toonMaterial.uniforms.uShadowThreshold.value = debugObject.shadowThreshold;
  toonMaterial.uniforms.uHalfLitThreshold.value = debugObject.halfLitThreshold;
};
updateToonMaterial();
const gui = new GUI();
gui.add(debugObject, "timeSpeed").min(0).max(3).step(0.1);
gui.addColor(debugObject, "shadowColor").onChange(updateToonMaterial);
gui.addColor(debugObject, "halfLitColor").onChange(updateToonMaterial);
gui.addColor(debugObject, "litColor").onChange(updateToonMaterial);
gui
  .add(debugObject, "shadowThreshold")
  .min(0)
  .max(1)
  .step(0.01)
  .onChange(updateToonMaterial);
gui
  .add(debugObject, "halfLitThreshold")
  .min(0)
  .max(1)
  .step(0.01)
  .onChange(updateToonMaterial);

/**
 * Marching Cubes
 */

const gameMapData = JSON.parse(JSON.stringify(mapData));

const gameMap = {
  data: JSON.parse(JSON.stringify(mapData)),
  graphics: {
    tiles: [],
  },
};

const generatePillar = (x, y, height) => {
  const boxGeometry = new THREE.BoxGeometry(0.9, height, 0.9);
  const box = new THREE.Mesh(boxGeometry, toonMaterial);
  box.position.x = x;
  box.position.y = height / 2 - 2;
  box.position.z = y;
  box.castShadow = true;
  box.receiveShadow = true;
  box.x = x;
  box.y = y;
  box.height = height;
  scene.add(box);
  return box;
};

const regenerateMap = (map) => {
  // Clear any removed tiles
  map.graphics.tiles.forEach((v) => {
    scene.remove(v);
  });
  map.graphics.tiles = [];
  map.data.tiles.forEach((v) => {
    const mesh = generatePillar(v.x, v.y, v.height);
    map.graphics.tiles.push(mesh);
  });
};

const updateMap = () => {
  regenerateMap(gameMap);
};

updateMap();
gui.add(debugObject, "width").min(2).max(30).step(1).onChange(updateMap);
gui.add(debugObject, "depth").min(2).max(30).step(1).onChange(updateMap);

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
  if (idx >= 0) {
    return;
  }

  gameMap.data.tiles.push({ x: coord[0], y: coord[1], height: 1 });
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
  console.log("tried remove:", idx);
  if (idx < 0) {
    return;
  }
  gameMap.data.tiles.splice(idx, 1);
  regenerateMap(gameMap);
};

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
loadTexture("matcap01");
loadTextureFromUrl("https://source.unsplash.com/random/100x100?sig=1");
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

makeDirectionalLight(new THREE.Vector3(-10, -10, 3));

/**
 * Animation
 */
const clock = new THREE.Clock();
const tick = () => {
  stats.begin();
  updateHighlight();
  if (controls.enabled) {
    timeTracker.elapsedTime =
      timeTracker.elapsedTime + debugObject.timeSpeed * clock.getDelta();
  }
  // update controls
  controls.update();

  // Render scene
  rotateBox(timeTracker.elapsedTime);
  composer.render();

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
  stats.end();
};

initLoadingAnimation();
tick();