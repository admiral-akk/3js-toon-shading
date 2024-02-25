#include <common>
#include <shadowmap_pars_vertex>


varying vec3 vNormal;
varying vec3 vWorldPos;

// Transformation described here: https://stackoverflow.com/questions/29879216/preparing-model-view-and-projection-matrices-for-glsl
// Variables described here: https://www.khronos.org/opengl/wiki/Built-in_Variable_(GLSL)
void main() {
    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>

    #include <begin_vertex>

    #include <worldpos_vertex>
    #include <shadowmap_vertex>
    vec4 objectPos = vec4(position, 1.);
    // Moves it into world space. Includes object rotations, scale, and translation.
    vec4 worldPos = modelMatrix * objectPos;
    // Applies view (moves it relative to camera position/orientation)
    vec4 viewPos = viewMatrix * worldPos;
    // Applies projection (orthographic/perspective)
    vec4 projectionPos = projectionMatrix * viewPos;
    gl_Position = projectionPos;
    vWorldPos = worldPos.xyz;
    vNormal = normalize(normalMatrix  * normal);
}