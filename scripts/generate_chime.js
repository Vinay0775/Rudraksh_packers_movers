const fs = require('fs');
const path = require('path');

// Generates a 16-bit 44.1kHz mono WAV file with a warm, melodic marimba/Rhodes chime (Uber/Porter style)
function generateChimeWav(outputPath) {
  const sampleRate = 44100;
  const durationSec = 3.6; // 3.6 seconds total sequence
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // WAV Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample (16 bits)
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Soothing Pentatonic Chime notes (Warm Mid-Range, No Harsh Shrill)
  // Sequence 1: Warm upward ripple (E4 -> G4 -> B4 -> E5)
  // Sequence 2: Resolution chime (G4 -> C5 -> E5)
  const notes = [
    { start: 0.08, freq: 329.63, dur: 1.2, amp: 0.45 }, // E4
    { start: 0.22, freq: 392.00, dur: 1.2, amp: 0.50 }, // G4
    { start: 0.38, freq: 493.88, dur: 1.4, amp: 0.55 }, // B4
    { start: 0.55, freq: 659.25, dur: 1.6, amp: 0.60 }, // E5

    { start: 1.70, freq: 392.00, dur: 1.0, amp: 0.45 }, // G4
    { start: 1.85, freq: 523.25, dur: 1.2, amp: 0.55 }, // C5
    { start: 2.02, freq: 659.25, dur: 1.5, amp: 0.60 }, // E5
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (const note of notes) {
      if (t >= note.start && t < note.start + note.dur) {
        const dt = t - note.start;
        // Soft acoustic attack (18ms) preventing any clicks or popping
        const attack = Math.min(1.0, dt / 0.018);
        // Gentle organic decay
        const decay = Math.exp(-dt * 3.8);
        const env = attack * decay;

        // Warm acoustic timbre: Fundamental + subtle warm harmonics
        const fundamental = Math.sin(2 * Math.PI * note.freq * dt);
        const harmonic2 = 0.25 * Math.sin(2 * Math.PI * (note.freq * 2.0) * dt);
        const harmonic3 = 0.08 * Math.sin(2 * Math.PI * (note.freq * 3.0) * dt);
        const tone = (fundamental + harmonic2 + harmonic3) / 1.33;

        sample += tone * env * note.amp;
      }
    }

    // Soft limiter to ensure pristine clarity without clipping
    sample = Math.max(-0.95, Math.min(0.95, sample));
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated soothing acoustic chime at: ${outputPath} (${buffer.length} bytes)`);
}

const targetPath = path.resolve(__dirname, '../driver_app/assets/siren.wav');
generateChimeWav(targetPath);

