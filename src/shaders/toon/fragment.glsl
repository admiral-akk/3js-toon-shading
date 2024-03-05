#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

varying vec3 vNormal;
uniform vec3 pShadowColor;
uniform vec3 pHalfLitColor;
uniform vec3 pLitColor;
uniform float pShadowThreshold;
uniform float pHalfLitThreshold;
uniform bool eIsHovered;

// Variables described here: https://www.khronos.org/opengl/wiki/Built-in_Variable_(GLSL)
void main()
{
  // shadow map
  DirectionalLightShadow directionalShadow = directionalLightShadows[0];

  float shadow = getShadow(
    directionalShadowMap[0],
    directionalShadow.shadowMapSize,
    directionalShadow.shadowBias,
    directionalShadow.shadowRadius,
    vDirectionalShadowCoord[0]
  );
  float NdotL = dot(vNormal, directionalLights[0].direction);
  float val = clamp(NdotL*shadow, 0., 1.);
  float isShadow =  step(val,pShadowThreshold);
  float isHalfLit = (1. - isShadow) * step(val, pHalfLitThreshold);
  float isLit = (1. - isShadow) * (1. - isHalfLit);
  vec3 color = pShadowColor * isShadow 
   + pHalfLitColor * isHalfLit 
   + pLitColor * isLit;
   if (eIsHovered) {
    gl_FragColor = vec4(1.0,0.,0., 1.0);
   } else {
    gl_FragColor = vec4(color, 1.0);
   }
}