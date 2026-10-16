import {
  aiAssistanceOutputSchema,
  type AiAssistanceOutput,
  type AiEvidence,
} from '@tandara/contracts';

export const WORKFLOW_VERSION = 'assistance-2';
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
export function deterministicAssistance(
  sources: AiEvidence[],
  task = 'briefing',
  question = '',
): AiAssistanceOutput {
  const claims = sources.slice(0, 8).map((s) => ({
    text: s.text.slice(0, 1000),
    state: 'explicit' as const,
    citations: [{ sourceId: s.id, quote: s.text.slice(0, 1000) }],
  }));
  const first = sources[0];
  const second = sources[1] ?? first;
  const instructionSource = sources.find((s) => s.kind === 'instruction');
  const titles: Record<string, string> = {
    briefing: 'Briefing situasional operasional Posko',
    clarification: 'Draf klarifikasi laporan warga untuk ditinjau',
    public_summary: 'Draf ringkasan publik terverifikasi untuk ditinjau',
    plan_draft: 'Draf pembaruan rencana kesiapsiagaan komunitas',
    training_draft: 'Draf skenario latihan kesiapsiagaan warga',
    translation: 'Draf saran terjemahan komunikasi kesiapsiagaan',
    answer: 'Sintesis jawaban berbasis pustaka pengetahuan RAG',
    duplicates: 'Analisis kemiripan dan kandidat laporan duplikat',
    coverage: 'Analisis cakupan pengamatan spasial wilayah',
  };
  const questionsByTask: Record<string, string[]> = {
    briefing: [
      'Laporan mana yang masih berstatus menunggu klarifikasi atau memerlukan penugasan koordinator segera?',
      'Apakah ada pembaruan sensor tinggi muka air atau prakiraan BMKG yang perlu disandingkan dengan laporan warga?',
    ],
    clarification: [
      'Mohon konfirmasi patokan lokasi terdekat (RT/RW, nama jalan/gang, atau bangunan sekitar).',
      'Kapan waktu pengamatan terakhir dan berapa perkiraan tinggi genangan saat ini?',
      'Apakah genangan mulai memasuki rumah warga atau menghambat akses kelompok rentan (lansia/anak/disabilitas)?',
    ],
    public_summary: [
      'Apakah seluruh fakta lokasi dan status penanganan telah diverifikasi koordinator lapangan sebelum dibagikan?',
    ],
    plan_draft: [
      'Apakah titik kumpul sementara telah diperiksa aksesibilitasnya bagi lansia dan penyandang disabilitas?',
      'Apakah daftar kontak koordinator RT/RW pada rencana wilayah ini sudah mutakhir?',
    ],
    training_draft: [
      'Apakah materi latihan sudah menekankan perbedaan antara observasi warga dan peringatan resmi otoritas?',
    ],
    translation: [
      'Apakah istilah lokal dan angka penting telah diperiksa oleh peninjau bahasa yang berkompeten?',
    ],
    answer: [
      'Pastikan versi dokumen rencana dan referensi yang dikutip masih berlaku sebelum disampaikan ke warga.',
    ],
    duplicates: [
      'Apakah jarak lokasi, patokan, dan waktu pengamatan mengacu pada titik kejadian yang sama?',
    ],
    coverage: [
      'Area mana yang belum memiliki laporan terbaru dan memerlukan pengecekan proaktif koordinator?',
    ],
  };
  const draft: AiAssistanceOutput['draft'] = !first
    ? null
    : task === 'clarification'
      ? {
          kind: 'clarification',
          sections: [
            {
              heading: 'Pesan permintaan klarifikasi ke warga',
              text: 'Terima kasih atas laporan yang Anda kirimkan ke Posko. Untuk mempercepat verifikasi lapangan, mohon informasikan patokan lokasi terdekat (RT/RW atau bangunan sekitar), waktu pengamatan terbaru, serta apakah air mulai memasuki rumah atau menghambat akses warga rentan.',
              citations: [{ sourceId: first.id, quote: first.text.slice(0, 300) }],
            },
          ],
        }
      : task === 'public_summary'
        ? {
            kind: 'public_summary',
            sections: [
              {
                heading: 'Ringkasan status publik wilayah',
                text: 'Posko wilayah telah menerima dan meninjau laporan warga terkait kondisi lingkungan setempat. Petugas koordinator sedang melakukan pemeriksaan lapangan dan koordinasi penanganan. Warga diimbau tetap tenang, menyimpan dokumen penting dalam wadah kedap air, serta memantau informasi resmi BMKG dan BPBD.',
                citations: [{ sourceId: first.id, quote: first.text.slice(0, 300) }],
              },
            ],
          }
        : task === 'plan_draft'
          ? {
              kind: 'plan_draft',
              sections: [
                {
                  heading: '1. Kesiapsiagaan Rumah Tangga & Tas Siaga 72 Jam',
                  text: 'Siapkan dokumen penting dalam kantong kedap air, obat rutin pribadi, air minum, senter, serta sepakati cara menghubungi anggota keluarga dan titik temu saat jaringan komunikasi terganggu.',
                  citations: [{ sourceId: first.id, quote: first.text.slice(0, 300) }],
                },
                {
                  heading: '2. Koordinasi Posko, Kelompok Rentan, & Keselamatan Lingkungan',
                  text: 'Prioritaskan pendampingan lansia, anak-anak, ibu hamil, dan penyandang disabilitas menuju titik kumpul yang telah ditinjau koordinator. Matikan panel listrik utama bila air mendekati teras dan pantau peringatan resmi BMKG/BPBD.',
                  citations: [{ sourceId: second!.id, quote: second!.text.slice(0, 300) }],
                },
              ],
            }
          : task === 'training_draft'
            ? {
                kind: 'training_draft',
                sections: [
                  {
                    heading: 'Skenario Latihan: Verifikasi Informasi & Langkah Siaga Banjir',
                    text: 'Latihan warga untuk membedakan laporan observasi awal dari peringatan resmi, menyiapkan tas siaga 72 jam, mengamankan instalasi listrik rumah, serta mengenali lokasi titik kumpul komunitas.',
                    citations: [{ sourceId: first.id, quote: first.text.slice(0, 300) }],
                  },
                ],
              }
            : null;
  return {
    title: first
      ? (titles[task] ?? 'Petikan sumber untuk ditinjau')
      : 'Petikan sumber untuk ditinjau',
    claims,
    questions: first ? (questionsByTask[task] ?? []) : [],
    abstained: sources.length === 0,
    limitation:
      'Mode aturan lokal; bukan inferensi model. Petikan tidak menetapkan keadaan terkini atau keamanan rute. Perlu tinjauan manusia.',
    translation:
      task === 'translation' && first
        ? (instructionSource?.text ?? (question || first.text.slice(0, 500)))
        : null,
    draft,
    needsHumanReview: true,
  };
}
