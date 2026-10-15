export function buildSubjectMastery(rows: Array<{ topic: string; attempts: number; avg_pct: number }>) {
  return rows.filter((row) => row.attempts > 0 && Number.isFinite(row.avg_pct) && row.avg_pct >= 0 && row.avg_pct <= 100)
    .map((row) => ({ name: row.topic, value: row.avg_pct }));
}
