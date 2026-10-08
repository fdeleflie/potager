export const getCalendarMonths = (entries: any[]) => {
  const months = new Map<string, Date>();
  entries.forEach(e => {
    const d = new Date(e.date);
    if (!isNaN(d.getTime())) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!months.has(key)) {
        months.set(key, new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  });
  return Array.from(months.values()).sort((a, b) => a.getTime() - b.getTime());
};
