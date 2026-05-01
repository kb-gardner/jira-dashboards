const DEFAULTS = {
  baseUrl:          '',
  email:            '',
  apiToken:         '',
  projectKey:       '',
  corsProxy:        '/proxy/',
  storyPointsField: 'customfield_10038',
  orgId:            '',
  siteId:           '',
};

function fmt(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }

const BAR_COLORS = { done: '#22C55E', inprog: '#F59E0B', todo: '#CBD5E1' };

// ── Global state ─────────────────────────────────────────────────

let activeCfg = null, activeBoardId = null, issuesCache = {};
let allBoards = [];             // [{id, name, type}, ...] - scrum boards only
let sprintsByBoard = {};        // { boardId: [sprints...] }
let backlogByPerson = {};       // { name: pts }
let backlogIssuesRaw = [];      // raw backlog issues for modal detail
let activeSprintId = null;      // currently displayed sprint id
let activeSprints = [];         // sprints for the currently active board
let allContributors = new Set();
let teamsByPerson = {};         // { personName: ['Team A', 'Team B'] }
let allTeamNames = [];          // sorted team names
let accountIdToName = {};       // { accountId: displayName } for team member resolution
let activeTeamTab = null;       // currently selected team tab
let excludedPeople = new Set(); // members of "non dashboard" team
let serverConfig = null;        // populated from /config endpoint

// Priority view state
let activeTopTab = 'capacity';  // 'capacity' | 'priority'
let activeDepartment = null;    // currently selected department in priority view
let allDepartments = [];        // discovered department option values
let priorityIssues = [];        // issues for current department, sorted

// ── Preferences (localStorage) ───────────────────────────────────
function savePref(key, val) {
  try {
    if (val === null || val === undefined) localStorage.removeItem('dash:' + key);
    else localStorage.setItem('dash:' + key, String(val));
  } catch (e) { /* ignore */ }
}
function loadPref(key) {
  try { return localStorage.getItem('dash:' + key); } catch (e) { return null; }
}
