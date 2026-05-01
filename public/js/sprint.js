async function selectSprint(sprint, btnEl) {
  document.querySelectorAll('.sprint-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  if (!issuesCache[sprint.id]) {
    showLoading(true);
    try { issuesCache[sprint.id] = await getIssues(activeCfg, activeBoardId, sprint.id); }
    catch(e) { showError(e.message); return; }
    finally { showLoading(false); document.getElementById('dashboard').style.display = 'block'; }
  }
  activeSprintId = sprint.id;
  savePref('sprintId', sprint.id);
  const sprintByPerson = processIssues(issuesCache[sprint.id], activeCfg.storyPointsFields);
  const dates = sprint.startDate ? ` · ${sprint.startDate.slice(0,10)} – ${sprint.endDate.slice(0,10)}` : '';
  renderDashboard(sprintByPerson, sprint.name + dates);
}

function buildSprintSelector(sprints) {
  const sel = document.getElementById('sprint-selector');
  sel.innerHTML = '';
  const activeIdx = sprints.findIndex(s => String(s.id) === String(activeSprintId));
  const fallbackIdx = sprints.findIndex(s => s.state === 'active');
  const defaultIdx = activeIdx >= 0 ? activeIdx : (fallbackIdx >= 0 ? fallbackIdx : 0);
  sprints.forEach((sp, i) => {
    const btn = document.createElement('button');
    btn.className = 'sprint-btn' + (sp.state === 'future' ? ' future' : '') + (i === defaultIdx ? ' active' : '');
    btn.textContent = sp.name;
    btn.title = sp.name;
    btn.onclick = () => selectSprint(sp, btn);
    sel.appendChild(btn);
  });
}
