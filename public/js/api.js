function jiraFetch(cfg, apiPath, opts = {}) {
  const url = `${cfg.corsProxy}${cfg.baseUrl.replace(/\/$/,'')}${apiPath}`;
  const headers = {
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...opts.headers,
  };
  if (!(serverConfig && serverConfig.hasAuth)) {
    headers['Authorization'] = 'Basic ' + btoa(`${cfg.email}:${cfg.apiToken}`);
  }
  return fetch(url, { method: opts.method || 'GET', headers, body: opts.body }).then(async r => {
    if (!r.ok) { const t = await r.text(); throw new Error(`Jira ${r.status}: ${t.slice(0,300)}`); }
    return r.json();
  });
}

async function getSprints(cfg) {
  setLoadingMsg('Finding boards...');
  const boards = await jiraFetch(cfg, `/rest/agile/1.0/board?projectKeyOrId=${cfg.projectKey}&maxResults=60`);
  if (!boards.values?.length) throw new Error(`No boards found for project "${cfg.projectKey}"`);
  const boardId = boards.values[0].id;
  setLoadingMsg('Loading sprints...');
  const data = await jiraFetch(cfg, `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed,future&maxResults=60`);
  const order = { closed: 0, active: 1, future: 2 };
  const all = (data.values || []).sort((a, b) => (order[a.state] ?? 0) - (order[b.state] ?? 0) || new Date(a.startDate || 0) - new Date(b.startDate || 0));
  const closedSprints = all.filter(s => s.state === 'closed').slice(-3);
  const otherSprints = all.filter(s => s.state !== 'closed');
  const sprints = [...closedSprints, ...otherSprints];
  if (!sprints.length) throw new Error('No sprints found on this board');
  return { boardId, sprints };
}

async function getIssues(cfg, boardId, sprintId) {
  setLoadingMsg('Loading sprint issues...');
  const fields = ['assignee', 'status', ...cfg.storyPointsFields, 'summary'].join(',');
  const jql = encodeURIComponent(`sprint=${sprintId}`);
  let issues = [], startAt = 0;
  while (true) {
    const data = await jiraFetch(cfg,
      `/rest/api/3/search/jql?jql=${jql}&maxResults=100&startAt=${startAt}&fields=${fields}`);
    issues = issues.concat(data.issues || []);
    if (issues.length >= data.total || !(data.issues?.length)) break;
    startAt += 100;
  }
  return issues;
}

async function getBacklog(cfg, boardId) {
  setLoadingMsg('Loading backlog...');
  const fields = ['assignee', 'status', ...cfg.storyPointsFields, 'summary'].join(',');
  const jql = encodeURIComponent(`project=${cfg.projectKey} AND sprint is EMPTY AND statusCategory = "To Do"`);
  let issues = [], startAt = 0;
  while (true) {
    const data = await jiraFetch(cfg,
      `/rest/api/3/search/jql?jql=${jql}&maxResults=100&startAt=${startAt}&fields=${fields}`);
    issues = issues.concat(data.issues || []);
    if (issues.length >= data.total || !(data.issues?.length)) break;
    startAt += 100;
  }
  return issues;
}

async function discoverStoryPointsField(cfg) {
  setLoadingMsg('Detecting story points field...');
  try {
    const fields = await jiraFetch(cfg, '/rest/api/3/field');
    // Look for story point fields by common names (case-insensitive)
    const spPatterns = ['story points', 'story point estimate', 'story_points'];
    const candidates = fields.filter(f =>
      spPatterns.some(p => (f.name || '').toLowerCase().includes(p))
    );
    if (candidates.length) {
      console.log('All story point field candidates:', candidates.map(f => `"${f.name}" → ${f.id}`));
      // Return ALL candidate field IDs so we can try each one
      return candidates.map(f => f.id);
    }
  } catch(e) {
    console.warn('Could not auto-detect story points field:', e.message);
  }
  return null;
}

async function getProjectMembers(cfg) {
  setLoadingMsg('Loading team members...');
  let users = [], startAt = 0;
  while (true) {
    const data = await jiraFetch(cfg,
      `/rest/api/3/user/assignable/search?project=${cfg.projectKey}&maxResults=200&startAt=${startAt}`);
    if (!data || !data.length) break;
    users = users.concat(data);
    if (data.length < 200) break;
    startAt += 200;
  }
  accountIdToName = {};
  users.forEach(u => {
    if (u.displayName && u.accountType === 'atlassian') {
      allContributors.add(u.displayName);
      if (u.accountId) accountIdToName[u.accountId] = u.displayName;
    }
  });
  return users;
}

