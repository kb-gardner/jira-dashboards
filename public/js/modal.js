document.getElementById('teams-container').addEventListener('click', e => {
  const row = e.target.closest('.bar-row[data-person]');
  if (!row) return;
  showPersonModal(row.dataset.person);
});

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('person-modal').classList.remove('open');
});
document.getElementById('person-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('person-modal').classList.remove('open');
});

function getPersonIssues(name) {
  const spField = (activeCfg && activeCfg.storyPointsField) || 'customfield_10038';
  const baseUrl = activeCfg ? activeCfg.baseUrl.replace(/\/$/, '') : '';

  const sprintIssues = (issuesCache[activeSprintId] || [])
    .filter(i => (i.fields.assignee?.displayName || 'Unassigned') === name && !excludedPeople.has(name));
  const categorized = { done: [], inprog: [], todo: [] };
  sprintIssues.forEach(i => {
    const f = i.fields;
    const cat = { done: 'done', indeterminate: 'inprog', new: 'todo' }[f.status?.statusCategory?.key] || 'todo';
    categorized[cat].push({
      key: i.key,
      summary: f.summary || '',
      pts: parseFloat(f[spField]) || 0,
      status: f.status?.name || '',
      url: baseUrl ? `${baseUrl}/browse/${i.key}` : '',
    });
  });

  const backlog = backlogIssuesRaw
    .filter(i => (i.fields.assignee?.displayName || 'Unassigned') === name && !excludedPeople.has(name))
    .map(i => {
      const f = i.fields;
      return {
        key: i.key,
        summary: f.summary || '',
        pts: parseFloat(f[spField]) || 0,
        status: f.status?.name || '',
        url: baseUrl ? `${baseUrl}/browse/${i.key}` : '',
      };
    });

  return { categorized, backlog };
}

function buildIssueTable(issues) {
  if (!issues.length) return '<div class="modal-empty">None</div>';
  const rows = issues.map(i => {
    const keyCell = i.url
      ? `<td class="col-key"><a href="${i.url}" target="_blank" rel="noopener">${i.key}</a></td>`
      : `<td class="col-key">${i.key}</td>`;
    return `<tr>${keyCell}<td>${i.summary}</td><td class="col-pts">${fmt(i.pts)}</td></tr>`;
  }).join('');
  const total = issues.reduce((s, i) => s + i.pts, 0);
  return `<table class="modal-table">
    <thead><tr><th>Key</th><th>Summary</th><th>Pts</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td></td><td style="text-align:right;font-weight:600;font-size:12px;color:var(--muted)">Total</td><td class="col-pts" style="font-weight:600">${fmt(total)}</td></tr></tfoot>
  </table>`;
}

function showPersonModal(name) {
  const { categorized, backlog } = getPersonIssues(name);
  document.getElementById('modal-person-name').textContent = name;

  const sections = [
    { title: 'Done', color: BAR_COLORS.done, issues: categorized.done },
    { title: 'In Progress', color: BAR_COLORS.inprog, issues: categorized.inprog },
    { title: 'To Do', color: BAR_COLORS.todo, issues: categorized.todo },
    { title: 'Backlog', color: '#94A3B8', issues: backlog },
  ];

  document.getElementById('modal-body').innerHTML = sections.map(s => {
    const pts = s.issues.reduce((sum, i) => sum + i.pts, 0);
    return `<div class="modal-section">
      <div class="modal-section-title">
        <span class="modal-section-dot" style="background:${s.color}"></span>
        ${s.title}
        <span class="modal-section-pts">${fmt(pts)} pts &middot; ${s.issues.length} issue${s.issues.length !== 1 ? 's' : ''}</span>
      </div>
      ${buildIssueTable(s.issues)}
    </div>`;
  }).join('');

  document.getElementById('person-modal').classList.add('open');
}
