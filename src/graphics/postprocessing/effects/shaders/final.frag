// postprocessing "Effect" fragment (uses mainImage API)

uniform sampler2D tGrain;           // tileable monochrome grain (e.g. 512x512)
uniform vec2 uResolution;          // viewport (width, height)
uniform float uTime;

// — Grain
uniform float uGrainScale;          // 4..10 (frequency)
uniform float uNoiseStrength;       // 0..1

// — Vignette / halo
uniform vec2 uVignetteCenter;      // usually vec2(0.5, 0.5)
uniform float uVignetteRadius;      // 0.45..0.75 (where dimming starts)
uniform float uVignetteStrength;    // 0..1  (how strong)
uniform float uVignettePower;       // 1.2..3.0 (falloff)
uniform vec3 uVignetteColor;       // subtle cool tint, e.g. vec3(0.04,0.05,0.08)

// — Project-specific: ocean depth (injected via customUniforms)
uniform float uOceanDepthStrength; // 0..1
uniform float uCausticsStrength;   // 0..1
uniform float uCausticsScale;      // 2..8

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float causticPattern(vec2 p, float time) {
  float c = 0.0;
  vec2 p1 = p * 1.0 + vec2(time * 0.04, time * 0.03);
  vec2 p2 = p * 1.7 + vec2(-time * 0.03, time * 0.05);
  vec2 p3 = p * 2.3 + vec2(time * 0.02, -time * 0.04);
  c += sin(p1.x * 3.1 + sin(p1.y * 2.7 + time * 0.3)) * 0.33;
  c += sin(p2.x * 2.3 + sin(p2.y * 3.1 - time * 0.2)) * 0.33;
  c += sin(p3.x * 1.7 + sin(p3.y * 2.3 + time * 0.15)) * 0.33;
  return c * 0.5 + 0.5;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {

  vec3 col = inputColor.rgb;

  // ---------------------------
  // Ocean depth gradient + caustics (project-specific, disabled when uniforms = 0)
  // ---------------------------
  float depthStrength = clamp(uOceanDepthStrength, 0.0, 1.0);
  if(depthStrength > 0.0) {
    vec3 surfaceColor = vec3(0.15, 0.25, 0.45);
    vec3 depthColor = vec3(0.04, 0.08, 0.18);
    float depthGradient = uv.y;
    vec3 oceanTint = mix(depthColor, surfaceColor, depthGradient);

    float luminance = luma(col);
    float bgMask = 1.0 - smoothstep(0.02, 0.15, luminance);

    col = mix(col, col + oceanTint * 0.3, bgMask * depthStrength);

    float causticsStr = clamp(uCausticsStrength, 0.0, 1.0);
    if(causticsStr > 0.0) {
      vec2 cAspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
      float scale = max(uCausticsScale, 0.5);
      float c = causticPattern(uv * cAspect * scale, uTime);
      float surfaceLight = smoothstep(0.2, 0.9, uv.y) * 0.6 + 0.4;
      col += vec3(0.08, 0.12, 0.18) * c * causticsStr * bgMask * surfaceLight * depthStrength;
    }
  }

  // ---------------------------
  // Film grain (tileable + animated)
  // ---------------------------
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);

  // animated offset to avoid static pattern
  vec2 gUv = fract((uv * aspect) * uGrainScale);

  // map to [-1, 1]
  float g = texture(tGrain, gUv).r * 2.0 - 1.0;

  // less grain on highlights
  float lum = luma(col);
  float grainAtten = mix(1.0, 0.35, smoothstep(0.0, 1.0, lum));

  col += g * uNoiseStrength * grainAtten;
  col = clamp(col, 0.0, 1.0);

  vec2 vignetteUv = uv - uVignetteCenter;
  vignetteUv.x *= uResolution.x / max(uResolution.y, 1.0);
  float dist = length(vignetteUv);
  float vignette = smoothstep(uVignetteRadius, 1.0, dist);
  vignette = pow(vignette, max(uVignettePower, 0.0001));
  float vignetteMix = clamp(vignette * uVignetteStrength, 0.0, 1.0);
  col = mix(col, uVignetteColor, vignetteMix);

  outputColor = vec4(col, inputColor.a);
}
