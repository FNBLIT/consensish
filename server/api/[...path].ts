import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { get, all, put, transaction, log, events, db } from '../repositories/database'
import { defaultDeadline, validateResponse, canAgree } from '../domain/consensus.mjs'

const id = () => randomBytes(18).toString('base64url')
const digest = (s: string) => createHash('sha256').update(s).digest('hex')
function hash(password: string) { const salt = id(); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}` }
function matches(value: string, encoded: string) { const [salt, key] = encoded.split(':'); if (!salt || !key) return false; return timingSafeEqual(Buffer.from(key, 'hex'), scryptSync(value, salt, 64)) }
function fail(message: string, statusCode = 400): never { throw createError({ statusCode, statusMessage: message }) }
function text(value: unknown, field: string, max = 5000, required = false) { if (typeof value !== 'string') { if (!required && value == null) return ''; fail(`${field} must be text.`) } const result = value.trim(); if (result.length > max || (required && !result)) fail(`${field} must contain ${required ? '1' : '0'}–${max} characters.`); return result }
const sanitize = ({ passwordHash, adminHash, ...record }: any) => ({ ...record, locked: !!passwordHash })
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  const method = event.method
  const parts = (getRouterParam(event, 'path') || '').split('/')
  if (method !== 'GET') {
    const origin = getHeader(event, 'origin')
    if (origin && origin !== getRequestURL(event).origin) fail('Cross-origin requests are not allowed.', 403)
    if (!getHeader(event, 'content-type')?.includes('application/json')) fail('Send JSON.', 415)
    if (Number(getHeader(event, 'content-length') || 0) > 40000) fail('Request too large.', 413)
    const key = digest(event.node.req.socket.remoteAddress || 'local')
    const now = Date.now()
    db.prepare('DELETE FROM attempts WHERE expires < ?').run(now)
    const attempt = db.prepare('SELECT count FROM attempts WHERE key=?').get(key) as any
    if (attempt?.count >= 100) fail('Too many requests. Try again in fifteen minutes.', 429)
    db.prepare('INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key, now + 900000)
  }
  const body: any = method === 'GET' ? {} : await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Send an object.')
  const cookie = (name: string, value: string) => setCookie(event, name, value, { httpOnly: true, sameSite: 'lax', secure: getRequestURL(event).protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 30 })
  const admin = (g: any) => { const token = getCookie(event, `admin_${g.id}`); return !!token && digest(token) === g.adminHash }
  const access = (record: any, kind: string) => !record.passwordHash || getCookie(event, `${kind}_${record.id}`) === digest(record.passwordHash)
  const unlock = (record: any, kind: string) => { if (record.passwordHash && !matches(text(body.password, 'Password', 200, true), record.passwordHash)) fail('That password did not match.', 403); cookie(`${kind}_${record.id}`, digest(record.passwordHash || 'open')); return { ok: true } }
  if (parts[0] === 'groups' && parts.length === 1 && method === 'POST') {
    const name = text(body.name, 'Group name', 100, true); const password = text(body.password, 'Password', 200)
    if (password && password.length < 8) fail('Use a password of at least 8 characters.')
    const token = id(); const group = { id: id(), name, description: text(body.description, 'Description', 1000), passwordHash: password ? hash(password) : '', adminHash: digest(token), createdAt: new Date().toISOString() }
    transaction(() => { put('group', group); log(group.id, null, 'group', `${name} was created.`) }); cookie(`admin_${group.id}`, token)
    return { group: sanitize(group), adminToken: token }
  }
  if (parts[0] === 'groups' && parts[1]) {
    const group = get('group', parts[1]); if (!group) fail('Group not found.', 404)
    if (parts[2] === 'claim' && method === 'POST') { if (digest(text(body.token, 'Organizer key', 200, true)) !== group.adminHash) fail('Invalid organizer key.', 403); cookie(`admin_${group.id}`, body.token); return { ok: true } }
    if (parts[2] === 'unlock' && method === 'POST') return unlock(group, 'group')
    if (!admin(group) && !access(group, 'group')) return method === 'GET' ? { locked: true, id: group.id } : fail('Unlock this group first.', 403)
    if (parts.length === 2 && method === 'GET') {
      const proposals = all('proposal').filter(p => p.groupId === group.id)
      const visible = (p: any) => admin(group) || access(p, 'proposal')
      return { group: sanitize(group), isAdmin: admin(group), proposals: proposals.map(p => ({ id: p.id, title: p.title, program: p.program, type: p.type, facilitator: p.facilitator, createdAt: p.createdAt, revision: p.revision, status: p.status, deadline: p.deadline, locked: !!p.passwordHash, outcome: visible(p) ? p.outcome : 'Password protected decision' })), activity: events(group.id).map((a: any) => { const p = proposals.find(p => p.id === a.proposalId); return p && !visible(p) ? { ...a, text: `${p.title}: ${a.kind} activity. Unlock the decision to read more.` } : a }) }
    }
    if (parts[2] === 'proposals' && method === 'POST') {
      if (!admin(group)) fail('An organizer key is required to create proposals.', 403)
      const budget = body.budget; if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0 || budget > 1e12) fail('Enter a valid budget.')
      const type = text(body.type, 'Type', 50, true); if (!['Event', 'Purchase', 'Project', 'Policy change', 'Other'].includes(type)) fail('Choose a proposal type.')
      const password = text(body.password, 'Password', 200); if (password && password.length < 8) fail('Use a password of at least 8 characters.')
      const now = new Date().toISOString()
      const proposal = { id: id(), groupId: group.id, title: text(body.title, 'Title', 160, true), description: text(body.description, 'Description', 10000, true), type, budget, program: text(body.program, 'Program', 150), recurring: text(body.recurring, 'Recurring cost', 200), facilitator: text(body.facilitator, 'Facilitator', 100, true), evidence: text(body.evidence, 'Evidence', 3000), timeline: text(body.timeline, 'Implementation timeline', 2000), meeting: text(body.meeting, 'Meeting', 200), deadline: defaultDeadline(budget, type), passwordHash: password ? hash(password) : '', revision: 1, status: 'Review', outcome: '', createdAt: now }
      transaction(() => { put('proposal', proposal); log(group.id, proposal.id, 'proposal', `${proposal.facilitator} opened “${proposal.title}” for review.`) }); return sanitize(proposal)
    }
  }
  if (parts[0] === 'proposals' && parts[1]) {
    const proposal = get('proposal', parts[1]); if (!proposal) fail('Decision not found.', 404)
    const group = get('group', proposal.groupId)
    if (parts[2] === 'unlock' && method === 'POST') return unlock(proposal, 'proposal')
    if (!admin(group) && !access(proposal, 'proposal')) return method === 'GET' ? { locked: true, id: proposal.id } : fail('Unlock this decision first.', 403)
    let participantId = getCookie(event, 'participant'); if (!participantId) { participantId = id(); cookie('participant', participantId) }
    const responses = () => all('response').filter(r => r.proposalId === proposal.id)
    if (method === 'GET' && parts.length === 2) return { proposal: sanitize(proposal), group: { id: group.id, name: group.name }, isAdmin: admin(group), participantId, responses: responses(), revisions: all('revision').filter(r => r.proposalId === proposal.id), activity: events(group.id, proposal.id) }
    if (parts[2] === 'responses' && method === 'POST') {
      if (proposal.status !== 'Review' || Date.now() >= Date.parse(proposal.deadline)) fail('This review is closed.')
      const justification = text(body.justification, 'Reason', 5000)
      try { validateResponse(body.position, justification) } catch (e: any) { fail(e.message) }
      const existing = responses().find(r => r.participantId === participantId && r.revision === proposal.revision && r.position !== 'COMMENT' && r.position !== 'ASK CLARIFYING QUESTION' && r.position !== 'SUGGEST MODIFICATION')
      const isPosition = !['COMMENT', 'ASK CLARIFYING QUESTION', 'SUGGEST MODIFICATION'].includes(body.position)
      const amendment = body.position === 'SUGGEST MODIFICATION' ? { title: text(body.amendment?.title, 'Revised title', 160, true), description: text(body.amendment?.description, 'Revised proposal', 10000, true), deadline: text(body.amendment?.deadline, 'Extended deadline', 50) } : undefined
      if (amendment?.deadline && (!Number.isFinite(Date.parse(amendment.deadline)) || Date.parse(amendment.deadline) <= Date.parse(proposal.deadline))) fail('An extension must be later than the current deadline.')
      const response = { id: isPosition && existing ? existing.id : id(), proposalId: proposal.id, participantId, name: text(body.name, 'Your name', 80, true), position: body.position, justification, revision: proposal.revision, createdAt: new Date().toISOString(), amendment, resolved: false }
      transaction(() => { put('response', response); log(group.id, proposal.id, 'response', `${response.name}: ${response.position.toLowerCase()}.`) }); return { ok: true }
    }
    if (!admin(group)) fail('Organizer access is required.', 403)
    if (parts[2] === 'amend' && method === 'POST') {
      if (proposal.status !== 'Review') fail('This decision is already closed.')
      const response = get('response', text(body.responseId, 'Modification', 100, true))
      if (!response || response.proposalId !== proposal.id || !response.amendment || response.resolved || response.revision !== proposal.revision) fail('This modification is no longer available.')
      if (body.accept !== true && body.accept !== false) fail('Choose accept or decline.')
      transaction(() => {
        response.resolved = true; put('response', response)
        if (body.accept) { put('revision', { ...sanitize(proposal), proposalId: proposal.id, id: `${proposal.id}:${proposal.revision}` }); proposal.title = response.amendment.title; proposal.description = response.amendment.description; proposal.deadline = response.amendment.deadline || defaultDeadline(proposal.budget, proposal.type); proposal.revision++; put('proposal', proposal) }
        log(group.id, proposal.id, 'revision', body.accept ? `The facilitator accepted ${response.name}’s modification with proposer consent. Revision ${proposal.revision} is open; everyone must respond again.` : `The facilitator declined ${response.name}’s modification.`)
      }); return { ok: true }
    }
    if (parts[2] === 'close' && method === 'POST') {
      if (proposal.status !== 'Review') fail('This decision is already closed.')
      if (!['Agreed', 'Not agreed', 'Withdrawn'].includes(body.status)) fail('Choose an outcome.')
      if (body.status !== 'Withdrawn' && Date.now() < Date.parse(proposal.deadline)) fail('The review window is still open. You can withdraw or wait for its deadline.')
      if (body.status === 'Agreed' && !canAgree(responses().filter(r => r.revision === proposal.revision))) fail('Agreement needs at least one approval and no blocks.')
      proposal.status = body.status; proposal.outcome = text(body.outcome, 'Outcome and rationale', 5000, true)
      transaction(() => { put('proposal', proposal); log(group.id, proposal.id, 'outcome', `${proposal.status}: ${proposal.outcome}`) }); return { ok: true }
    }
  }
  fail('Endpoint not found.', 404)
})
