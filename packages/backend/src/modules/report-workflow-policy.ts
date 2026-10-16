import type { Workflow, WorkflowAction, User } from '@tandara/contracts';

const targets: Record<WorkflowAction['action'], Workflow['status'] | null> = {
  verify: 'verified',
  request_information: 'needs_information',
  reject: 'rejected',
  assign: 'assigned',
  start: 'in_progress',
  update: null,
  submit_resolution: 'awaiting_approval',
  approve: 'resolved',
  return: 'in_progress',
};
const allowed: Record<WorkflowAction['action'], Workflow['status'][]> = {
  verify: ['received', 'needs_information'],
  request_information: ['received', 'verified', 'assigned', 'in_progress'],
  reject: ['received', 'needs_information', 'verified'],
  assign: ['verified', 'assigned', 'in_progress'],
  start: ['assigned'],
  update: ['assigned', 'in_progress'],
  submit_resolution: ['in_progress'],
  approve: ['awaiting_approval'],
  return: ['awaiting_approval'],
};
export function workflowDecision(
  user: Pick<User, 'id' | 'role'>,
  current: Workflow,
  action: WorkflowAction['action'],
  resolutionAuthor: string | null,
) {
  if (!allowed[action].includes(current.status))
    return { error: 'Tindakan tidak tersedia pada status laporan saat ini.' };
  if (['assign', 'approve', 'return', 'reject'].includes(action) && user.role !== 'admin')
    return { error: 'Tindakan ini hanya dapat dilakukan Admin.' };
  if (['start', 'update', 'submit_resolution'].includes(action) && current.assigneeId !== user.id)
    return { error: 'Hanya koordinator yang ditugaskan dapat memperbarui penanganan.' };
  if (action === 'approve' && resolutionAuthor === user.id)
    return { error: 'Penyelesaian harus disetujui oleh Admin yang berbeda.' };
  return { status: targets[action] ?? current.status };
}
