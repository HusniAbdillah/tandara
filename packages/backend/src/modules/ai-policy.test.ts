import { describe, it, expect } from 'vitest';
import {
  deterministicAssistance,
  redactAiText,
  sensitiveAiText,
  validateAssistance,
} from './ai-policy.js';
import { buildLexicalOrQuery } from './knowledge.js';
import type { AiEvidence, AiTask } from '@tandara/contracts';
const sources: AiEvidence[] = [
  {
    id: 'plan:1',
    entityId: '20000000-0000-4000-8000-000000000001',
    kind: 'plan',
    version: '3',
    title: 'Rencana',
    text: 'Simpan air minum untuk 3 hari. Jangan gunakan rute yang belum diperiksa.',
  },
];
describe('bounded assistance policy', () => {
  it('preserves dates and identifiers adjacent to digits while redacting full phone numbers', () => {
    const text = 'Tanggal 2026-10-13, 07:30, koordinat -6.123456, versi abc08123456789x.';
    expect(redactAiText(text)).toBe(text);
    expect(redactAiText('Hubungi +62 812 3456 7890.')).not.toContain('812');
  });
  it('redacts contacts and quarantines identity descriptions', () => {
    expect(redactAiText('Hubungi 081234567890 atau person@example.test')).not.toMatch(
      /081234|person@/,
    );
    expect(sensitiveAiText('NIK saya tercantum di KTP')).toBe(true);
  });
  it('preserves labelled deterministic source extracts', () => {
    const output = deterministicAssistance(sources);
    expect(validateAssistance(output, sources, 'answer').needsHumanReview).toBe(true);
    expect(output.limitation).toContain('bukan inferensi');
  });
  it('generates task-aware valid outputs across all 9 Posko AI tasks', () => {
    const tasks: Exclude<AiTask, 'triage'>[] = [
      'briefing',
      'clarification',
      'public_summary',
      'plan_draft',
      'training_draft',
      'translation',
      'answer',
      'duplicates',
      'coverage',
    ];
    for (const task of tasks) {
      const taskSources =
        task === 'translation' ? [{ ...sources[0]!, kind: 'instruction' as const }] : sources;
      const output = deterministicAssistance(taskSources, task, 'Langkah kesiapsiagaan air minum');
      const validated = validateAssistance(output, taskSources, task);
      expect(validated.abstained).toBe(false);
      expect(validated.needsHumanReview).toBe(true);
      expect(validated.questions.length).toBeGreaterThan(0);
      if (['clarification', 'public_summary', 'plan_draft', 'training_draft'].includes(task)) {
        expect(validated.draft?.kind).toBe(task);
        expect(validated.draft?.sections.length).toBeGreaterThan(0);
      }
      if (task === 'translation') {
        expect(validated.translation).toContain('3 hari');
      }
    }
  });
  it('builds stopword-filtered OR lexical tsquery for natural Indonesian RAG questions', () => {
    const orQuery = buildLexicalOrQuery(
      'Bagaimana langkah evakuasi mandiri dan persiapan kelompok rentan di titik kumpul?',
    );
    expect(orQuery).toContain('evakuasi');
    expect(orQuery).toContain('kelompok');
    expect(orQuery).toContain(' | ');
    expect(orQuery).not.toContain('bagaimana');
  });
  it('abstains with no approved evidence', () => {
    expect(deterministicAssistance([]).abstained).toBe(true);
  });
  it('rejects fabricated source identifiers', () => {
    const output = deterministicAssistance(sources);
    output.claims[0]!.citations[0]!.sourceId = 'private-region';
    expect(() => validateAssistance(output, sources, 'answer')).toThrow();
  });
  it('rejects invented quotations and unsupported explicit paraphrases', () => {
    const output = deterministicAssistance(sources);
    output.claims[0]!.text = 'Wilayah ini aman.';
    expect(() => validateAssistance(output, sources, 'answer')).toThrow('extract');
    output.claims[0]!.citations[0]!.quote = 'invented';
    expect(() => validateAssistance(output, sources, 'answer')).toThrow('quote');
  });
  it('rejects altered numeric details in translations', () => {
    const output = deterministicAssistance([]);
    output.abstained = false;
    output.translation = 'Simpan air minum untuk 30 hari.';
    expect(() =>
      validateAssistance(output, [{ ...sources[0]!, kind: 'instruction' }], 'translation'),
    ).toThrow('numeric');
  });
  it('rejects draft types and citations outside the selected task', () => {
    const output = deterministicAssistance(sources);
    output.draft = {
      kind: 'plan_draft',
      sections: [
        {
          heading: 'Draf',
          text: 'Simpan air minum.',
          citations: [{ sourceId: 'plan:1', quote: 'Simpan air minum' }],
        },
      ],
    };
    expect(() => validateAssistance(output, sources, 'training_draft')).toThrow('kind');
    expect(validateAssistance(output, sources, 'plan_draft').draft?.kind).toBe('plan_draft');
  });
  it('keeps model safety decisions provisional', () => {
    const output = { ...deterministicAssistance(sources), needsHumanReview: false };
    expect(() => validateAssistance(output, sources, 'answer')).toThrow();
  });
});
