// Final integration test
import { Engine } from './engine/Engine.js';
import { World } from './game/World.js';
import { Player } from './game/entities/Player.js';
import { writeFileSync } from 'fs';

const canvas = { width: 800, height: 500, addEventListener: () => {} };
canvas.getContext = () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: () => {}
});

const engine = new Engine(canvas);
engine.resize(800, 500);

const world = new World();
engine.setScene(world.scene);
engine.skyMesh = world.skyMesh;
engine.scene.programs = world.programs;
engine.scene.samplers = world.samplers;
engine.scene.terrain = world.terrain;

const player = new Player(world.scene);
player.position = [0, world.terrain.heightAt(0, 0) + player.height, 5];

let frameCount = 0;
const origRender = engine._render.bind(engine);
engine._render = function() {
    origRender();
    frameCount++;
    if (frameCount === 1) {
        const W = this.fb.width, H = this.fb.height;
        const ppm = `P6\n${W} ${H}\n255\n`;
        const bytes = new Uint8Array(W * H * 3);
        for (let i = 0; i < W * H; i++) {
            const v = this.fb.color[i];
            bytes[i * 3] = v & 0xFF;
            bytes[i * 3 + 1] = (v >> 8) & 0xFF;
            bytes[i * 3 + 2] = (v >> 16) & 0xFF;
        }
        writeFileSync('/workspaces/Free-ai/_final.ppm', Buffer.concat([Buffer.from(ppm), Buffer.from(bytes)]));
        console.log('Rendered frame saved to _final.ppm');
        process.exit(0);
    }
};
engine._update = () => {};
engine._render();
