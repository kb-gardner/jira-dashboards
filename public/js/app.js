// ── Load from Jira ───────────────────────────────────────────────

document.getElementById('btn-load').addEventListener('click', async () => {
  const hasServerAuth = serverConfig && serverConfig.hasAuth;
  const cfg = {
    baseUrl:          document.getElementById('cfg-url').value.trim(),
    email:            hasServerAuth ? '' : document.getElementById('cfg-email').value.trim(),
    apiToken:         hasServerAuth ? '' : document.getElementById('cfg-token').value.trim(),
    projectKey:       document.getElementById('cfg-project').value.trim().toUpperCase(),
    corsProxy:        DEFAULTS.corsProxy || '/proxy/',
    storyPointsField: (serverConfig && serverConfig.storyPointsField) || DEFAULTS.storyPointsField || 'customfield_10038',
    orgId:            (serverConfig && serverConfig.orgId) || DEFAULTS.orgId || '',
    siteId:           (serverConfig && serverConfig.siteId) || DEFAULTS.siteId || '',
  };

  document.getElementById('config-error').style.display = 'none';
  if (!cfg.baseUrl || !cfg.projectKey) { showError('Please fill in all required fields.'); return; }
  if (!hasServerAuth && (!cfg.email || !cfg.apiToken)) { showError('Please fill in email and API token.'); return; }
  if (!cfg.baseUrl.startsWith('http')) { showError('Base URL must start with https://'); return; }

  const btn = document.getElementById('btn-load');
  btn.disabled = true;
  document.getElementById('config-banner').style.display = 'none';
  showLoading(true);

  try {
    activeCfg = cfg; issuesCache = {}; backlogByPerson = {}; backlogIssuesRaw = [];
    activeSprintId = null; allContributors = new Set(); teamsByPerson = {}; allTeamNames = [];
    accountIdToName = {}; activeTeamTab = null; excludedPeople = new Set();

    // Auto-detect story points fields
    const detectedFields = await discoverStoryPointsField(cfg);
    cfg.storyPointsFields = detectedFields || [cfg.storyPointsField];

    const { boardId, sprints } = await getSprints(cfg);
    activeBoardId = boardId;

    // Load project members
    await getProjectMembers(cfg);

    // Load team assignments
    await loadTeams(cfg);

    // Load backlog
    const backlogIssues = await getBacklog(cfg, boardId);
    backlogIssuesRaw = backlogIssues;
    backlogByPerson = processBacklog(backlogIssues, cfg.storyPointsFields);

    // Load active sprint (or first if none active)
    const firstSprint = sprints.find(s => s.state === 'active') || sprints[0];
    activeSprintId = firstSprint.id;
    issuesCache[firstSprint.id] = await getIssues(cfg, boardId, firstSprint.id);
    const sprintByPerson = processIssues(issuesCache[firstSprint.id], cfg.storyPointsFields);

    const dates = firstSprint.startDate ? ` · ${firstSprint.startDate.slice(0,10)} – ${firstSprint.endDate.slice(0,10)}` : '';
    renderDashboard(sprintByPerson, firstSprint.name + dates);
    buildSprintSelector(sprints);
    showLoading(false);
    document.getElementById('dashboard').style.display = 'block';
  } catch(e) {
    showError(e.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btn-reconfigure').addEventListener('click', () => {
  document.getElementById('config-banner').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
});

// ── Initialization ───────────────────────────────────────────────
if (location.protocol === 'file:') {
  document.getElementById('config-banner').style.display = 'block';
  const errEl = document.getElementById('config-error');
  errEl.style.display = 'block';
  errEl.style.whiteSpace = 'pre-line';
  errEl.innerHTML = 'This file needs its built-in proxy server to reach Jira.\n\n'
    + 'Open a terminal and run:\n'
    + '<code style="background:#F1F5F9;padding:2px 8px;border-radius:4px;font-size:13px">node main.html</code>\n\n'
    + 'Then open <a href="http://localhost:8090">http://localhost:8090</a> in your browser.';
  document.getElementById('btn-load').disabled = true;
} else {
  fetch('/config').then(function(r){ return r.json(); }).then(function(cfg){
    serverConfig = cfg;
    if (cfg.hasAuth) {
      document.querySelectorAll('#cfg-email, #cfg-token').forEach(function(el){
        el.closest('.config-field').style.display = 'none';
      });
      document.getElementById('config-note').style.display = 'none';
      var sa = document.getElementById('config-server-auth');
      if (sa) sa.style.display = 'block';
      if (cfg.baseUrl) document.getElementById('cfg-url').value = cfg.baseUrl;
      if (cfg.projectKey) document.getElementById('cfg-project').value = cfg.projectKey;
      document.getElementById('btn-load').click();
    } else if (DEFAULTS.baseUrl && DEFAULTS.email && DEFAULTS.apiToken && DEFAULTS.projectKey) {
      ['url','email','token','project'].forEach(function(k){
        var el = document.getElementById('cfg-' + k);
        var val = DEFAULTS[{url:'baseUrl',email:'email',token:'apiToken',project:'projectKey'}[k]];
        if (el && val) el.value = val;
      });
      document.getElementById('btn-load').click();
    }
  }).catch(function(e){
    console.warn('Could not fetch /config:', e.message);
  });
}
