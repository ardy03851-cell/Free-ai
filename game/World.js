// =============================================================
// game/World.js
// Assembles terrain, water, sky, and scatters trees/rocks/houses
// across the heightmap. Returns a fully-populated Scene.
// =============================================================

import { Terrain } from '../engine/world/Terrain.js';
import { Water } from '../engine/world/Water.js';
import { Scene } from '../engine/world/SceneGraph.js';
import { SceneNode } from '../engine/world/SceneGraph.js';
import { ModelBuilder } from '../engine/models/ModelBuilder.js';
import { Texture } from '../engine/render/Texture.js';
import { ShaderProgram, makeRasterizerShader } from '../engine/shaders/ShaderCompiler.js';
import { SKY_SHADER, buildSkyDome } from '../engine/world/Sky.js';
import {
    LIT_SHADER, TEXTURED_SHADER, TERRAIN_SHADER, WATER_SHADER, FLAT_COLOR_SHADER, FOLIAGE_SHADER
} from '../engine/shaders/ShaderLibrary.js';
import { fbm2D } from '../engine/world/Noise.js';

export class World {
    constructor() {
        this.scene = new Scene();
        // Lights
        this.scene.addLight({
            type: 'directional',
            direction: [0.4, -0.8, 0.45],
            color: [1.0, 0.95, 0.85]
        });
        this.scene.addLight({
            type: 'ambient',
            color: [0.30, 0.35, 0.45]
        });

        // Build terrain from heightmap
        this.terrain = Terrain.fromProcedural({ size: 96, scale: 1.6, amplitude: 9, targetBelow: 0.55 });
        // Build water over the whole extent
        const extent = this.terrain.hm.size * this.terrain.hm.scale;
        this.water = new Water(extent * 1.1, this.terrain.waterLevel, 48);

        // Build textures
        this.tex = {
            grass: Texture.createGrass(96),
            stone: Texture.createStone(96),
            water: Texture.createWater(64),
            wood: Texture.createWood(96)
        };

        // Compile shaders
        this.programs = {
            sky: new ShaderProgram(SKY_SHADER),
            lit: new ShaderProgram(LIT_SHADER),
            textured: new ShaderProgram(TEXTURED_SHADER),
            terrain: new ShaderProgram(TERRAIN_SHADER),
            water: new ShaderProgram(WATER_SHADER),
            flat: new ShaderProgram(FLAT_COLOR_SHADER),
            foliage: new ShaderProgram(FOLIAGE_SHADER)
        };

        // Bind samplers -> textures by name
        this.samplers = {
            diffuse: this.tex.grass
        };

        // Terrain node
        this.terrainNode = new SceneNode(this.terrain.mesh, { shader: this.programs.terrain });
        this.scene.add(this.terrainNode);

        // Water node
        this.waterNode = new SceneNode(this.water.mesh, { shader: this.programs.water });
        this.scene.add(this.waterNode);

        // Sky node
        this.skyMesh = buildSkyDome();
        this.skyNode = new SceneNode(this.skyMesh, { shader: this.programs.sky });
        this.scene.add(this.skyNode);

        // Scatter props across the world
        this._scatter();

        // Decoration buildings / crystals
        this._addLandmarks();
    }

    _scatter() {
        // Pine trees and rocks distributed using noise
        const hm = this.terrain.hm;
        const step = 4;
        for (let y = 4; y < hm.size - 4; y += step) {
            for (let x = 4; x < hm.size - 4; x += step) {
                const h = hm.get(x, y);
                if (h < this.terrain.waterLevel + 0.4) continue;
                if (h > 5.5) continue;
                const wx = (x - hm.size / 2) * hm.scale;
                const wz = (y - hm.size / 2) * hm.scale;
                const n = fbm2D(x * 0.15, y * 0.15, 3);
                if (n > 0.15) {
                    // tree
                    const scale = 0.8 + (n - 0.15) * 0.6;
                    const m = new ModelBuilder('tree').pineTree(3.5 * scale, 1.1 * scale, 0.18 * scale).build();
                    const node = new SceneNode(m, { shader: this.programs.foliage });
                    node.position = [wx, h, wz];
                    node.rotation = [0, n * 12, 0];
                    node.tag = 'tree';
                    this.scene.add(node);
                } else if (n < -0.1) {
                    // rock
                    const m = new ModelBuilder('rock').rock(0.5 + (1 + n) * 0.6).build();
                    const node = new SceneNode(m, { shader: this.programs.lit });
                    node.position = [wx, h, wz];
                    node.tag = 'rock';
                    this.scene.add(node);
                }
            }
        }
    }

    _addLandmarks() {
        const hm = this.terrain.hm;
        const half = hm.size / 2 * hm.scale;
        // central house on the highest point
        let bestX = 0, bestZ = 0, bestH = -1e9;
        for (let y = 0; y < hm.size; y += 3) {
            for (let x = 0; x < hm.size; x += 3) {
                const h = hm.get(x, y);
                if (h > bestH) { bestH = h; bestX = x; bestZ = y; }
            }
        }
        const wx = (bestX - hm.size / 2) * hm.scale;
        const wz = (bestZ - hm.size / 2) * hm.scale;
        const house = new ModelBuilder('house').house(3.4, 3.4, 2.6).build();
        const houseNode = new SceneNode(house, { shader: this.programs.lit });
        houseNode.position = [wx, bestH, wz];
        houseNode.tag = 'house';
        this.scene.add(houseNode);

        // floating crystals
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            const r = 12 + (i % 2) * 6;
            const px = Math.cos(ang) * r;
            const pz = Math.sin(ang) * r;
            const py = hm.sample(px, pz) + 2.0 + (i % 3);
            const m = new ModelBuilder('crystal').crystal(0.8 + (i % 3) * 0.2).build();
            const node = new SceneNode(m, { shader: this.programs.lit });
            node.position = [px, py, pz];
            node.tag = 'crystal';
            node.update = (dt, t) => { node.position[1] = py + Math.sin(t * 1.5 + i) * 0.3; node.rotation[1] = t * 0.5; };
            this.scene.add(node);
        }
    }
}
