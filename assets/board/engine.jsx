// engine.jsx — Three.js Monopoly-style board engine.
// Exposes <Monopoly3D theme={...} artboardId /> which renders:
//   • a 3D board with 40 tiles (colored bands, text labels) via CanvasTexture
//   • a top-hat token that can be clicked, driven (WASD), dice-rolled, or walked
//   • a small UI chrome: mode toggle (Drive / Roll / Walk / Click), dice button, tile list
//   • a content modal that shows a tile's body
//
// Three.js is loaded in the main HTML; we read it off `window.THREE`.

const { useRef, useEffect, useState, useMemo, useCallback } = React;

// ── Themes ────────────────────────────────────────────────────────────────
const THEMES = {
  ivy: {
    name: 'Ivy',
    board:       '#fbf5e3',  // brighter cream
    boardRim:    '#f0e4c0',
    boardEdge:   '#4a3524',
    ground:      '#2d5a41',  // lighter ivy green
    groundAlt:   '#35684a',
    tileFace:    '#fdf8e8',  // nearly white
    tileStroke:  '#1a1410',
    accent:      '#8a3535',  // lighter maroon
    accent2:     '#d4b255',  // brighter gold
    ink:         '#1a1410',  // high contrast text
    subInk:      '#5a4a32',
    chanceTint:  '#d4b255',
    chestTint:   '#8a3535',
    corner:      '#f0e4c0',
    // Bright, saturated property bands
    bands: {
      brown:  '#8a5a32',
      cyan:   '#5aa6c2',
      pink:   '#d88a96',
      orange: '#e89a45',
      red:    '#c03838',
      yellow: '#e8c340',
      green:  '#4a8a55',
      blue:   '#3d6aa8',
    },
    font: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
    uiFont: '"Inter", system-ui, sans-serif',
    fog: 0.00,
    sky: '#2d5a41',
    skyBottom: '#1a3a28',
    hatColor: '#141008',
    hatBand:  '#8a3535',
  },
  // "Medium" variant: darker night-library mood, spotlit board
  library: {
    name: 'Night Library',
    board:       '#efe3c2',
    boardRim:    '#d9c692',
    boardEdge:   '#1a1208',
    ground:      '#0c0f14',
    groundAlt:   '#10151d',
    tileFace:    '#f4e9c9',
    tileStroke:  '#1a1208',
    accent:      '#8a2a2a',
    accent2:     '#c9a24a',
    ink:         '#1a1208',
    subInk:      '#6e5e46',
    chanceTint:  '#c9a24a',
    chestTint:   '#8a2a2a',
    corner:      '#d9c692',
    bands: {
      brown:  '#6f4328',
      cyan:   '#5f8190',
      pink:   '#ac6670',
      orange: '#b9773b',
      red:    '#8b2f2f',
      yellow: '#bf9c3a',
      green:  '#386445',
      blue:   '#30506f',
    },
    font: '"Playfair Display", Georgia, serif',
    uiFont: '"Inter", system-ui, sans-serif',
    fog: 0.025,
    sky: '#0c0f14',
    skyBottom: '#05070a',
    hatColor: '#0a0604',
    hatBand:  '#8a2a2a',
  },
  // "Bold" variant: high contrast, crimson felt, brass-trim board, dramatic lighting
  crimson: {
    name: 'Senior Common Room',
    board:       '#f3e4bf',
    boardRim:    '#b8892a',
    boardEdge:   '#2a0e0e',
    ground:      '#4a0e14',
    groundAlt:   '#5a1118',
    tileFace:    '#f6e9c6',
    tileStroke:  '#2a0e0e',
    accent:      '#9d1b1b',
    accent2:     '#d5a021',
    ink:         '#2a0e0e',
    subInk:      '#7a4a2a',
    chanceTint:  '#d5a021',
    chestTint:   '#9d1b1b',
    corner:      '#e6c97a',
    bands: {
      brown:  '#8a502a',
      cyan:   '#4a7a95',
      pink:   '#c0616d',
      orange: '#d57f35',
      red:    '#b52424',
      yellow: '#d8ae2e',
      green:  '#3a7a4a',
      blue:   '#254a78',
    },
    font: '"Playfair Display", Georgia, serif',
    uiFont: '"Inter", system-ui, sans-serif',
    fog: 0.01,
    sky: '#4a0e14',
    skyBottom: '#1a0406',
    hatColor: '#050202',
    hatBand:  '#d5a021',
  },
};

