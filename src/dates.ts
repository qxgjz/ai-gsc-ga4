export type DateRange = {
  startDate: string;
  endDate: string;
};

export type DateRanges = {
  current: DateRange;
  previous: DateRange;
};

export function getDateRange(days: number, now = new Date()): DateRange {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - 3);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end)
  };
}

export function getDateRanges(days: number, now = new Date()): DateRanges {
  const current = getDateRange(days, now);
  const previousEnd = parseDate(current.startDate);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);

  return {
    current,
    previous: {
      startDate: formatDate(previousStart),
      endDate: formatDate(previousEnd)
    }
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
