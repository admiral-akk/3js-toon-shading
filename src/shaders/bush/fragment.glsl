#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

varying vec3 vNormal;
uniform vec3 uShadowColor;
uniform vec3 uHalfLitColor;
uniform vec3 uLitColor;
uniform float uShadowThreshold;
uniform float uHalfLitThreshold;
uniform bool uIsHovered;
uniform sampler2D uNoise;

varying vec3 vWorldPos;

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

  vec3 lightCross = normalize(cross(vec3(0.,1.,0.),directionalLights[0].direction));
  vec3 otherLightCross = normalize(cross(vec3(0.,1.,0.),lightCross));

  vec3 lightOrthogonal =vWorldPos- 
  dot(vWorldPos,directionalLights[0].direction) * directionalLights[0].direction;
  
  vec2 texSample = 1.*vec2(dot(lightCross,lightOrthogonal), dot(otherLightCross,lightOrthogonal));
  float noise = 2.*(texture2D(uNoise,texSample).x- 0.5);
  float NdotL = dot(vNormal, directionalLights[0].direction) + 0.25* noise;
  float val = clamp(NdotL*shadow, 0., 1.);
  float isShadow =  step(val,uShadowThreshold);
  float isHalfLit = (1. - isShadow) * step(val, uHalfLitThreshold);
  float isLit = (1. - isShadow) * (1. - isHalfLit);
  vec3 color = uShadowColor * isShadow 
   + uHalfLitColor * isHalfLit 
   + uLitColor * isLit;
   if (uIsHovered) {
    gl_FragColor = vec4(1.0,0.,0., 1.0);
   } else {
    gl_FragColor = vec4(color, 1.0);
   }
}