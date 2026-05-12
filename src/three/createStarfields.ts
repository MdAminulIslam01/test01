import * as THREE from 'three';
import { bellOpacity, rangeOpacity } from './zoomScale';

export type StarfieldSystem = {
  root: THREE.Group;
  update: (delta: number, elapsed: number, zoom: number) => void;
  dispose: () => void;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createStarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.13, 'rgba(255,250,236,0.86)');
  gradient.addColorStop(0.38, 'rgba(180,204,255,0.22)');
  gradient.addColorStop(0.72, 'rgba(88,126,210,0.055)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGalaxyTexture(colorA = '#dce9ff', colorB = '#ffbe78') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(256, 256);

  const haze = ctx.createRadialGradient(0, 0, 5, 0, 0, 230);
  haze.addColorStop(0, colorA);
  haze.addColorStop(0.2, 'rgba(170,197,255,0.45)');
  haze.addColorStop(0.6, 'rgba(66,92,176,0.14)');
  haze.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.ellipse(0, 0, 218, 74, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let arm = 0; arm < 3; arm += 1) {
    ctx.strokeStyle = arm === 1 ? colorB : 'rgba(205,224,255,0.6)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let i = 0; i < 150; i += 1) {
      const t = i / 149;
      const angle = t * Math.PI * 2.1 + arm * ((Math.PI * 2) / 3);
      const radius = 12 + t * 210;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.32;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSphericalPoints(count: number, minRadius: number, maxRadius: number, size: number, sizeAttenuation = true) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const radius = randomBetween(minRadius, maxRadius);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(randomBetween(-1, 1));
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const stellarType = Math.random();
    const hue = stellarType < 0.62 ? randomBetween(0.08, 0.15) : randomBetween(0.55, 0.64);
    color.setHSL(hue, randomBetween(0.04, 0.34), randomBetween(0.72, 1));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    map: createStarTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation,
  });

  return new THREE.Points(geometry, material);
}

