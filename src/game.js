import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const ZONES = [
  { name: 'VIOLETA', bg: 0x05030d, fog: 0x090517, primary: 0x7c42ff, secondary: 0x58f7ff },
  { name: 'CARMESIM', bg: 0x0b0209, fog: 0x17030d, primary: 0xff245f, secondary: 0xff8d35 },
  { name: 'ABISSAL', bg: 0x01080c, fog: 0x02151b, primary: 0x13d8d2, secondary: 0x62ff8f },
  { name: 'SOLAR', bg: 0x0c0701, fog: 0x1a0c02, primary: 0xffb31f, secondary: 0xff4d7d },
  { name: 'SINGULAR', bg: 0x03020a, fog: 0x0b0317, primary: 0xe84bff, secondary: 0xffffff },
];

const clamp = THREE.MathUtils.clamp;
const rand = (min, max) => THREE.MathUtils.randFloat(min, max);

export class RiftRider {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.state = 'menu';
    this.clock = new THREE.Clock();
    this.time = 0;
    this.entities = [];
    this.effects = [];
    this.rings = [];
    this.input = { x: 0, y: 0, boost: false };
    this.keys = new Set();
    this.score = 0;
    this.shards = 0;
    this.combo = 1;
    this.bestCombo = 1;
    this.comboTimer = 0;
    this.energy = 1;
    this.shield = false;
    this.distance = 0;
    this.speed = 28;
    this.spawnDistance = 0;
    this.wave = 0;
    this.shake = 0;
    this.zoneIndex = 0;

