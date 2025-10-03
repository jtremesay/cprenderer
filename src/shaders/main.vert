attribute vec4 a_position;

uniform mat4 u_model_view;
uniform mat4 u_projection_view;

void main() {
    gl_Position = u_projection_view * u_model_view * a_position;
}