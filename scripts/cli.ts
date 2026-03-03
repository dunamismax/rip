import { env } from '../backend/env';
import { checkFfmpeg, checkYtdlp } from '../backend/ytdlp';

async function doctor() {
  console.log('rip doctor\n');
  console.log(`NODE_ENV           ${env.NODE_ENV}`);
  console.log(`PORT               ${env.PORT}`);
  console.log(`DOWNLOAD_DIR       ${env.DOWNLOAD_DIR}`);
  console.log(`MAX_CONCURRENT     ${env.MAX_CONCURRENT_DOWNLOADS}`);
  console.log('');

  const ytdlpVersion = await checkYtdlp();
  if (ytdlpVersion) {
    console.log(`yt-dlp             ${ytdlpVersion}`);
  } else {
    console.error('yt-dlp             NOT FOUND (brew install yt-dlp)');
  }

  const hasFfmpeg = await checkFfmpeg();
  if (hasFfmpeg) {
    console.log('ffmpeg             available');
  } else {
    console.error('ffmpeg             NOT FOUND (brew install ffmpeg)');
  }

  console.log('\nStatus: ok');
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
