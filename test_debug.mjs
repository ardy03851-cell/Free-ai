// Minimal debug: one triangle, see if rasterizer draws it
import { FrameBuffer } from './engine/render/FrameBuffer.js';
import { Rasterizer } from './engine/render/Rasterizer.js';
import { Camera } from './engine/world/Camera.js';
import { mat4Multiply, mat4Identity, mat4Translate } from './engine/core/Mat4.js';
import { Mesh } from './engine/models/Mesh.js';

const canvas = { width: 200, height: 150, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData: () => {} }) };
const fb = new FrameBuffer(canvas);
const rast = new Rasterizer(fb);

const cam = new Camera(200 / 150);
cam.position = [0, 0, 5];
cam.pitch = 0;
cam.yaw = 0;
cam.updateView();

const vp = new Float32Array(16);
mat4Multiply(vp, cam.proj, cam.view);
rast.setViewProjection(vp);

// identity model
const M = new Float32Array(16); mat4Identity(M);
rast.setModelMatrix(M);

// big triangle
const mesh = Mesh.fromArrays('tri',
    [
        -1, -1, 0, 0, 0, 1, 0, 0,
         1, -1, 0, 0, 0, 1, 1, 0,
         0,  1, 0, 0, 0, 1, 0.5, 1
    ],
    [0, 1, 2],
    8
);
mesh.cullBackface = false;

fb.clear();
rast.setShader(ctx => { ctx.fb.setPixel(ctx.pixel[0], ctx.pixel[1], 0, 200, 0); });
rast.setUniforms({});
console.log('Before draw, fb.color[0]:', fb.color[0].toString(16));

// Manually project one vertex
const m = rast.mvp;
const v = [-1, -1, 0];
const w = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15];
const x = (m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12]) / w;
const y = (m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13]) / w;
const z = (m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]) / w;
console.log('Manual project (-1,-1,0):', x.toFixed(3), y.toFixed(3), z.toFixed(3), 'w=', w.toFixed(3));
const sx = (x * 0.5 + 0.5) * 200;
const sy = (1 - (y * 0.5 + 0.5)) * 150;
console.log('Screen:', sx.toFixed(1), sy.toFixed(1));
console.log('View matrix:', Array.from(cam.view).map(v => v.toFixed(2)));
console.log('Proj matrix:', Array.from(cam.proj).map(v => v.toFixed(2)));

// Compute screen for all 3 verts
for (const vtx of [[-1,-1,0],[1,-1,0],[0,1,0]]) {
    const ww = m[3] * vtx[0] + m[7] * vtx[1] + m[11] * vtx[2] + m[15];
    const xx = (m[0] * vtx[0] + m[4] * vtx[1] + m[8] * vtx[2] + m[12]) / ww;
    const yy = (m[1] * vtx[0] + m[5] * vtx[1] + m[9] * vtx[2] + m[13]) / ww;
    const sxx = (xx * 0.5 + 0.5) * 200;
    const syy = (1 - (yy * 0.5 + 0.5)) * 150;
    console.log('Vertex', vtx, '-> screen', sxx.toFixed(1), syy.toFixed(1), 'w=', ww.toFixed(2));
}

rast.draw(mesh);
console.log('After draw, fb.color[0]:', fb.color[0].toString(16));
console.log('After draw, fb.color[100*200+100]:', fb.color[100 * 200 + 100].toString(16));
console.log('After draw, fb.color[15000]:', fb.color[15000].toString(16));

// Count green pixels
let g = 0;
for (let i = 0; i < fb.color.length; i++) if ((fb.color[i] & 0xFF) === 0 && ((fb.color[i] >> 8) & 0xFF) > 100) g++;
console.log('Green pixels:', g, '/ 30000');
