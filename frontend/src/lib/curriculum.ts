import curriculumData from "../../public/curriculum.json";

export type Level = { id: string; label: string; classes: string[] };
export type Subject = {
  id: string; label: string; icon: string; color: string; levels: string[];
};

export function getAllClasses(): string[] {
  return curriculumData.levels.flatMap((l) => l.classes);
}

export function getSubjectsForClass(classId: string): Subject[] {
  const level = curriculumData.levels.find((l) => l.classes.includes(classId));
  if (!level) return [];
  return curriculumData.subjects.filter((s) => s.levels.includes(level.id)) as Subject[];
}

export function getTopicsForSubjectAndClass(subjectId: string, classId: string): string[] {
  const topics = (curriculumData.topics as Record<string, Record<string, string[]>>);
  return topics[subjectId]?.[classId] || [];
}

export function getLevels(): Level[] {
  return curriculumData.levels as Level[];
}

export function getAllSubjects(): Subject[] {
  return curriculumData.subjects as Subject[];
}
