attribute vec4 a_position;
uniform mat4 u_model_matrix;
uniform mat4 u_projection_matrix;

void main() {
    gl_Position = u_projection_matrix * u_model_matrix * a_position;
}