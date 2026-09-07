// Full world render test (terrain + water + trees + sky)
import { FrameBuffer } from './engine/render/FrameBuffer.js';
import { Rasterizer } from './engine/render/Rasterizer.js';
import { Camera } from './engine/world/Camera.js';
import { mat4Multiply, mat4Identity, mat4Translate, mat4Scale } from './engine/core/Mat4.js';
import { Terrain } from './engine/world/Terrain.js';
import { Water } from './engine/world/Water.js';
import { ModelBuilder } from './engine/models/ModelBuilder.js';
import { Texture } from './engine/render/Texture.js';
import { ShaderProgram, makeRasterizerShader } from './engine/shaders/ShaderCompiler.js';
import { LIT_SHADER, TERRAIN_SHADER, WATER_SHADER, FOLIAGE_SHADER } from './engine/shaders/ShaderLibrary.js';
import { SKY_SHADER, buildSkyDome } from './engine/world/Sky.js';

const W = 300, H = 200;
const canvas = { width: W, height: H, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData: () => {} }) };
const fb = new FrameBuffer(canvas);
const rast = new Rasterizer(fb);
const cam = new Camera(W / H);
cam.position = [0, 8, 20];
cam.pitch = -0.3;
cam.updateView();

const vp = new Float32Array(16);
mat4Multiply(vp, cam.proj, cam.view);
rast.setViewProjection(vp);

const tex = { grass: Texture.createGrass(64) };
const skyProg = new ShaderProgram(SKY_SHADER);
const terProg = new ShaderProgram(TERRAIN_SHADER);
const watProg = new ShaderProgram(WATER_SHADER);
const folProg = new ShaderProgram(FOLIAGE_SHADER);
const litProg = new ShaderProgram(LIT_SHADER);

// Build world
const terrain = Terrain.fromProcedural({ size: 48, scale: 2, amplitude: 6, targetBelow: 0.5 });
const water = new Water(terrain.hm.size * terrain.hm.scale, terrain.waterLevel, 24);
const sky = buildSkyDome(300);
const sunDir = [0.4, -0.8, 0.45];
const ambient = [0.3, 0.35, 0.45];
const common = { cameraPos: cam.position, lightDir: sunDir, lightColor: [1, 0.95, 0.85], ambient, time: 0 };

// Build a model matrix helper
function modelAt(x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1) {
    const M = new Float32Array(16); mat4Identity(M);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    M[0] = c * sx; M[2] = -s * sz;
    M[5] = sy;
    M[8] = s * sx; M[10] = c * sz;
    M[12] = x; M[13] = y; M[14] = z;
    return M;
}

fb.clear();

// Sky
rast.setModelMatrix(modelAt(cam.position[0], cam.position[1], cam.position[2]));
rast.setShader(makeRasterizerShader(skyProg, {}));
rast.setUniforms({ sunDir, zenith: [0.2, 0.45, 0.85], horizon: [0.85, 0.78, 0.65], sunColor: [1, 0.95, 0.8], time: 0 });
rast.draw(sky);

// Terrain
rast.setModelMatrix(mat4Identity(new Float32Array(16)));
rast.setShader(makeRasterizerShader(terProg, tex));
rast.setUniforms({ ...common, lowY: terrain.bounds.min[1], highY: terrain.bounds.max[1] });
rast.draw(terrain.mesh);

// Water
rast.setModelMatrix(mat4Identity(new Float32Array(16)));
rast.setShader(makeRasterizerShader(watProg, {}));
rast.setUniforms({ ...common, deepColor: [0.05, 0.18, 0.45], shallowColor: [0.3, 0.65, 0.85], skyTint: [0.5, 0.7, 0.95] });
rast.draw(water.mesh);

// Trees
for (let i = 0; i < 10; i++) {
    const x = (Math.random() - 0.5) * 40;
    const z = (Math.random() - 0.5) * 40;
    const h = terrain.heightAt(x, z);
    if (h < terrain.waterLevel + 0.5) continue;
    const m = new ModelBuilder('tree').pineTree(3, 1, 0.2).build();
    rast.setModelMatrix(modelAt(x, h, z, Math.random() * 6));
    rast.setShader(makeRasterizerShader(folProg, {}));
    rast.setUniforms(common);
    rast.draw(m);
}

let nonBlack = 0;
for (let i = 0; i < fb.color.length; i++) {
    if (fb.color[i] !== fb.clearColor) nonBlack++;
}
console.log('Total colored pixels:', nonBlack, '/', fb.color.length);
console.log('Sample colors (R,G,B) at various pixels:');
for (const idx of [0, 30000, 60000, W * 30 + 150, W * 100 + 150, W * 150 + 150]) {
    const v = fb.color[idx];
    if (v === undefined) { console.log(`  [${idx}] = (out of bounds)`); continue; }
    console.log(`  [${idx}] = #${v.toString(16).padStart(8, '0')}`);
}

// Save as PPM to view
import { writeFileSync } from 'fs';
try {
    const ppm = `P6\n${W} ${H}\n255\n`;
    const bytes = new Uint8Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
        const v = fb.color[i];
        bytes[i * 3] = v & 0xFF;
        bytes[i * 3 + 1] = (v >> 8) & 0xFF;
        bytes[i * 3 + 2] = (v >> 16) & 0xFF;
    }
    writeFileSync('/workspaces/Free-ai/test_render.ppm', Buffer.concat([Buffer.from(ppm), Buffer.from(bytes)]));
    console.log('Saved test_render.ppm');
} catch (e) {
    console.log('PPM save failed:', e.message);
}
