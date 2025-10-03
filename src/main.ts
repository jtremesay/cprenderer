import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';
import type { GLTFWithBuffers } from '@loaders.gl/gltf';
import { mat4, vec3 } from 'gl-matrix';
import main_vert_shader_source from './shaders/main.vert?raw';
import main_frag_shader_source from './shaders/main.frag?raw';

const TARGET_UPS = 60;
const TARGET_DT = 1 / TARGET_UPS;

async function main() {
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
        uvBuffer: WebGLBuffer | null;
        indexBuffer: WebGLBuffer | null;
        indexCount: number;
        vertexCount: number;
        texture: WebGLTexture | null;
        material: any;
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

                // Extract UV coordinates if available
                let glUvBuffer: WebGLBuffer | null = null;
                if (primitive.attributes.TEXCOORD_0 !== undefined) {
                    const uvAccessor = gltf.json.accessors![primitive.attributes.TEXCOORD_0];
                    const uvBufferView = gltf.json.bufferViews![uvAccessor.bufferView!];
                    const uvBuffer = gltf.buffers[uvBufferView.buffer];

                    const uvs = new Float32Array(
                        uvBuffer.arrayBuffer,
                        (uvBufferView.byteOffset || 0) + (uvAccessor.byteOffset || 0),
                        uvAccessor.count * 2
                    );

                    glUvBuffer = gl.createBuffer()!;
                    gl.bindBuffer(gl.ARRAY_BUFFER, glUvBuffer);
                    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
                }

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
                    uvBuffer: glUvBuffer,
                    indexBuffer: glIndexBuffer,
                    indexCount,
                    vertexCount: positionAccessor.count,
                    texture: null, // Will be set later
                    material: primitive.material !== undefined ? gltf.json.materials![primitive.material] : null
                });
            }
        }

        return meshes;
    }

    function createTextureFromImage(gl: WebGLRenderingContext, image: ImageBitmap | HTMLImageElement): WebGLTexture {
        const texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Upload the image to the texture
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);

        return texture;
    }

    async function loadTextures(gl: WebGLRenderingContext, gltf: GLTFWithBuffers, meshes: MeshData[]): Promise<void> {
        const textureCache = new Map<number, WebGLTexture>();

        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            if (!mesh.material) continue;

            // Try to get base color texture
            const pbrMetallicRoughness = mesh.material.pbrMetallicRoughness;
            if (pbrMetallicRoughness && pbrMetallicRoughness.baseColorTexture) {
                const textureIndex = pbrMetallicRoughness.baseColorTexture.index;

                // Check if we already loaded this texture
                if (textureCache.has(textureIndex)) {
                    mesh.texture = textureCache.get(textureIndex)!;
                    continue;
                }

                // Load the texture
                const textureInfo = gltf.json.textures![textureIndex];
                const imageIndex = textureInfo.source!;
                let imageInfo = gltf.json.images![imageIndex];
                if (imageInfo.uri) {
                    imageInfo.uri = "scifi_room/" + imageInfo.uri;
                }

                if (imageInfo.uri) {
                    try {
                        // Load image from URI
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            img.src = imageInfo.uri!;
                        });

                        const texture = createTextureFromImage(gl, img);
                        textureCache.set(textureIndex, texture);
                        mesh.texture = texture;
                    } catch (error) {
                        console.warn(`Failed to load texture ${imageInfo.uri}:`, error);
                    }
                } else if (imageInfo.bufferView !== undefined) {
                    try {
                        // Load image from buffer
                        const bufferView = gltf.json.bufferViews![imageInfo.bufferView];
                        const buffer = gltf.buffers[bufferView.buffer];

                        const imageData = new Uint8Array(
                            buffer.arrayBuffer,
                            bufferView.byteOffset || 0,
                            bufferView.byteLength
                        );

                        const blob = new Blob([imageData], { type: imageInfo.mimeType });
                        const imageUrl = URL.createObjectURL(blob);

                        const img = new Image();
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            img.src = imageUrl;
                        });

                        const texture = createTextureFromImage(gl, img);
                        textureCache.set(textureIndex, texture);
                        mesh.texture = texture;

                        URL.revokeObjectURL(imageUrl);
                    } catch (error) {
                        console.warn(`Failed to load texture from buffer:`, error);
                    }
                }
            }
        }
    }

    let container = document.querySelector(".main-renderer")!
    let canvas = document.createElement("canvas");
    container.appendChild(canvas);
    canvas.width = 800;
    canvas.height = canvas.width * 9 / 16;
    let gl = canvas.getContext("webgl") as WebGLRenderingContext;
    if (!gl) {
        throw new Error("WebGL not supported");
    }

    let program = load_program(gl, main_vert_shader_source, main_frag_shader_source);
    let program_info = new ProgramInfo(gl, program, ["a_position", "a_texcoord"], ["u_model_view", "u_projection_view", "u_texture", "u_has_texture"]);

    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Set up camera
    let camera = new OrbitCamera(canvas);

    // Extract mesh data from GLTF
    let meshes = extractMeshData(gl, gltf);
    console.log(`Loaded ${meshes.length} meshes from GLTF`);

    // Load textures
    await loadTextures(gl, gltf, meshes);
    console.log(`Loaded textures for meshes`);

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

            // Bind UV buffer if available
            if (mesh.uvBuffer) {
                gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);
                gl.vertexAttribPointer(program_info.attrib_locations.a_texcoord, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(program_info.attrib_locations.a_texcoord);
            } else {
                gl.disableVertexAttribArray(program_info.attrib_locations.a_texcoord);
            }

            // Bind texture if available
            if (mesh.texture) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, mesh.texture);
                gl.uniform1i(program_info.uniform_locations.u_texture, 0);
                gl.uniform1i(program_info.uniform_locations.u_has_texture, 1);
            } else {
                gl.uniform1i(program_info.uniform_locations.u_has_texture, 0);
            }

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
}

// Start the application
main().catch(console.error);