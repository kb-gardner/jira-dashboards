function setLoadingMsg(msg) { document.getElementById('loading-msg').textContent = msg; }

function showLoading(on) {
  document.getElementById('loading-overlay').style.display = on ? 'flex' : 'none';
  if (on) document.getElementById('dashboard').style.display = 'none';
}

function showError(msg) {
  const el = document.getElementById('config-error');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('config-banner').style.display = 'block';
  document.getElementById('loading-overlay').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
}
