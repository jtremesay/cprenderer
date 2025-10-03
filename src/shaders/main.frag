precision mediump float;

varying vec2 v_texcoord;

uniform sampler2D u_texture;
uniform bool u_has_texture;

void main() {
    if(u_has_texture) {
        gl_FragColor = texture2D(u_texture, v_texcoord);
    } else {
        gl_FragColor = vec4(0.8, 0.8, 0.8, 1.0);
    }
}