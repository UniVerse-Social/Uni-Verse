export function emailMatchesDomains(email, domains = []) {
  const e = String(email || '').trim().toLowerCase();
  if (!e.includes('@') || !domains?.length) return false;
  return domains.some((d) => e.endsWith(`@${String(d).toLowerCase()}`));
}
