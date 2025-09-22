import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import type { GLTFWithBuffers } from '@loaders.gl/gltf';
import vanilla_vert_shader_source from './shaders/vanilla.vert?raw';
import vanilla_frag_shader_source from './shaders/vanilla.frag?raw';
import main_vert_shader_source from './shaders/main.vert?raw';
import main_frag_shader_source from './shaders/main.frag?raw';

const TARGET_UPS = 60;
const TARGET_DT = 1 / TARGET_UPS;

const gltf = await load("scifi_room/scene.gltf", GLTFLoader);

function load_shader(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) {
        throw new Error("Could not create shader");
    }

    // Send the source to the shader object
    gl.shaderSource(shader, source);

    // Compile the shader program
    gl.compileShader(shader);

    // See if it compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(
            `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`,
        );
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function load_program(gl: WebGLRenderingContext, vs_src: string, fs_src: string): WebGLProgram {
    const vs = load_shader(gl, gl.VERTEX_SHADER, vs_src);
    const fs = load_shader(gl, gl.FRAGMENT_SHADER, fs_src);
    if (!vs || !fs) {
        throw new Error("Could not create shaders");
    }

    // Create the shader program
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    // If creating the shader program failed, alert
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`Unable to initialize the shader program: ${gl.getProgramInfoLog(program)}`);
    }

    return program;
}



class Renderer {
    gl: WebGLRenderingContext;
    program: WebGLProgram;

    constructor(vs_src: string, fs_src: string, container: Element) {
        const canvas = document.createElement("canvas");
        container.appendChild(canvas);

        const width = 800;
        const height = width * 9 / 16
        canvas.width = width;
        canvas.height = height;
        this.gl = canvas.getContext("webgl") as WebGLRenderingContext;
        if (!this.gl) {
            throw new Error("WebGL not supported");
        }

        this.program = load_program(this.gl, vs_src, fs_src);
    }

    render(_engine: Engine) {
        this.gl.clearColor(0.5, 0.5, 0.5, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
}

class MainRenderer extends Renderer {
    constructor(container: Element) {
        super(main_vert_shader_source, main_frag_shader_source, container);
    }
}

class VanillaRenderer extends Renderer {
    constructor(container: Element) {
        super(vanilla_vert_shader_source, vanilla_frag_shader_source, container);
    }
}

class Engine {
    gltf: GLTFWithBuffers;
    tick_count: number = 0;
    wall_clock: number = 0;
    renderers: Renderer[] = [];

    constructor(gltf: GLTFWithBuffers) {
        this.gltf = gltf;

        for (let el of document.querySelectorAll(".main-renderer")) {
            this.renderers.push(new MainRenderer(el));
        }

        for (let el of document.querySelectorAll(".vanilla-renderer")) {
            this.renderers.push(new VanillaRenderer(el));
        }
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

console.log(gltf)