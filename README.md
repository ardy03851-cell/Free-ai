# Lume · Custom 3D Engine & Game

A fully hand-rolled 3D game engine and an iPad-friendly world demo — built **without WebGL, WebGPU, Three.js, or any graphics library**. Every pixel is computed on the CPU in plain JavaScript.

## What's in here

| File / Folder | Purpose |
|---|---|
| `index.html` | Single entry point |
| `game/main.js` | Boots the engine, wires input, runs the world |
| `engine/core/Vec3.js`, `Mat4.js`, `Vec2.js` | Hand-written math (vec3, mat4 column-major, vec2) |
| `engine/render/FrameBuffer.js` | CPU color + depth buffer drawn via `putImageData` |
| `engine/render/Rasterizer.js` | Software triangle rasterizer with z-buffer, perspective-correct interpolation, edge-function incremental scan |
| `engine/render/Texture.js` | Texture objects + procedural grass/stone/water/wood generators |
| `engine/shaders/ShaderLang.js` | **`Lume`** — a brand-new tiny shader DSL (parser + interpreter) |
| `engine/shaders/ShaderLibrary.js` | Pre-written Lume shaders (lit, textured, terrain, water, sky, foliage) |
| `engine/shaders/ShaderCompiler.js` | Bridges compiled Lume into per-pixel rasterizer functions |
| `engine/models/MDLFormat.js` | **`LumeMDL`** — a brand-new declarative 3D model format (text) |
| `engine/models/Mesh.js` | Vertex/index buffer model object |
| `engine/models/ModelBuilder.js` | Easy-to-use chainable model API: `pineTree()`, `house()`, `crystal()`, `figure()`... |
| `engine/world/Noise.js` | fBm, value, ridged noise |
| `engine/world/HeightMap.js` | Procedural heightmap with island falloff + mountains |
| `engine/world/Terrain.js` | Builds a triangulated terrain mesh from a heightmap |
| `engine/world/Water.js` | Animated wave surface driven by Gerstner-ish stacked sines |
| `engine/world/Camera.js` | First/third-person fly camera with pitch/yaw/zoom |
| `engine/world/Sky.js` | Procedural sky dome with sun + clouds (Lume shader) |
| `engine/world/SceneGraph.js` | Lightweight scene graph: nodes with mesh + material |
| `engine/input/TouchInput.js` | iPad multi-touch: virtual joystick, look, pinch zoom |
| `engine/Engine.js` | Main render loop, owns FrameBuffer, Rasterizer, Camera |
| `game/World.js` | Assembles the world: terrain, water, sky, scattered trees/rocks/houses |
| `game/entities/Player.js` | Walk-on-terrain player with gravity + jump |
| `assets/models/*.mdl` | Sample hand-authored models in LumeMDL text format |

## Two brand-new "special" languages

### LumeMDL — declarative 3D models in plain text
```mdl
# LumeMDL v1
name: tree_pine
primitive: cone
radius: 0.9
height: 3.5
translate: [0, 2.5, 0]
color: [0.20, 0.55, 0.20]
```

### Lume — a safe interpreted shader DSL
```c
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
varying vec3 vNormal;
varying vec2 vUv;
uniform vec3 cameraPos;
uniform vec3 lightDir;
uniform sampler diffuse;

fn vertex() {
    vNormal = normal;
    vUv = uv;
    return position;
}

fn fragment() {
    let N = normalize(vNormal);
    let L = normalize(-lightDir);
    let diff = max(dot(N, L), 0.0);
    let tex = texture(diffuse, vUv);
    return tex.rgb * (0.3 + diff * 0.8);
}
```

Supports `vec2`, `vec3`, `let`, `if/else`, `mix`, `clamp`, `normalize`, `dot`, `cross`, `texture()`, swizzles, and more.

## Run it

Open `index.html` in any modern browser (works on iPad Safari). The whole thing is ES modules — no build step.

## iPad controls
- **Left half of screen** = virtual joystick (move)
- **Right half of screen** = drag to look
- **Pinch** = zoom
- **Space / button** = jump
- **WASD / arrow keys** also work in desktop browsers
