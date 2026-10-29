

/* Decode any file with a playable audio track (a plain audio file, or the audio channel embedded inside a video file) 
   into a PCM16 WAV Blob, using the browser's built-in Web Audio API. This lets video files reuse the  exact same, 
   already-working /api/forensics/audio engine that the Audio Deepfake tab uses, without needing any new server-side dependency. */

export async function decodeToWav(file: File): Promise<Blob> {
  const arrayBuf = await file.arrayBuffer()
  const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
  const ctx = new Ctx()
  const audioBuf = await ctx.decodeAudioData(arrayBuf)
  const sr = audioBuf.sampleRate
  const numSamples = audioBuf.length

  const mono = new Float32Array(numSamples)
  for (let c = 0; c < audioBuf.numberOfChannels; c++) {
    const ch = audioBuf.getChannelData(c)
    for (let i = 0; i < numSamples; i++) mono[i] += ch[i] / audioBuf.numberOfChannels
  }

  const dataLen = numSamples * 2
  const buf = new ArrayBuffer(44 + dataLen)
  const view = new DataView(buf)
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataLen, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  writeStr(36, 'data'); view.setUint32(40, dataLen, true)
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}