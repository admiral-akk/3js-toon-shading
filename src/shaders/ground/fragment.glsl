#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

varying vec3 vNormal;
uniform vec3 uShadowColor;
uniform vec3 uHalfLitColor;
uniform vec3 uLitColor;
uniform vec3 uGroundColor;
uniform float uShadowThreshold;
uniform float uHalfLitThreshold;
uniform bool uIsHovered;

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
  float isShadow =  step(val,uShadowThreshold);
  float isHalfLit = (1. - isShadow) * step(val, uHalfLitThreshold);
  float isLit = (1. - isShadow) * (1. - isHalfLit);
  vec3 color = uShadowColor * isShadow 
   + uHalfLitColor * isHalfLit 
   + uLitColor * isLit  ;
    gl_FragColor = vec4(uGroundColor * color, 1.0);
}