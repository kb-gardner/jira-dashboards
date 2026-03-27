function getTeamMembers(teamName) {
  const members = [];
  allContributors.forEach(name => {
    const personTeams = teamsByPerson[name];
    if (teamName === 'No Team') {
      if (!personTeams || personTeams.length === 0) members.push(name);
    } else {
      if (personTeams && personTeams.includes(teamName)) members.push(name);
    }
  });
  return members.sort((a, b) => a.localeCompare(b));
}

function getOrderedTeams() {
  const teams = [...allTeamNames];
  const hasUnteamed = [...allContributors].some(name => !teamsByPerson[name] || teamsByPerson[name].length === 0);
  if (hasUnteamed) teams.push('No Team');
  return teams;
}

function buildBarRows(members, valueFn, barColor, maxVal) {
  if (!members.length) return '<div class="bar-empty">No members</div>';
  return members.map(name => {
    const val = valueFn(name);
    const pct = val > 0 ? Math.max((val / maxVal) * 100, 2) : 0;
    return `<div class="bar-row" data-person="${name}">
      <div class="bar-label" title="${name}">${name}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <div class="bar-value">${fmt(val)} pts</div>
    </div>`;
  }).join('');
}

function buildStackedBarRows(members, dataFn, maxVal) {
  if (!members.length) return '<div class="bar-empty">No members</div>';
  return members.map(name => {
    const d = dataFn(name);
    const done = d ? d.done : 0;
    const inprog = d ? d.inprog : 0;
    const todo = d ? d.todo : 0;
    const total = done + inprog + todo;
    const totalPct = total > 0 ? Math.max((total / maxVal) * 100, 2) : 0;

    let segments = '';
    if (total > 0) {
      const donePct = (done / total) * 100;
      const inprogPct = (inprog / total) * 100;
      const todoPct = (todo / total) * 100;
      if (done > 0)   segments += `<div class="bar-segment" style="width:${donePct}%;background:${BAR_COLORS.done}" title="Done: ${fmt(done)} pts"></div>`;
      if (inprog > 0) segments += `<div class="bar-segment" style="width:${inprogPct}%;background:${BAR_COLORS.inprog}" title="In Progress: ${fmt(inprog)} pts"></div>`;
      if (todo > 0)   segments += `<div class="bar-segment" style="width:${todoPct}%;background:${BAR_COLORS.todo}" title="To Do: ${fmt(todo)} pts"></div>`;
    }

    return `<div class="bar-row" data-person="${name}">
      <div class="bar-label" title="${name}">${name}</div>
      <div class="bar-track">
        <div class="bar-fill-stacked" style="width:${totalPct}%">${segments}</div>
      </div>
      <div class="bar-value">${fmt(total)} pts</div>
    </div>`;
  }).join('');
}

function buildAttentionRows(members, sprintByPerson) {
  const items = [];
  members.forEach(name => {
    const backlogPts = backlogByPerson[name] || 0;
    const d = sprintByPerson[name];
    const sprintTotal = d ? d.done + d.inprog + d.todo : 0;

    if (backlogPts === 0 && sprintTotal === 0) {
      items.push({ name, reasons: ['No backlog', 'Nothing in sprint'], detail: 'no work assigned' });
    } else if (backlogPts === 0) {
      items.push({ name, reasons: ['No backlog'], detail: `${fmt(sprintTotal)} pts in sprint` });
    } else if (sprintTotal === 0) {
      items.push({ name, reasons: ['Nothing in sprint'], detail: `${fmt(backlogPts)} pts in backlog` });
    }
  });

  if (items.length === 0) return '<div class="attention-ok">Everyone looks good</div>';
  return items.map(item => `
    <div class="risk-item">
      <div>
        <div class="risk-name">${item.name}</div>
        <div class="risk-detail">${item.detail}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${item.reasons.map(r => `<span class="risk-reason">${r}</span>`).join('')}</div>
    </div>`).join('');
}
