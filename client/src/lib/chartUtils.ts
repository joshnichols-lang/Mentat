export type TimeRange = "1h" | "1d" | "1w" | "1m" | "1y";

export const timeRanges: { value: TimeRange; label: string; ms: number }[] = [
  { value: "1h", label: "1H", ms: 60 * 60 * 1000 },
  { value: "1d", label: "1D", ms: 24 * 60 * 60 * 1000 },
  { value: "1w", label: "1W", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "1m", label: "1M", ms: 30 * 24 * 60 * 60 * 1000 },
  { value: "1y", label: "1Y", ms: 365 * 24 * 60 * 60 * 1000 },
];

// Uniform date formatting for all charts
export const formatChartDate = (timestamp: string | number, timeRange: TimeRange): string => {
  const date = new Date(timestamp);
  
  switch (timeRange) {
    case "1h":
    case "1d":
      // Time format for short ranges
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    case "1w":
    case "1m":
      // Date format for medium ranges
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    case "1y":
      // Month/year for long range
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: '2-digit' 
      });
    default:
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
  }
};

// Filter data by time range
export const filterDataByTimeRange = <T extends { timestamp: string }>(
  data: T[], 
  timeRange: TimeRange
): T[] => {
  if (data.length === 0) return [];
  
  const selectedRange = timeRanges.find(r => r.value === timeRange);
  if (!selectedRange) return data;
  
  const now = Date.now();
  const cutoff = now - selectedRange.ms;
  
  return data.filter((item) => {
    const timestamp = new Date(item.timestamp).getTime();
    return timestamp >= cutoff;
  });
};
