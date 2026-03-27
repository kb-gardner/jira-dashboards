function processIssues(issues, storyPointsField) {
  const byAssignee = {};
  issues.forEach(issue => {
    const f = issue.fields;
    const name = f.assignee?.displayName || 'Unassigned';
    if (excludedPeople.has(name)) return;
    const pts  = parseFloat(f[storyPointsField]) || 0;
    const cat  = { done: 'done', indeterminate: 'inprog', new: 'todo' }[f.status?.statusCategory?.key] || 'todo';
    if (!byAssignee[name]) byAssignee[name] = { name, done:0, inprog:0, todo:0 };
    byAssignee[name][cat] += pts;
    allContributors.add(name);
  });
  return byAssignee;
}

function processBacklog(issues, storyPointsField) {
  const byAssignee = {};
  issues.forEach(issue => {
    const f = issue.fields;
    const name = f.assignee?.displayName || 'Unassigned';
    if (excludedPeople.has(name)) return;
    const pts  = parseFloat(f[storyPointsField]) || 0;
    if (!byAssignee[name]) byAssignee[name] = 0;
    byAssignee[name] += pts;
    allContributors.add(name);
  });
  return byAssignee;
}
