// =============================================================
// engine/render/FrameBuffer.js
// CPU-side color + depth buffers drawn into an <canvas> via putImageData.
// No WebGL. The entire frame is one big Uint32Array per channel.
// =============================================================

export class FrameBuffer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.color = new Uint32Array(this.imageData.data.buffer);
        // Depth is stored as 32-bit floats for proper precision
        this.depth = new Float32Array(this.width * this.height);
        this.clearColor = 0xFF000000; // ABGR
        this.frameCount = 0;
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;
        this.imageData = this.ctx.createImageData(w, h);
        this.color = new Uint32Array(this.imageData.data.buffer);
        this.depth = new Float32Array(w * h);
    }

    clear() {
        this.color.fill(this.clearColor);
        this.depth.fill(1e9);
        this.frameCount++;
    }

    setPixel(x, y, r, g, b) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
        // ABGR little-endian packing
        const i = (y * this.width + x) | 0;
        this.color[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
    }

    getDepth(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 1e9;
        return this.depth[(y * this.width + x) | 0];
    }

    setDepth(x, y, z) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
        this.depth[(y * this.width + x) | 0] = z;
    }

    blit() {
        this.ctx.putImageData(this.imageData, 0, 0);
    }
}
