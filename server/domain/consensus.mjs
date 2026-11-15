export const positions = ['APPROVE', 'EXPRESS CONCERN', 'ASK CLARIFYING QUESTION', 'COMMENT', 'SUGGEST MODIFICATION', 'STAND ASIDE', 'BLOCK'];
export function reviewDays(budget, type) { return type === 'Policy change' || budget > 5000 ? 28 : budget > 1000 ? 14 : 7; }
export function defaultDeadline(budget, type, start = new Date()) { const date = new Date(start); date.setUTCDate(date.getUTCDate() + reviewDays(budget, type)); return date.toISOString(); }
export function validateResponse(position, justification) { if (!positions.includes(position)) throw new Error('Choose a valid response.'); if (['BLOCK', 'EXPRESS CONCERN', 'SUGGEST MODIFICATION', 'ASK CLARIFYING QUESTION', 'COMMENT'].includes(position) && !String(justification || '').trim()) throw new Error('Please add a reason, question, or comment.'); }
export function canAgree(responses) { return responses.some(r => r.position === 'APPROVE') && !responses.some(r => r.position === 'BLOCK'); }
