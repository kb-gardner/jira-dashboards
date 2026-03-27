document.getElementById('btn-demo').addEventListener('click', () => {
  document.getElementById('config-error').style.display = 'none';
  document.getElementById('config-banner').style.display = 'none';
  activeCfg = {};
  allContributors = new Set(); teamsByPerson = {}; allTeamNames = [];
  accountIdToName = {}; activeTeamTab = null; excludedPeople = new Set();
  backlogIssuesRaw = []; activeSprintId = null;

  backlogByPerson = {
    'Kyle Jensen':     5,  'Josiah Hepworth': 12, 'Maria Torres': 8,
    'Devon Park':      0,  'Lena Vo':         15, 'Arjun Mehta':  3,
    'Nia Williams':    10,
  };

  // Demo team assignments (some on multiple teams)
  teamsByPerson = {
    'Kyle Jensen':     ['Engineering'],
    'Josiah Hepworth': ['Engineering'],
    'Maria Torres':    ['Engineering', 'Mobile'],
    'Devon Park':      ['QA'],
    'Lena Vo':         ['Engineering'],
    'Arjun Mehta':     ['Platform'],
    'Nia Williams':    ['Platform', 'QA'],
  };
  allTeamNames = ['Engineering', 'Mobile', 'Platform', 'QA'];

  Object.keys(backlogByPerson).forEach(n => allContributors.add(n));

  const demos = [
    { id:'d22', name:'Sprint 22', state:'closed', startDate:'2025-02-03', endDate:'2025-02-14',
      employees:[
        {name:'Kyle Jensen',    done:12,inprog:2,todo:0},
        {name:'Josiah Hepworth',done:9, inprog:3,todo:1},
        {name:'Maria Torres',   done:7, inprog:2,todo:3},
        {name:'Devon Park',     done:10,inprog:1,todo:0},
        {name:'Lena Vo',        done:6, inprog:4,todo:2},
      ]},
    { id:'d23', name:'Sprint 23', state:'closed', startDate:'2025-02-17', endDate:'2025-02-28',
      employees:[
        {name:'Kyle Jensen',    done:11,inprog:1,todo:0},
        {name:'Josiah Hepworth',done:10,inprog:2,todo:0},
        {name:'Maria Torres',   done:8, inprog:3,todo:1},
        {name:'Devon Park',     done:10,inprog:0,todo:0},
        {name:'Lena Vo',        done:5, inprog:2,todo:4},
        {name:'Arjun Mehta',    done:9, inprog:2,todo:1},
      ]},
    { id:'d24', name:'Sprint 24', state:'active', startDate:'2025-03-03', endDate:'2025-03-14',
      employees:[
        {name:'Kyle Jensen',    done:10,inprog:2,todo:1},
        {name:'Josiah Hepworth',done:8, inprog:4,todo:0},
        {name:'Maria Torres',   done:5, inprog:2,todo:5},
        {name:'Devon Park',     done:10,inprog:0,todo:2},
        {name:'Lena Vo',        done:3, inprog:3,todo:6},
        {name:'Arjun Mehta',    done:12,inprog:1,todo:0},
        {name:'Nia Williams',   done:7, inprog:2,todo:3},
      ]},
    { id:'d25', name:'Sprint 25', state:'future', startDate:'2025-03-17', endDate:'2025-03-28',
      employees:[
        {name:'Kyle Jensen',    done:0,inprog:0,todo:8},
        {name:'Josiah Hepworth',done:0,inprog:0,todo:6},
        {name:'Maria Torres',   done:0,inprog:0,todo:10},
        {name:'Devon Park',     done:0,inprog:0,todo:5},
        {name:'Arjun Mehta',    done:0,inprog:0,todo:7},
      ]},
  ];

  demos.forEach(sp => sp.employees.forEach(e => allContributors.add(e.name)));

  // Generate synthetic Jira-like issues for each demo sprint so the modal works
  const demoTasks = ['Implement API endpoint','Fix login validation','Update dashboard UI','Write unit tests','Refactor data layer',
    'Add error handling','Optimize query performance','Create migration script','Update documentation','Fix pagination bug',
    'Add caching layer','Improve search filters','Setup CI pipeline','Review pull requests','Design system updates'];
  let demoIssueNum = 100;
  const statusMap = {
    done:   { name: 'Done',        statusCategory: { key: 'done' } },
    inprog: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
    todo:   { name: 'To Do',       statusCategory: { key: 'new' } },
  };
  const spField = activeCfg.storyPointsField || 'customfield_10038';

  function generateDemoIssues(employees) {
    const issues = [];
    employees.forEach(emp => {
      ['done','inprog','todo'].forEach(cat => {
        let remaining = emp[cat];
        while (remaining > 0) {
          const pts = Math.min(remaining, Math.ceil(Math.random() * 3));
          issues.push({
            key: `DEMO-${demoIssueNum++}`,
            fields: {
              summary: demoTasks[Math.floor(Math.random() * demoTasks.length)],
              assignee: { displayName: emp.name },
              status: statusMap[cat],
              [spField]: pts,
            },
          });
          remaining -= pts;
        }
      });
    });
    return issues;
  }

  issuesCache = {};
  demos.forEach(sp => { issuesCache[sp.id] = generateDemoIssues(sp.employees); });

  // Generate synthetic backlog issues
  backlogIssuesRaw = Object.entries(backlogByPerson).flatMap(([name, pts]) => {
    const issues = [];
    let remaining = pts;
    while (remaining > 0) {
      const p = Math.min(remaining, Math.ceil(Math.random() * 3));
      issues.push({
        key: `DEMO-${demoIssueNum++}`,
        fields: {
          summary: demoTasks[Math.floor(Math.random() * demoTasks.length)],
          assignee: { displayName: name },
          status: statusMap.todo,
          [spField]: p,
        },
      });
      remaining -= p;
    }
    return issues;
  });

  function toMap(employees) {
    const m = {};
    employees.forEach(e => { m[e.name] = e; });
    return m;
  }

  function renderDemoSprint(sp) {
    activeSprintId = sp.id;
    renderDashboard(toMap(sp.employees), `${sp.name} · ${sp.startDate} – ${sp.endDate}`);
  }

  const sel = document.getElementById('sprint-selector');
  sel.innerHTML = '';
  const activeDemo = demos.findIndex(s => s.state === 'active');
  const defaultDemo = activeDemo >= 0 ? activeDemo : demos.length - 1;
  demos.forEach((sp, i) => {
    const btn = document.createElement('button');
    btn.className = 'sprint-btn' + (sp.state === 'future' ? ' future' : '') + (i === defaultDemo ? ' active' : '');
    btn.textContent = sp.name;
    btn.onclick = () => {
      document.querySelectorAll('.sprint-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDemoSprint(sp);
    };
    sel.appendChild(btn);
  });

  renderDemoSprint(demos[defaultDemo]);
  document.getElementById('dashboard').style.display = 'block';
});
