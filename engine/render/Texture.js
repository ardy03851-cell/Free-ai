// =============================================================
// engine/render/Texture.js
// Software textures. Stored as raw RGBA Uint8ClampedArray.
// Supports wrapping, mipmap-lite (just level 0 for now),
// and bilinear sampling at the pixel level.
// =============================================================

export class Texture {
    constructor(width, height, pixels) {
        this.width = width;
        this.height = height;
        this.pixels = pixels; // Uint8ClampedArray RGBA
    }

    static fromCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        const data = ctx.getImageData(0, 0, w, h).data;
        return new Texture(w, h, new Uint8ClampedArray(data));
    }

    static createSolid(r, g, b, a = 255) {
        const px = new Uint8ClampedArray([r, g, b, a]);
        return new Texture(1, 1, px);
    }

    static createCheckerboard(size = 64, c1 = [255, 255, 255], c2 = [40, 40, 40]) {
        const px = new Uint8ClampedArray(size * size * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const c = ((x >> 3) + (y >> 3)) & 1 ? c1 : c2;
                const i = (y * size + x) * 4;
                px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
            }
        }
        return new Texture(size, size, px);
    }

    // Procedural stone/grass texture
    static createGrass(size = 128) {
        const px = new Uint8ClampedArray(size * size * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = (Math.sin(x * 0.3) + Math.cos(y * 0.27) + Math.sin((x + y) * 0.1)) * 0.25;
                const r = 40 + n * 50 + Math.random() * 25;
                const g = 110 + n * 60 + Math.random() * 30;
                const b = 30 + n * 30;
                const i = (y * size + x) * 4;
                px[i] = r | 0; px[i + 1] = g | 0; px[i + 2] = b | 0; px[i + 3] = 255;
            }
        }
        return new Texture(size, size, px);
    }

    static createStone(size = 128) {
        const px = new Uint8ClampedArray(size * size * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = (Math.sin(x * 0.5) * Math.cos(y * 0.4) + Math.random() * 0.3) * 0.5;
                const v = 110 + n * 60;
                const i = (y * size + x) * 4;
                px[i] = v | 0; px[i + 1] = v * 0.95 | 0; px[i + 2] = v * 0.9 | 0; px[i + 3] = 255;
            }
        }
        return new Texture(size, size, px);
    }

    static createWater(size = 128) {
        const px = new Uint8ClampedArray(size * size * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = (Math.sin(x * 0.2) + Math.cos(y * 0.18) + Math.sin((x + y) * 0.07)) * 0.25;
                const r = 30 + n * 40;
                const g = 80 + n * 60;
                const b = 160 + n * 60;
                const i = (y * size + x) * 4;
                px[i] = r | 0; px[i + 1] = g | 0; px[i + 2] = b | 0; px[i + 3] = 255;
            }
        }
        return new Texture(size, size, px);
    }

    static createWood(size = 128) {
        const px = new Uint8ClampedArray(size * size * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const ring = Math.sin((x + y * 0.3) * 0.4) * 0.5 + 0.5;
                const grain = (Math.sin(y * 1.5 + Math.cos(x * 0.3) * 4) + 1) * 0.3;
                const v = 80 + ring * 50 + grain * 30;
                const i = (y * size + x) * 4;
                px[i] = v + 20 | 0; px[i + 1] = v * 0.6 | 0; px[i + 2] = v * 0.3 | 0; px[i + 3] = 255;
            }
        }
        return new Texture(size, size, px);
    }

    sample(u, v) {
        // wrap
        u = u - Math.floor(u);
        v = v - Math.floor(v);
        const x = (u * (this.width - 1)) | 0;
        const y = (v * (this.height - 1)) | 0;
        const i = (y * this.width + x) * 4;
        return [this.pixels[i], this.pixels[i + 1], this.pixels[i + 2], this.pixels[i + 3]];
    }
}
