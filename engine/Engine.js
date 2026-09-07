// =============================================================
// engine/Engine.js
// The core engine loop. Owns the FrameBuffer, Rasterizer, Camera,
// and Scene. Wires shaders, per-frame uniforms, and runs render.
// =============================================================

import { FrameBuffer } from './render/FrameBuffer.js';
import { Rasterizer } from './render/Rasterizer.js';
import { Camera } from './world/Camera.js';
import { mat4Multiply, mat4Identity, mat4Translate, mat4RotateX, mat4RotateY, mat4RotateZ, mat4Scale } from './core/Mat4.js';
import { makeRasterizerShader } from './shaders/ShaderCompiler.js';

export class Engine {
    constructor(canvas) {
        this.canvas = canvas;
        this.fb = new FrameBuffer(canvas);
        this.raster = new Rasterizer(this.fb);
        this.camera = new Camera(canvas.width / canvas.height);
        this.scene = null;
        this.time = 0;
        this.lastFrame = performance.now();
        this.fps = 0;
        this.fpsCounter = 0;
        this.fpsTimer = 0;

        // Background clear color (sky tint)
        this.fb.clearColor = 0xFFB0D0FF;
    }

    resize(w, h) {
        this.fb.resize(w, h);
        this.camera.setAspect(w / h);
    }

    setScene(scene) { this.scene = scene; }

    start() {
        const loop = () => {
            const now = performance.now();
            const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
            this.lastFrame = now;
            this.time += dt;
            this.fpsCounter++;
            this.fpsTimer += dt;
            if (this.fpsTimer >= 1) {
                this.fps = this.fpsCounter;
                this.fpsCounter = 0;
                this.fpsTimer = 0;
            }
            this._update(dt);
            this._render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    _update(dt) {
        if (this.scene && this.scene.update) this.scene.update(dt, this.time);
    }

    _render() {
        const fb = this.fb;
        fb.clear();
        if (!this.scene) { fb.blit(); return; }

        const vp = this.camera.view;
        // view*proj
        const vpMat = new Float32Array(16);
        mat4Multiply(vpMat, this.camera.proj, vp);
        this.raster.setViewProjection(vpMat);
        this.raster.setLights(this.scene.lights);

        // Draw sky (special: ignore camera translation, only rotation)
        // We use a model matrix that zeroes translation
        const skyModel = new Float32Array(16);
        // Sky should follow the camera: build a model at camera pos with rotation only
        mat4Translate(skyModel, this.camera.position[0], this.camera.position[1], this.camera.position[2]);
        this.raster.setModelMatrix(skyModel);
        // Use the sky shader from the scene
        const skyShader = this.scene.programs ? this.scene.programs.sky : null;
        if (skyShader) this.raster.setShader(makeRasterizerShader(skyShader, this.scene.samplers || {}));
        // Sun direction = first light dir inverted
        const sunDir = this.scene.lights[0] ? this.scene.lights[0].direction : [0.4, -0.8, 0.45];
        const ambient = (this.scene.lights[1] && this.scene.lights[1].type === 'ambient') ? this.scene.lights[1].color : [0.3, 0.35, 0.45];
        this.raster.setUniforms({
            sunDir,
            zenith: [0.20, 0.45, 0.85],
            horizon: [0.85, 0.78, 0.65],
            sunColor: [1.0, 0.95, 0.8],
            time: this.time
        });
        this.raster.draw(this.skyMesh);

        // Build common uniforms for lit objects
        const camPos = this.camera.position;
        const common = {
            cameraPos: camPos,
            lightDir: sunDir,
            lightColor: [1.0, 0.95, 0.85],
            ambient,
            time: this.time
        };

        // Sort opaque nodes by distance (back-to-front not required for z-buffer, but
        // we want to draw the sky-like stuff first).
        const nodes = this.scene.nodes.slice();
        // Draw terrain first
        const terrainNode = nodes.find(n => n.mesh && n.mesh.name === 'terrain');
        if (terrainNode) this._drawNode(terrainNode, common);
        const waterNode = nodes.find(n => n.mesh && n.mesh.name === 'water');
        if (waterNode) this._drawNode(waterNode, common);
        // Then all other nodes
        for (const n of nodes) {
            if (n === terrainNode || n === waterNode) continue;
            if (n.mesh && n.mesh.name === 'skydome') continue;
            this._drawNode(n, common);
        }
        fb.blit();
    }

    _drawNode(node, common) {
        const model = this._modelMatrix(node);
        this.raster.setModelMatrix(model);
        // Build shader
        const mat = node.material || { shader: this.scene.programs?.lit };
        const prog = mat.shader;
        if (!prog) return;
        const uniforms = Object.assign({}, common, mat.uniforms || {});
        // Bind samplers
        if (this.scene && this.scene.samplers) {
            Object.assign(uniforms, this.scene.samplers);
        }
        // Per-material extras
        if (prog === this.scene.programs.terrain) {
            const b = this.scene.terrain.bounds;
            uniforms.lowY = b.min[1];
            uniforms.highY = b.max[1];
        }
        if (prog === this.scene.programs.water) {
            uniforms.deepColor = [0.05, 0.18, 0.45];
            uniforms.shallowColor = [0.30, 0.65, 0.85];
            uniforms.skyTint = [0.5, 0.7, 0.95];
        }
        if (prog === this.scene.programs.foliage) {
            uniforms.shininess = 8;
            uniforms.specularStrength = 0.05;
        }
        if (prog === this.scene.programs.lit) {
            uniforms.shininess = 24;
            uniforms.specularStrength = 0.4;
        }
        const shader = makeRasterizerShader(prog, this.scene.samplers || {});
        this.raster.setShader(shader);
        this.raster.setUniforms(uniforms);
        this.raster.draw(node.mesh);
    }

    _modelMatrix(node) {
        const out = new Float32Array(16);
        // Build T * R * S
        const T = mat4Translate(new Float32Array(16), node.position[0], node.position[1], node.position[2]);
        const RX = new Float32Array(16); mat4Identity(RX);
        const RY = new Float32Array(16); mat4Identity(RY);
        const RZ = new Float32Array(16); mat4Identity(RZ);
        // simple per-axis rotation
        if (node.rotation[0]) {
            const m = require_RotX(node.rotation[0]);
            mat4Multiply(RX, RX, m);
        }
        if (node.rotation[1]) {
            const m = require_RotY(node.rotation[1]);
            mat4Multiply(RY, RY, m);
        }
        if (node.rotation[2]) {
            const m = require_RotZ(node.rotation[2]);
            mat4Multiply(RZ, RZ, m);
        }
        const S = mat4Scale(new Float32Array(16), node.scale[0], node.scale[1], node.scale[2]);
        mat4Multiply(out, T, RZ);
        mat4Multiply(out, out, RY);
        mat4Multiply(out, out, RX);
        mat4Multiply(out, out, S);
        return out;
    }
}

// Helpers — rotate matrix builders
function require_RotX(r) { return mat4RotateX(new Float32Array(16), r); }
function require_RotY(r) { return mat4RotateY(new Float32Array(16), r); }
function require_RotZ(r) { return mat4RotateZ(new Float32Array(16), r); }
