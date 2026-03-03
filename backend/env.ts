import { z } from 'zod';

export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DOWNLOAD_DIR: z.string().min(1).default(`${process.env.HOME}/Downloads/Rip`),
    MAX_CONCURRENT_DOWNLOADS: z.coerce.number().int().min(1).max(10).default(3),
    YTDLP_PATH: z.string().min(1).default('yt-dlp'),
  })
  .parse(process.env);
