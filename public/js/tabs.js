function setTopTab(tabName) {
  if (tabName !== 'capacity' && tabName !== 'priority') tabName = 'capacity';
  activeTopTab = tabName;
  savePref('topTab', tabName);

  document.querySelectorAll('.top-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.topTab === tabName);
  });
  document.getElementById('capacity-view').style.display = tabName === 'capacity' ? '' : 'none';
  document.getElementById('priority-view').style.display = tabName === 'priority' ? '' : 'none';
}

document.querySelectorAll('.top-tab').forEach(btn => {
  btn.addEventListener('click', async () => {
    const tab = btn.dataset.topTab;
    setTopTab(tab);
    if (tab === 'priority') {
      await refreshPriorityView();
    }
  });
});
