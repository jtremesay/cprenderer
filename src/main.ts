import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import type { GLTFWithBuffers } from '@loaders.gl/gltf';
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

class ProgramInfo {
    program: WebGLProgram
    attrib_locations: { [key: string]: number } = {};
    uniform_locations: { [key: string]: WebGLUniformLocation | null } = {};

    constructor(gl: WebGLRenderingContext, program: WebGLProgram, attribs: string[], uniforms: string[]) {
        this.program = program;

        for (let attrib of attribs) {
            this.attrib_locations[attrib] = gl.getAttribLocation(program, attrib);
        }

        for (let uniform of uniforms) {
            this.uniform_locations[uniform] = gl.getUniformLocation(program, uniform);
        }
    }
}

let container = document.querySelector(".main-renderer")!;
let canvas = document.createElement("canvas");
container.appendChild(canvas);
canvas.width = 800;
canvas.height = canvas.width * 9 / 16;
let gl = canvas.getContext("webgl") as WebGLRenderingContext;
if (!gl) {
    throw new Error("WebGL not supported");
}

let program = load_program(gl, main_vert_shader_source, main_frag_shader_source);
let program_info = new ProgramInfo(gl, program, ["a_position"], ["u_model_view", "u_projection_view"]);
console.log(program_info);

gl.clearColor(0.5, 0.5, 0.5, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

console.log(gltf)