export type CliArgs = {
  config: string;
  days: number;
  site?: string;
};

export function parseArgs(argv = process.argv.slice(2)): CliArgs {
  const args: CliArgs = {
    config: "sites.config.json",
    days: 90
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];

    if (arg === "--config" && value) {
      args.config = value;
      i += 1;
    } else if (arg === "--days" && value) {
      args.days = Number.parseInt(value, 10);
      i += 1;
    } else if (arg === "--site" && value) {
      args.site = value;
      i += 1;
    }
  }

  if (!Number.isFinite(args.days) || args.days < 1) {
    throw new Error("--days must be a positive integer");
  }

  return args;
}
