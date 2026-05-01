// ── Board tab logic ──────────────────────────────────────────────

function buildBoardTabs() {
  const container = document.getElementById('board-tabs');
  if (!allBoards.length) { container.style.display = 'none'; return; }
  if (allBoards.length === 1) {
    // No need to show tabs if there's only one board
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  container.innerHTML = '';
  allBoards.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'board-tab' + (b.id === activeBoardId ? ' active' : '');
    btn.textContent = b.name;
    btn.title = b.name;
    btn.dataset.boardId = b.id;
    btn.onclick = () => selectBoard(b.id);
    container.appendChild(btn);
  });
}

async function selectBoard(boardId) {
  if (boardId === activeBoardId) return;
  activeBoardId = boardId;
  savePref('boardId', boardId);
  document.querySelectorAll('.board-tab').forEach(btn => {
    btn.classList.toggle('active', String(btn.dataset.boardId) === String(boardId));
  });

  showLoading(true);
  try {
    if (!sprintsByBoard[boardId]) {
      sprintsByBoard[boardId] = await getSprints(activeCfg, boardId);
    }
    activeSprints = sprintsByBoard[boardId];
    if (!activeSprints.length) {
      document.getElementById('sprint-selector').innerHTML =
        '<span class="sprint-empty">No sprints on this board</span>';
      document.getElementById('teams-container').innerHTML = '';
      document.getElementById('team-tabs').style.display = 'none';
      document.getElementById('sprint-label').textContent = '—';
      return;
    }

    // Pick a sprint: per-board saved > active > first
    const savedKey = 'sprintId:' + boardId;
    const savedSprintId = loadPref(savedKey);
    let sprint =
      (savedSprintId && activeSprints.find(s => String(s.id) === savedSprintId)) ||
      activeSprints.find(s => s.state === 'active') ||
      activeSprints[0];

    activeSprintId = sprint.id;
    savePref('sprintId', sprint.id);
    savePref(savedKey, sprint.id);

    if (!issuesCache[sprint.id]) {
      issuesCache[sprint.id] = await getIssues(activeCfg, boardId, sprint.id);
    }
    const sprintByPerson = processIssues(issuesCache[sprint.id], activeCfg.storyPointsFields);
    const dates = sprint.startDate ? ` · ${sprint.startDate.slice(0,10)} – ${sprint.endDate.slice(0,10)}` : '';
    renderDashboard(sprintByPerson, sprint.name + dates);
    buildSprintSelector(activeSprints);
  } catch (e) {
    showError(e.message);
    return;
  } finally {
    showLoading(false);
    document.getElementById('dashboard').style.display = 'block';
  }
}
