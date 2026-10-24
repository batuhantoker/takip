/** The finished soundtrack: the narration over a quiet music bed that dips while the narrator speaks. */
import { spawn } from 'node:child_process';

/** The bed's level before ducking: present, never competing with the voice. */
const MUSIC_VOLUME = 0.18;
/** A short loops (the platform replays it), so the bed's tail is crossfaded into its head over this long, with no fades. */
const SEAM_S = 0.6;
/** A long cut ends: its bed fades out under the end card over this long. */
const END_FADE_S = 2.5;

function ffmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
}

/** Writes `out` (48 kHz stereo WAV, loudness-normalised for social video) from the narration and, if given, music. */
export async function mixTrack({ narration, music, out, totalMs, loop = true }: { narration: string; music: string | null; out: string; totalMs: number; loop?: boolean }) {
  const t = totalMs / 1000;
  const voice = '[0:a]aresample=48000,aformat=channel_layouts=stereo';
  // loudnorm works at 192 kHz and hands that on
  const normalise = 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000';
  if (!music) return ffmpeg(['-i', narration, '-filter_complex', `${voice},${normalise}[out]`, '-map', '[out]', out]);
  // the music loops if the model ended it early, and its level follows the voice through a sidechain; a short's bed runs
  // SEAM_S past the end and that tail is laid under its own head, so the last sample flows into the first
  const x = SEAM_S;
  const bed = `[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${loop ? t + x : t},asetpts=N/SR/TB,volume=${MUSIC_VOLUME}`;
  const graph = [
    ...(loop ? [
      `${bed},asplit=3[ma][mb][mc]`,
      `[ma]atrim=0:${x},asetpts=PTS-STARTPTS,afade=t=in:d=${x}[head]`,
      `[mb]atrim=${t}:${t + x},asetpts=PTS-STARTPTS,afade=t=out:d=${x}[tail]`,
      '[head][tail]amix=inputs=2:duration=first:normalize=0[seam]',
      `[mc]atrim=${x}:${t},asetpts=PTS-STARTPTS[body]`,
      '[seam][body]concat=n=2:v=0:a=1[m]',
    ] : [`${bed},afade=t=out:st=${Math.max(0, t - END_FADE_S)}:d=${END_FADE_S}[m]`]),
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
