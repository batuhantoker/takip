/** The finished soundtrack: the narration over a quiet music bed that dips while the narrator speaks. */
import { spawn } from 'node:child_process';

/** The bed's level before ducking: present, never competing with the voice. */
const MUSIC_VOLUME = 0.18;
const FADE_IN_S = 1.5;
const FADE_OUT_S = 2.5;

function ffmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
}

/** Writes `out` (48 kHz stereo WAV, loudness-normalised for social video) from the narration and, if given, music. */
export async function mixTrack({ narration, music, out, totalMs }: { narration: string; music: string | null; out: string; totalMs: number }) {
  const t = totalMs / 1000;
  const voice = '[0:a]aresample=48000,aformat=channel_layouts=stereo';
  // loudnorm works at 192 kHz and hands that on
  const normalise = 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000';
  if (!music) return ffmpeg(['-i', narration, '-filter_complex', `${voice},${normalise}[out]`, '-map', '[out]', out]);
  // the music loops if the model ended it early, and its level follows the voice through a sidechain
  const graph = [
    `[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${t},volume=${MUSIC_VOLUME},` +
      `afade=t=in:d=${FADE_IN_S},afade=t=out:st=${Math.max(0, t - FADE_OUT_S)}:d=${FADE_OUT_S}[m]`,
    `${voice},asplit=2[v][sc]`,
    '[m][sc]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=500[bed]',
    `[v][bed]amix=inputs=2:duration=first:normalize=0,${normalise}[out]`,
  ].join(';');
  return ffmpeg(['-i', narration, '-stream_loop', '-1', '-i', music, '-filter_complex', graph, '-map', '[out]', '-t', String(t), out]);
}

/** Swaps a filmed video's soundtrack for a new one, keeping the picture as it is. */
export async function replaceAudio(video: string, audio: string, out: string) {
  return ffmpeg(['-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
}
