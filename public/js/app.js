// ── Load from Jira ───────────────────────────────────────────────

async function loadAll(cfg, opts = {}) {
  const { preserveSelection = false } = opts;
  const prevBoardId = preserveSelection ? activeBoardId : null;
  const prevSprintId = preserveSelection ? activeSprintId : null;
  const prevTeamTab = preserveSelection ? activeTeamTab : null;
  const prevDepartment = preserveSelection ? activeDepartment : null;

  issuesCache = {}; backlogByPerson = {}; backlogIssuesRaw = [];
  allBoards = []; sprintsByBoard = {};
  activeSprintId = null; activeBoardId = null;
  allContributors = new Set(); teamsByPerson = {}; allTeamNames = [];
  accountIdToName = {}; activeTeamTab = preserveSelection ? prevTeamTab : null; excludedPeople = new Set();
  priorityIssues = []; allDepartments = [];

  // Auto-detect Jira fields
  const fieldIds = await discoverFields(cfg);
  cfg.storyPointsFields = fieldIds.storyPoints;
  cfg.deptPriorityField = fieldIds.deptPriority;
  cfg.submissionField   = fieldIds.submission;
  cfg.departmentField   = fieldIds.department;

  // Load all scrum boards
  allBoards = await getBoards(cfg);
  if (!allBoards.length) throw new Error(`No scrum boards found for project "${cfg.projectKey}"`);

  // Pick initial board: preserved > env override > saved > first
  const envBoardId = (serverConfig && serverConfig.boardId) || cfg.boardId;
  const savedBoardId = loadPref('boardId');
  let initialBoard =
    (prevBoardId && allBoards.find(b => b.id === prevBoardId)) ||
    (envBoardId && allBoards.find(b => String(b.id) === String(envBoardId))) ||
    (savedBoardId && allBoards.find(b => String(b.id) === savedBoardId)) ||
    allBoards[0];
  activeBoardId = initialBoard.id;
  savePref('boardId', initialBoard.id);
  console.log('[boards] using:', `${initialBoard.name} (id=${initialBoard.id})`);

  // Sprints for the chosen board
  const sprints = await getSprints(cfg, activeBoardId);
  sprintsByBoard[activeBoardId] = sprints;
  activeSprints = sprints;

  // Project-wide loads (members, teams, backlog) — don't depend on board
  await getProjectMembers(cfg);
  await loadTeams(cfg);
  const backlogIssues = await getBacklog(cfg, activeBoardId);
  backlogIssuesRaw = backlogIssues;
  backlogByPerson = processBacklog(backlogIssues, cfg.storyPointsFields);

  buildBoardTabs();

  if (sprints.length) {
    // Pick the sprint: preserved > per-board saved > active > first
    const perBoardKey = 'sprintId:' + activeBoardId;
    const perBoardSaved = loadPref(perBoardKey);
    const globalSaved = loadPref('sprintId');
    let firstSprint =
      (prevSprintId && sprints.find(s => String(s.id) === String(prevSprintId))) ||
      (perBoardSaved && sprints.find(s => String(s.id) === perBoardSaved)) ||
      (globalSaved && sprints.find(s => String(s.id) === globalSaved)) ||
      sprints.find(s => s.state === 'active') ||
      sprints[0];

    activeSprintId = firstSprint.id;
    savePref('sprintId', firstSprint.id);
    savePref(perBoardKey, firstSprint.id);

    issuesCache[firstSprint.id] = await getIssues(cfg, activeBoardId, firstSprint.id);
    const sprintByPerson = processIssues(issuesCache[firstSprint.id], cfg.storyPointsFields);

    const dates = firstSprint.startDate ? ` · ${firstSprint.startDate.slice(0,10)} – ${firstSprint.endDate.slice(0,10)}` : '';
    renderDashboard(sprintByPerson, firstSprint.name + dates);
    buildSprintSelector(sprints);
  } else {
    document.getElementById('sprint-selector').innerHTML =
      '<span class="sprint-empty">No sprints on this board</span>';
    document.getElementById('teams-container').innerHTML = '';
    document.getElementById('sprint-label').textContent = '—';
  }

  // Restore top tab; if priority, refresh that view
  const savedTopTab = loadPref('topTab') || 'capacity';
  setTopTab(savedTopTab);

  if (savedTopTab === 'priority') {
    const savedDept = prevDepartment || loadPref('department');
    if (savedDept) activeDepartment = savedDept;
    await refreshPriorityView();
  }
}

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
    activeCfg = cfg;
    await loadAll(cfg);
    showLoading(false);
    document.getElementById('dashboard').style.display = 'block';
  } catch(e) {
    showError(e.message);
  } finally {
    btn.disabled = false;
  }
});

async function refreshCurrentView() {
  if (!activeCfg) return;
  if (activeTopTab === 'priority') {
    // Re-pull department list too so newly added departments show up
    allDepartments = [];
    await refreshPriorityView();
    document.getElementById('last-refreshed').textContent = `Last refreshed: ${new Date().toLocaleString()}`;
    return;
  }
  // Capacity tab: refresh just the active sprint + backlog
  if (activeSprintId == null) return;
  setLoadingMsg('Refreshing current sprint...');
  const [sprintIssues, backlogIssues] = await Promise.all([
    getIssues(activeCfg, activeBoardId, activeSprintId),
    getBacklog(activeCfg, activeBoardId),
  ]);
  issuesCache[activeSprintId] = sprintIssues;
  backlogIssuesRaw = backlogIssues;
  backlogByPerson = processBacklog(backlogIssues, activeCfg.storyPointsFields);

  const sprint = (activeSprints || []).find(s => String(s.id) === String(activeSprintId));
  const dates = sprint && sprint.startDate
    ? ` · ${sprint.startDate.slice(0,10)} – ${sprint.endDate.slice(0,10)}`
    : '';
  const label = sprint ? sprint.name + dates : '';
  const sprintByPerson = processIssues(sprintIssues, activeCfg.storyPointsFields);
  renderDashboard(sprintByPerson, label);
}

document.getElementById('btn-refresh').addEventListener('click', async () => {
  if (!activeCfg) return;
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Refreshing...';
  showLoading(true);
  try {
    await refreshCurrentView();
  } catch (e) {
    showError(e.message);
    return;
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
    showLoading(false);
    document.getElementById('dashboard').style.display = 'block';
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
