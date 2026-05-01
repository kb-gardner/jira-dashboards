// ── Priority view ────────────────────────────────────────────────

const SUBMISSION_OPTIONS = ['', 'Submitted', 'Approved', 'Declined'];

function readDepartmentValue(field) {
  if (field == null) return null;
  if (Array.isArray(field)) return field.map(x => x.value || x.name || x).join(', ');
  if (typeof field === 'object') return field.value || field.name || null;
  return field;
}

function readSubmissionValue(field) {
  if (field == null) return '';
  if (typeof field === 'object') return field.value || field.name || '';
  return field;
}

function readPriorityValue(field) {
  if (field == null || field === '') return null;
  const n = Number(field);
  return Number.isFinite(n) ? n : null;
}

function comparePriorityIssues(a, b) {
  // Nulls sort to the bottom; otherwise ascending priority, then key for stability
  if (a._priority == null && b._priority == null) return a.key.localeCompare(b.key);
  if (a._priority == null) return 1;
  if (b._priority == null) return -1;
  if (a._priority !== b._priority) return a._priority - b._priority;
  return a.key.localeCompare(b.key);
}

function decoratePriorityIssue(cfg, issue) {
  const f = issue.fields;
  return {
    key: issue.key,
    summary: f.summary || '',
    assignee: f.assignee?.displayName || 'Unassigned',
    status: f.status?.name || '',
    statusCategory: f.status?.statusCategory?.key || 'new',
    submission: readSubmissionValue(f[cfg.submissionField]),
    department: readDepartmentValue(f[cfg.departmentField]),
    _priority: readPriorityValue(f[cfg.deptPriorityField]),
  };
}

async function ensureDepartmentList() {
  if (allDepartments.length) return;
  if (!activeCfg || !activeCfg.departmentField) return;
  allDepartments = await getDepartmentOptions(activeCfg);
}

function populateDepartmentSelect() {
  const sel = document.getElementById('priority-dept-select');
  const prev = activeDepartment || loadPref('department');
  sel.innerHTML = '';
  if (!allDepartments.length) {
    const opt = document.createElement('option');
    opt.textContent = '(no departments found)';
    opt.value = '';
    sel.appendChild(opt);
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  allDepartments.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    sel.appendChild(opt);
  });
  if (prev && allDepartments.includes(prev)) {
    sel.value = prev;
    activeDepartment = prev;
  } else {
    activeDepartment = allDepartments[0];
    sel.value = activeDepartment;
  }
  savePref('department', activeDepartment);
}

async function refreshPriorityView() {
  if (!activeCfg) return;
  if (!activeCfg.departmentField || !activeCfg.deptPriorityField) {
    document.getElementById('priority-list').innerHTML =
      `<div class="priority-empty">Required Jira fields not found. Need "Department" and "Department Priority Number".</div>`;
    document.getElementById('priority-meta').textContent = '';
    return;
  }
  await ensureDepartmentList();
  populateDepartmentSelect();
  if (!activeDepartment) {
    document.getElementById('priority-list').innerHTML = '';
    return;
  }
  await loadAndRenderPriorityIssues();
}

async function loadAndRenderPriorityIssues() {
  const listEl = document.getElementById('priority-list');
  listEl.innerHTML = '<div class="priority-loading">Loading...</div>';
  document.getElementById('priority-meta').textContent = '';
  try {
    const issues = await getDepartmentIssues(activeCfg, activeDepartment);
    priorityIssues = issues
      .map(i => decoratePriorityIssue(activeCfg, i))
      .sort(comparePriorityIssues);
    renderPriorityList();
  } catch (e) {
    listEl.innerHTML = `<div class="priority-empty">Error: ${e.message}</div>`;
  }
}

function statusPillClass(category) {
  if (category === 'done') return 'status-pill status-done';
  if (category === 'indeterminate') return 'status-pill status-inprog';
  return 'status-pill status-todo';
}

function submissionPillClass(value) {
  const v = (value || '').toLowerCase();
  if (v === 'approved') return 'submission-pill sub-approved';
  if (v === 'submitted') return 'submission-pill sub-submitted';
  if (v === 'declined') return 'submission-pill sub-declined';
  return 'submission-pill sub-none';
}

function renderPriorityList() {
  const baseUrl = activeCfg.baseUrl.replace(/\/$/, '');
  const listEl = document.getElementById('priority-list');
  const withPri = priorityIssues.filter(i => i._priority != null).length;
  const withoutPri = priorityIssues.length - withPri;
  document.getElementById('priority-meta').textContent =
    `${priorityIssues.length} task${priorityIssues.length !== 1 ? 's' : ''} · ${withPri} prioritized · ${withoutPri} unset`;

  if (!priorityIssues.length) {
    listEl.innerHTML = `<div class="priority-empty">No tasks for ${activeDepartment}</div>`;
    return;
  }

  listEl.innerHTML = `
    <div class="priority-row priority-header">
      <div class="pri-handle"></div>
      <div class="pri-num">#</div>
      <div class="pri-summary">Task</div>
      <div class="pri-assignee">Assignee</div>
      <div class="pri-status">Status</div>
      <div class="pri-submission">Submission</div>
    </div>
    ${priorityIssues.map(i => priorityRowHtml(i, baseUrl)).join('')}
  `;
  attachDragHandlers();
}

