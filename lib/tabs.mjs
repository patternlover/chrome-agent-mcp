/** One line per open page: short id, title, url. Service workers are not tabs. */
export function formatTabs(targets) {
  const pages = (targets ?? []).filter((t) => t.type === 'page');
  if (!pages.length) return 'no open tabs';
  return pages
    .map((t) => `${t.id.slice(0, 6)}\t${t.title || '(untitled)'}\t${t.url}`)
    .join('\n');
}
