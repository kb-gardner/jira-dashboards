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
  attachInlineEditHandlers();
}

function priorityRowHtml(i, baseUrl) {
  const url = `${baseUrl}/browse/${i.key}`;
  const priText = i._priority != null ? i._priority : '—';
  const subLabel = i.submission || '—';
  return `<div class="priority-row" draggable="true" data-key="${i.key}">
    <div class="pri-handle" title="Drag to reorder">⋮⋮</div>
    <div class="pri-num"><span class="pri-num-badge editable" title="Click to edit priority">${priText}</span></div>
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

  // Compute final insert index in the post-splice array.
  let insertIdx = dropBefore ? targetIdx : targetIdx + 1;
  if (insertIdx > sourceIdx) insertIdx -= 1;
  if (insertIdx === sourceIdx) return; // no movement

  await applyMove(sourceIdx, insertIdx);
}

// Cascade rule:
//   - Source ADOPTS the priority of the row it lands next to (the row that gets
//     displaced by the insertion): the post-splice neighbor at toIdx+1 (move up)
//     or toIdx-1 (move down).
//   - Every skipped row shifts by 1 in the opposite direction:
//     move up   → skipped rows [toIdx+1 .. fromIdx] each +1
//     move down → skipped rows [fromIdx .. toIdx-1] each -1 (clamped to >= 1)
//   - Rows with null priority are not changed and don't contribute to adoption.
async function applyMove(fromIdx, toIdx) {
  const arr = priorityIssues.slice();
  const source = arr[fromIdx];
  arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, source);

  // Snapshot original priorities so the cascade reads pre-move values.
  const oldP = new Map();
  priorityIssues.forEach(i => oldP.set(i.key, i._priority));

  const updates = [];

  if (toIdx < fromIdx) {
    const adoptFrom = arr[toIdx + 1];
    const adopted = oldP.get(adoptFrom.key);
    if (adopted !== oldP.get(source.key)) {
      updates.push({ issue: source, oldP: oldP.get(source.key), newP: adopted });
    }
    for (let k = toIdx + 1; k <= fromIdx; k++) {
      const item = arr[k];
      const cur = oldP.get(item.key);
      if (cur == null) continue;
      updates.push({ issue: item, oldP: cur, newP: cur + 1 });
    }
  } else if (toIdx > fromIdx) {
    const adoptFrom = arr[toIdx - 1];
    const adopted = oldP.get(adoptFrom.key);
    if (adopted !== oldP.get(source.key)) {
      updates.push({ issue: source, oldP: oldP.get(source.key), newP: adopted });
    }
    for (let k = fromIdx; k < toIdx; k++) {
      const item = arr[k];
      const cur = oldP.get(item.key);
      if (cur == null) continue;
      const newP = Math.max(1, cur - 1);
      if (newP !== cur) {
        updates.push({ issue: item, oldP: cur, newP });
      }
    }
  }

  // Optimistic state — apply updates and reorder.
  const prevOrder = priorityIssues.slice();
  const prevPriorities = updates.map(u => ({ issue: u.issue, p: u.oldP }));
  updates.forEach(u => { u.issue._priority = u.newP; });
  priorityIssues = arr;
  renderPriorityList();

  if (!updates.length) return;

  try {
    for (const u of updates) {
      await updateIssuePriority(activeCfg, u.issue.key, activeCfg.deptPriorityField, u.newP);
    }
  } catch (err) {
    prevPriorities.forEach(p => { p.issue._priority = p.p; });
    priorityIssues = prevOrder;
    renderPriorityList();
    alert(`Failed to update priorities: ${err.message}`);
  }
}

// ── Inline priority edit ─────────────────────────────────────────

function attachInlineEditHandlers() {
  document.querySelectorAll('#priority-list .pri-num-badge.editable').forEach(badge => {
    badge.addEventListener('click', onPriorityBadgeClick);
    badge.addEventListener('mousedown', e => e.stopPropagation());
  });
}

function onPriorityBadgeClick(e) {
  e.stopPropagation();
  const badge = e.currentTarget;
  const row = badge.closest('.priority-row');
  if (!row) return;
  const key = row.dataset.key;
  const issue = priorityIssues.find(i => i.key === key);
  if (!issue) return;

  // Make the row not draggable while editing
  row.setAttribute('draggable', 'false');

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'pri-num-input';
  input.value = issue._priority != null ? String(issue._priority) : '';
  input.placeholder = '—';
  input.min = '1';
  input.step = '1';

  badge.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  let cancelled = false;

  const finish = async () => {
    if (done) return;
    done = true;
    if (cancelled) {
      renderPriorityList();
      return;
    }
    const raw = input.value.trim();
    let newP = null;
    if (raw !== '') {
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n) || n < 1) {
        alert('Priority must be a positive integer (or empty to clear).');
        renderPriorityList();
        return;
      }
      newP = n;
    }
    if (newP === issue._priority) {
      renderPriorityList();
      return;
    }
    const oldP = issue._priority;
    issue._priority = newP;
    priorityIssues.sort(comparePriorityIssues);
    renderPriorityList();
    try {
      await updateIssuePriority(activeCfg, issue.key, activeCfg.deptPriorityField, newP);
    } catch (err) {
      issue._priority = oldP;
      priorityIssues.sort(comparePriorityIssues);
      renderPriorityList();
      alert(`Failed to update ${issue.key}: ${err.message}`);
    }
  };

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
    else if (ev.key === 'Escape') { cancelled = true; input.blur(); }
  });
  input.addEventListener('blur', finish);
  input.addEventListener('mousedown', (ev) => ev.stopPropagation());
  input.addEventListener('click', (ev) => ev.stopPropagation());
}

// Department select change
document.getElementById('priority-dept-select').addEventListener('change', async (e) => {
  activeDepartment = e.target.value;
  savePref('department', activeDepartment);
  await loadAndRenderPriorityIssues();
});
