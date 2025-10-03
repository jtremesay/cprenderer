attribute vec4 a_position;
attribute vec2 a_texcoord;

uniform mat4 u_model_view;
uniform mat4 u_projection_view;

varying vec2 v_texcoord;

void main() {
    gl_Position = u_projection_view * u_model_view * a_position;
    v_texcoord = a_texcoord;
}