    this.setupRenderer();
    this.setupWorld();
    this.setupInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.update());
  }

  setupRenderer() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(ZONES[0].bg);
    this.scene.fog = new THREE.FogExp2(ZONES[0].fog, 0.018);

    this.camera = new THREE.PerspectiveCamera(66, 1, 0.1, 240);
    this.camera.position.set(0, 1.35, 9.4);
    this.camera.lookAt(0, 0, -22);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.55));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.18, 0.5, 0.16);
    this.composer.addPass(this.bloomPass);
  }

  setupWorld() {
    this.world = new THREE.Group();
    this.scene.add(this.world);

    const hemi = new THREE.HemisphereLight(0x8fdcff, 0x180524, 1.6);
    this.scene.add(hemi);
    this.keyLight = new THREE.PointLight(0xb154ff, 38, 30, 2);
    this.keyLight.position.set(0, 4, 7);
    this.scene.add(this.keyLight);

    this.createStars();
    this.createTunnel();
    this.createShip();
    this.createHorizonCore();
  }

  createStars() {
    const count = 950;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color(0x8aefff);
    const c2 = new THREE.Color(0xff48ba);
    for (let i = 0; i < count; i++) {
      const radius = rand(7, 36);
      const a = rand(0, Math.PI * 2);
      positions[i * 3] = Math.cos(a) * radius;
      positions[i * 3 + 1] = Math.sin(a) * radius;
      positions[i * 3 + 2] = rand(-210, 20);
      const color = Math.random() > 0.72 ? c2 : c1;
      colors.set([color.r, color.g, color.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ size: 0.085, vertexColors: true, transparent: true, opacity: 0.76, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.scene.add(this.stars);
  }

  createTunnel() {
    const ringGeometry = new THREE.TorusGeometry(8.2, 0.035, 5, 72);
    for (let i = 0; i < 24; i++) {
      const material = new THREE.MeshBasicMaterial({ color: i % 5 === 0 ? 0xff3cac : 0x6b39d4, transparent: true, opacity: i % 5 === 0 ? 0.5 : 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
      const ring = new THREE.Mesh(ringGeometry, material);
      ring.position.z = -i * 8;
      ring.rotation.z = (i * 0.17) % Math.PI;
      ring.scale.setScalar(1 + Math.sin(i * 1.9) * 0.055);
      ring.userData.major = i % 5 === 0;
      this.rings.push(ring);
      this.world.add(ring);
    }

    const railMaterial = new THREE.MeshBasicMaterial({ color: 0x391a79, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending });
    const railGeometry = new THREE.BoxGeometry(0.03, 0.03, 190);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rail = new THREE.Mesh(railGeometry, railMaterial.clone());
      rail.position.set(Math.cos(a) * 8.15, Math.sin(a) * 8.15, -85);
      this.world.add(rail);
    }
  }

  createShip() {
    this.ship = new THREE.Group();
    this.ship.position.set(0, -0.25, 0);

    const hullMaterial = new THREE.MeshStandardMaterial({ color: 0x171625, metalness: 0.85, roughness: 0.2, emissive: 0x130827, emissiveIntensity: 1.2 });
    const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0x62f8ff });
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x281342, metalness: 0.8, roughness: 0.24, emissive: 0x4c1680, emissiveIntensity: 1.4, side: THREE.DoubleSide });

    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.46, 2.45, 6), hullMaterial);
    hull.rotation.x = -Math.PI / 2;
    hull.position.z = -0.18;
    hull.scale.set(1, 1, 0.72);
    this.ship.add(hull);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshBasicMaterial({ color: 0x8dfaff, transparent: true, opacity: 0.82 }));
    cockpit.scale.set(0.72, 0.45, 1.35);
    cockpit.position.set(0, 0.25, -0.28);
    this.ship.add(cockpit);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -0.65);
    wingShape.lineTo(2.25, 0.62);
    wingShape.lineTo(0.72, 0.45);
    wingShape.lineTo(0, 0.95);
    wingShape.closePath();
    const wingGeometry = new THREE.ShapeGeometry(wingShape);
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.rotation.x = -Math.PI / 2;
    leftWing.rotation.z = Math.PI / 2;
    leftWing.position.set(-0.06, -0.08, 0.34);
    leftWing.scale.set(0.82, 0.82, 0.82);
    this.ship.add(leftWing);
    const rightWing = leftWing.clone();
    rightWing.rotation.z = -Math.PI / 2;
    rightWing.position.x = 0.06;
    this.ship.add(rightWing);

    for (const x of [-0.5, 0.5]) {
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 0.55, 10), hullMaterial);
      engine.rotation.x = Math.PI / 2;
      engine.position.set(x, -0.07, 0.75);
      this.ship.add(engine);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), edgeMaterial);
      glow.position.set(x, -0.07, 1.08);
      glow.scale.z = 2.3;
      this.ship.add(glow);
    }

    this.trails = [];
    for (const x of [-0.5, 0.5]) {
      const trail = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 2.8, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x66f8ff, transparent: true, opacity: 0.56, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      trail.rotation.x = Math.PI / 2;
      trail.position.set(x, -0.07, 2.38);
      this.ship.add(trail);
      this.trails.push(trail);
    }

    this.shieldBubble = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.55, 2),
      new THREE.MeshBasicMaterial({ color: 0x55f5ff, wireframe: true, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending }),
    );
    this.shieldBubble.scale.z = 1.25;
    this.shieldBubble.visible = false;
    this.ship.add(this.shieldBubble);

    this.world.add(this.ship);
  }

  createHorizonCore() {
    this.core = new THREE.Group();
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(2.3, 28, 18), new THREE.MeshBasicMaterial({ color: 0x5c21ff, transparent: true, opacity: 0.13, wireframe: true, blending: THREE.AdditiveBlending }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.core.add(sphere, glow);
    this.core.position.z = -190;
    this.world.add(this.core);
  }

  setupInput() {
    window.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (event.code === 'Space') this.input.boost = true;
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      if (event.code === 'Space') this.input.boost = false;
    });
  }

  setMove(x, y) {
    this.input.x = clamp(x, -1, 1);
    this.input.y = clamp(y, -1, 1);
  }

  setBoost(active) {
    this.input.boost = active;
  }

  reset() {
    for (const entity of this.entities) this.world.remove(entity.object);
    for (const effect of this.effects) this.world.remove(effect.object);
    this.entities.length = 0;
    this.effects.length = 0;
    this.score = 0;
    this.shards = 0;
    this.combo = 1;
    this.bestCombo = 1;
    this.comboTimer = 0;
    this.energy = 1;
    this.shield = false;
    this.distance = 0;
    this.speed = 28;
    this.spawnDistance = 38;
    this.wave = 0;
    this.zoneIndex = 0;
    this.ship.position.set(0, -0.25, 0);
    this.ship.rotation.set(0, 0, 0);
    this.ship.visible = true;
    this.shieldBubble.visible = false;
    this.applyZone(0, true);
  }

  start() {
    this.reset();
    this.state = 'running';
    this.clock.getDelta();
    this.callbacks.onState?.('running');
    this.callbacks.onHud?.(this.getHud());
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.input.boost = false;
    this.callbacks.onState?.('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.clock.getDelta();
    this.callbacks.onState?.('running');
  }

  showMenu() {
    this.state = 'menu';
    this.reset();
    this.callbacks.onState?.('menu');
  }

  getHud() {
    return {
      score: Math.floor(this.score),
      zone: this.zoneIndex + 1,
      zoneName: ZONES[this.zoneIndex].name,
      combo: this.combo,
      comboProgress: this.combo <= 1 ? 0 : clamp(this.comboTimer / 4, 0, 1),
      energy: this.energy,
      shield: this.shield,
      shards: this.shards,
      bestCombo: this.bestCombo,
      boosting: this.input.boost && this.energy > 0.02,
    };
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.034);
    this.time += dt;
    this.animateAmbient(dt);

    if (this.state === 'running') this.updateGame(dt);
    else if (this.state === 'menu') this.updateMenu(dt);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.8);
      this.camera.position.x = rand(-this.shake, this.shake);
      this.camera.position.y = 1.35 + rand(-this.shake, this.shake);
    } else {
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, 0, dt * 8);
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, 1.35, dt * 8);
    }
    this.composer.render();
  }

  animateAmbient(dt) {
    this.core.rotation.x += dt * 0.14;
    this.core.rotation.y -= dt * 0.2;
    this.core.children[1].scale.setScalar(1 + Math.sin(this.time * 2.1) * 0.12);
    this.shieldBubble.rotation.y += dt * 0.8;
    this.shieldBubble.rotation.z -= dt * 0.4;
    this.shieldBubble.material.opacity = 0.17 + Math.sin(this.time * 6) * 0.06;
  }

  updateMenu(dt) {
    const drift = 7;
    this.moveWorld(dt, drift);
    this.ship.position.x = Math.sin(this.time * 0.55) * 0.45;
    this.ship.position.y = -0.25 + Math.sin(this.time * 0.9) * 0.12;
    this.ship.rotation.z = Math.sin(this.time * 0.55) * -0.08;
    this.ship.rotation.x = Math.sin(this.time * 0.7) * 0.025;
    this.trails.forEach((trail, i) => { trail.scale.y = 0.7 + Math.sin(this.time * 7 + i) * 0.1; });
  }

  moveWorld(dt, speed) {
    for (const ring of this.rings) {
      ring.position.z += speed * dt;
      ring.rotation.z += dt * (ring.userData.major ? 0.055 : -0.022);
      if (ring.position.z > 12) ring.position.z -= 192;
    }
    const positions = this.stars.geometry.attributes.position.array;
    for (let i = 2; i < positions.length; i += 3) {
      positions[i] += speed * dt * 0.72;
      if (positions[i] > 18) positions[i] = -205;
    }
    this.stars.geometry.attributes.position.needsUpdate = true;
  }

  updateGame(dt) {
    const keyX = (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0);
    const keyY = (this.keys.has('ArrowUp') || this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('ArrowDown') || this.keys.has('KeyS') ? 1 : 0);
    const moveX = keyX || this.input.x;
    const moveY = keyY || this.input.y;
    const boosting = this.input.boost && this.energy > 0.018;

    if (boosting) this.energy = Math.max(0, this.energy - dt * 0.19);
    else this.energy = Math.min(1, this.energy + dt * 0.075);

    const baseSpeed = Math.min(50, 28 + this.distance * 0.00125);
    this.speed = THREE.MathUtils.lerp(this.speed, baseSpeed * (boosting ? 1.68 : 1), dt * 3.4);
    this.distance += this.speed * dt;
    this.score += this.speed * dt * (boosting ? 2.2 : 1) * (1 + (this.combo - 1) * 0.11);

    const targetX = clamp(moveX, -1, 1) * 5.25;
    const targetY = clamp(moveY, -1, 1) * 3.45 - 0.15;
    this.ship.position.x = THREE.MathUtils.damp(this.ship.position.x, targetX, 7.2, dt);
    this.ship.position.y = THREE.MathUtils.damp(this.ship.position.y, targetY, 7.2, dt);
    this.ship.rotation.z = THREE.MathUtils.damp(this.ship.rotation.z, -moveX * 0.42, 6, dt);
    this.ship.rotation.x = THREE.MathUtils.damp(this.ship.rotation.x, moveY * 0.16, 6, dt);
    this.ship.rotation.y = THREE.MathUtils.damp(this.ship.rotation.y, -moveX * 0.08, 6, dt);
    this.ship.scale.setScalar(1 + (boosting ? 0.045 : 0));
    this.trails.forEach((trail, i) => {
      trail.scale.set(1 + (boosting ? 0.55 : 0), 1 + (boosting ? 1.35 : 0) + Math.sin(this.time * 12 + i) * 0.08, 1);
      trail.material.opacity = boosting ? 0.88 : 0.5;
    });

    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.comboTimer = 0;
      }
    }

    this.spawnDistance -= this.speed * dt;
    if (this.spawnDistance <= 0) this.spawnWave();
    this.moveWorld(dt, this.speed);
    this.updateEntities(dt);
    this.updateEffects(dt);

    const nextZone = Math.min(ZONES.length - 1, Math.floor(this.distance / 1250));
    if (nextZone !== this.zoneIndex) {
      this.zoneIndex = nextZone;
      this.applyZone(nextZone);
      this.callbacks.onToast?.(`ZONA ${String(nextZone + 1).padStart(2, '0')} // ${ZONES[nextZone].name}`);
    }
    this.callbacks.onHud?.(this.getHud());
  }

  spawnWave() {
    this.wave += 1;
    const spacing = Math.max(30, 42 - this.distance * 0.0018);
    this.spawnDistance = spacing + rand(-4, 7);
    const laneX = rand(-4.3, 4.3);
    const laneY = rand(-2.8, 2.8);
    const pattern = this.wave % 6;

    if (pattern === 1 || pattern === 4) {
      const endX = clamp(laneX + rand(-3.5, 3.5), -4.5, 4.5);
      const endY = clamp(laneY + rand(-2.2, 2.2), -3, 3);
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        this.spawnShard(THREE.MathUtils.lerp(laneX, endX, t), THREE.MathUtils.lerp(laneY, endY, t), -108 - i * 5.2);
      }
      if (pattern === 4) this.spawnMine(-laneX * 0.7, -laneY * 0.5, -124);
    } else if (pattern === 2) {
      this.spawnSpinner(rand(-1.6, 1.6), rand(-0.8, 0.8), -116);
      for (let i = 0; i < 4; i++) this.spawnShard(laneX, laneY, -130 - i * 5.4);
    } else if (pattern === 3) {
      this.spawnGate(laneX, laneY, -118);
      for (let i = 0; i < 4; i++) this.spawnShard(laneX, laneY, -121 - i * 4.5);
    } else if (pattern === 5) {
      this.spawnMine(laneX, laneY, -114);
      const safeX = laneX > 0 ? laneX - 3.2 : laneX + 3.2;
      for (let i = 0; i < 5; i++) this.spawnShard(clamp(safeX, -4.4, 4.4), clamp(-laneY * 0.45, -2.8, 2.8), -118 - i * 4.8);
    } else {
      const radius = 2.1;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.spawnShard(Math.cos(a) * radius, Math.sin(a) * radius, -118 - (i % 2) * 2.5);
      }
      if (this.wave % 12 === 0 || (this.wave > 8 && Math.random() < 0.18)) this.spawnShield(0, 0, -130);
    }
  }

  spawnShard(x, y, z) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.33, 0),
      new THREE.MeshBasicMaterial({ color: 0x6ffbff, transparent: true, opacity: 0.92 }),
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.025, 5, 24),
      new THREE.MeshBasicMaterial({ color: 0xa4ffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }),
    );
    group.add(mesh, halo);
    group.position.set(x, y, z);
    this.world.add(group);
    this.entities.push({ kind: 'shard', object: group, radius: 0.62, spin: rand(-2.2, 2.2), collected: false });
  }

  spawnShield(x, y, z) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.055, 7, 28), new THREE.MeshBasicMaterial({ color: 0x58f7ff, blending: THREE.AdditiveBlending }));
    const ring2 = ring.clone();
    ring2.rotation.x = Math.PI / 2;
    group.add(core, ring, ring2);
    group.position.set(x, y, z);
    this.world.add(group);
    this.entities.push({ kind: 'shield', object: group, radius: 0.85, spin: 1.8 });
  }

  spawnMine(x, y, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.9, 1),
      new THREE.MeshStandardMaterial({ color: 0x160c22, metalness: 0.85, roughness: 0.28, emissive: 0xff174f, emissiveIntensity: 1.2, wireframe: false }),
    );
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.04, 1), new THREE.MeshBasicMaterial({ color: 0xff315f, wireframe: true, transparent: true, opacity: 0.6 }));
    group.add(body, wire);
    for (let i = 0; i < 8; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.72, 5), new THREE.MeshBasicMaterial({ color: 0xff375e }));
      const direction = new THREE.Vector3(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1).normalize();
      spike.position.copy(direction).multiplyScalar(1.2);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      group.add(spike);
    }
    group.position.set(x, y, z);
    this.world.add(group);
    this.entities.push({ kind: 'obstacle', subtype: 'mine', object: group, radius: 1.15, spin: rand(-1.5, 1.5), passed: false });
  }

  spawnSpinner(x, y, z) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x1d0d2a, metalness: 0.9, roughness: 0.2, emissive: 0xff2f90, emissiveIntensity: 1.6 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.38, 0.42), material);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.72, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    core.rotation.x = Math.PI / 2;
    group.add(bar, core);
    group.position.set(x, y, z);
    group.rotation.z = rand(0, Math.PI);
    this.world.add(group);
    this.entities.push({ kind: 'obstacle', subtype: 'spinner', object: group, radius: 0.62, width: 4.2, spin: rand(0.8, 1.3), passed: false });
  }

  spawnGate(gapX, gapY, z) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x171020, metalness: 0.86, roughness: 0.24, emissive: 0x8b31ff, emissiveIntensity: 1.5 });
    const edge = new THREE.MeshBasicMaterial({ color: 0xc58cff, wireframe: true, transparent: true, opacity: 0.75 });
    const gapWidth = 2.75;
    const leftWidth = Math.max(0.7, 8.2 + gapX - gapWidth / 2);
    const rightWidth = Math.max(0.7, 8.2 - gapX - gapWidth / 2);
    const left = new THREE.Mesh(new THREE.BoxGeometry(leftWidth, 7.2, 0.55), material);
    left.position.x = -8.2 + leftWidth / 2;
    const right = new THREE.Mesh(new THREE.BoxGeometry(rightWidth, 7.2, 0.55), material);
    right.position.x = 8.2 - rightWidth / 2;
    const top = new THREE.Mesh(new THREE.BoxGeometry(gapWidth, Math.max(0.6, 5.4 - gapY), 0.55), material);
    top.position.set(gapX, 3.6 - top.geometry.parameters.height / 2, 0);
    const bottomHeight = Math.max(0.6, 5.4 + gapY);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(gapWidth, bottomHeight, 0.55), material);
    bottom.position.set(gapX, -3.6 + bottomHeight / 2, 0);
    group.add(left, right, top, bottom);
    for (const piece of [left, right, top, bottom]) {
      const outline = new THREE.Mesh(piece.geometry, edge);
      outline.position.copy(piece.position);
      outline.scale.setScalar(1.008);
      group.add(outline);
    }
    group.position.z = z;
    this.world.add(group);
    this.entities.push({ kind: 'obstacle', subtype: 'gate', object: group, radius: 0.75, gapX, gapY, gapWidth: gapWidth * 0.5, gapHeight: 1.18, passed: false });
  }

  updateEntities(dt) {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      entity.object.position.z += this.speed * dt;
      if (entity.kind === 'shard' || entity.kind === 'shield') {
        entity.object.rotation.y += dt * entity.spin;
        entity.object.rotation.z += dt * 1.25;
        entity.object.scale.setScalar(1 + Math.sin(this.time * 5 + i) * 0.08);
      } else if (entity.subtype === 'mine') {
        entity.object.rotation.x += dt * entity.spin;
        entity.object.rotation.y += dt * entity.spin * 0.7;
      } else if (entity.subtype === 'spinner') {
        entity.object.rotation.z += dt * entity.spin;
      }

      const dz = Math.abs(entity.object.position.z - this.ship.position.z);
      if (dz < 1.25) this.checkCollision(entity, i);

      if (entity.object.position.z > 3 && entity.kind === 'obstacle' && !entity.passed) {
        entity.passed = true;
        if (this.isNearMiss(entity)) {
          this.score += 125 * this.combo;
          this.bumpCombo();
          this.callbacks.onNearMiss?.();
          this.callbacks.onToast?.('QUASE! +125');
        }
      }

      if (entity.object.position.z > 18) this.removeEntity(i);
    }
  }

  checkCollision(entity, index) {
    const sx = this.ship.position.x;
    const sy = this.ship.position.y;
    let hit = false;
    if (entity.subtype === 'gate') {
      hit = Math.abs(sx - entity.gapX) > entity.gapWidth || Math.abs(sy - entity.gapY) > entity.gapHeight;
    } else if (entity.subtype === 'spinner') {
      const dx = sx - entity.object.position.x;
      const dy = sy - entity.object.position.y;
      const c = Math.cos(-entity.object.rotation.z);
      const s = Math.sin(-entity.object.rotation.z);
      const lx = dx * c - dy * s;
      const ly = dx * s + dy * c;
      hit = Math.abs(lx) < entity.width + 0.55 && Math.abs(ly) < 0.62;
    } else {
      const dx = sx - entity.object.position.x;
      const dy = sy - entity.object.position.y;
      hit = Math.hypot(dx, dy) < entity.radius + 0.52;
    }
    if (!hit) return;

    if (entity.kind === 'shard') {
      this.collectShard(entity.object.position);
      this.removeEntity(index);
    } else if (entity.kind === 'shield') {
      this.shield = true;
      this.shieldBubble.visible = true;
      this.score += 250;
      this.callbacks.onShield?.();
      this.callbacks.onToast?.('ESCUDO DE FASE');
      this.removeEntity(index);
    } else if (entity.kind === 'obstacle') {
      if (this.shield) {
        this.shield = false;
        this.shieldBubble.visible = false;
        this.shake = 0.26;
        this.score += 180;
        this.explode(entity.object.position, ZONES[this.zoneIndex].secondary, 22);
        this.callbacks.onShieldBreak?.();
        this.callbacks.onToast?.('ESCUDO ROMPIDO');
        this.removeEntity(index);
      } else {
        this.crash(entity.object.position);
      }
    }
  }

  isNearMiss(entity) {
    const sx = this.ship.position.x;
    const sy = this.ship.position.y;
    if (entity.subtype === 'gate') {
      const edgeX = Math.abs(Math.abs(sx - entity.gapX) - entity.gapWidth);
      const edgeY = Math.abs(Math.abs(sy - entity.gapY) - entity.gapHeight);
      return Math.min(edgeX, edgeY) < 0.42;
    }
    const distance = Math.hypot(sx - entity.object.position.x, sy - entity.object.position.y);
    return distance < (entity.subtype === 'spinner' ? 4.9 : entity.radius + 1.15);
  }

  collectShard(position) {
    this.shards += 1;
    this.score += 70 * this.combo;
    this.energy = Math.min(1, this.energy + 0.055);
    this.bumpCombo();
    this.explode(position, 0x70fbff, 8);
    this.callbacks.onShard?.(this.combo);
    if (this.combo === 5 || this.combo === 10 || this.combo === 15) this.callbacks.onToast?.(`FLUXO ×${this.combo}`);
  }

  bumpCombo() {
    this.combo = Math.min(20, this.combo + 1);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = 4;
  }

  removeEntity(index) {
    const entity = this.entities[index];
    if (!entity) return;
    this.world.remove(entity.object);
    this.disposeObject(entity.object);
    this.entities.splice(index, 1);
  }

  explode(position, color, count = 18) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      velocities.push(new THREE.Vector3(rand(-3.8, 3.8), rand(-3.8, 3.8), rand(-2, 5.5)));
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: 0.16, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.world.add(points);
    this.effects.push({ object: points, velocities, life: 0.75, maxLife: 0.75 });
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt;
      const positions = effect.object.geometry.attributes.position.array;
      for (let p = 0; p < effect.velocities.length; p++) {
        const velocity = effect.velocities[p];
        positions[p * 3] += velocity.x * dt;
        positions[p * 3 + 1] += velocity.y * dt;
        positions[p * 3 + 2] += (velocity.z + this.speed * 0.3) * dt;
        velocity.multiplyScalar(0.97);
      }
      effect.object.geometry.attributes.position.needsUpdate = true;
      effect.object.material.opacity = Math.max(0, effect.life / effect.maxLife);
      if (effect.life <= 0) {
        this.world.remove(effect.object);
        effect.object.geometry.dispose();
        effect.object.material.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  crash(position) {
    if (this.state !== 'running') return;
    this.state = 'over';
    this.input.boost = false;
    this.shake = 0.52;
    this.explode(this.ship.position, 0xff315f, 52);
    this.explode(position, 0xffffff, 25);
    this.ship.visible = false;
    this.callbacks.onCrash?.({ score: Math.floor(this.score), shards: this.shards, bestCombo: this.bestCombo });
    this.callbacks.onState?.('over');
  }

  applyZone(index, immediate = false) {
    const zone = ZONES[index];
    this.scene.background.setHex(zone.bg);
    this.scene.fog.color.setHex(zone.fog);
    this.keyLight.color.setHex(zone.primary);
    this.core.children[0].material.color.setHex(zone.primary);
    this.core.children[1].material.color.setHex(zone.secondary);
    for (const ring of this.rings) ring.material.color.setHex(ring.userData.major ? zone.secondary : zone.primary);
    this.bloomPass.strength = immediate ? 1.18 : 1.38;
  }

  disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
  }

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.fov = width / height < 1.25 ? 72 : 66;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }
}
