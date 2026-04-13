function getStoryPoints(fields, storyPointsFields) {
  for (const fieldId of storyPointsFields) {
    const val = parseFloat(fields[fieldId]);
    if (val > 0) return val;
  }
  return 0;
}

function processIssues(issues, storyPointsFields) {
  const byAssignee = {};
  issues.forEach(issue => {
    const f = issue.fields;
    const name = f.assignee?.displayName || 'Unassigned';
    if (excludedPeople.has(name)) return;
    const pts  = getStoryPoints(f, storyPointsFields);
    const cat  = { done: 'done', indeterminate: 'inprog', new: 'todo' }[f.status?.statusCategory?.key] || 'todo';
    if (!byAssignee[name]) byAssignee[name] = { name, done:0, inprog:0, todo:0 };
    byAssignee[name][cat] += pts;
    allContributors.add(name);
  });
  console.log('DIAG processIssues result:', JSON.stringify(byAssignee));
  console.log('DIAG excludedPeople:', [...excludedPeople]);
  return byAssignee;
}

function processBacklog(issues, storyPointsFields) {
  const byAssignee = {};
  issues.forEach(issue => {
    const f = issue.fields;
    const name = f.assignee?.displayName || 'Unassigned';
    if (excludedPeople.has(name)) return;
    const pts  = getStoryPoints(f, storyPointsFields);
    if (!byAssignee[name]) byAssignee[name] = 0;
    byAssignee[name] += pts;
    allContributors.add(name);
  });
  return byAssignee;
}
