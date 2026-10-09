// 200 ms blocks of mono 16 kHz float32 PCM. Output stays silent to avoid feedback.
class PCMCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new Float32Array(3200);
    this.offset = 0;
  }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const c of channels) sample += c[i];
      this.frame[this.offset++] = sample / channels.length;
      if (this.offset === 3200) {
        this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
        this.frame = new Float32Array(3200);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PCMCapture);
