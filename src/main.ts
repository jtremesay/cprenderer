import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import type { GLTFWithBuffers } from '@loaders.gl/gltf';
import { mat4, vec3 } from 'gl-matrix';
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

class OrbitCamera {
    position: vec3 = vec3.create();
    target: vec3 = vec3.create();
    up: vec3 = vec3.fromValues(0, 1, 0);

    radius: number = 1000.0;
    angle: number = 0.0;
    speed: number = 1.0;
    height: number = 300.0;

    viewMatrix: mat4 = mat4.create();
    projectionMatrix: mat4 = mat4.create();

    constructor(canvas: HTMLCanvasElement) {
        // Set up projection matrix
        const aspect = canvas.width / canvas.height;
        const fov = Math.PI / 4; // 45 degrees
        const near = 0.1;
        const far = 10000.0;
        mat4.perspective(this.projectionMatrix, fov, aspect, near, far);

        // Initialize position
        this.updatePosition(0);
    }

    updatePosition(deltaTime: number) {
        this.angle += this.speed * deltaTime;

        // Calculate camera position in orbit around target
        this.position[0] = Math.cos(this.angle) * this.radius;
        this.position[1] = this.height;
        this.position[2] = Math.sin(this.angle) * this.radius;

        // Update view matrix
        mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    }
}

interface MeshData {
    positionBuffer: WebGLBuffer;
    indexBuffer: WebGLBuffer | null;
    indexCount: number;
    vertexCount: number;
}

function extractMeshData(gl: WebGLRenderingContext, gltf: GLTFWithBuffers): MeshData[] {
    const meshes: MeshData[] = [];

    if (!gltf.json.meshes) return meshes;

    for (const mesh of gltf.json.meshes) {
        for (const primitive of mesh.primitives) {
            const positionAccessor = gltf.json.accessors![primitive.attributes.POSITION!];
            const positionBufferView = gltf.json.bufferViews![positionAccessor.bufferView!];
            const positionBuffer = gltf.buffers[positionBufferView.buffer];

            // Extract position data
            const positions = new Float32Array(
                positionBuffer.arrayBuffer,
                (positionBufferView.byteOffset || 0) + (positionAccessor.byteOffset || 0),
                positionAccessor.count * 3
            );

            // Create WebGL position buffer
            const glPositionBuffer = gl.createBuffer()!;
            gl.bindBuffer(gl.ARRAY_BUFFER, glPositionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

            let glIndexBuffer: WebGLBuffer | null = null;
            let indexCount = 0;

            // Handle indices if present
            if (primitive.indices !== undefined) {
                const indexAccessor = gltf.json.accessors![primitive.indices];
                const indexBufferView = gltf.json.bufferViews![indexAccessor.bufferView!];
                const indexBuffer = gltf.buffers[indexBufferView.buffer];

                // Extract index data (handle different component types)
                let indices: Uint16Array | Uint32Array;
                if (indexAccessor.componentType === 5123) { // UNSIGNED_SHORT
                    indices = new Uint16Array(
                        indexBuffer.arrayBuffer,
                        (indexBufferView.byteOffset || 0) + (indexAccessor.byteOffset || 0),
                        indexAccessor.count
                    );
                } else { // UNSIGNED_INT
                    indices = new Uint32Array(
                        indexBuffer.arrayBuffer,
                        (indexBufferView.byteOffset || 0) + (indexAccessor.byteOffset || 0),
                        indexAccessor.count
                    );
                }

                glIndexBuffer = gl.createBuffer()!;
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glIndexBuffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
                indexCount = indexAccessor.count;
            }

            meshes.push({
                positionBuffer: glPositionBuffer,
                indexBuffer: glIndexBuffer,
                indexCount,
                vertexCount: positionAccessor.count
            });
        }
    }

    return meshes;
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

// Enable depth testing
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);

// Set up camera
let camera = new OrbitCamera(canvas);

// Extract mesh data from GLTF
let meshes = extractMeshData(gl, gltf);
console.log(`Loaded ${meshes.length} meshes from GLTF`);

// Set up render state
gl.clearColor(0.2, 0.2, 0.3, 1.0);

// Model matrix (identity for now)
let modelMatrix = mat4.create();

let lastTime = 0;

function render(currentTime: number) {
    const deltaTime = (currentTime - lastTime) * 0.001; // Convert to seconds
    lastTime = currentTime;

    // Update camera
    camera.updatePosition(deltaTime);

    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use our shader program
    gl.useProgram(program_info.program);

    // Calculate model-view matrix
    let modelViewMatrix = mat4.create();
    mat4.multiply(modelViewMatrix, camera.viewMatrix, modelMatrix);

    // Set uniforms
    gl.uniformMatrix4fv(program_info.uniform_locations.u_model_view, false, modelViewMatrix);
    gl.uniformMatrix4fv(program_info.uniform_locations.u_projection_view, false, camera.projectionMatrix);

    // Render each mesh
    for (const mesh of meshes) {
        // Bind position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
        gl.vertexAttribPointer(program_info.attrib_locations.a_position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program_info.attrib_locations.a_position);

        // Draw the mesh
        if (mesh.indexBuffer && mesh.indexCount > 0) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
            gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
        }
    }

    requestAnimationFrame(render);
}

// Start the render loop
requestAnimationFrame(render);