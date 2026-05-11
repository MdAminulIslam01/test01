import * as THREE from 'three';
import { bellOpacity, rangeOpacity, smoothstep } from './zoomScale';

export type BodySystem = {
  earthMoon: THREE.Group;
  solarSystem: THREE.Group;
  update: (delta: number, elapsed: number, zoom: number) => void;
  dispose: () => void;
};

type PlanetSpec = {
  name: string;
  radius: number;
  orbit: number;
  speed: number;
  spin: number;
  initialAngle: number;
  tilt?: number;
  texture: string;
  fallback: [string, string];
};

const TEXTURES = {
  earth: '/textures/earth_day.jpg',
  earthClouds: '/textures/earth_clouds.jpg',
  earthNight: '/textures/earth_night.jpg',
  moon: '/textures/moon.jpg',
  sun: '/textures/sun.jpg',
  mercury: '/textures/mercury.jpg',
  venus: '/textures/venus.jpg',
  mars: '/textures/mars.jpg',
  jupiter: '/textures/jupiter.jpg',
  saturn: '/textures/saturn.jpg',
  uranus: '/textures/uranus.jpg',
  neptune: '/textures/neptune.jpg',
};

const EARTH_ORBIT_RADIUS = 23;
const SOLAR_ORBIT_SCALE = 2.15;

const PLANETS: PlanetSpec[] = [
  {
    name: 'Mercury',
    radius: 0.45,
    orbit: 12,
    speed: 0.74,
    spin: 0.65,
    initialAngle: 0.5,
    texture: TEXTURES.mercury,
    fallback: ['#7a746b', '#373430'],
  },
  {
    name: 'Venus',
    radius: 0.78,
    orbit: 17,
    speed: 0.52,
    spin: -0.18,
    initialAngle: 2.25,
    texture: TEXTURES.venus,
    fallback: ['#d8b26f', '#6d5635'],
  },
  {
    name: 'Earth',
    radius: 1.18,
    orbit: EARTH_ORBIT_RADIUS,
    speed: 0.42,
    spin: 1,
    initialAngle: 0,
    tilt: 0.41,
    texture: TEXTURES.earth,
    fallback: ['#2c6d9e', '#113047'],
  },
  {
    name: 'Mars',
    radius: 0.62,
    orbit: 31,
    speed: 0.32,
    spin: 0.93,
    initialAngle: 4.2,
    texture: TEXTURES.mars,
    fallback: ['#b05c39', '#3d1d17'],
  },
  {
    name: 'Jupiter',
    radius: 2.55,
    orbit: 45,
    speed: 0.2,
    spin: 1.65,
    initialAngle: 1.45,
    texture: TEXTURES.jupiter,
    fallback: ['#d1a679', '#725743'],
  },
  {
    name: 'Saturn',
    radius: 2.05,
    orbit: 63,
    speed: 0.15,
    spin: 1.42,
    initialAngle: 2.95,
    texture: TEXTURES.saturn,
    fallback: ['#d6bd82', '#67553b'],
  },
  {
    name: 'Uranus',
    radius: 1.42,
    orbit: 80,
    speed: 0.11,
    spin: 1.2,
    initialAngle: 4.85,
    texture: TEXTURES.uranus,
    fallback: ['#8fd3dc', '#31515d'],
  },
  {
    name: 'Neptune',
    radius: 1.38,
    orbit: 96,
    speed: 0.09,
    spin: 1.18,
    initialAngle: 5.75,
    texture: TEXTURES.neptune,
    fallback: ['#426ec7', '#0b1e48'],
  },
];

