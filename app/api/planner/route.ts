import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { emptyPlanner, validatePlanner } from '../../../lib/model';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Please sign in to access your timetable.' }, 401);
  try {
    const row = await env.DB!.prepare('SELECT data, revision FROM planners WHERE user_id = ?').bind(user.userId).first<{ data: string; revision: number }>();
    return json({ data: row ? JSON.parse(row.data) : emptyPlanner(), revision: row?.revision ?? 0 });
  } catch { return json({ error: 'Your timetable could not be loaded. Please try again.' }, 503); }
}
export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Please sign in to save your timetable.' }, 401);
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'This save request is not allowed.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Expected a timetable.' }, 415);
  let body;
  try {
    const text = await request.text();
    if (text.length > 2_000_000) return json({ error: 'This timetable is too large.' }, 413);
    body = JSON.parse(text);
  } catch { return json({ error: 'The timetable could not be read.' }, 400); }
  if (!validatePlanner(body?.data) || !Number.isInteger(body.revision) || body.revision < 0) return json({ error: 'Please check the term dates and lecture times.' }, 400);
  try {
    const now = new Date().toISOString();
    const result = body.revision === 0
      ? await env.DB!.prepare('INSERT INTO planners (user_id, data, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING').bind(user.userId, JSON.stringify(body.data), now).run()
      : await env.DB!.prepare('UPDATE planners SET data = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?').bind(JSON.stringify(body.data), now, user.userId, body.revision).run();
    if (!result.meta.changes) return json({ error: 'Your timetable changed in another tab. Reload to get the latest version.' }, 409);
    return json({ revision: body.revision + 1 });
  } catch { return json({ error: 'Your change could not be saved. Please try again.' }, 503); }
}
