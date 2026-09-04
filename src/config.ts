import { readFile } from "node:fs/promises";
import { z } from "zod";

const SiteConfigSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1),
  gscProperty: z.string().min(1),
  ga4PropertyId: z.string().min(1),
  defaultCountry: z.string().min(2).optional(),
  defaultLanguage: z.string().min(2).optional(),
  conversionEvents: z.array(z.string().min(1)).default([]),
  segments: z
    .object({
      brandQueries: z.array(z.string()).default([]),
      targetCountries: z.array(z.string()).default([]),
      contentPathPrefixes: z.array(z.string()).default([])
    })
    .default({})
});

const ConfigSchema = z.object({
  sites: z.array(SiteConfigSchema).min(1)
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;
export type AppConfig = z.infer<typeof ConfigSchema>;

export async function loadConfig(path: string): Promise<AppConfig> {
  const raw = await readFile(path, "utf8");
  return ConfigSchema.parse(JSON.parse(raw));
}
