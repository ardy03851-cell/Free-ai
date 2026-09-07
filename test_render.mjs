// Full render test — exercises rasterizer + shaders end-to-end
import { FrameBuffer } from './engine/render/FrameBuffer.js';
import { Rasterizer } from './engine/render/Rasterizer.js';
import { Camera } from './engine/world/Camera.js';
import { mat4Multiply } from './engine/core/Mat4.js';
import { Texture } from './engine/render/Texture.js';
import { Terrain } from './engine/world/Terrain.js';
import { Water } from './engine/world/Water.js';
import { ModelBuilder } from './engine/models/ModelBuilder.js';
import { ShaderProgram, makeRasterizerShader } from './engine/shaders/ShaderCompiler.js';
import { LIT_SHADER, TERRAIN_SHADER, WATER_SHADER, FOLIAGE_SHADER } from './engine/shaders/ShaderLibrary.js';
import { Scene } from './engine/world/SceneGraph.js';
import { SceneNode } from './engine/world/SceneGraph.js';

// Fake canvas
const canvas = { width: 200, height: 150 };
const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: () => {}
};
canvas.getContext = () => ctx;

const fb = new FrameBuffer(canvas);
const rast = new Rasterizer(fb);
const cam = new Camera(200 / 150, Math.PI / 3);
cam.position = [0, 5, 8];
cam.updateView();

const vp = new Float32Array(16);
mat4Multiply(vp, cam.proj, cam.view);
rast.setViewProjection(vp);

const tex = { grass: Texture.createGrass(64) };
const litProg = new ShaderProgram(LIT_SHADER);
const folProg = new ShaderProgram(FOLIAGE_SHADER);

const scene = new Scene();
scene.addLight({ type: 'directional', direction: [0.4, -0.8, 0.45], color: [1, 0.95, 0.85] });
scene.addLight({ type: 'ambient', color: [0.3, 0.35, 0.45] });
scene.samplers = tex;
scene.programs = { lit: litProg, foliage: folProg };

// Add a few pine trees
for (let i = 0; i < 5; i++) {
    const m = new ModelBuilder('pine').pineTree(3, 1, 0.2).build();
    const n = new SceneNode(m, { shader: folProg });
    n.position = [-4 + i * 2, 0, -2 + (i % 2)];
    scene.add(n);
}

// Render
fb.clear();
const sunDir = scene.lights[0].direction;
const ambient = scene.lights[1].color;
const common = { cameraPos: cam.position, lightDir: sunDir, lightColor: [1, 0.95, 0.85], ambient, time: 0 };
for (const n of scene.nodes) {
    const M = new Float32Array(16);
    M[0] = 1; M[5] = 1; M[10] = 1; M[15] = 1;
    M[12] = n.position[0]; M[13] = n.position[1]; M[14] = n.position[2];
    rast.setModelMatrix(M);
    const prog = n.material.shader;
    const u = { ...common, shininess: 8, specularStrength: 0.05, ...scene.samplers };
    rast.setShader(makeRasterizerShader(prog, scene.samplers));
    rast.setUniforms(u);
    rast.draw(n.mesh);
}

// Count non-clear pixels
let colored = 0;
for (let i = 0; i < fb.color.length; i++) {
    if (fb.color[i] !== fb.clearColor) colored++;
}
console.log('Rendered pixels:', colored, '/', fb.color.length);
console.log('Color sample [0]:', fb.color[0].toString(16));
console.log('OK');
