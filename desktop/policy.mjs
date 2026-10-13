export function isUniversityLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && ['scientia.doc.ic.ac.uk', 'imperial.cloud.panopto.eu'].includes(url.hostname); }
  catch { return false; }
}
export function isAppPage(value, origin) {
  try { const url = new URL(value); return url.origin === origin && url.pathname === '/'; }
  catch { return false; }
}