function loadTexture(manager: THREE.LoadingManager, path: string, fallback: [string, string]) {
  const texture = new THREE.TextureLoader(manager).load(
    path,
    (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.needsUpdate = true;
    },
    undefined,
    () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, 256, 128);
      gradient.addColorStop(0, fallback[0]);
      gradient.addColorStop(0.55, fallback[1]);
      gradient.addColorStop(1, fallback[0]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      (texture as unknown as { image: unknown }).image = canvas;
      texture.needsUpdate = true;
    },
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function setGroupOpacity(group: THREE.Object3D, opacity: number) {
  group.visible = opacity > 0.015;
  group.traverse((object) => {
    const material = (object as THREE.Mesh | THREE.Points | THREE.Line).material;
    if (!material) {
      return;
    }
    const materials = Array.isArray(material) ? material : [material];
    for (const item of materials) {
      if ('opacity' in item) {
        item.userData.baseOpacity ??= item.opacity;
        item.transparent = true;
        item.opacity = item.userData.baseOpacity * opacity;
      }
    }
  });
}

function createAtmosphere(radius: number, color: THREE.ColorRepresentation, intensity = 1) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 32),
    new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(color) },
        intensity: { value: intensity },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 glowColor;
        uniform float intensity;
        void main() {
          float rim = pow(0.58 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.2);
          gl_FragColor = vec4(glowColor, rim * intensity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  );
  return mesh;
}

function createOrbit(radius: number, color = 0x9ebcff) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 220; i += 1) {
    const angle = (i / 220) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.035,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  return line;
}

function createDebrisBelt(count: number, innerRadius: number, outerRadius: number, height: number, size: number, hue: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const radius = innerRadius + Math.pow(Math.random(), 0.72) * (outerRadius - innerRadius);
    const angle = Math.random() * Math.PI * 2;
    const bandNoise = (Math.random() - 0.5) * height;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = bandNoise;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    color.setHSL(hue + Math.random() * 0.04, 0.32 + Math.random() * 0.25, 0.44 + Math.random() * 0.32);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
}

function visualOrbitRadius(spec: PlanetSpec) {
  return spec.orbit * SOLAR_ORBIT_SCALE;
}

function createPlanet(manager: THREE.LoadingManager, spec: PlanetSpec) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(spec.radius, 64, 32),
    new THREE.MeshStandardMaterial({
      map: loadTexture(manager, spec.texture, spec.fallback),
      roughness: 0.88,
      metalness: 0,
    }),
  );
  mesh.name = spec.name;
  mesh.position.x = visualOrbitRadius(spec);
  mesh.rotation.z = spec.tilt ?? 0;
  pivot.rotation.y = spec.initialAngle;
  pivot.add(mesh);
  return { pivot, mesh, spec };
}