async function getOrgId(cfg) {
  setLoadingMsg('Loading organization...');
  if (cfg.orgId) return cfg.orgId;
  try {
    const info = await jiraFetch(cfg, '/_edge/tenant_info');
    return info.orgId || null;
  } catch(e) {
    console.warn('Could not get orgId from tenant_info:', e.message);
    return null;
  }
}

async function loadTeams(cfg) {
  setLoadingMsg('Loading teams...');

  const orgId = cfg.orgId;
  if (!orgId) { console.warn('No orgId configured, skipping teams'); return; }

  // Try automatic API-based team + member loading via Jira gateway
  try {
    let teamsUrl = `/gateway/api/public/teams/v1/org/${orgId}/teams?size=300`;
    if (cfg.siteId) teamsUrl += `&siteId=${cfg.siteId}`;

    const teamsData = await jiraFetch(cfg, teamsUrl);
    const apiTeams = teamsData.entities || [];
    let membersLoaded = 0;
    for (const team of apiTeams) {
      const teamName = team.displayName || team.name;
      const teamId = team.teamId;
      if (!teamName || !teamId) continue;

      try {
        setLoadingMsg(`Loading members: ${teamName}...`);
        let membersUrl = `/gateway/api/public/teams/v1/org/${orgId}/teams/${teamId}/members`;
        if (cfg.siteId) membersUrl += `?siteId=${cfg.siteId}`;

        const membersData = await jiraFetch(cfg, membersUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ first: 50 }),
        });

        const members = membersData.results || [];
        let pageInfo = membersData.pageInfo;
        let allMembers = [...members];
        while (pageInfo && pageInfo.hasNextPage && pageInfo.endCursor) {
          const nextData = await jiraFetch(cfg, membersUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first: 50, after: pageInfo.endCursor }),
          });
          allMembers = allMembers.concat(nextData.results || []);
          pageInfo = nextData.pageInfo;
        }

        let resolved = 0;
        allMembers.forEach(m => {
          const name = accountIdToName[m.accountId];
          if (name) {
            resolved++;
            allContributors.add(name);
            if (!teamsByPerson[name]) teamsByPerson[name] = [];
            if (!teamsByPerson[name].includes(teamName)) teamsByPerson[name].push(teamName);
          }
        });
        membersLoaded++;
      } catch(e) {
        console.warn(`Could not load members for ${teamName}: ${e.message}`);
      }
    }

    if (membersLoaded > 0) {
      allTeamNames = [...new Set(Object.values(teamsByPerson).flat())].sort((a, b) => a.localeCompare(b));
      applyTeamExclusions();
      return;
    }
    console.warn('API team listing worked but no members could be loaded');
  } catch(e) {
    console.warn('Teams API fetch failed, falling back to manual config:', e.message);
  }

  // Fallback: manual teamMembers config
  const teamConfig = cfg.teamMembers || {};
  const configTeamNames = Object.keys(teamConfig).filter(t => teamConfig[t] && teamConfig[t].length > 0);
  if (configTeamNames.length) {
    configTeamNames.forEach(teamName => {
      teamConfig[teamName].forEach(memberName => {
        const match = [...allContributors].find(c =>
          c === memberName ||
          c.toLowerCase() === memberName.toLowerCase() ||
          c.toLowerCase().includes(memberName.toLowerCase()) ||
          memberName.toLowerCase().includes(c.toLowerCase())
        );
        const name = match || memberName;
        if (!teamsByPerson[name]) teamsByPerson[name] = [];
        if (!teamsByPerson[name].includes(teamName)) teamsByPerson[name].push(teamName);
        allContributors.add(name);
      });
    });
    allTeamNames = configTeamNames.sort((a, b) => a.localeCompare(b));
  }
  applyTeamExclusions();
}

function applyTeamExclusions() {
  const excludeTeam = allTeamNames.find(t => t.toLowerCase() === 'non dashboard');
  if (!excludeTeam) return;
  excludedPeople = new Set();
  allContributors.forEach(name => {
    const teams = teamsByPerson[name];
    if (teams && teams.includes(excludeTeam)) excludedPeople.add(name);
  });
  excludedPeople.forEach(name => {
    allContributors.delete(name);
    delete teamsByPerson[name];
  });
  allTeamNames = allTeamNames.filter(t => t !== excludeTeam);
}
