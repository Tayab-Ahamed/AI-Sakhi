export type PracticeTopic = { subject: string; chapter: string; question_count: number };
export type PracticeTopics = { topics: PracticeTopic[]; truncated: boolean };
export type PracticeIntent = { creation_key: string; subject: string; chapter: string; count?: number };
export type PracticeQuestion = { id: number; question_text: string; options: string[] };
export type PracticeAttempt = {
  id: string; subject: string; chapter: string; status: "active" | "completed";
  questions: PracticeQuestion[];
  result: null | { score: number; total: number; next_action: string; items: Array<{
    question_id: number; is_correct: boolean; selected_index: number; correct_index: number; explanation: string;
  }> };
};
