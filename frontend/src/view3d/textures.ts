import * as THREE from "three";

// All textures are generated on a canvas at runtime — no network/asset dependency.

function makeCanvas(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return { c, ctx: c.getContext("2d")! };
}

/** Subtle plaster / painted wall with fine noise. */
export function plasterTexture(base = "#eef0f3"): THREE.CanvasTexture {
  const { c, ctx } = makeCanvas(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  // speckle noise for a matte plaster feel
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = Math.random() * 22 - 11;
    ctx.fillStyle = `rgba(${120 + shade},${120 + shade},${130 + shade},0.05)`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

/** Wood-plank floor with grain and seams. */
export function woodFloorTexture(): THREE.CanvasTexture {
  const { c, ctx } = makeCanvas(512);
  const planks = 6;
  const ph = 512 / planks;
  const tones = ["#c9a36a", "#c49a5e", "#cea874", "#bf935a", "#d2ac79", "#c19760"];
  for (let p = 0; p < planks; p++) {
    ctx.fillStyle = tones[p % tones.length];
    ctx.fillRect(0, p * ph, 512, ph);
    // grain
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = `rgba(90,60,30,${Math.random() * 0.08})`;
      ctx.beginPath();
      const y = p * ph + Math.random() * ph;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + (Math.random() * 6 - 3), 340, y + (Math.random() * 6 - 3), 512, y);
      ctx.stroke();
    }
    // seam
    ctx.fillStyle = "rgba(60,40,20,0.35)";
    ctx.fillRect(0, p * ph, 512, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
