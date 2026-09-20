export const QAI_ASK_EVENT = "q-ai:ask";
export function askQuantumCoach(question: string) {
  window.dispatchEvent(new CustomEvent(QAI_ASK_EVENT, { detail: question.slice(0, 4000) }));
}
