#version 330 core

uniform sampler2D Texture;
uniform sampler2D NormalMap;
uniform sampler2D RoughnessMap;
uniform sampler2D MetallicMap;
uniform sampler2D EmissiveMap;
uniform vec3 color;

in vec3 v_vertex;
in vec3 v_normal;
in vec2 v_uv;

layout(location = 0) out vec4 out_color;

void main() {
    out_color = vec4(color, 1.0);
    out_color *= texture(Texture, v_uv);
}