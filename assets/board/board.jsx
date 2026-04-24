// board.jsx — The <Monopoly3D /> component.
// Renders a Three.js scene with:
//   - square wooden board (40 tile spots)
//   - colored bands + title textures on tiles (generated via tileFaceCanvas)
//   - top-hat token that can be moved via click-jump, WASD drive, dice roll, or walk
//   - tile hover highlight and selection modal
//   - orbit camera (damped) with sensible bounds
//
// Designed to be embedded inside a fixed-size card (e.g. 720x720).
// Props:
//   theme  — key into THEMES ('ivy' | 'library' | 'crimson')
//   modeDefault — 'drive' | 'roll' | 'walk' | 'click'
//   id     — unique id, in case several boards live on one page

const { useRef, useEffect, useState, useMemo, useCallback, useLayoutEffect } = React;

// ─── Layout math ──────────────────────────────────────────────────────────
// 20-tile layout: 4 corners + 4 property tiles per side.
// Exaggerated tile size — deep tiles on a board that's mostly ring, tiny center.
const NUM_TILES = 20;
const TILES_PER_SIDE = 4;
const T_SHORT = 5.6;   // corner size / tile depth (perpendicular to edge) — HUGE
const T_LONG  = 4.4;   // property width along edge
const BOARD_W = T_SHORT * 2 + T_LONG * TILES_PER_SIDE; // = 11.2 + 17.6 = 28.8
const HALF = BOARD_W / 2;
// Center square = BOARD_W - 2*T_SHORT = 17.6 units (down from 19.8). Ring is much fatter.
const TILE_H = 0.2;    // thickness of raised tile
const BOARD_H = 0.3;

// Compute (x, z, rotationY, orient) for tile index 0..19
// 0 = bottom-right corner (GO), 1..4 = bottom side (right-to-left),
// 5 = bottom-left corner (Jail), 6..9 = left side (bottom-to-top),
// 10 = top-left corner, 11..14 = top side (left-to-right),
// 15 = top-right corner, 16..19 = right side (top-to-bottom).
function tilePos(i) {
  // bottom corner centers at (HALF - T_SHORT/2, HALF - T_SHORT/2)
  // We lay tiles on the ground plane (y = 0), z decreasing upward.
  // Using Three.js convention: x right, y up, z toward camera.
  // Bottom row: z = +HALF - T_SHORT/2 (near camera)
  // Top row:    z = -HALF + T_SHORT/2
  // Left col:   x = -HALF + T_SHORT/2
  // Right col:  x = +HALF - T_SHORT/2
  const edgeOff = HALF - T_SHORT / 2;            // center of corner-tile
  const propStart = HALF - T_SHORT - T_LONG / 2; // center of first property next to a corner
  if (i === 0)  return { x:  edgeOff, z:  edgeOff, rot: 0, w: T_SHORT, h: T_SHORT, orient: 'corner' };
  if (i === 5)  return { x: -edgeOff, z:  edgeOff, rot: 0, w: T_SHORT, h: T_SHORT, orient: 'corner' };
  if (i === 10) return { x: -edgeOff, z: -edgeOff, rot: 0, w: T_SHORT, h: T_SHORT, orient: 'corner' };
  if (i === 15) return { x:  edgeOff, z: -edgeOff, rot: 0, w: T_SHORT, h: T_SHORT, orient: 'corner' };

  if (i >= 1 && i <= 4) {
    // bottom row (right-to-left) — text reads toward +z (toward camera)
    const x = propStart - (i - 1) * T_LONG;
    return { x, z: edgeOff, rot: 0, w: T_LONG, h: T_SHORT, orient: 'bottom' };
  }
  if (i >= 6 && i <= 9) {
    // left column — no mesh rotation; geometry swapped (long along z)
    const z = propStart - (i - 6) * T_LONG;
    return { x: -edgeOff, z, rot: 0, w: T_SHORT, h: T_LONG, orient: 'left' };
  }
  if (i >= 11 && i <= 14) {
    // top row — 180° around Y so text reads toward camera
    const x = -propStart + (i - 11) * T_LONG;
    return { x, z: -edgeOff, rot: Math.PI, w: T_LONG, h: T_SHORT, orient: 'top' };
  }
  if (i >= 16 && i <= 19) {
    // right column — no mesh rotation; geometry swapped
    const z = -propStart + (i - 16) * T_LONG;
    return { x: edgeOff, z, rot: 0, w: T_SHORT, h: T_LONG, orient: 'right' };
  }
  return { x: 0, z: 0, rot: 0, w: T_LONG, h: T_SHORT, orient: 'bottom' };
}