export function createBodySystem(manager: THREE.LoadingManager): BodySystem {
  const earthMoon = new THREE.Group();
  earthMoon.name = 'Earth Moon System';

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 96, 48),
    new THREE.MeshStandardMaterial({
      map: loadTexture(manager, TEXTURES.earth, ['#2d78ad', '#061a2d']),
      emissiveMap: loadTexture(manager, TEXTURES.earthNight, ['#050716', '#11172f']),
      emissive: new THREE.Color(0xffd6a0),
      emissiveIntensity: 0.045,
      roughness: 0.82,
    }),
  );
  earth.rotation.z = 0.41;
  earthMoon.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(2.545, 96, 48),
    new THREE.MeshStandardMaterial({
      map: loadTexture(manager, TEXTURES.earthClouds, ['#ffffff', '#7892aa']),
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      roughness: 0.65,
    }),
  );
  clouds.rotation.z = 0.41;
  earthMoon.add(clouds);
  earthMoon.add(createAtmosphere(2.6, 0x9dccff, 0.18));

  const moonPivot = new THREE.Group();
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 64, 32),
    new THREE.MeshStandardMaterial({
      map: loadTexture(manager, TEXTURES.moon, ['#aaa69b', '#3d3c39']),
      roughness: 0.95,
    }),
  );
  moon.position.x = 7.4;
  moonPivot.add(moon);
  earthMoon.add(moonPivot);

  const moonOrbit = createOrbit(7.4, 0x8fa8c6);
  earthMoon.add(moonOrbit);

  const solarSystem = new THREE.Group();
  solarSystem.name = 'Solar System';
  solarSystem.scale.setScalar(1.2);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(4.4, 96, 48),
    new THREE.MeshBasicMaterial({
      map: loadTexture(manager, TEXTURES.sun, ['#fff2a0', '#e45b1e']),
    }),
  );
  solarSystem.add(sun);
  solarSystem.add(createAtmosphere(5.15, 0xffb44c, 0.72));
  solarSystem.add(new THREE.PointLight(0xffd391, 30, 1_100, 1.35));

  const planetRecords = PLANETS.map((spec) => createPlanet(manager, spec));
  const orbitAngles = planetRecords.map((record) => record.spec.initialAngle);
  const asteroidBelt = createDebrisBelt(3_400, 35 * SOLAR_ORBIT_SCALE, 40 * SOLAR_ORBIT_SCALE, 1.5, 0.42, 0.08);
  const kuiperBelt = createDebrisBelt(5_800, 112 * SOLAR_ORBIT_SCALE, 168 * SOLAR_ORBIT_SCALE, 8, 0.85, 0.58);
  const oortCloud = createDebrisBelt(9_500, 250 * SOLAR_ORBIT_SCALE, 520 * SOLAR_ORBIT_SCALE, 210, 1.3, 0.62);
  oortCloud.rotation.x = 0.28;
  oortCloud.rotation.z = -0.18;
  solarSystem.add(asteroidBelt, kuiperBelt, oortCloud);

  for (const record of planetRecords) {
    solarSystem.add(createOrbit(visualOrbitRadius(record.spec)));
    solarSystem.add(record.pivot);

    if (record.spec.name === 'Saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(record.spec.radius * 1.45, record.spec.radius * 2.35, 128),
        new THREE.MeshStandardMaterial({
          color: 0xcab989,
          transparent: true,
          opacity: 0.58,
          side: THREE.DoubleSide,
          roughness: 0.9,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI * 0.47;
      ring.position.copy(record.mesh.position);
      record.pivot.add(ring);
    }
  }
  const solarEarth = planetRecords.find((record) => record.spec.name === 'Earth');

  setGroupOpacity(solarSystem, 0);

  const update = (delta: number, elapsed: number, zoom: number) => {
    earth.rotation.y += delta * 0.22;
    clouds.rotation.y += delta * 0.28;
    moon.rotation.y += delta * 0.09;
    moonPivot.rotation.y += delta * 0.065;

    sun.rotation.y += delta * 0.09;
    const orbitMotion = smoothstep(1.08, 1.68, zoom);
    for (let index = 0; index < planetRecords.length; index += 1) {
      const record = planetRecords[index];
      if (record.spec.name !== 'Earth') {
        orbitAngles[index] += delta * record.spec.speed * orbitMotion;
      }
      record.pivot.rotation.y = orbitAngles[index];
      record.mesh.rotation.y += delta * record.spec.spin;
    }

    setGroupOpacity(earthMoon, rangeOpacity(zoom, -0.2, 0, 0.72, 1.18));
    const solarOpacity = Math.max(
      bellOpacity(zoom, 1.2, 1.05),
      rangeOpacity(zoom, 1.15, 1.8, 3.85, 4.55) * 0.82,
    );
    setGroupOpacity(solarSystem, solarOpacity);
    const solarScale = 1.1 + zoom * 0.12;
    solarSystem.scale.setScalar(solarScale);
    setGroupOpacity(asteroidBelt, rangeOpacity(zoom, 1.25, 1.65, 2.35, 2.9));
    setGroupOpacity(kuiperBelt, rangeOpacity(zoom, 2.05, 2.55, 3.35, 3.95));
    setGroupOpacity(oortCloud, rangeOpacity(zoom, 2.65, 3.15, 3.8, 4.45) * 0.78);

    if (solarEarth) {
      const earthOrbit = visualOrbitRadius(solarEarth.spec);
      solarSystem.position.set(
        -earthOrbit * solarScale,
        0,
        0,
      );
    } else {
      solarSystem.position.set(-EARTH_ORBIT_RADIUS * SOLAR_ORBIT_SCALE * solarScale, 0, 0);
    }
  };

  const dispose = () => {
    for (const group of [earthMoon, solarSystem]) {
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
          object.geometry.dispose();
          const material = object.material;
          const materials = Array.isArray(material) ? material : [material];
          for (const item of materials) {
            item.dispose();
          }
        }
      });
    }
  };

  return { earthMoon, solarSystem, update, dispose };
}
