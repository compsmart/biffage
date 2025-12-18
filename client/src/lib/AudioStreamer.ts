export class AudioStreamer {
  audioContext: AudioContext;
  audioQueue: Float32Array[] = [];
  isPlaying: boolean = false;
  scheduledTime: number = 0;
  gainNode: GainNode;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000, // Gemini default output
    });
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }

  addPCM16(chunk: ArrayBuffer) {
    const float32 = this.pcm16ToFloat32(chunk);
    this.audioQueue.push(float32);
    this.scheduleNextBuffer();
  }

  pcm16ToFloat32(buffer: ArrayBuffer): Float32Array {
    const int16 = new Int16Array(buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    return float32;
  }

  scheduleNextBuffer() {
    if (this.audioQueue.length === 0) return;
    
    // Reset time if we fell behind or first chunk
    if (this.scheduledTime < this.audioContext.currentTime) {
      this.scheduledTime = this.audioContext.currentTime + 0.05; // add small buffer
    }

    while (this.audioQueue.length > 0) {
      const chunk = this.audioQueue.shift()!;
      const buffer = this.audioContext.createBuffer(1, chunk.length, 24000);
      buffer.getChannelData(0).set(chunk);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);
      source.start(this.scheduledTime);
      
      this.scheduledTime += buffer.duration;
    }
  }

  async resume() {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}
