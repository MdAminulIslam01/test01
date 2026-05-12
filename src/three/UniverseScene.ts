import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createBodySystem, type BodySystem } from './createBodies';
import { createStarfieldSystem, type StarfieldSystem } from './createStarfields';
import { cameraDistanceForZoom, clamp, damp, levelNameForZoom } from './zoomScale';

type UniverseSceneOptions = {
  onReady?: () => void;
  onLevelChange?: (level: string) => void;
};

function createSpaceDome() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(220_000, 96, 48),
    new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorld = normalize(worldPosition.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorld;
        void main() {
          float horizon = smoothstep(-0.85, 0.75, vWorld.y);
          float centerGlow = pow(max(0.0, 1.0 - abs(vWorld.y) * 0.75), 2.2);
          vec3 zenith = vec3(0.003, 0.007, 0.018);
          vec3 horizonColor = vec3(0.012, 0.018, 0.04);
          vec3 color = mix(horizonColor, zenith, horizon) + vec3(0.008, 0.011, 0.022) * centerGlow;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
}

export class UniverseScene {
  private readonly mount: HTMLDivElement;
  private readonly options: UniverseSceneOptions;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(56, 1, 0.02, 320_000);
  private readonly spaceDome = createSpaceDome();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly loadingManager = new THREE.LoadingManager();
  private readonly bodySystem: BodySystem;
  private readonly starfieldSystem: StarfieldSystem;
  private animationFrame = 0;
  private zoom = 0;
  private targetZoom = 0;
  private currentLevel = '';
  private disposed = false;
  private lowFpsSeconds = 0;
  private lastTime = performance.now() / 1_000;
  private elapsedTime = 0;

  constructor(mount: HTMLDivElement, options: UniverseSceneOptions = {}) {
    this.mount = mount;
    this.options = options;

    this.loadingManager.onLoad = () => this.options.onReady?.();
    this.loadingManager.onError = () => this.options.onReady?.();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.mount.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.42;
    this.controls.target.set(0, 0, 0);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.46, 0.16);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.spaceDome.renderOrder = -100;
    this.scene.add(this.spaceDome);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.035));
    const keyLight = new THREE.DirectionalLight(0xfff6df, 2.35);
    keyLight.position.set(-7, 5, 8);
    this.scene.add(keyLight);
    this.bodySystem = createBodySystem(this.loadingManager);
    this.starfieldSystem = createStarfieldSystem();
    this.scene.add(this.starfieldSystem.root, this.bodySystem.earthMoon, this.bodySystem.solarSystem);

    this.camera.position.set(0, 4.2, cameraDistanceForZoom(0));
    this.camera.lookAt(this.controls.target);
    this.resize();
    this.updateLevelName();

    window.addEventListener('resize', this.resize);
    this.renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: false });
    this.animationFrame = window.requestAnimationFrame(this.animate);
  }

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const delta = Math.sign(event.deltaY) * Math.min(0.32, Math.abs(event.deltaY) * 0.0018);
    this.targetZoom = clamp(this.targetZoom + delta);
  };

  private readonly resize = () => {
    const width = Math.max(1, this.mount.clientWidth);
    const height = Math.max(1, this.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  };

  private updateCamera(delta: number) {
    this.zoom = damp(this.zoom, this.targetZoom, 4.2, delta);
    const desiredDistance = cameraDistanceForZoom(this.zoom);
    const direction = this.camera.position.clone().sub(this.controls.target);
    if (direction.lengthSq() < 0.001) {
      direction.set(0, 0.28, 1);
    }
    direction.normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(direction, desiredDistance);
    this.camera.near = Math.max(0.02, desiredDistance / 30_000);
    this.camera.far = Math.max(2_000, desiredDistance * 3.5);
    this.camera.updateProjectionMatrix();
  }

  private updateLevelName() {
    const name = levelNameForZoom(this.zoom);
    if (name !== this.currentLevel) {
      this.currentLevel = name;
      this.options.onLevelChange?.(name);
    }
  }

  private adaptQuality(delta: number) {
    const fps = 1 / Math.max(delta, 0.001);
    this.lowFpsSeconds = fps < 34 ? this.lowFpsSeconds + delta : Math.max(0, this.lowFpsSeconds - delta);
    if (this.lowFpsSeconds > 2.5) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
      this.bloomPass.strength = 0.28;
    }
  }

  private readonly animate = () => {
    if (this.disposed) {
      return;
    }

    const now = performance.now() / 1_000;
    const delta = Math.min(now - this.lastTime, 0.05);
    this.lastTime = now;
    this.elapsedTime += delta;
    const elapsed = this.elapsedTime;

    this.controls.update();
    this.updateCamera(delta);
    this.spaceDome.position.copy(this.camera.position);
    this.bodySystem.update(delta, elapsed, this.zoom);
    this.starfieldSystem.update(delta, elapsed, this.zoom);
    this.updateLevelName();
    this.adaptQuality(delta);
    this.composer.render();

    this.animationFrame = window.requestAnimationFrame(this.animate);
  };

  dispose() {
    this.disposed = true;
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', this.resize);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel);
    this.controls.dispose();
    this.bodySystem.dispose();
    this.starfieldSystem.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
