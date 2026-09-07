// Simulate the full engine + world boot
import { Engine } from './engine/Engine.js';
import { World } from './game/World.js';
import { Player } from './game/entities/Player.js';

// Mock canvas
const canvas = { width: 600, height: 400 };
canvas.getContext = () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: () => {}
});
canvas.addEventListener = () => {};

const engine = new Engine(canvas);
engine.resize(600, 400);

const world = new World();
engine.setScene(world.scene);
engine.skyMesh = world.skyMesh;
engine.scene.programs = world.programs;
engine.scene.samplers = world.samplers;
engine.scene.terrain = world.terrain;

const player = new Player(world.scene);
player.position = [0, world.terrain.heightAt(0, 0) + player.height, 5];

// Override render to do a single frame and save as PNG
const origRender = engine._render.bind(engine);
let frameCount = 0;
engine._render = function() {
    origRender();
    frameCount++;
    if (frameCount === 1) {
        const { writeFileSync } = require('fs');
        const W = this.fb.width, H = this.fb.height;
        const ppm = `P6\n${W} ${H}\n255\n`;
        const bytes = new Uint8Array(W * H * 3);
        for (let i = 0; i < W * H; i++) {
            const v = this.fb.color[i];
            bytes[i * 3] = v & 0xFF;
            bytes[i * 3 + 1] = (v >> 8) & 0xFF;
            bytes[i * 3 + 2] = (v >> 16) & 0xFF;
        }
        writeFileSync('/workspaces/Free-ai/full_test.ppm', Buffer.concat([Buffer.from(ppm), Buffer.from(bytes)]));
        console.log('Saved full_test.ppm');
        // Force exit
        process.exit(0);
    }
};

// Mock input
engine._update = (dt) => {};

// Don't start loop, call directly
engine._render();