function priorityRowHtml(i, baseUrl) {
  const url = `${baseUrl}/browse/${i.key}`;
  const priText = i._priority != null ? i._priority : '—';
  const subLabel = i.submission || '—';
  return `<div class="priority-row" draggable="true" data-key="${i.key}">
    <div class="pri-handle" title="Drag to reorder">⋮⋮</div>
    <div class="pri-num"><span class="pri-num-badge">${priText}</span></div>
    <div class="pri-summary">
      <a href="${url}" target="_blank" rel="noopener">${escapeHtml(i.summary)}</a>
      <span class="pri-key">${i.key}</span>
    </div>
    <div class="pri-assignee">${escapeHtml(i.assignee)}</div>
    <div class="pri-status"><span class="${statusPillClass(i.statusCategory)}">${escapeHtml(i.status)}</span></div>
    <div class="pri-submission"><span class="${submissionPillClass(i.submission)}">${escapeHtml(subLabel)}</span></div>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Drag and drop ────────────────────────────────────────────────
let dragSourceKey = null;

function attachDragHandlers() {
  const rows = document.querySelectorAll('#priority-list .priority-row[draggable="true"]');
  rows.forEach(row => {
    row.addEventListener('dragstart', onDragStart);
    row.addEventListener('dragend', onDragEnd);
    row.addEventListener('dragover', onDragOver);
    row.addEventListener('dragleave', onDragLeave);
    row.addEventListener('drop', onDrop);
  });
}

function onDragStart(e) {
  dragSourceKey = e.currentTarget.dataset.key;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', dragSourceKey); } catch (_) {}
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('#priority-list .priority-row.drop-above, #priority-list .priority-row.drop-below')
    .forEach(el => el.classList.remove('drop-above', 'drop-below'));
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const row = e.currentTarget;
  if (!row.dataset.key || row.dataset.key === dragSourceKey) return;
  const rect = row.getBoundingClientRect();
  const before = (e.clientY - rect.top) < rect.height / 2;
  row.classList.toggle('drop-above', before);
  row.classList.toggle('drop-below', !before);
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drop-above', 'drop-below');
}

async function onDrop(e) {
  e.preventDefault();
  const row = e.currentTarget;
  row.classList.remove('drop-above', 'drop-below');
  const targetKey = row.dataset.key;
  if (!targetKey || !dragSourceKey || targetKey === dragSourceKey) return;

  const rect = row.getBoundingClientRect();
  const dropBefore = (e.clientY - rect.top) < rect.height / 2;

  const sourceIdx = priorityIssues.findIndex(i => i.key === dragSourceKey);
  const targetIdx = priorityIssues.findIndex(i => i.key === targetKey);
  if (sourceIdx === -1 || targetIdx === -1) return;

  const source = priorityIssues[sourceIdx];
  const target = priorityIssues[targetIdx];

  // Pick the neighbor whose priority we copy.
  // dropBefore: drop above target -> adopt target's priority.
  // !dropBefore: drop below target -> adopt next row's priority, or target's if no next row.
  const neighborIdx = dropBefore ? targetIdx : Math.min(targetIdx + 1, priorityIssues.length - 1);
  const neighbor = priorityIssues[neighborIdx];

  let newPri = neighbor._priority;
  if (newPri != null) newPri = Math.max(1, Math.min(20, newPri));

  // Compute the new index after splice to keep visual order matching drop intent.
  const arr = priorityIssues.slice();
  arr.splice(sourceIdx, 1);
  let insertIdx = arr.findIndex(i => i.key === targetKey);
  if (insertIdx === -1) insertIdx = arr.length;
  if (!dropBefore) insertIdx += 1;
  arr.splice(insertIdx, 0, source);

  const prevPri = source._priority;
  const prevOrder = priorityIssues.slice();
  source._priority = newPri;
  priorityIssues = arr;
  renderPriorityList();

  if (newPri === prevPri) return; // visual reorder only, nothing to persist

  try {
    await updateIssuePriority(activeCfg, source.key, activeCfg.deptPriorityField, newPri);
  } catch (err) {
    source._priority = prevPri;
    priorityIssues = prevOrder;
    renderPriorityList();
    alert(`Failed to update priority for ${source.key}: ${err.message}`);
  }
}

// Department select change
document.getElementById('priority-dept-select').addEventListener('change', async (e) => {
  activeDepartment = e.target.value;
  savePref('department', activeDepartment);
  await loadAndRenderPriorityIssues();
});
