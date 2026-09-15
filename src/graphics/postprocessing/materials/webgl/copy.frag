uniform sampler2D inputBuffer;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(inputBuffer, vUv);
  #include <colorspace_fragment>
}
