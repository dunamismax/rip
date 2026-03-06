import { z } from 'zod';

const parsedEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    WEB_PORT: z.coerce.number().int().positive().default(3000),
    WEB_ORIGIN: z.string().url().optional(),
    DOWNLOAD_DIR: z.string().min(1).default(`${process.env.HOME}/Downloads/Rip`),
    MAX_CONCURRENT_DOWNLOADS: z.coerce.number().int().min(1).max(10).default(3),
    YTDLP_PATH: z.string().min(1).default('yt-dlp'),
  })
  .parse(process.env);

export const env = {
  ...parsedEnv,
  WEB_ORIGIN: parsedEnv.WEB_ORIGIN ?? `http://localhost:${parsedEnv.WEB_PORT}`,
};
