#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

uniform vec3 pWaterColor;

// Variables described here: https://www.khronos.org/opengl/wiki/Built-in_Variable_(GLSL)
void main()
{
  gl_FragColor = vec4(pWaterColor, 0.7);
}