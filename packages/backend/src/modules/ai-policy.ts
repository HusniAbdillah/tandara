import {
  aiAssistanceOutputSchema,
  type AiAssistanceOutput,
  type AiEvidence,
} from '@tandara/contracts';

export const WORKFLOW_VERSION = 'assistance-1';
export const MAX_CONTEXT_CHARACTERS = 24000;
// Quarantine ambiguous identity/contact material instead of promising complete PII detection.
export function redactAiText(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[kontak dihapus]')
    .replace(/(?<![\w\d])(?:\+62|62|0)(?:[ .()-]?\d){8,13}(?!\d)/g, '[kontak dihapus]')
    .replace(/\b\d{16}\b/g, '[identitas dihapus]');
}
export function sensitiveAiText(text: string): boolean {
  return /\b(nik|ktp|paspor|passport|rekening|nomor kartu|alamat lengkap|nama lengkap|diagnosis|diagnosa)\b/i.test(
    text,
  );
}
export function validateAssistance(
  output: unknown,
  sources: AiEvidence[],
  task: string,
): AiAssistanceOutput {
  const value = aiAssistanceOutputSchema.parse(output);
  if (value.abstained && value.claims.some((c) => c.state === 'explicit'))
    throw new Error('Abstention conflicts with explicit claims');
  if (task !== 'translation' && value.translation !== null)
    throw new Error('Unexpected translation');
  if (value.draft) {
    if (value.draft.kind !== task) throw new Error('Draft kind mismatch');
    for (const section of value.draft.sections)
      for (const citation of section.citations) {
        const source = sources.find((s) => s.id === citation.sourceId);
        if (!source || !source.text.includes(citation.quote))
          throw new Error('Draft source mismatch');
      }
  }
  if (task === 'translation' && value.translation) {
    const original = sources.find((s) => s.kind === 'instruction')?.text ?? '';
    const numbers = (text: string) =>
      [...text.matchAll(/\d+(?:[.,:/-]\d+)*/g)]
        .map((m) => m[0])
        .sort()
        .join('|');
    if (numbers(original) !== numbers(value.translation))
      throw new Error('Translation changed numeric details');
  }
  for (const claim of value.claims) {
    if (claim.state !== 'insufficient_evidence' && !claim.citations.length)
      throw new Error('Missing citation');
    for (const citation of claim.citations) {
      const source = sources.find((s) => s.id === citation.sourceId);
      if (!source || !source.text.includes(citation.quote))
        throw new Error('Citation does not quote an authorized source');
    }
    // All factual prose is extractive; synthesis belongs in separately reviewed questions/translation.
    if (claim.state === 'explicit' && !claim.citations.some((c) => c.quote === claim.text))
      throw new Error('Explicit claims must be exact source extracts');
    if (
      /(pasti aman|jalur aman saat ini|evakuasi sekarang|peringatan resmi diterbitkan)/i.test(
        claim.text,
      )
    )
      throw new Error('Unsupported operational claim');
  }
  return value;
}
export function deterministicAssistance(sources: AiEvidence[]): AiAssistanceOutput {
  return {
    title: 'Petikan sumber untuk ditinjau',
    claims: sources.slice(0, 8).map((s) => ({
      text: s.text.slice(0, 1000),
      state: 'explicit' as const,
      citations: [{ sourceId: s.id, quote: s.text.slice(0, 1000) }],
    })),
    questions: [],
    abstained: sources.length === 0,
    limitation:
      'Mode aturan lokal; bukan inferensi model. Petikan tidak menetapkan keadaan terkini atau keamanan rute. Perlu tinjauan manusia.',
    translation: null,
    draft: null,
    needsHumanReview: true,
  };
}
