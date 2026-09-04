import type { AppConfig, SiteConfig } from "../config.js";

export function selectSites(config: AppConfig, siteId?: string): SiteConfig[] {
  if (!siteId) return config.sites;

  const site = config.sites.find((candidate) => candidate.id === siteId);
  if (!site) {
    throw new Error(`Site "${siteId}" was not found in the config`);
  }

  return [site];
}
