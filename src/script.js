import "./style.css";
import * as THREE from "three";
import { gsap } from "gsap";
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
import { partition, customUniform } from "./helper.js";
import * as ENGINE from "./engine.js";

/**
 * Helpers
 */
const _dummyVector = new THREE.Vector3();

/**
 *
 */

const engine = new ENGINE.KubEngine();

/**
 * Event Handling
 */

const applyInputToGame = () => {
  if (!document.hasFocus()) {
    return;
  }
  const { inputManager } = engine;
  const { buttons } = inputManager.mouseState;
  const { pressedKeys } = inputManager.keyState;
  switch (buttons) {
    case 1:
      addCube();
      break;
    case 2:
      removeCube();
      break;
    default:
      break;
  }

  const ctrl = pressedKeys.get("Control");
  const s = pressedKeys.get("s");

  if (s && ctrl && (s.heldUserTime == 0 || ctrl.heldUserTime == 0)) {
    engine.exportData();
  }
  if (pressedKeys.has("1")) {
    setSelect("1");
  }
  if (pressedKeys.has("2")) {
    setSelect("2");
  }
};

/**
 * Materials
 */

const waterMaterial = engine.renderManager.materialManager.addMaterial(
  "water",
  waterVertexShader,
  waterFragmentShader,
  {
    lights: true,
    transparent: true,
    unique: true,
  }
);
const toonMaterial = engine.renderManager.materialManager.addMaterial(
  "cube",
  toonVertexShader,
  toonFragmentShader,
  { lights: true, unique: true }
);

const bushMaterial = engine.renderManager.materialManager.addMaterial(
  "bush",
  toonVertexShader,
  toonFragmentShader,
  { lights: true, unique: true }
);

const hoveredToonMaterial = new THREE.ShaderMaterial({
  lights: true,
  vertexShader: toonVertexShader,
  fragmentShader: toonFragmentShader,
  uniforms: {
    ...THREE.UniformsLib.lights,
    pShadowColor: customUniform(new THREE.Color(75 / 255, 75 / 255, 75 / 255), {
      attachDebug: true,
    }),
    pHalfLitColor: customUniform(new THREE.Color(0.5, 0.5, 0.5), {
      attachDebug: true,
    }),
    pLitColor: customUniform(new THREE.Color(0.9, 0.9, 0.9), {
      attachDebug: true,
    }),
    pShadowThreshold: customUniform(0.1, { attachDebug: true }),
    pHalfLitThreshold: customUniform(0.5, { attachDebug: true }),
    eIsHovered: customUniform(true),
  },
});

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

class GameEditor {
  constructor(engine) {
    this.engine = engine;
    this.editorData = {
      gameMap: {
        state: { tiles: [] },
        graphics: {
          tiles: [],
        },
      },
    };
    this.syncFromData = (data) => {
      this.editorData.gameMap.state.tiles = data.state.tiles;
    };
    this.syncToData = (data) => {
      if (!("state" in data)) {
        data.state = {};
      }
      data.state.tiles = this.editorData.gameMap.state.tiles;
    };
  }
}

const editor = new GameEditor(engine);
engine.editor = editor;
const gameMap = editor.editorData.gameMap;

engine.importData();
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
  engine.scene.add(box);
  return box;
};

const regenerateMap = (map) => {
  // Clear any removed tiles
  map.graphics.tiles.forEach((v) => {
    engine.scene.remove(v);
  });
  map.graphics.tiles = [];
  map.state.tiles.forEach((tile) => {
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
engine.scene.add(selectionPlane);

const raycaster = new THREE.Raycaster();
raycaster.layers.set(1);
selectionPlane.layers.enable(1);

const targetCoordinate = () => {
  const { pos } = engine.inputManager.mouseState;
  if (!pos) {
    return;
  }
  raycaster.setFromCamera(pos, engine.camera);

  const intersects = raycaster.intersectObjects(engine.scene.children);

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
  const idx = gameMap.state.tiles.findIndex(
    (v) => coord[0] === v.x && coord[1] === v.y
  );
  switch (selectionConfig.current) {
    case "tile":
      if (idx >= 0) {
        return;
      }
      gameMap.state.tiles.push({ x: coord[0], y: coord[1], height: 1 });
      break;
    case "bush":
      if (idx < 0) {
        return;
      }
      gameMap.state.tiles[idx].hasBush = true;
      break;
  }

  regenerateMap(gameMap);
};

const removeCube = () => {
  const coord = targetCoordinate();
  if (!coord) {
    return;
  }
  const idx = gameMap.state.tiles.findIndex(
    (v) => coord[0] === v.x && coord[1] === v.y
  );
  switch (selectionConfig.current) {
    case "tile":
      if (idx < 0) {
        return;
      }
      gameMap.state.tiles.splice(idx, 1);
      break;
    case "bush":
      if (idx < 0) {
        return;
      }
      gameMap.state.tiles[idx].hasBush = false;
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
engine.scene.add(waterPlane);

const groundPlaneG = new THREE.PlaneGeometry(1000, 1000);
const groundPlane = new THREE.Mesh(groundPlaneG, groundMaterial);
groundPlane.lookAt(new THREE.Vector3(0, 1, 0));
groundPlane.position.y = -2.0;
groundPlane.castShadow = false;
groundPlane.receiveShadow = false;
engine.scene.add(groundPlane);

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
engine.composer.addPass(loadingScreen);

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
  engine.loadingManager.onProgress = (_, itemsLoaded, itemsTotal) => {
    updateProgress(itemsLoaded / itemsTotal);
  };
  if (!engine.loadingManager.hasFiles) {
    updateProgress(1);
  }
};

/**
 * Loaded Objects
 */

engine.loadTexture("./texture/matcap01.png");
engine.loadTexture("https://source.unsplash.com/random/100x100?sig=1");
engine.loadSound("./audio/swoosh01.mp3");
engine.loadFont("./fonts/helvetiker_regular.typeface.json");

/**
 *  Box
 */
const boxG = new THREE.SphereGeometry(1, 200, 200);
const boxMesh = new THREE.Mesh(boxG, toonMaterial);
engine.scene.add(boxMesh);
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
engine.scene.add(planeMesh);
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
  directionalLight.shadow.camera.near = 0; // same as the engine.camera
  directionalLight.shadow.camera.far = 40; // same as the engine.camera
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.bottom = -10;
  directionalLight.shadow.camera.left = 10;
  directionalLight.shadow.camera.right = -10;
  engine.scene.add(directionalLight);
  return directionalLight;
};

makeDirectionalLight(new THREE.Vector3(-10, -10, 5));

/**
 * Animation
 */
const clock = new THREE.Clock();
const tick = () => {
  engine.statsManager.stats.begin();
  updateHighlight();
  for (const materialName in engine.renderManager.materialManager.materials) {
    const material =
      engine.renderManager.materialManager.materials[materialName];
    if (material.uniforms && material.uniforms.eTime) {
      material.uniforms.eTime.value = engine.timeManager.time.gameTime;
    }
  }
  engine.update();
  // update controls
  // controls.update();
  applyInputToGame();

  // Render engine.scene
  rotateBox(timeTracker.elapsedTime);
  engine.composer.render();

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
  engine.endLoop();
  engine.statsManager.stats.end();
};

initLoadingAnimation();
tick();
