// Orders GitHub search results. Kept apart from app.js, with no browser calls,
// so a test can load it and check that a look-alike never outranks the original.
const OFFICIAL = 'anthropics/skills';

// topic: repositories matching "<name> skill". byName: repositories with <name> in their name.
// Both arrive most starred first, as the GitHub API returned them.
function rankRepos(name, topic, byName, hasOfficial) {
  const row = (r) => ({ repo: r.full_name, description: r.description || '', stars: r.stargazers_count });
  // Of the name matches, keep only repositories named exactly like the search; the rest are unrelated projects.
  const exact = byName.map(row).filter((r) => r.repo.split('/')[1].toLowerCase() === name.toLowerCase());
  const found = [
    ...(hasOfficial ? [{ repo: OFFICIAL, officialFor: name, official: true }] : []),
    ...exact,
    ...topic.map(row),
  ];
  return found.filter((r, i) => found.findIndex((x) => x.repo === r.repo) === i).slice(0, 9);
}
