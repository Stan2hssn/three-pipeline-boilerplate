uniform sampler2D tScene;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(tScene, vUv);
  #include <colorspace_fragment>
}