function createMilkyWayPoints(count: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  const arms = 4;

  for (let i = 0; i < count; i += 1) {
    const arm = i % arms;
    const radius = Math.pow(Math.random(), 0.78) * 5_800 + 180;
    const spin = radius * 0.0022;
    const angle = arm * ((Math.PI * 2) / arms) + spin + randomBetween(-0.28, 0.28);
    const spread = Math.pow(Math.random(), 2.2) * 560;
    positions[i * 3] = Math.cos(angle) * radius + randomBetween(-spread, spread);
    positions[i * 3 + 1] = randomBetween(-95, 95) * (1 - radius / 8_200) + randomBetween(-28, 28);
    positions[i * 3 + 2] = Math.sin(angle) * radius + randomBetween(-spread, spread);

    const warmCore = Math.max(0, 1 - radius / 2_900);
    color.setHSL(0.6 - warmCore * 0.48, 0.24 + warmCore * 0.18, 0.52 + Math.random() * 0.3);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 11,
    map: createStarTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  return new THREE.Points(geometry, material);
}

function createOrionArmPoints(count: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const t = Math.random();
    const angle = -0.9 + t * 1.85;
    const radius = 2_400 + t * 6_200 + randomBetween(-460, 460);
    positions[i * 3] = Math.cos(angle) * radius + randomBetween(-220, 220);
    positions[i * 3 + 1] = randomBetween(-150, 150);
    positions[i * 3 + 2] = Math.sin(angle) * radius + randomBetween(-520, 520);

    color.setHSL(randomBetween(0.08, 0.65), randomBetween(0.08, 0.38), randomBetween(0.56, 0.9));
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
      size: 8,
      map: createStarTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
}

function createDeepGalaxies(count: number) {
  const group = new THREE.Group();
  const textures = [createGalaxyTexture(), createGalaxyTexture('#eaf0ff', '#a6c8ff'), createGalaxyTexture('#fff0ce', '#fd9f72')];

  for (let i = 0; i < count; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: textures[i % textures.length],
      color: new THREE.Color().setHSL(randomBetween(0.55, 0.68), randomBetween(0.1, 0.38), randomBetween(0.65, 0.95)),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    const radius = randomBetween(9_000, 31_000);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(randomBetween(-0.92, 0.92));
    sprite.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
    const scale = randomBetween(130, 650);
    sprite.scale.set(scale * randomBetween(1.4, 3.5), scale, 1);
    group.add(sprite);
  }

  return group;
}

function createLocalGroupGalaxies() {
  const group = new THREE.Group();
  const textures = [createGalaxyTexture(), createGalaxyTexture('#eaf0ff', '#88b7ff'), createGalaxyTexture('#fff1cf', '#f6a66e')];
  const specs = [
    { position: [0, 0, 0], scale: [4_200, 1_250, 1] },
    { position: [13_500, 1_200, -5_400], scale: [5_600, 1_450, 1] },
    { position: [-9_200, -850, 8_800], scale: [1_650, 620, 1] },
    { position: [6_400, -1_900, 10_400], scale: [1_350, 520, 1] },
  ];

  for (const spec of specs) {
    const material = new THREE.SpriteMaterial({
      map: textures[group.children.length % textures.length],
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(spec.position[0], spec.position[1], spec.position[2]);
    sprite.scale.set(spec.scale[0], spec.scale[1], spec.scale[2]);
    group.add(sprite);
  }

  for (let i = 0; i < 28; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: textures[i % textures.length],
      color: new THREE.Color().setHSL(randomBetween(0.55, 0.7), 0.22, randomBetween(0.58, 0.9)),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    const radius = randomBetween(8_000, 24_000);
    const theta = Math.random() * Math.PI * 2;
    const y = randomBetween(-4_200, 4_200);
    sprite.position.set(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
    const scale = randomBetween(420, 1_100);
    sprite.scale.set(scale * randomBetween(1.8, 3.8), scale, 1);
    group.add(sprite);
  }

  return group;
}

function createCosmicWeb(count: number) {
  const group = new THREE.Group();
  const positions: THREE.Vector3[] = [];
  for (let i = 0; i < count; i += 1) {
    const radius = randomBetween(28_000, 92_000);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(randomBetween(-0.82, 0.82));
    positions.push(
      new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      ),
    );
  }

  const pointGeometry = new THREE.BufferGeometry().setFromPoints(positions);
  const pointColors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    color.setHSL(randomBetween(0.57, 0.67), randomBetween(0.12, 0.38), randomBetween(0.45, 0.8));
    pointColors[i * 3] = color.r;
    pointColors[i * 3 + 1] = color.g;
    pointColors[i * 3 + 2] = color.b;
  }
  pointGeometry.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
  group.add(
    new THREE.Points(
      pointGeometry,
      new THREE.PointsMaterial({
        size: 140,
        map: createStarTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );

  const linePoints: THREE.Vector3[] = [];
  for (let i = 0; i < positions.length; i += 1) {
    const start = positions[i];
    let nearest = positions[(i + 1) % positions.length];
    let nearestDistance = Infinity;
    for (let j = 0; j < positions.length; j += 1) {
      if (i === j) {
        continue;
      }
      const distance = start.distanceToSquared(positions[j]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = positions[j];
      }
    }
    linePoints.push(start, nearest);
  }

  group.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(linePoints),
      new THREE.LineBasicMaterial({
        color: 0xb8c8e8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );

  return group;
}

function setPointsOpacity(points: THREE.Points, opacity: number) {
  points.visible = opacity > 0.01;
  const material = points.material as THREE.PointsMaterial;
  material.opacity = opacity;
}

function setSpriteGroupOpacity(group: THREE.Group, opacity: number) {
  group.visible = opacity > 0.01;
  for (const child of group.children) {
    if (child instanceof THREE.Sprite) {
      child.material.userData.baseOpacity ??= randomBetween(0.72, 1);
      child.material.opacity = opacity * child.material.userData.baseOpacity;
    }
  }
}

function setObjectOpacity(group: THREE.Group, opacity: number) {
  group.visible = opacity > 0.01;
  group.traverse((object) => {
    const material = (object as THREE.Points | THREE.LineSegments | THREE.Sprite).material;
    if (!material) {
      return;
    }
    const materials = Array.isArray(material) ? material : [material];
    for (const item of materials) {
      if ('opacity' in item) {
        item.userData.baseOpacity ??= item.opacity || 1;
        item.transparent = true;
        item.opacity = item.userData.baseOpacity * opacity;
      }
    }
  });
}

export function createStarfieldSystem(): StarfieldSystem {
  const root = new THREE.Group();
  const nearStars = createSphericalPoints(9_200, 85, 1_850, 1.65, false);
  const localStars = createSphericalPoints(16_500, 1_900, 12_000, 5.4);
  const interstellarMist = createSphericalPoints(8_400, 1_200, 5_600, 7.2);
  const orionArm = createOrionArmPoints(20_000);
  const deepStars = createSphericalPoints(25_000, 10_000, 102_000, 12.5);
  const milkyWay = createMilkyWayPoints(34_000);
  const localGroup = createLocalGroupGalaxies();
  const deepGalaxies = createDeepGalaxies(240);
  const cosmicWeb = createCosmicWeb(130);

  root.add(nearStars, localStars, interstellarMist, orionArm, deepStars, milkyWay, localGroup, deepGalaxies, cosmicWeb);

  const update = (delta: number, elapsed: number, zoom: number) => {
    nearStars.rotation.y += delta * 0.004;
    localStars.rotation.y -= delta * 0.0025;
    interstellarMist.rotation.y += delta * 0.0018;
    orionArm.rotation.y = -0.28 + elapsed * 0.0018;
    deepStars.rotation.y += delta * 0.0012;
    milkyWay.rotation.y = elapsed * 0.002;
    localGroup.rotation.y = elapsed * 0.001;
    deepGalaxies.rotation.y = -elapsed * 0.0008;
    cosmicWeb.rotation.y = elapsed * 0.00035;

    setPointsOpacity(nearStars, Math.max(0.22, 0.95 - zoom * 0.095));
    setPointsOpacity(localStars, rangeOpacity(zoom, 3.1, 3.65, 4.85, 5.45) * 0.86);
    setPointsOpacity(interstellarMist, rangeOpacity(zoom, 2.55, 3.25, 4.65, 5.2) * 0.3);
    setPointsOpacity(orionArm, rangeOpacity(zoom, 4.35, 4.95, 5.95, 6.55) * 0.92);
    setPointsOpacity(deepStars, rangeOpacity(zoom, 5.25, 6.05, 8.1, 8.38) * 0.58 + bellOpacity(zoom, 8, 1.35) * 0.3);

    const milkyOpacity = rangeOpacity(zoom, 5.55, 6.1, 6.65, 7.08);
    setPointsOpacity(milkyWay, milkyOpacity);
    milkyWay.scale.setScalar(0.62 + zoom * 0.08);

    setSpriteGroupOpacity(localGroup, rangeOpacity(zoom, 6.55, 6.98, 7.46, 7.84) * 0.84);
    setSpriteGroupOpacity(deepGalaxies, rangeOpacity(zoom, 7.25, 7.7, 8.12, 8.38) * 0.72);
    setObjectOpacity(cosmicWeb, rangeOpacity(zoom, 7.5, 7.86, 8.15, 8.42) * 0.34);
  };

  const dispose = () => {
    root.traverse((object) => {
      if (object instanceof THREE.Points) {
        object.geometry.dispose();
        object.material.dispose();
      }
      if (object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        object.material.dispose();
      }
      if (object instanceof THREE.Sprite) {
        object.material.dispose();
      }
    });
  };

  return { root, update, dispose };
}
