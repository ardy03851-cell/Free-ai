// Quick smoke test — runs all engine modules in Node
import { mat4Identity, mat4Perspective, mat4LookAt, mat4Multiply } from './engine/core/Mat4.js';
import { vec3, vec3Add, vec3Cross, vec3Normalize } from './engine/core/Vec3.js';
import { Mesh } from './engine/models/Mesh.js';
import { ModelBuilder } from './engine/models/ModelBuilder.js';
import { compileShader } from './engine/shaders/ShaderLang.js';
import { LIT_SHADER, TERRAIN_SHADER, WATER_SHADER } from './engine/shaders/ShaderLibrary.js';
import { SKY_SHADER } from './engine/world/Sky.js';
import { Texture } from './engine/render/Texture.js';
import { fbm2D } from './engine/world/Noise.js';
import { HeightMap } from './engine/world/HeightMap.js';
import { Terrain } from './engine/world/Terrain.js';
import { Water } from './engine/world/Water.js';

// Test math
const m = new Float32Array(16);
mat4Identity(m);
const p = mat4Perspective(new Float32Array(16), Math.PI / 3, 16 / 9, 0.1, 100);
console.log('mat4 ok');

// Test model builder
const pine = new ModelBuilder('pine').pineTree().build();
console.log('pine mesh verts:', pine.maxVerts);

// Test shader compile
const lit = compileShader(LIT_SHADER);
const sky = compileShader(SKY_SHADER);
const water = compileShader(WATER_SHADER);
const terrain = compileShader(TERRAIN_SHADER);
console.log('lit varyings:', Object.keys(lit.varyings));
console.log('sky varyings:', Object.keys(sky.varyings));

// Test textures
const grass = Texture.createGrass(64);
console.log('grass tex size:', grass.width, grass.height);

// Test terrain + water
const hm = new HeightMap(32, 2.0);
hm.generateProcedural();
const tr = new Terrain(hm, 0);
console.log('terrain verts:', tr.mesh.maxVerts, 'water level:', tr.waterLevel);

const w = new Water(64, 0, 24);
w.update(0.016);
console.log('water verts:', w.mesh.maxVerts);

console.log('ALL OK');
