const fs = require('fs');
const path = require('path');

// Generates a 16-bit 44.1kHz mono WAV file with a warm, melodic multi-tone chime (Porter/Uber style)
function generateChimeWav(outputPath) {
  const sampleRate = 44100;
  const durationSec = 3.0; // 3 seconds per chime sequence
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
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  buffer.writeUInt16LE(2, 32);  // BlockAlign (NumChannels * BitsPerSample/8)
  buffer.writeUInt16LE(16, 34); // BitsPerSample (16 bits)
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Musical Chime notes: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
  // Two melodic arpeggiated bursts:
  // Burst 1: at t = 0.05s (C5 + G5), at t = 0.25s (E5 + C6)
  // Burst 2: at t = 1.2s (E5 + G5), at t = 1.4s (C6 + E6)
  const notes = [
    { start: 0.05, freq: 523.25, dur: 0.8, amp: 0.4 },
    { start: 0.12, freq: 659.25, dur: 0.8, amp: 0.5 },
    { start: 0.20, freq: 783.99, dur: 1.0, amp: 0.6 },
    { start: 0.32, freq: 1046.50, dur: 1.2, amp: 0.7 },

    { start: 1.20, freq: 659.25, dur: 0.7, amp: 0.45 },
    { start: 1.28, freq: 783.99, dur: 0.8, amp: 0.55 },
    { start: 1.38, freq: 1046.50, dur: 1.0, amp: 0.65 },
    { start: 1.50, freq: 1318.51, dur: 1.3, amp: 0.65 },
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (const note of notes) {
      if (t >= note.start && t < note.start + note.dur) {
        const dt = t - note.start;
        // Exponential bell envelope: fast attack (5ms), smooth exponential decay
        const attack = Math.min(1.0, dt / 0.008);
        const decay = Math.exp(-dt * 4.5);
        const env = attack * decay;

        // Rich bell timbre: fundamental + 2nd harmonic (octave) + 3rd harmonic
        const fundamental = Math.sin(2 * Math.PI * note.freq * dt);
        const harmonic2 = 0.35 * Math.sin(2 * Math.PI * (note.freq * 2.0) * dt);
        const harmonic3 = 0.15 * Math.sin(2 * Math.PI * (note.freq * 3.0) * dt);
        const tone = (fundamental + harmonic2 + harmonic3) / 1.5;

        sample += tone * env * note.amp;
      }
    }

    // Soft limiter / compression
    sample = Math.max(-1.0, Math.min(1.0, sample));
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated pleasant chime WAV at: ${outputPath} (${buffer.length} bytes)`);
}

const targetPath = path.resolve(__dirname, '../driver_app/assets/siren.wav');
generateChimeWav(targetPath);