// Token rest position — sit inside a tile near the inner edge
function tokenTarget(i, lanePhase = 0) {
  const p = tilePos(i);
  // pull token toward center of the board (inner edge of tile)
  const inwardDepth = T_SHORT * 0.28;
  // Determine inward direction based on which side
  let dx = 0, dz = 0;
  if (i === 0)  { dx = -inwardDepth; dz = -inwardDepth; }
  else if (i === 5)  { dx =  inwardDepth; dz = -inwardDepth; }
  else if (i === 10) { dx =  inwardDepth; dz =  inwardDepth; }
  else if (i === 15) { dx = -inwardDepth; dz =  inwardDepth; }
  else if (p.orient === 'bottom') dz = -inwardDepth;
  else if (p.orient === 'top')    dz =  inwardDepth;
  else if (p.orient === 'left')   dx =  inwardDepth;
  else if (p.orient === 'right')  dx = -inwardDepth;
  return { x: p.x + dx, z: p.z + dz, rot: p.rot };
}

// Build a top-hat mesh
function buildTopHat(theme, THREE) {
  const group = new THREE.Group();
  const hatColor = new THREE.Color(theme.hatColor);
  const bandColor = new THREE.Color(theme.hatBand);
  const bodyMat = new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.45, metalness: 0.1 });
  const bandMat = new THREE.MeshStandardMaterial({ color: bandColor, roughness: 0.5, metalness: 0.2 });

  // brim
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.08, 40), bodyMat);
  brim.position.y = 0.04;
  brim.castShadow = true;
  group.add(brim);

  // main stovepipe
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.7, 40), bodyMat);
  body.position.y = 0.43;
  body.castShadow = true;
  group.add(body);

  // band
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 40), bandMat);
  band.position.y = 0.12;
  group.add(band);

  // top cap (slight highlight)
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.35, 0.04, 40),
    new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.35, metalness: 0.15 }));
  top.position.y = 0.78;
  group.add(top);

  return group;
}

