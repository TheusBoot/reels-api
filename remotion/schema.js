const { z } = require("zod");

const reelSchema = z.object({
  headline: z.string().min(1).max(220),
  sourceName: z.string().max(60).default(""),
  imageSrc: z.string(),
  audioSrc: z.string().nullable().default(null),
  musicSrc: z.string().nullable().default(null),
  introText: z.string().max(60).default("OLHA SÓ O QUE ESTÁ BOMBANDO"),
  showIntro: z.boolean().default(true),
  fitMode: z.enum(["contain", "cover"]).default("contain"),
  durationInFrames: z.number().int().min(150).max(3960), // 120s de narração + intro, a 30fps
  introDurationInFrames: z.number().int().min(0).max(120).default(36), // 1.2s a 30fps
  theme: z.enum(["dark", "light"]).default("dark"),
});

module.exports = { reelSchema };
