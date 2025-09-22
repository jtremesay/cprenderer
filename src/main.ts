import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import type { GLTFWithBuffers } from '@loaders.gl/gltf';
const TARGET_UPS = 60;
const TARGET_DT = 1 / TARGET_UPS;

const gltf = await load("scifi_room/scene.gltf", GLTFLoader);

class Renderer {
    gl: WebGLRenderingContext;

    constructor(canvas: HTMLCanvasElement) {

        const width = 800;
        const height = width * 9 / 16
        canvas.width = width;
        canvas.height = height;
        this.gl = canvas.getContext("webgl") as WebGLRenderingContext;
        if (!this.gl) {
            throw new Error("WebGL not supported");
        }
    }

    render(engine: Engine) {
        this.gl.clearColor(engine.wall_clock % 1, 0.5, 0.5, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
}

class MainRenderer extends Renderer {
    constructor() {
        super(document.querySelector("#main_render") as HTMLCanvasElement);
    }
}

class Engine {
    gltf: GLTFWithBuffers;
    tick_count: number = 0;
    wall_clock: number = 0;
    renderers: Renderer[] = [];

    constructor(gltf: GLTFWithBuffers) {
        this.gltf = gltf;

        this.renderers.push(new MainRenderer());
    }

    start() {
        requestAnimationFrame(this.run.bind(this));
    }

    run() {
        this.wall_clock += TARGET_DT;


        //console.log(`Tick ${this.tick_count}`);
        for (let renderer of this.renderers) {
            renderer.render(this);
        }


        this.tick_count += 1;
        requestAnimationFrame(this.run.bind(this));
    }
}

let engine = new Engine(gltf);
engine.start();