// ── Texture helpers ───────────────────────────────────────────────────────
// Each tile is rendered onto a 512x768 canvas: color band at top (short side),
// title, and optional group marker.

function tileFaceCanvas(tile, theme, orient /* 'bottom'|'left'|'top'|'right'|'corner' */) {
  // Logical portrait canvas is always 512x768 — all drawing code below uses
  // those coordinates. For side tiles (left/right) the BACKING canvas is
  // landscape (768x512) to match the box's top-face aspect; we rotate the
  // context so our portrait-space drawing lands correctly on the landscape
  // canvas, and so text still reads from world-south when placed on the mesh.
  // For 'top' tiles we flip the portrait 180° because the mesh is rotated
  // PI around Y — without this, text would appear upside-down from the camera.
  const W = 512, H = 768;
  const isSide = (orient === 'left' || orient === 'right');
  const cw = isSide ? H : W;  // backing canvas width
  const ch = isSide ? W : H;  // backing canvas height
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');
  if (orient === 'left') {
    ctx.translate(cw, 0);
    ctx.rotate(Math.PI / 2);
  } else if (orient === 'right') {
    ctx.translate(0, ch);
    ctx.rotate(-Math.PI / 2);
  } else if (orient === 'top') {
    ctx.translate(cw, ch);
    ctx.rotate(Math.PI);
  }

  // face
  ctx.fillStyle = theme.tileFace;
  ctx.fillRect(0, 0, W, H);
  // subtle inner border
  ctx.strokeStyle = theme.tileStroke;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  if (tile.kind === 'corner') {
    // center the title — bigger, higher contrast
    ctx.fillStyle = theme.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 68px ${theme.uiFont}`;
    wrapText(ctx, tile.title.toUpperCase(), W / 2, H / 2 - 30, W - 60, 76);
    if (tile.subtitle) {
      ctx.fillStyle = theme.subInk;
      ctx.font = `500 34px ${theme.uiFont}`;
      ctx.fillText(tile.subtitle, W / 2, H / 2 + 120);
    }
    // small ornamental diamond
    ctx.fillStyle = theme.accent2;
    ctx.beginPath();
    ctx.moveTo(W/2, H/2 + 160);
    ctx.lineTo(W/2 + 14, H/2 + 174);
    ctx.lineTo(W/2, H/2 + 188);
    ctx.lineTo(W/2 - 14, H/2 + 174);
    ctx.closePath();
    ctx.fill();
    return c;
  }

  // color band at top
  let bandColor = null;
  if (tile.kind === 'property') bandColor = theme.bands[tile.group] || theme.accent;
  if (tile.kind === 'chance')   bandColor = theme.chanceTint;
  if (tile.kind === 'chest')    bandColor = theme.chestTint;
  if (tile.kind === 'rail')     bandColor = theme.accent;
  if (tile.kind === 'utility')  bandColor = theme.accent2;
  if (tile.kind === 'tax')      bandColor = theme.ink;

  const bandH = (tile.kind === 'property' || tile.kind === 'chance' || tile.kind === 'chest') ? 110 : 0;
  if (bandH) {
    ctx.fillStyle = bandColor;
    ctx.fillRect(0, 0, W, bandH);
    ctx.strokeStyle = theme.tileStroke;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, bandH); ctx.lineTo(W, bandH);
    ctx.stroke();
  }

  // Title area (below band) — bigger, bolder, clearer
  ctx.fillStyle = theme.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `700 56px ${theme.uiFont}`;
  const titleY = bandH + 50;
  wrapText(ctx, tile.title.toUpperCase(), W / 2, titleY, W - 40, 64);

  if (tile.subtitle) {
    ctx.fillStyle = theme.subInk;
    ctx.font = `500 32px ${theme.uiFont}`;
    ctx.fillText(tile.subtitle, W / 2, titleY + 160);
  }

  // Kind ornament (bottom)
  ctx.fillStyle = bandColor || theme.accent;
  const oy = H - 180;
  if (tile.kind === 'rail') {
    // simple train silhouette
    ctx.beginPath();
    ctx.roundRect(W/2 - 110, oy, 220, 80, 10);
    ctx.fill();
    ctx.fillStyle = theme.tileFace;
    ctx.fillRect(W/2 - 90, oy + 15, 40, 35);
    ctx.fillRect(W/2 - 40, oy + 15, 40, 35);
    ctx.fillRect(W/2 + 10, oy + 15, 40, 35);
    ctx.fillStyle = theme.ink;
    ctx.beginPath(); ctx.arc(W/2 - 60, oy + 95, 14, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(W/2 + 60, oy + 95, 14, 0, Math.PI*2); ctx.fill();
  } else if (tile.kind === 'utility') {
    // lamp / gear-ish circle
    ctx.beginPath(); ctx.arc(W/2, oy + 50, 48, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = theme.tileFace; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(W/2 - 20, oy + 50); ctx.lineTo(W/2 + 20, oy + 50);
    ctx.moveTo(W/2, oy + 30); ctx.lineTo(W/2, oy + 70); ctx.stroke();
  } else if (tile.kind === 'tax') {
    ctx.font = `800 72px ${theme.uiFont}`;
    ctx.textAlign = 'center';
    ctx.fillText('$', W/2, oy);
  } else if (tile.kind === 'chance') {
    ctx.font = `800 italic 120px ${theme.font}`;
    ctx.fillText('?', W/2, oy - 30);
  } else if (tile.kind === 'chest') {
    ctx.fillRect(W/2 - 70, oy + 10, 140, 80);
    ctx.fillStyle = theme.tileFace;
    ctx.fillRect(W/2 - 10, oy + 40, 20, 30);
  } else if (tile.kind === 'property') {
    // "DEED" ornament
    ctx.strokeStyle = theme.accent2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W/2 - 80, oy + 80);
    ctx.lineTo(W/2 + 80, oy + 80);
    ctx.stroke();
    ctx.fillStyle = theme.subInk;
    ctx.font = `400 italic 22px ${theme.font}`;
    ctx.fillText('property', W/2, oy + 90);
  }

  return c;
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  const total = lines.length;
  for (let i = 0; i < total; i++) {
    ctx.fillText(lines[i], x, y + i * lineH);
  }
}

// Board center canvas — the big square in the middle (logo)
function centerCanvas(theme) {
  const W = 1024, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  // rotated diamond-style center, like Monopoly
  ctx.fillStyle = theme.board;
  ctx.fillRect(0, 0, W, H);

  // diagonal chance/chest areas
  ctx.save();
  ctx.translate(W/2, H/2);
  ctx.rotate(-Math.PI/4);
  ctx.fillStyle = theme.chanceTint;
  ctx.globalAlpha = 0.15;
  ctx.fillRect(-W*0.4, -80, W*0.8, 160);
  ctx.rotate(Math.PI/2);
  ctx.fillStyle = theme.chestTint;
  ctx.fillRect(-W*0.4, -80, W*0.8, 160);
  ctx.restore();
  ctx.globalAlpha = 1;

  // title
  ctx.fillStyle = theme.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 italic 140px ${theme.font}`;
  ctx.save();
  ctx.translate(W/2, H/2 - 20);
  ctx.rotate(-Math.PI/4);
  ctx.fillText('DEAN', 0, -130);
  ctx.fillText('KAPLAN', 0, 10);
  ctx.font = `600 italic 52px ${theme.font}`;
  ctx.fillStyle = theme.accent2;
  ctx.fillText('PhD Candidate', 0, 110);
  ctx.fillText('in Economics', 0, 170);
  ctx.font = `500 italic 44px ${theme.font}`;
  ctx.fillStyle = theme.subInk;
  ctx.fillText('Boston College', 0, 240);
  ctx.restore();

  // rim diamonds
  ctx.strokeStyle = theme.accent2;
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.lineWidth = 2;
  ctx.strokeRect(70, 70, W - 140, H - 140);
  return c;
}

Object.assign(window, { TILE_FACE: tileFaceCanvas, CENTER_FACE: centerCanvas, THEMES });
