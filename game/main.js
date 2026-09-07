// =============================================================
// game/main.js
// Entry point. Boots the engine, builds the world, and starts
// the render loop with iPad-friendly touch input.
// =============================================================

import { Engine } from '../engine/Engine.js';
import { TouchInput } from '../engine/input/TouchInput.js';
import { World } from './World.js';
import { Player } from './entities/Player.js';

const canvas = document.getElementById('gameCanvas');
canvas.width = Math.min(window.innerWidth, 1024);
canvas.height = Math.min(window.innerHeight, 768);

const engine = new Engine(canvas);
engine.resize(canvas.width, canvas.height);

const world = new World();
engine.setScene(world.scene);
engine.skyMesh = world.skyMesh;
engine.scene.programs = world.programs;
engine.scene.samplers = world.samplers;
engine.scene.terrain = world.terrain;

const player = new Player(world.scene);
// Place player on terrain
player.position = [0, world.terrain.heightAt(0, 0) + player.height, 5];
player.velocity = [0, 0, 0];

const input = new TouchInput(canvas);

let lastInput = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, zoom: 0, jump: false };

function update(dt) {
    const i = input.consume();
    lastInput = i;
    player.update(dt, i, world.terrain);
    // Third-person follow camera
    const followDistance = 6 - i.zoom;
    const fy = player.yaw;
    const fx = Math.cos(fy) * followDistance;
    const fz = Math.sin(fy) * followDistance;
    const targetX = player.position[0] - fx;
    const targetZ = player.position[2] - fz;
    const targetY = player.position[1] + 3.5;
    // Smooth follow
    engine.camera.position[0] += (targetX - engine.camera.position[0]) * Math.min(1, dt * 4);
    engine.camera.position[1] += (targetY - engine.camera.position[1]) * Math.min(1, dt * 4);
    engine.camera.position[2] += (targetZ - engine.camera.position[2]) * Math.min(1, dt * 4);
    // Camera rotation
    engine.camera.yaw = fy + Math.PI;
    engine.camera.pitch = -0.35;
    engine.camera.updateView();

    // Animate water
    world.water.update(dt);
    // Animate world (floating crystals etc.)
    world.scene.update(dt, engine.time);
}

// Override engine._update to use our player logic
engine._update = update;

engine.start();

// Optional: HUD
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;bottom:10px;left:10px;color:#fff;font:14px sans-serif;text-shadow:0 1px 2px #000;pointer-events:none;z-index:9';
hud.innerHTML = 'Lume Engine · 3D · touch left to move, right to look, pinch to zoom';
document.body.appendChild(hud);

setInterval(() => {
    hud.innerHTML = `Lume Engine · ${engine.fps} FPS · ${world.scene.nodes.length} nodes · player @ ${player.position.map(v => v.toFixed(1)).join(', ')}`;
}, 200);

// Prevent default touch behaviors on iPad
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
