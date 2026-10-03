import type { ConfusionSlideStat } from "@/lib/types";

export function aggregateConfusion(rows: { slide_number: number; participant_id: string }[]): ConfusionSlideStat[] {
  const bySlide = new Map<number, { signalCount: number; students: Set<string> }>();
  for (const row of rows) {
    const entry = bySlide.get(row.slide_number) ?? { signalCount: 0, students: new Set<string>() };
    entry.signalCount += 1;
    entry.students.add(row.participant_id);
    bySlide.set(row.slide_number, entry);
  }
  return [...bySlide.entries()]
    .sort(([a], [b]) => a - b)
    .map(([slideNumber, e]) => ({ slideNumber, signalCount: e.signalCount, uniqueStudents: e.students.size }));
}
