function buildTeamTabs() {
  const teams = getOrderedTeams();
  const tabsContainer = document.getElementById('team-tabs');
  if (teams.length <= 1) { tabsContainer.style.display = 'none'; return; }

  tabsContainer.style.display = 'flex';
  tabsContainer.innerHTML = '';
  teams.forEach(teamName => {
    const btn = document.createElement('button');
    btn.className = 'team-tab';
    btn.textContent = teamName;
    btn.onclick = () => switchTeamTab(teamName);
    tabsContainer.appendChild(btn);
  });

  const defaultTeam = activeTeamTab && teams.includes(activeTeamTab)
    ? activeTeamTab
    : (teams.includes('Technology All') ? 'Technology All' : teams[0]);
  switchTeamTab(defaultTeam);
}

function switchTeamTab(teamName) {
  activeTeamTab = teamName;
  document.querySelectorAll('.team-tab').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === teamName);
  });
  document.querySelectorAll('.team-section').forEach(section => {
    section.style.display = section.dataset.team === teamName ? '' : 'none';
  });
}

function renderDashboard(sprintByPerson, sprintLabel) {
  document.getElementById('sprint-label').textContent = sprintLabel;

  const teams = getOrderedTeams();
  const container = document.getElementById('teams-container');

  // Fixed capacity target for bar scaling (bars overflow past 100% if over 60)
  const globalActiveMax = 60;
  const globalBacklogMax = 60;

  container.innerHTML = teams.map(teamName => {
    const members = getTeamMembers(teamName);

    const activeRows = buildStackedBarRows(members, name => {
      return sprintByPerson[name] || null;
    }, globalActiveMax);

    const backlogRows = buildBarRows(members, name => {
      return backlogByPerson[name] || 0;
    }, '#94A3B8', globalBacklogMax);

    const attentionRows = buildAttentionRows(members, sprintByPerson);

    return `<div class="team-section" data-team="${teamName}">
      <div class="team-section-header">
        <h2>${teamName}</h2>
        <span class="team-member-count">${members.length} member${members.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="team-inner-grid">
        <div class="team-sub-section">
          <div class="team-sub-header">Active Work <span class="bar-legend"><span class="legend-dot" style="background:${BAR_COLORS.done}"></span>Done <span class="legend-dot" style="background:${BAR_COLORS.inprog}"></span>In Progress <span class="legend-dot" style="background:${BAR_COLORS.todo}"></span>To Do</span></div>
          <div class="team-sub-content">${activeRows}</div>
        </div>
        <div class="team-sub-section">
          <div class="team-sub-header">Backlog</div>
          <div class="team-sub-content">${backlogRows}</div>
        </div>
      </div>
      <div class="team-attention">
        <div class="team-attention-header">Needs Attention</div>
        ${attentionRows}
      </div>
    </div>`;
  }).join('');

  buildTeamTabs();
  document.getElementById('last-refreshed').textContent = `Last refreshed: ${new Date().toLocaleString()}`;
}