function Monopoly3D({ theme: themeKey = 'ivy', modeDefault = 'drive', id = 'board' }) {
  const theme = THEMES[themeKey] || THEMES.ivy;
  const canvasRef = useRef(null);
  const mountRef = useRef(null);
  const stateRef = useRef({
    THREE: null, scene: null, camera: null, renderer: null, raycaster: null,
    tiles: [], token: null, tokenPos: { x: 0, z: 0, y: 0.5, rotY: 0 },
    tokenTargetIdx: 0, moveQueue: [], lastTime: 0,
    driveVel: { x: 0, z: 0 }, driveKeys: new Set(),
    hovered: -1, hoverRing: null, selectRing: null,
    camOrbit: { theta: Math.PI / 4, phi: Math.PI / 3.2, r: 46, target: { x: 0, y: 0, z: 0 } },
    dragging: null,
    pointerJustMoved: false,
    pointerDownAt: null,
  });

  const [mode, setMode] = useState(modeDefault);
  const [currentTile, setCurrentTile] = useState(0);
  const [openTile, setOpenTile] = useState(null); // tile id
  const [rolling, setRolling] = useState(false);
  const [dice, setDice] = useState([null, null]);
  const [hoverLabel, setHoverLabel] = useState(null);
  const [hatReady, setHatReady] = useState(false);
  const [showHelp, setShowHelp] = useState(true);

  // Modal click helper
  const openTileData = openTile != null ? TILES.find(t => t.id === openTile) : null;

  // ── Scene setup ────────────────────────────────────────────────────────
  useEffect(() => {
    const THREE = window.THREE;
    if (!THREE) return;
    const canvas = canvasRef.current;
    const mount = mountRef.current;
    if (!canvas || !mount) return;

    const st = stateRef.current;
    st.THREE = THREE;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.sky);
    if (theme.fog > 0) scene.fog = new THREE.FogExp2(theme.sky, theme.fog);
    st.scene = scene;

    const width = mount.clientWidth;
    const height = mount.clientHeight;
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 200);
    camera.position.set(34, 32, 34);
    camera.lookAt(0, 0, 0);
    st.camera = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    st.renderer = renderer;

    // ── Lighting ────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff3d9, 1.1);
    key.position.set(20, 30, 15);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -25;
    key.shadow.camera.right = 25;
    key.shadow.camera.top = 25;
    key.shadow.camera.bottom = -25;
    key.shadow.camera.near = 5;
    key.shadow.camera.far = 80;
    key.shadow.bias = -0.0008;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x9eb2c6, 0.3);
    fill.position.set(-15, 12, -10);
    scene.add(fill);

    // Crimson theme gets a warmer rim light
    if (themeKey === 'crimson') {
      const rim = new THREE.PointLight(0xffb070, 0.8, 80, 2);
      rim.position.set(0, 18, 0);
      scene.add(rim);
    }

    // ── Ground ─────────────────────────────────────────────────────────
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.ground), roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // Subtle ground pattern: a second, slightly lighter plane with a large-dot texture
    const patC = document.createElement('canvas');
    patC.width = patC.height = 512;
    const pctx = patC.getContext('2d');
    pctx.fillStyle = theme.ground; pctx.fillRect(0, 0, 512, 512);
    pctx.fillStyle = theme.groundAlt;
    for (let gy = 0; gy < 512; gy += 64) {
      for (let gx = 0; gx < 512; gx += 64) {
        if (((gx + gy) / 64) % 2 === 0) pctx.fillRect(gx, gy, 64, 64);
      }
    }
    const gTex = new THREE.CanvasTexture(patC);
    gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping;
    gTex.repeat.set(8, 8);
    ground.material.map = gTex;
    ground.material.needsUpdate = true;

    // ── Board base ─────────────────────────────────────────────────────
    const boardMat = [
      // sides (edge)
      new THREE.MeshStandardMaterial({ color: theme.boardEdge, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: theme.boardEdge, roughness: 0.6 }),
      // top — replaced below with canvas texture
      new THREE.MeshStandardMaterial({ color: theme.board, roughness: 0.7 }),
      // bottom
      new THREE.MeshStandardMaterial({ color: theme.boardEdge, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: theme.boardEdge, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: theme.boardEdge, roughness: 0.6 }),
    ];
    const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W, BOARD_H, BOARD_W), boardMat);
    board.position.y = BOARD_H / 2;
    board.castShadow = true; board.receiveShadow = true;
    scene.add(board);

    // center face canvas
    const cCanvas = CENTER_FACE(theme);
    const cTex = new THREE.CanvasTexture(cCanvas);
    cTex.anisotropy = 8;
    // Apply to the top face (index 2 in BoxGeometry)
    board.material[2] = new THREE.MeshStandardMaterial({ map: cTex, roughness: 0.7 });

    // ── Tiles ──────────────────────────────────────────────────────────
    const tileGroup = new THREE.Group();
    scene.add(tileGroup);
    st.tiles = [];

    for (let i = 0; i < NUM_TILES; i++) {
      const pos = tilePos(i);
      const tile = TILES[i];

      const faceCanvas = TILE_FACE(tile, theme, pos.orient);
      const faceTex = new THREE.CanvasTexture(faceCanvas);
      faceTex.anisotropy = 8;

      const matSide = new THREE.MeshStandardMaterial({ color: theme.tileFace, roughness: 0.7 });
      const matFace = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.6 });

      // Box materials: [px, nx, py, ny, pz, nz]
      const mats = [matSide, matSide, matFace, matSide, matSide, matSide];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(pos.w, TILE_H, pos.h), mats);
      mesh.position.set(pos.x, BOARD_H + TILE_H / 2, pos.z);
      mesh.rotation.y = pos.rot;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.tileIndex = i;
      tileGroup.add(mesh);
      st.tiles.push(mesh);
    }

    // ── Hover ring ─────────────────────────────────────────────────────
    const hoverRing = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.14, 40),
      new THREE.MeshBasicMaterial({ color: theme.accent2, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    hoverRing.rotation.x = -Math.PI / 2;
    hoverRing.position.y = BOARD_H + TILE_H + 0.01;
    hoverRing.visible = false;
    scene.add(hoverRing);
    st.hoverRing = hoverRing;

    const selectRing = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.16, 40),
      new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
    );
    selectRing.rotation.x = -Math.PI / 2;
    selectRing.position.y = BOARD_H + TILE_H + 0.005;
    scene.add(selectRing);
    st.selectRing = selectRing;

    // ── Token (top hat) ─────────────────────────────────────────────────
    const hat = buildTopHat(theme, THREE);
    hat.position.y = BOARD_H + TILE_H;
    scene.add(hat);
    st.token = hat;
    const start = tokenTarget(0);
    hat.position.x = start.x;
    hat.position.z = start.z;
    st.tokenPos = { x: start.x, z: start.z, y: BOARD_H + TILE_H, rotY: 0 };
    setHatReady(true);

    // ── Pointer / interaction ──────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    st.raycaster = raycaster;

    const setPointer = (ev) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    };

    const onMove = (ev) => {
      setPointer(ev);
      if (st.dragging) {
        st.pointerJustMoved = true;
        const dx = ev.clientX - st.dragging.lx;
        const dy = ev.clientY - st.dragging.ly;
        st.dragging.lx = ev.clientX; st.dragging.ly = ev.clientY;
        st.camOrbit.theta -= dx * 0.005;
        st.camOrbit.phi = Math.max(0.25, Math.min(Math.PI / 2.05, st.camOrbit.phi - dy * 0.005));
        return;
      }
      // hover raycast
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(st.tiles, false);
      if (hits.length) {
        const idx = hits[0].object.userData.tileIndex;
        if (st.hovered !== idx) {
          st.hovered = idx;
          const p = tilePos(idx);
          hoverRing.visible = true;
          hoverRing.position.x = p.x; hoverRing.position.z = p.z;
          const s = Math.max(p.w, p.h) * 0.68;
          hoverRing.geometry.dispose();
          hoverRing.geometry = new THREE.RingGeometry(s, s + 0.08, 48);
          setHoverLabel({ i: idx, title: TILES[idx].title });
        }
      } else {
        if (st.hovered !== -1) {
          st.hovered = -1;
          hoverRing.visible = false;
          setHoverLabel(null);
        }
      }
    };

    const onDown = (ev) => {
      setPointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(st.tiles, false);
      st.pointerJustMoved = false;
      st.pointerDownAt = { x: ev.clientX, y: ev.clientY, tile: hits.length ? hits[0].object.userData.tileIndex : -1 };
      // Right click or shift = orbit; otherwise if no tile hit, also orbit
      if (ev.button === 2 || ev.shiftKey || hits.length === 0) {
        st.dragging = { lx: ev.clientX, ly: ev.clientY, id: ev.pointerId };
        canvas.setPointerCapture(ev.pointerId);
      }
    };

    const onUp = (ev) => {
      if (st.dragging) {
        canvas.releasePointerCapture(ev.pointerId);
        st.dragging = null;
      } else if (st.pointerDownAt && !st.pointerJustMoved && st.pointerDownAt.tile >= 0) {
        // Click = jump token to tile (only in 'click' mode); in other modes it opens the tile info
        const idx = st.pointerDownAt.tile;
        if (getMode() === 'click') {
          queueJump(idx);
        } else {
          setOpenTile(TILES[idx].id);
        }
      }
      st.pointerDownAt = null;
    };

    const onWheel = (ev) => {
      ev.preventDefault();
      st.camOrbit.r = Math.max(22, Math.min(75, st.camOrbit.r + ev.deltaY * 0.03));
    };

    const getMode = () => modeRef.current;
    const onKeyDown = (ev) => {
      const m = getMode();
      if (m === 'drive') {
        const k = ev.key.toLowerCase();
        if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
          st.driveKeys.add(k); ev.preventDefault();
        }
      } else if (m === 'walk') {
        const k = ev.key.toLowerCase();
        let step = null;
        if (k === 'arrowright' || k === 'd') step = 1;
        if (k === 'arrowleft'  || k === 'a') step = -1;
        if (step !== null) {
          ev.preventDefault();
          const next = (st.tokenTargetIdx + step + NUM_TILES) % NUM_TILES;
          queueJump(next);
        }
      }
    };
    const onKeyUp = (ev) => {
      const k = ev.key.toLowerCase();
      st.driveKeys.delete(k);
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Animation loop ─────────────────────────────────────────────────
    let raf;
    let lastT = performance.now();
    const loop = (t) => {
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      // Update token (drive / queued jumps)
      const m = modeRef.current;
      if (m === 'drive') {
        const accel = 18;
        let ax = 0, az = 0;
        if (st.driveKeys.has('w') || st.driveKeys.has('arrowup'))    az -= 1;
        if (st.driveKeys.has('s') || st.driveKeys.has('arrowdown'))  az += 1;
        if (st.driveKeys.has('a') || st.driveKeys.has('arrowleft'))  ax -= 1;
        if (st.driveKeys.has('d') || st.driveKeys.has('arrowright')) ax += 1;
        const norm = Math.hypot(ax, az);
        if (norm > 0) { ax /= norm; az /= norm; }
        const yaw = st.camOrbit.theta - Math.PI / 2;
        const dirX = ax * Math.cos(yaw) - az * Math.sin(yaw);
        const dirZ = ax * Math.sin(yaw) + az * Math.cos(yaw);
        st.driveVel.x += dirX * accel * dt;
        st.driveVel.z += dirZ * accel * dt;
        const damp = Math.pow(0.02, dt);
        st.driveVel.x *= damp; st.driveVel.z *= damp;
        const maxV = 9;
        const vMag = Math.hypot(st.driveVel.x, st.driveVel.z);
        if (vMag > maxV) { st.driveVel.x = st.driveVel.x / vMag * maxV; st.driveVel.z = st.driveVel.z / vMag * maxV; }
        st.tokenPos.x += st.driveVel.x * dt;
        st.tokenPos.z += st.driveVel.z * dt;

        // ── Constrain to the outer RING of tiles only (no travel through the middle) ──
        // Outer square: |x| or |z| close to HALF. Inner forbidden square is smaller.
        const outer = HALF - 0.3;                  // stay inside the board edge
        const inner = HALF - T_SHORT + 0.25;       // don't enter the center square
        // Clamp to outer bounds
        if (st.tokenPos.x >  outer) { st.tokenPos.x =  outer; st.driveVel.x = 0; }
        if (st.tokenPos.x < -outer) { st.tokenPos.x = -outer; st.driveVel.x = 0; }
        if (st.tokenPos.z >  outer) { st.tokenPos.z =  outer; st.driveVel.z = 0; }
        if (st.tokenPos.z < -outer) { st.tokenPos.z = -outer; st.driveVel.z = 0; }
        // Push out of the inner forbidden square (stay on the ring)
        if (Math.abs(st.tokenPos.x) < inner && Math.abs(st.tokenPos.z) < inner) {
          // Find nearest edge and push the token out to it
          const dRight = inner - st.tokenPos.x;
          const dLeft  = st.tokenPos.x + inner;
          const dTop   = st.tokenPos.z + inner;
          const dBot   = inner - st.tokenPos.z;
          const mn = Math.min(dRight, dLeft, dTop, dBot);
          if (mn === dRight) { st.tokenPos.x =  inner; st.driveVel.x = Math.max(0, st.driveVel.x); }
          else if (mn === dLeft)  { st.tokenPos.x = -inner; st.driveVel.x = Math.min(0, st.driveVel.x); }
          else if (mn === dTop)   { st.tokenPos.z = -inner; st.driveVel.z = Math.min(0, st.driveVel.z); }
          else                    { st.tokenPos.z =  inner; st.driveVel.z = Math.max(0, st.driveVel.z); }
        }

        if (vMag > 0.4) st.tokenPos.rotY = Math.atan2(st.driveVel.x, st.driveVel.z);

        let closest = 0, cd = Infinity;
        for (let i = 0; i < NUM_TILES; i++) {
          const tp = tokenTarget(i);
          const d = (tp.x - st.tokenPos.x) ** 2 + (tp.z - st.tokenPos.z) ** 2;
          if (d < cd) { cd = d; closest = i; }
        }
        if (cd < 0.9 && st.tokenTargetIdx !== closest) {
          st.tokenTargetIdx = closest;
          setCurrentTile(closest);
        }
      } else if (st.moveQueue.length > 0) {
        const next = st.moveQueue[0];
        const tgt = tokenTarget(next);
        const dx = tgt.x - st.tokenPos.x;
        const dz = tgt.z - st.tokenPos.z;
        const dist = Math.hypot(dx, dz);
        const speed = 14;
        const step = Math.min(dist, speed * dt);
        if (dist < 0.05) {
          st.tokenPos.x = tgt.x; st.tokenPos.z = tgt.z;
          st.moveQueue.shift();
          st.tokenTargetIdx = next;
          setCurrentTile(next);
          if (st.moveQueue.length === 0 && m !== 'drive') {
            // Land animation: tiny bounce handled by hat.position.y modulation
            setOpenTile(TILES[next].id);
          }
        } else {
          st.tokenPos.x += (dx / dist) * step;
          st.tokenPos.z += (dz / dist) * step;
          st.tokenPos.rotY = Math.atan2(dx, dz);
        }
      }

      // Apply token transform
      const bounceT = (m === 'drive') ? 0 : Math.max(0, Math.sin(t * 0.012)) * 0.12;
      st.token.position.x = st.tokenPos.x;
      st.token.position.z = st.tokenPos.z;
      st.token.position.y = BOARD_H + TILE_H + bounceT;
      st.token.rotation.y = st.tokenPos.rotY;

      // Select ring follows current tile
      const cp = tilePos(st.tokenTargetIdx);
      const ringS = Math.max(cp.w, cp.h) * 0.72;
      selectRing.position.x = cp.x; selectRing.position.z = cp.z;
      if (selectRing.geometry.parameters.innerRadius !== ringS) {
        selectRing.geometry.dispose();
        selectRing.geometry = new THREE.RingGeometry(ringS, ringS + 0.06, 48);
      }
      const pulse = 0.75 + 0.25 * Math.sin(t * 0.004);
      selectRing.material.opacity = 0.55 + 0.35 * pulse;

      // Camera orbit (damped)
      const o = st.camOrbit;
      const cx = o.target.x + o.r * Math.sin(o.phi) * Math.cos(o.theta);
      const cy = o.target.y + o.r * Math.cos(o.phi);
      const cz = o.target.z + o.r * Math.sin(o.phi) * Math.sin(o.theta);
      camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.15);
      camera.lookAt(o.target.x, o.target.y, o.target.z);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // ── Resize ─────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((mm) => { if (mm.map) mm.map.dispose(); mm.dispose(); });
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey]);

  // ── Mode ref (so animation loop sees current mode) ────────────────────
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Queue a jump along the shortest ring path ─────────────────────────
  const queueJump = useCallback((toIdx) => {
    const st = stateRef.current;
    const from = st.tokenTargetIdx;
    if (toIdx === from) { setOpenTile(TILES[toIdx].id); return; }
    // Walk step-by-step along the ring so the token hops around the board
    const fwd = (toIdx - from + NUM_TILES) % NUM_TILES;
    const bwd = (from - toIdx + NUM_TILES) % NUM_TILES;
    const dir = fwd <= bwd ? 1 : -1;
    const steps = Math.min(fwd, bwd);
    const q = [];
    let cur = from;
    for (let i = 0; i < steps; i++) {
      cur = (cur + dir + NUM_TILES) % NUM_TILES;
      q.push(cur);
    }
    st.moveQueue = q;
  }, []);

  // ── Dice roll ─────────────────────────────────────────────────────────
  const rollDice = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    // animate "rolling" numbers for ~700ms
    let ticks = 10;
    const iv = setInterval(() => {
      ticks--;
      setDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
      if (ticks <= 0) {
        clearInterval(iv);
        setDice([d1, d2]);
        setRolling(false);
        const st = stateRef.current;
        const total = d1 + d2;
        // step forward `total` tiles (wraps around the 20-tile ring)
        const q = [];
        let cur = st.tokenTargetIdx;
        for (let i = 0; i < total; i++) { cur = (cur + 1) % NUM_TILES; q.push(cur); }
        st.moveQueue = q;
      }
    }, 70);
  }, [rolling]);

  // ── Close modal shortcut
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') setOpenTile(null); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // ── UI ────────────────────────────────────────────────────────────────
  return (
    <div ref={mountRef} style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: `radial-gradient(ellipse at 50% 40%, ${theme.sky} 0%, ${theme.skyBottom} 100%)`,
      fontFamily: theme.uiFont,
      color: '#f6efd8',
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'grab' }} />

      {/* Masthead */}
      <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pointerEvents: 'none' }}>
        <div>
          <div style={{ fontFamily: theme.font, fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: theme.accent2, letterSpacing: 0.3, textShadow: '0 2px 12px rgba(0,0,0,.5)', lineHeight: 1.1 }}>
            Dean Kaplan
          </div>
          <div style={{ fontFamily: theme.font, fontStyle: 'italic', fontWeight: 500, fontSize: 14, color: 'rgba(246,239,216,.82)', textShadow: '0 2px 10px rgba(0,0,0,.55)', marginTop: 1 }}>
            PhD Candidate in Economics
          </div>
          <div style={{ fontSize: 11, color: 'rgba(246,239,216,.55)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
            Boston College
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(246,239,216,.55)', letterSpacing: 2, textTransform: 'uppercase', textAlign: 'right', pointerEvents: 'none' }}>
          {theme.name}
        </div>
      </div>

      {/* Current tile pill */}
      <div style={{ position: 'absolute', top: 102, left: '50%', transform: 'translateX(-50%)', background: 'rgba(10,6,4,.55)', backdropFilter: 'blur(8px)', padding: '6px 14px', borderRadius: 999, fontSize: 12, color: theme.accent2, letterSpacing: 2, textTransform: 'uppercase', border: `1px solid ${theme.accent2}40` }}>
        <span style={{ opacity: .7, marginRight: 8 }}>On:</span>
        <span style={{ fontWeight: 600 }}>{TILES[currentTile]?.title || '—'}</span>
      </div>

      {/* Hover label */}
      {hoverLabel && (
        <div style={{ position: 'absolute', bottom: 82, left: '50%', transform: 'translateX(-50%)', background: 'rgba(10,6,4,.7)', padding: '6px 12px', borderRadius: 6, fontSize: 12, color: '#f6efd8', letterSpacing: 0.5, pointerEvents: 'none' }}>
          {hoverLabel.title}
          <span style={{ opacity: .5, marginLeft: 8, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>click</span>
        </div>
      )}

      {/* Mode toggle */}
      <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', gap: 4, background: 'rgba(10,6,4,.6)', borderRadius: 8, padding: 4, border: `1px solid ${theme.accent2}30` }}>
        {[
          { k: 'drive', label: 'Drive', hint: 'WASD' },
          { k: 'roll',  label: 'Roll',  hint: 'Dice' },
          { k: 'walk',  label: 'Walk',  hint: '← →' },
          { k: 'click', label: 'Click', hint: 'Jump' },
        ].map(({ k, label, hint }) => (
          <button key={k} onClick={() => setMode(k)}
            style={{
              background: mode === k ? theme.accent : 'transparent',
              color: mode === k ? '#f6efd8' : 'rgba(246,239,216,.7)',
              border: 'none', padding: '6px 10px', borderRadius: 5,
              cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600, letterSpacing: 0.5,
              display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1,
            }}>
            <span>{label}</span>
            <span style={{ fontSize: 9, opacity: .7, letterSpacing: 1, marginTop: 2 }}>{hint}</span>
          </button>
        ))}
      </div>

      {/* Dice button (only in roll mode) */}
      {mode === 'roll' && (
        <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(10,6,4,.6)', borderRadius: 8, padding: 8, border: `1px solid ${theme.accent2}30` }}>
          <Die n={dice[0]} theme={theme} rolling={rolling} />
          <Die n={dice[1]} theme={theme} rolling={rolling} />
          <button onClick={rollDice} disabled={rolling} style={{
            background: theme.accent, color: '#f6efd8', border: 'none',
            padding: '8px 14px', borderRadius: 5, cursor: rolling ? 'wait' : 'pointer',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
          }}>{rolling ? '…' : 'Roll'}</button>
        </div>
      )}

      {/* Tile list (top right), only shown in click mode or small screens */}
      {mode === 'click' && (
        <div style={{ position: 'absolute', top: 56, right: 14, bottom: 60, width: 180, background: 'rgba(10,6,4,.55)', backdropFilter: 'blur(8px)', borderRadius: 6, border: `1px solid ${theme.accent2}30`, overflowY: 'auto', padding: 6, fontSize: 11 }}>
          {TILES.map((t, i) => (
            <button key={t.id} onClick={() => queueJump(i)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', marginBottom: 2,
                background: i === currentTile ? theme.accent : 'transparent',
                color: i === currentTile ? '#f6efd8' : 'rgba(246,239,216,.8)',
                border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
              }}>
              <span style={{ opacity: .5, marginRight: 6, fontSize: 10 }}>{String(i).padStart(2,'0')}</span>
              {t.title}
            </button>
          ))}
        </div>
      )}

      {/* Help dismissable */}
      {showHelp && (
        <div style={{ position: 'absolute', top: 110, left: 14, maxWidth: 220, background: 'rgba(10,6,4,.65)', backdropFilter: 'blur(8px)', padding: '10px 12px', borderRadius: 6, fontSize: 11, lineHeight: 1.5, color: 'rgba(246,239,216,.85)', border: `1px solid ${theme.accent2}30` }}>
          <div style={{ fontFamily: theme.font, fontStyle: 'italic', fontSize: 14, color: theme.accent2, marginBottom: 4 }}>How to play</div>
          <div><b>Drive</b>: WASD/arrows · <b>Roll</b>: dice · <b>Walk</b>: ← → · <b>Click</b>: jump</div>
          <div style={{ marginTop: 4, opacity: .75 }}>Drag the background to orbit · scroll to zoom. Click a tile to open it.</div>
          <button onClick={() => setShowHelp(false)} style={{ marginTop: 6, background: 'transparent', color: theme.accent2, border: `1px solid ${theme.accent2}60`, padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', letterSpacing: 1, textTransform: 'uppercase' }}>
            Got it
          </button>
        </div>
      )}

      {/* Tile modal */}
      {openTileData && (
        <TileModal tile={openTileData} theme={theme} onClose={() => setOpenTile(null)} />
      )}
    </div>
  );
}

function Die({ n, theme, rolling }) {
  const pips = n || 1;
  const dots = {
    1: [[1,1]],
    2: [[0,0],[2,2]],
    3: [[0,0],[1,1],[2,2]],
    4: [[0,0],[0,2],[2,0],[2,2]],
    5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
    6: [[0,0],[0,2],[1,0],[1,2],[2,0],[2,2]],
  }[pips] || [];
  return (
    <div style={{
      width: 36, height: 36, background: '#f6efd8', borderRadius: 6,
      position: 'relative', boxShadow: '0 2px 6px rgba(0,0,0,.4), inset 0 -2px 4px rgba(0,0,0,.08)',
      transform: rolling ? `rotate(${Math.random() * 30 - 15}deg)` : 'rotate(0deg)',
      transition: 'transform .15s',
    }}>
      {n != null && dots.map(([r, c], i) => (
        <div key={i} style={{
          position: 'absolute', width: 6, height: 6, borderRadius: 3, background: theme.ink,
          left: 6 + c * 9, top: 6 + r * 9,
        }} />
      ))}
    </div>
  );
}

function TileModal({ tile, theme, onClose }) {
  const bandColor = tile.kind === 'property' ? theme.bands[tile.group] :
                    tile.kind === 'chance'   ? theme.chanceTint :
                    tile.kind === 'chest'    ? theme.chestTint :
                    tile.kind === 'rail'     ? theme.accent :
                    tile.kind === 'utility'  ? theme.accent2 :
                    tile.kind === 'tax'      ? theme.ink :
                    theme.corner;
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: 'rgba(4,3,2,.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: theme.tileFace, color: theme.ink,
        maxWidth: 560, width: '100%', maxHeight: '88%',
        display: 'flex', flexDirection: 'column',
        borderRadius: 3, border: `2px solid ${theme.tileStroke}`,
        boxShadow: '0 30px 80px rgba(0,0,0,.6), 0 0 0 6px rgba(181,149,59,.08)',
        fontFamily: theme.uiFont, overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Close button (floating) */}
        <button onClick={onClose} aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 2,
            width: 32, height: 32, borderRadius: 16, border: 'none',
            background: 'rgba(42,34,24,.08)', color: theme.ink, cursor: 'pointer',
            fontSize: 18, lineHeight: 1, fontFamily: 'inherit', display: 'flex',
            alignItems: 'center', justifyContent: 'center', transition: 'background .12s' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(42,34,24,.16)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(42,34,24,.08)')}>×</button>

        {/* Color band */}
        <div style={{ background: bandColor, height: 16, borderBottom: `2px solid ${theme.tileStroke}`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '22px 28px 16px', flexShrink: 0, borderBottom: `1px solid ${theme.tileStroke}15` }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: theme.subInk, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: bandColor }} />
            {tile.kind === 'property' ? 'Property Deed' : tile.kind}
          </div>
          <div style={{ fontFamily: theme.font, fontSize: 32, fontWeight: 700, lineHeight: 1.05, letterSpacing: -0.4, color: theme.ink }}>
            {tile.title}
          </div>
          {tile.subtitle && (
            <div style={{ fontFamily: theme.font, fontStyle: 'italic', fontSize: 17, color: theme.subInk, marginTop: 4 }}>
              {tile.subtitle}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '18px 28px 22px', overflowY: 'auto', flex: 1 }}>
          {tile.body?.intro && (
            <div style={{ fontSize: 16, lineHeight: 1.5, color: theme.ink, marginBottom: 14, fontWeight: 500 }}>
              {tile.body.intro}
            </div>
          )}
          {tile.body?.paragraphs?.map((p, i) => (
            <div key={i} style={{ fontSize: 14, lineHeight: 1.65, color: theme.ink, marginBottom: 12, textWrap: 'pretty' }}>{p}</div>
          ))}

          {tile.body?.stats?.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0, marginTop: 14, marginBottom: 6, border: `1px solid ${theme.tileStroke}20`, borderRadius: 3, overflow: 'hidden' }}>
              {tile.body.stats.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: 12, background: i % 2 === 0 ? 'transparent' : `${theme.tileStroke}08` }}>
                  <span style={{ color: theme.subInk, letterSpacing: 1, textTransform: 'uppercase', fontSize: 10 }}>{s.k}</span>
                  <span style={{ color: theme.ink, fontWeight: 500 }}>{s.v}</span>
                </div>
              ))}
            </div>
          )}

          {tile.body?.links?.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: theme.subInk, marginBottom: 8 }}>Links</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tile.body.links.map((l, i) => {
                  const isMail = l.href.startsWith('mailto');
                  const isHash = l.href.startsWith('#');
                  return (
                    <a key={i} href={l.href} target={isMail || isHash ? undefined : '_blank'} rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 3,
                        background: `${theme.tileStroke}06`, border: `1px solid ${theme.tileStroke}20`,
                        color: theme.ink, textDecoration: 'none', fontSize: 13, fontWeight: 500,
                        transition: 'background .12s, border-color .12s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = `${theme.accent}14`; e.currentTarget.style.borderColor = `${theme.accent}60`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = `${theme.tileStroke}06`; e.currentTarget.style.borderColor = `${theme.tileStroke}20`; }}>
                      <span>{l.label}</span>
                      <span style={{ color: theme.accent, fontSize: 14 }}>→</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Monopoly3D });
