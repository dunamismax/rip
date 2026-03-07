import { constants } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { env } from '../backend/env';
import { checkFfmpeg, checkYtdlp } from '../backend/ytdlp';

function resolveDownloadDir(downloadDir: string): string {
  const homeDir = process.env.HOME ?? '/tmp';
  return downloadDir.replace(/^~/, homeDir);
}

async function doctor() {
  const resolvedDownloadDir = resolveDownloadDir(env.DOWNLOAD_DIR);
  let ok = true;

  console.log('rip doctor\n');
  console.log(`NODE_ENV           ${env.NODE_ENV}`);
  console.log(`PORT               ${env.PORT}`);
  console.log(`WEB_PORT           ${env.WEB_PORT}`);
  console.log(`WEB_ORIGIN         ${env.WEB_ORIGIN}`);
  console.log(`DOWNLOAD_DIR       ${resolvedDownloadDir}`);
  console.log(`MAX_CONCURRENT     ${env.MAX_CONCURRENT_DOWNLOADS}`);
  console.log(`YTDLP_PATH         ${env.YTDLP_PATH}`);
  console.log('');

  const ytdlpVersion = await checkYtdlp();
  if (ytdlpVersion) {
    console.log(`yt-dlp             ${ytdlpVersion}`);
  } else {
    ok = false;
    console.error(`yt-dlp             NOT FOUND (${env.YTDLP_PATH})`);
  }

  const hasFfmpeg = await checkFfmpeg();
  if (hasFfmpeg) {
    console.log('ffmpeg             available');
  } else {
    ok = false;
    console.error('ffmpeg             NOT FOUND (brew install ffmpeg)');
  }

  try {
    await mkdir(resolvedDownloadDir, { recursive: true });
    await access(resolvedDownloadDir, constants.W_OK);
    console.log('download dir       writable');
  } catch (error) {
    ok = false;
    const reason = error instanceof Error ? error.message : 'Unknown error';
    console.error(`download dir       NOT WRITABLE (${reason})`);
  }

  if (ok) {
    console.log('\nStatus: ok');
    return;
  }

  console.error('\nStatus: failed');
  process.exitCode = 1;
}

const command = Bun.argv[2];

switch (command) {
  case 'doctor':
    await doctor();
    break;
  default:
    console.error(`Unknown command: ${command ?? '<none>'}`);
    console.error('Available commands: doctor');
    process.exitCode = 1;
}
