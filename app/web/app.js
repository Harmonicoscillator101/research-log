/* 科研日志 —— 界面逻辑（无框架、无构建步骤） */
(() => {
  'use strict';

  // ---------------------------------------------------------------- 常量

  const STATUS = {
    planned: { label: '未来', color: 'var(--planned)' },
    active: { label: '进行中', color: 'var(--active)' },
    paused: { label: '暂停', color: 'var(--paused)' },
    done: { label: '已完成', color: 'var(--done)' },
  };

  const COLUMNS = [
    { status: 'planned', title: '未来', empty: '把还没启动的想法放这里' },
    { status: 'active', title: '进行中', empty: '把在做的项目拖到这里' },
    { status: 'done', title: '已完成', empty: '完成的项目会留在这里' },
  ];

  // ---------------------------------------------------------------- 状态

  const S = {
    doc: null,
    rev: 0,
    dataPath: '',
    selected: null,
    view: 'board',
    focusMs: null,
    filter: 'all',
    query: '',
    expanded: new Set(),
    dateEdit: null,
    undo: [],
    saveTimer: null,
    saving: false,
    dirty: false,
    editSeq: 0,
    pendingFocus: null,
    booted: false,
  };

  let dragPid = null;
  let suppressClick = false;

  // ---------------------------------------------------------------- 工具

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (value) =>
    String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));

  const uid = (prefix) =>
    prefix + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);

  const multiline = (value) => esc(value).replace(/\n/g, '<br>');

  function pad(n) { return String(n).padStart(2, '0'); }

  function iso(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const hh = pad(Math.floor(Math.abs(offset) / 60));
    const mm = pad(Math.abs(offset) % 60);
    return local.toISOString().slice(0, 19) + `${sign}${hh}:${mm}`;
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function toDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function fmtShort(value) {
    const d = toDate(value);
    if (!d) return '';
    const now = new Date();
    if (d.getFullYear() === now.getFullYear()) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  function fmtLogTime(value) {
    const d = toDate(value);
    if (!d) return '';
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
      : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtStamp(value) {
    const d = toDate(value);
    if (!d) return String(value || '').slice(0, 16).replace('T', ' ');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function parseDay(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function fmtDay(value) {
    const date = value instanceof Date ? value : parseDay(value);
    if (!date) return '';
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fmtFullDay(value) {
    const date = value instanceof Date ? value : parseDay(value);
    if (!date) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function startOfDay(value) {
    const date = toDate(value);
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function dayDiff(a, b) {
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }

  function relDate(value) {
    const d = toDate(value);
    if (!d) return '';
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (days <= 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days} 天前`;
    return fmtShort(value);
  }

  const icon = (name, cls = 'icon') =>
    `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  // ---------------------------------------------------------------- 数据访问

  const projects = () => (S.doc && Array.isArray(S.doc.projects) ? S.doc.projects : []);
  const entries = () => (S.doc && Array.isArray(S.doc.entries) ? S.doc.entries : []);
  const getProject = (id) => projects().find((p) => p.id === id) || null;

  function progressOf(project) {
    const items = project.milestones || [];
    const done = items.filter((m) => m.done).length;
    return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
  }

  function isAllDone(project) {
    const p = progressOf(project);
    return p.total > 0 && p.done === p.total;
  }

  function dateControl(field, value) {
    if (S.dateEdit === field) {
      return `<input type="date" class="date-input" data-edit="${esc(field)}" value="${esc(value || '')}">`;
    }
    return `<button type="button" class="date-btn ${value ? '' : 'is-empty'}" data-act="edit-date" data-field="${esc(field)}">${value ? esc(value) : '设置'}</button>`;
  }

  function sortedProjects() {
    return projects()
      .filter((p) => !p.archived)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  function matchesQuery(project) {
    const q = S.query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      project.title,
      project.field,
      project.goal && project.goal.text,
      project.goal && project.goal.criteria,
      ...(project.milestones || []).map((m) => m.text),
      ...(project.milestones || []).map((m) => m.note),
    ].join('\n').toLowerCase();
    return haystack.includes(q);
  }

  function visibleProjects() {
    return sortedProjects().filter((p) => {
      if (S.filter !== 'all') {
        if (S.filter === 'active' && !(p.status === 'active' || p.status === 'paused')) return false;
        if (S.filter !== 'active' && p.status !== S.filter) return false;
      }
      return matchesQuery(p);
    });
  }

  // ---------------------------------------------------------------- 提示

  let toastTimer = null;

  function toast(message, actionLabel, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(message)}</span>` + (actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : '');
    el.classList.add('show');
    const button = $('button', el);
    if (button && action) {
      button.addEventListener('click', () => {
        el.classList.remove('show');
        action();
      }, { once: true });
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), actionLabel ? 6500 : 2800);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* 退回下面的旧办法 */ }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------- 读写

  async function fetchState() {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (!res.ok) throw new Error('读取失败 ' + res.status);
    return res.json();
  }

  async function bootstrap() {
    try {
      const json = await fetchState();
      S.doc = json.data;
      S.rev = json.rev;
      S.dataPath = json.dataPath || '';
      S.booted = true;
      render();
      connectEvents();
    } catch (error) {
      $('#main').innerHTML = `<div class="empty"><div class="empty-title">无法连接本地引擎</div>
        <div class="empty-text">${esc(error.message)}。请关闭窗口后重新双击「科研日志」。</div></div>`;
    }
  }

  function connectEvents() {
    try {
      const source = new EventSource('/api/events');
      source.onmessage = (event) => {
        let payload;
        try { payload = JSON.parse(event.data); } catch { return; }
        if (!payload || !payload.external) return;
        if (payload.rev === S.rev) return;
        if (S.dirty || S.saving) {
          toast('数据文件在外部被修改了，当前修改尚未保存', '重新载入', () => location.reload());
          return;
        }
        if (payload.kind === 'resources') {
          reloadFromDisk(true).then(() => toast('资料已添加'));
          return;
        }
        reloadFromDisk();
      };
    } catch { /* 忽略 */ }
  }

  async function reloadFromDisk(silent = false) {
    try {
      const json = await fetchState();
      S.doc = json.data;
      S.rev = json.rev;
      render();
      if (!silent) toast('已载入磁盘上的最新版本');
    } catch { /* 忽略 */ }
  }

  function touch() {
    S.editSeq += 1;
    S.dirty = true;
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(saveNow, 320);
  }

  async function saveNow() {
    if (!S.doc || S.saving) return;
    const seq = S.editSeq;
    S.saving = true;
    try {
      const res = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rev: S.rev, data: S.doc }),
      });
      if (res.status === 409) {
        const json = await res.json();
        S.doc = json.data;
        S.rev = json.rev;
        S.dirty = false;
        render();
        toast('数据文件已被外部修改，已载入最新版本');
        return;
      }
      const json = await res.json();
      if (json.ok) {
        S.rev = json.rev;
        S.doc.rev = json.rev;
        if (S.editSeq === seq) S.dirty = false;
        else setTimeout(saveNow, 200);
      } else {
        toast('保存失败：' + (json.error || '未知错误'));
      }
    } catch (error) {
      toast('保存失败：' + error.message);
    } finally {
      S.saving = false;
    }
  }

  function snapshot() {
    S.undo.push(JSON.stringify(S.doc));
    if (S.undo.length > 60) S.undo.shift();
  }

  function edit(fn, options = {}) {
    if (!S.doc) return;
    snapshot();
    fn(S.doc);
    touch();
    if (options.render !== false) render();
  }

  function undo() {
    if (!S.undo.length) { toast('没有可以撤销的操作'); return; }
    const state = JSON.parse(S.undo.pop());
    S.doc = state;
    // Keep the full-document undo compatible with the current server revision.
    S.doc.rev = S.rev;
    if (S.selected && !getProject(S.selected)) S.selected = null;
    touch();
    render();
    toast('已撤销上一步');
  }

  function addEntry(projectId, text, kind = 'auto') {
    if (!text) return;
    S.doc.entries.unshift({
      id: uid('e'),
      projectId: projectId || null,
      at: iso(),
      kind,
      text,
    });
    if (S.doc.entries.length > 800) S.doc.entries.length = 800;
  }

  // ---------------------------------------------------------------- 渲染

  function render() {
    if (!S.doc) return;
    const detail = $('.detail');
    const scrollTop = detail ? detail.scrollTop : 0;
    const keepScroll = detail && S.selected ? S.selected : null;

    renderCounts();
    renderRail();
    renderMain();
    renderSide();

    if (S.pendingFocus) {
      const selector = S.pendingFocus === 'title' ? '.detail-title' : '#new-milestone';
      const target = $(selector);
      S.pendingFocus = null;
      if (target) {
        target.focus();
        if (target.classList.contains('detail-title') && target.tagName !== 'INPUT') {
          const range = document.createRange();
          range.selectNodeContents(target);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    } else if (S.focusGrip) {
      const grip = document.querySelector(`.ms-grip[data-mid="${S.focusGrip}"]`);
      S.focusGrip = null;
      if (grip) grip.focus();
    } else if (keepScroll && S.selected === keepScroll) {
      const next = $('.detail');
      if (next) next.scrollTop = scrollTop;
    }

    if (S.focusMs) {
      const mid = S.focusMs;
      S.focusMs = null;
      requestAnimationFrame(() => {
        const row = document.querySelector(`.milestone[data-mid="${mid}"]`);
        if (!row) return;
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        row.classList.add('ms-flash');
        setTimeout(() => row.classList.remove('ms-flash'), 1800);
      });
    }
  }

  function renderCounts() {
    const visible = sortedProjects();
    const count = (status) => visible.filter((p) => (status === 'active' ? (p.status === 'active' || p.status === 'paused') : p.status === status)).length;
    const chips = [
      { key: 'active', label: '进行中', value: count('active'), color: 'var(--active)' },
      { key: 'planned', label: '未来', value: count('planned'), color: 'var(--planned)' },
      { key: 'done', label: '已完成', value: count('done'), color: 'var(--done)' },
    ];
    $('#counts').innerHTML = chips.map((chip) => `
      <button type="button" class="count-chip" data-act="filter" data-filter="${chip.key}">
        <span class="dot" style="background:${chip.color}"></span>${chip.label} <b>${chip.value}</b>
      </button>`).join('');
  }

  function renderRail() {
    const list = visibleProjects();
    const filters = [
      { key: 'all', label: '全部' },
      { key: 'active', label: '进行中' },
      { key: 'planned', label: '未来' },
      { key: 'done', label: '已完成' },
    ];

    const items = list.map((project) => {
      const progress = progressOf(project);
      const color = STATUS[project.status] ? STATUS[project.status].color : 'var(--text-3)';
      const count = progress.total ? `${progress.done}/${progress.total}` : '—';
      const dateLabel = project.status === 'done' && project.completedAt
        ? fmtShort(project.completedAt)
        : project.targetDate ? `目标 ${fmtShort(project.targetDate)}` : '';
      return `
        <button type="button" class="project-item ${S.selected === project.id ? 'active' : ''}"
                data-act="select" data-pid="${esc(project.id)}" style="--item-color:${color}">
          <span class="pi-dot"></span>
          <span class="pi-title">${esc(project.title || '未命名项目')}</span>
          <span class="pi-count">${count}</span>
          <span class="pi-sub">
            <span class="pi-bar"><i style="width:${progress.pct}%"></i></span>
            <span class="pi-date">${esc(dateLabel)}</span>
          </span>
        </button>`;
    }).join('');

    const week = weekData();
    const weekCount = week.overdue.length + week.todayItems.length + week.upcoming.length;
    const weekOverdue = week.overdue.length;

    $('#rail').innerHTML = `
      <div class="rail-head">
        <button type="button" class="week-entry ${S.view === 'week' ? 'active' : ''}" data-act="week">
          ${icon('calendar')}<span>本周</span>
          ${weekCount ? `<span class="week-entry-count ${weekOverdue ? 'alert' : ''}">${weekCount}</span>` : ''}
        </button>
        <div class="rail-label">项目</div>
        <div class="filters">
          ${filters.map((f) => `<button type="button" class="filter ${S.filter === f.key ? 'active' : ''}"
             data-act="filter" data-filter="${f.key}">${f.label}</button>`).join('')}
        </div>
      </div>
      <div class="project-list">
        ${items || `<div class="rail-empty">还没有项目<br>点右上角「新建项目」开始</div>`}
      </div>
      <div class="rail-foot">
        <div class="rail-hint">拖动卡片可以改变项目状态；所有改动自动保存。</div>
      </div>`;
  }

  function weekData() {
    const today = startOfToday();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const since = weekStart.getTime();
    const list = sortedProjects();

    const due = [];
    list.forEach((project) => {
      (project.milestones || []).forEach((milestone) => {
        if (milestone.done || !milestone.due) return;
        const date = parseDay(milestone.due);
        if (!date) return;
        const diff = dayDiff(date, today);
        if (diff > 7) return;
        due.push({ project, milestone, date, diff });
      });
    });
    due.sort((a, b) => a.date - b.date || String(a.project.title).localeCompare(String(b.project.title)));

    const completed = [];
    list.forEach((project) => {
      (project.milestones || []).forEach((milestone) => {
        if (!milestone.done || !milestone.doneAt) return;
        const at = toDate(milestone.doneAt);
        if (at && at.getTime() >= since) completed.push({ project, milestone, at });
      });
    });
    completed.sort((a, b) => b.at - a.at);

    const notes = (S.doc.entries || [])
      .filter((entry) => entry.kind === 'note')
      .map((entry) => ({ entry, at: toDate(entry.at) }))
      .filter((item) => item.at && item.at.getTime() >= since)
      .sort((a, b) => b.at - a.at)
      .slice(0, 30);

    const stale = list
      .filter((project) => project.status !== 'done')
      .map((project) => {
        const updated = startOfDay(project.updatedAt);
        return { project, days: updated ? dayDiff(today, updated) : 0 };
      })
      .filter((item) => item.days >= 14)
      .sort((a, b) => b.days - a.days);

    return {
      today,
      weekStart,
      overdue: due.filter((item) => item.diff < 0),
      todayItems: due.filter((item) => item.diff === 0),
      upcoming: due.filter((item) => item.diff > 0),
      completed,
      notes,
      stale,
    };
  }

  function weekHtml() {
    const data = weekData();
    const dueRow = (item) => {
      const when = item.diff < 0 ? `逾期 ${Math.abs(item.diff)} 天` : item.diff === 0 ? '今天' : fmtDay(item.date);
      return `
        <button type="button" class="week-row ${item.diff < 0 ? 'overdue' : ''}" data-act="goto-ms"
                data-pid="${esc(item.project.id)}" data-mid="${esc(item.milestone.id)}">
          <span class="week-when">${when}</span>
          <span class="week-text">${esc(item.milestone.text)}</span>
          <span class="week-project">${esc(item.project.title)}</span>
        </button>`;
    };

    const section = (title, kind, rows, count) => (rows ? `
      <section class="week-section">
        <div class="week-section-head"><span class="week-dot ${kind}"></span>${title}<span class="week-section-count">${count}</span></div>
        <div class="week-list">${rows}</div>
      </section>` : '');

    const dueSections = [
      section('逾期', 'overdue', data.overdue.map(dueRow).join(''), data.overdue.length),
      section('今天', 'today', data.todayItems.map(dueRow).join(''), data.todayItems.length),
      section('未来 7 天', 'next', data.upcoming.map(dueRow).join(''), data.upcoming.length),
    ].join('');

    const completedSection = section('本周完成', 'done', data.completed.map((item) => `
      <button type="button" class="week-row done" data-act="goto-ms" data-pid="${esc(item.project.id)}" data-mid="${esc(item.milestone.id)}">
        <span class="week-when">${fmtDay(item.at)}</span>
        <span class="week-text">${esc(item.milestone.text)}</span>
        <span class="week-project">${esc(item.project.title)}</span>
      </button>`).join(''), data.completed.length);

    const notesSection = section('本周进展', 'note', data.notes.map(({ entry, at }) => {
      const owner = entry.projectId ? getProject(entry.projectId) : null;
      const inner = `
        <span class="week-when">${fmtDay(at)}</span>
        <span class="week-text">${esc(entry.text)}</span>
        <span class="week-project">${owner ? esc(owner.title) : ''}</span>`;
      return owner
        ? `<button type="button" class="week-row note" data-act="goto-project" data-pid="${esc(owner.id)}">${inner}</button>`
        : `<div class="week-row note">${inner}</div>`;
    }).join(''), data.notes.length);

    const staleSection = section('久未更新', 'stale', data.stale.map(({ project, days }) => `
      <button type="button" class="week-row" data-act="goto-project" data-pid="${esc(project.id)}">
        <span class="week-when">${days} 天</span>
        <span class="week-text">${esc(project.title)}</span>
        <span class="week-project">${STATUS[project.status] ? STATUS[project.status].label : ''}</span>
      </button>`).join(''), data.stale.length);

    const sections = dueSections + completedSection + notesSection + staleSection;

    return `
      <div class="week">
        <div class="week-inner">
          <header class="week-head">
            <div>
              <h1 class="week-title">本周</h1>
              <p class="week-sub">最近 7 天 · ${fmtDay(data.weekStart)} – ${fmtDay(data.today)}</p>
            </div>
            <div class="week-tools">
              <span class="week-stat">逾期 <b class="${data.overdue.length ? 'alert' : ''}">${data.overdue.length}</b>
                · 今天 <b>${data.todayItems.length}</b> · 7 天内 <b>${data.upcoming.length}</b></span>
              <button class="btn btn-sm btn-soft" type="button" data-act="copy-week">${icon('copy')}复制回顾</button>
            </div>
          </header>
          ${sections || `<div class="week-empty-big">最近 7 天还没有需要关注的事。<br>给小目标填个截止日期，或者记一条进展。</div>`}
        </div>
      </div>`;
  }

  async function copyWeekReview() {
    const data = weekData();
    const lines = [];
    lines.push(`# 科研周报（${fmtFullDay(data.weekStart)} ~ ${fmtFullDay(data.today)}）`, '');
    lines.push('## 本周完成');
    if (data.completed.length) {
      data.completed.forEach(({ project, milestone, at }) => {
        lines.push(`- [${project.title}] ${milestone.text}（${fmtDay(at)}）`);
      });
    } else {
      lines.push('- 无');
    }
    lines.push('', '## 进展记录');
    if (data.notes.length) {
      data.notes.forEach(({ entry, at }) => {
        const owner = entry.projectId ? getProject(entry.projectId) : null;
        lines.push(`- ${fmtDay(at)}${owner ? ` [${owner.title}]` : ''} ${entry.text}`);
      });
    } else {
      lines.push('- 无');
    }
    lines.push('', '## 进行中');
    const active = sortedProjects().filter((project) => project.status === 'active' || project.status === 'paused');
    if (active.length) {
      active.forEach((project) => {
        const progress = progressOf(project);
        lines.push(`- ${project.title}：${progress.done}/${progress.total}，最近更新 ${fmtShort(project.updatedAt)}`);
      });
    } else {
      lines.push('- 无');
    }
    lines.push('', '## 下周关注');
    const upcoming = [...data.todayItems, ...data.upcoming].slice(0, 8);
    if (upcoming.length) {
      upcoming.forEach(({ project, milestone, date }) => {
        lines.push(`- [${project.title}] ${milestone.text}（${fmtDay(date)}）`);
      });
    } else {
      lines.push('- 暂无');
    }
    const ok = await copyText(lines.join('\n'));
    toast(ok ? '周报已复制到剪贴板' : '复制失败');
  }

  function renderMain() {
    const project = S.selected ? getProject(S.selected) : null;
    if (project) {
      S.selected = project.id;
      $('#main').innerHTML = detailHtml(project);
    } else if (S.view === 'week') {
      S.selected = null;
      $('#main').innerHTML = weekHtml();
    } else {
      S.selected = null;
      $('#main').innerHTML = projects().length ? boardHtml() : emptyHtml();
    }
  }

  function emptyHtml() {
    return `
      <div class="empty">
        <div class="empty-art">${icon('flask')}</div>
        <div class="empty-title">从第一个项目开始</div>
        <div class="empty-text">每个项目写一句大目标，再拆成若干可以打勾的小目标。未来的想法先放进「未来」，开工时拖到「进行中」。</div>
        <div class="empty-actions">
          <button class="btn btn-primary" type="button" data-act="new-project">${icon('plus')}新建项目</button>
          <button class="btn" type="button" data-act="demo">载入示例</button>
        </div>
      </div>`;
  }

  function boardHtml() {
    const list = visibleProjects();
    const columns = COLUMNS.map((column) => {
      const items = list.filter((p) => (column.status === 'done' ? p.status === 'done' : p.status === column.status || (column.status === 'active' && p.status === 'paused')));
      const cards = items.map((project) => cardHtml(project, column)).join('');
      return `
        <section class="column" data-status="${column.status}" style="--col-color:${column.status === 'planned' ? 'var(--planned)' : column.status === 'active' ? 'var(--active)' : 'var(--done)'}">
          <header class="column-head">
            <span class="dot ${column.status}"></span>
            <span class="column-title">${column.title}</span>
            <span class="column-count">${items.length}</span>
          </header>
          <div class="cards">
            ${cards || `<div class="column-empty">${column.empty}</div>`}
          </div>
        </section>`;
    }).join('');
    return `<div class="board">${columns}</div>`;
  }

  function cardHtml(project, column) {
    const progress = progressOf(project);
    const color = project.status === 'paused' ? 'var(--paused)' : column.status === 'planned' ? 'var(--planned)' : column.status === 'active' ? 'var(--active)' : 'var(--done)';
    const goal = (project.goal && project.goal.text) || '';
    const meta = progress.total
      ? `${progress.done}/${progress.total}`
      : (project.status === 'done' && project.completedAt ? fmtShort(project.completedAt) : '');
    return `
      <article class="card ${project.status === 'paused' ? 'paused' : ''}" draggable="true"
               data-act="select" data-pid="${esc(project.id)}" style="--col-color:${color}"
               title="${esc(project.title)}">
        <div class="card-top">
          <div class="card-title">${esc(project.title || '未命名项目')}</div>
          ${project.field ? `<span class="card-field">${esc(project.field)}</span>` : ''}
        </div>
        <div class="card-goal ${goal ? '' : 'empty'}">${esc(goal || '还没有写大目标')}</div>
        <div class="card-foot">
          <span class="card-bar"><i style="width:${progress.pct}%"></i></span>
          <span>${meta}</span>
        </div>
      </article>`;
  }

  function detailHtml(project) {
    const progress = progressOf(project);
    const status = STATUS[project.status] || STATUS.active;
    const goal = project.goal || { text: '', criteria: '', targetDate: '' };
    const items = (project.milestones || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const overdue = (m) => m.due && !m.done && toDate(m.due) && toDate(m.due) < new Date(new Date().toDateString());

    const milestones = items.map((item) => {
      const expanded = S.expanded.has(`${project.id}:${item.id}`);
      const notePreview = item.note ? `<span class="ms-note-preview">${icon('note')}${esc(item.note)}</span>` : '';
      const due = item.due ? `<span class="ms-due ${overdue(item) ? 'overdue' : ''}">${icon('calendar')}${esc(fmtShort(item.due))}${item.done && item.doneAt ? '' : ''}</span>` : '';
      return `
        <div class="milestone ${item.done ? 'done' : ''}" data-mid="${esc(item.id)}" data-pid="${esc(project.id)}">
          <button type="button" class="ms-grip" draggable="true" data-mid="${esc(item.id)}" data-pid="${esc(project.id)}"
                  title="拖动排序（也可以 Alt + ↑ / ↓）" aria-label="拖动排序">${icon('grip')}</button>
          <button type="button" class="ms-check" data-act="toggle-ms" data-mid="${esc(item.id)}" aria-pressed="${item.done}" aria-label="${item.done ? '标记未完成' : '标记完成'}">
            ${icon('check')}
          </button>
          <div class="ms-body">
            <div class="ms-text" contenteditable="true" spellcheck="false" data-edit="ms.text"
                 data-mid="${esc(item.id)}" data-placeholder="小目标">${esc(item.text)}</div>
            ${(due || notePreview) ? `<div class="ms-sub">${due}${notePreview}</div>` : ''}
          </div>
          <div class="ms-actions">
            <button type="button" class="ms-action ${expanded ? 'on' : ''}" data-act="toggle-note" data-mid="${esc(item.id)}" title="备注与截止日期">${icon('note')}</button>
            <button type="button" class="ms-action danger" data-act="delete-ms" data-mid="${esc(item.id)}" title="删除">${icon('trash')}</button>
          </div>
          ${expanded ? `
          <div class="ms-expand">
            <label>截止日期
              <input type="date" value="${esc(item.due || '')}" data-edit="ms.due" data-mid="${esc(item.id)}">
              ${item.due ? `<button type="button" class="btn btn-sm" data-act="clear-due" data-mid="${esc(item.id)}">清除</button>` : ''}
            </label>
            <textarea class="ms-note" placeholder="备注：记录卡点、思路、依赖…" data-edit="ms.note" data-mid="${esc(item.id)}">${esc(item.note || '')}</textarea>
          </div>` : ''}
        </div>`;
    }).join('');

    const banner = (isAllDone(project) && project.status !== 'done') ? `
      <div class="banner">${icon('check')}
        <span>小目标全部完成。要把这个项目标记为「已完成」吗？</span>
        <button class="btn btn-sm btn-soft" type="button" data-act="complete-project">标记完成</button>
      </div>` : '';

    const statusOptions = Object.entries(STATUS).map(([key, value]) =>
      `<option value="${key}" ${project.status === key ? 'selected' : ''}>${value.label}</option>`).join('');

    const CATEGORY = {
      ref: { label: '文献' },
      repo: { label: '项目库' },
      note: { label: '笔记' },
    };
    const resources = Array.isArray(project.resources) ? project.resources : [];
    const resourceChip = (resource) => {
      const category = resource.category || 'ref';
      const label = resource.label || String(resource.path || '').split(/[\\/]/).pop() || '资料';
      const isNote = category === 'note' || /\.(md|markdown)$/i.test(String(resource.path || ''));
      const iconName = isNote ? 'note' : category === 'repo' ? 'folder' : resource.kind === 'dir' ? 'folder' : 'file';
      return `
        <span class="resource-chip">
          <button type="button" class="resource-main" data-act="${isNote ? 'open-note' : 'open-resource'}"
                  data-id="${esc(resource.id)}" title="${esc(resource.path)}">
            ${icon(iconName)}
            <span class="resource-label">${esc(label)}</span>
          </button>
          <button type="button" class="resource-x resource-folder" data-act="reveal-resource" data-id="${esc(resource.id)}"
                  title="在文件夹中显示">${icon('folder')}</button>
          <button type="button" class="resource-x" data-act="remove-resource" data-id="${esc(resource.id)}"
                  title="从项目中移除">×</button>
        </span>`;
    };

    const groups = ['ref', 'repo', 'note'].map((category) => ({
      category,
      items: resources.filter((resource) => (resource.category || 'ref') === category),
    }));

    const resourcesBlock = `
      <section class="resources">
        <div class="block-head resource-head">
          <span class="block-title">资料与项目库</span>
          <span class="block-count">${resources.length}</span>
          <span class="spacer"></span>
          <button class="btn btn-sm" type="button" data-act="add-resource" data-category="ref">${icon('plus')}文献</button>
          <button class="btn btn-sm" type="button" data-act="add-resource" data-category="repo">${icon('plus')}项目库</button>
          <button class="btn btn-sm" type="button" data-act="add-resource" data-category="note">${icon('plus')}笔记</button>
        </div>
        ${groups.filter((group) => group.items.length).map((group) => `
          <div class="resource-group">
            <div class="resource-group-label">${CATEGORY[group.category].label}<span>${group.items.length}</span></div>
            <div class="resource-list">${group.items.map(resourceChip).join('')}</div>
          </div>`).join('') || `<div class="resource-empty">挂文献 PDF、项目文件夹或 Markdown 笔记，之后点一下就能打开。</div>`}
      </section>`;

    return `
      <div class="detail">
        <div class="detail-inner">
          <button type="button" class="back" data-act="back">${icon('arrow-left')}全部项目</button>

          <h1 class="detail-title" contenteditable="true" spellcheck="false" data-edit="title" data-placeholder="未命名项目">${esc(project.title || '')}</h1>

          <div class="detail-meta">
            <span class="pill status" style="--pill-color:${status.color}">
              <span class="dot" style="background:${status.color}"></span>
              <select data-act="status" aria-label="项目状态">${statusOptions}</select>
            </span>
            <span class="pill field">${icon('target')}
              <input type="text" placeholder="研究领域 / 标签" value="${esc(project.field || '')}" data-edit="field" maxlength="20">
            </span>
            <span class="pill date">${icon('calendar')}<span class="pill-label">开始</span>
              ${dateControl('startDate', project.startDate)}
            </span>
            <span class="pill date">${icon('target')}<span class="pill-label">目标</span>
              ${dateControl('targetDate', project.targetDate)}
            </span>
            <button class="btn btn-sm btn-danger detail-delete" type="button" data-act="delete-project" title="删除项目">${icon('trash')}删除项目</button>
          </div>

          <section class="goal-panel">
            <div class="goal-label">${icon('target')}大目标</div>
            <div class="goal-text" contenteditable="true" spellcheck="false" data-edit="goal.text"
                 data-placeholder="写下这个项目要达成的那一件事…">${multiline(goal.text || '')}</div>
            <div class="goal-foot">
              <span class="goal-foot-label">成功判据</span>
              <div class="goal-criteria" contenteditable="true" spellcheck="false" data-edit="goal.criteria"
                   data-placeholder="怎样算达成？写一句判据，比如「投稿接收」">${multiline(goal.criteria || '')}</div>
              <span class="goal-date">目标
                ${dateControl('goal.targetDate', goal.targetDate)}
              </span>
            </div>
          </section>

          ${resourcesBlock}

          <section class="milestones-block">
            <div class="block-head">
              <span class="block-title">小目标</span>
              <span class="block-count">${progress.done}/${progress.total}</span>
              <span class="block-progress"><i style="width:${progress.pct}%"></i></span>
            </div>
            <div class="milestones">
              ${milestones || ''}
              <div class="add-row">
                ${icon('plus')}
                <input class="add-input" id="new-milestone" type="text" placeholder="添加一个小目标，回车即可" autocomplete="off">
              </div>
            </div>
            ${banner}
          </section>

          <div class="detail-foot">
            <span class="meta-text">创建于 ${esc(fmtShort(project.createdAt))} · 更新于 ${esc(relDate(project.updatedAt))}</span>
            <span class="spacer"></span>
            <button class="btn btn-sm btn-danger" type="button" data-act="delete-project">${icon('trash')}删除项目</button>
          </div>
        </div>
      </div>`;
  }

  function renderSide() {
    const project = S.selected ? getProject(S.selected) : null;
    const all = entries();
    const list = (project ? all.filter((e) => e.projectId === project.id) : all)
      .slice()
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 80);
    const title = project ? '进展' : '最近进展';
    const subtitle = project ? esc(project.title) : '全部项目';

    const items = list.map((entry) => {
      const owner = !project && entry.projectId ? getProject(entry.projectId) : null;
      return `
        <div class="log-entry ${entry.kind === 'note' ? 'note' : 'auto'}">
          ${owner ? `<div class="log-project">${esc(owner.title)}</div>` : ''}
          <div class="log-time">${esc(fmtLogTime(entry.at))}</div>
          <div class="log-text" data-kind="${esc(entry.kind)}">${esc(entry.text)}</div>
          <button class="log-copy" type="button" data-act="copy-log" data-id="${esc(entry.id)}"
                  title="复制这条进展" aria-label="复制这条进展">${icon('copy')}</button>
        </div>`;
    }).join('');

    $('#side').innerHTML = `
      <div class="side-head">
        <span class="side-title">${title}</span>
        <span class="spacer"></span>
        <button class="side-copy" type="button" data-act="copy-log-all"
                title="复制当前列表（纯文本，适合贴进周报）" aria-label="复制当前列表">${icon('copy')}</button>
        <span class="side-sub">${subtitle}</span>
      </div>
      <div class="log-compose">
        <textarea class="log-input" id="log-input" placeholder="${project ? '今天做了什么、结果如何、下一步…' : '随手记一条进展…'}"></textarea>
        <div class="log-compose-row">
          <span class="log-hint">Ctrl + Enter 记录</span>
          <span class="spacer"></span>
          <button class="btn btn-sm btn-soft" type="button" data-act="add-log">记录</button>
        </div>
      </div>
      <div class="log-list">
        ${items || `<div class="side-empty">还没有进展记录。<br>写下第一条，之后就有一条时间线。</div>`}
      </div>`;

    const input = $('#log-input');
    if (input) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          submitLog();
        }
      });
    }
  }

  // ---------------------------------------------------------------- 操作

  function selectProject(id) {
    S.selected = id;
    S.view = 'board';
    S.pendingFocus = null;
    S.dateEdit = null;
    render();
  }

  function backToBoard() {
    S.selected = null;
    S.view = 'board';
    S.dateEdit = null;
    render();
  }

  function newProject() {
    const project = {
      id: uid('p'),
      title: '',
      field: '',
      status: 'active',
      goal: { text: '', criteria: '', targetDate: '' },
      milestones: [],
      notes: '',
      createdAt: iso(),
      updatedAt: iso(),
      startDate: today(),
      targetDate: '',
      completedAt: null,
      archived: false,
      order: -(Date.now() / 1000),
    };
    edit((doc) => {
      doc.projects.push(project);
      doc.entries.unshift({
        id: uid('e'), projectId: project.id, at: iso(), kind: 'auto', text: '创建项目',
      });
    }, { render: false });
    S.selected = project.id;
    S.pendingFocus = 'title';
    render();
  }

  async function deleteProject(id) {
    const project = getProject(id);
    if (!project) return;
    const ok = await confirmDialog({
      title: '删除这个项目？',
      body: `「${project.title || '未命名项目'}」和它的小目标、进展记录都会被删除。删除后可以用 Ctrl+Z 撤销。`,
      okLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    snapshot();
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || '服务端拒绝删除');
      S.doc.projects = S.doc.projects.filter((p) => p.id !== id);
      S.rev = json.rev;
      S.doc.rev = json.rev;
      S.selected = null;
      render();
      toast('项目已删除', '撤销', undo);
    } catch (error) {
      toast('删除失败：' + error.message);
    }
  }

  function setStatus(id, status) {
    const project = getProject(id);
    if (!project || project.status === status) return;
    const finish = () => {
      edit((doc) => {
        const target = doc.projects.find((p) => p.id === id);
        if (!target) return;
        target.status = status;
        target.updatedAt = iso();
        if (status === 'done') target.completedAt = iso();
        if (status !== 'done') target.completedAt = null;
        if (status === 'active' && !target.startDate) target.startDate = today();
        addEntry(id, `状态改为「${STATUS[status].label}」`);
      });
    };
    if (status === 'done') {
      const progress = progressOf(project);
      if (progress.total && progress.done < progress.total) {
        confirmDialog({
          title: '还有小目标没完成',
          body: `「${project.title || '未命名项目'}」还有 ${progress.total - progress.done} 个小目标没有打勾。仍然标记为已完成吗？`,
          okLabel: '标记完成',
        }).then((ok) => { if (ok) finish(); });
        return;
      }
    }
    finish();
  }

  function toggleMilestone(pid, mid) {
    const project = getProject(pid);
    if (!project) return;
    const item = (project.milestones || []).find((m) => m.id === mid);
    if (!item) return;
    edit((doc) => {
      const target = doc.projects.find((p) => p.id === pid);
      const milestone = target.milestones.find((m) => m.id === mid);
      milestone.done = !milestone.done;
      milestone.doneAt = milestone.done ? iso() : null;
      target.updatedAt = iso();
      addEntry(pid, milestone.done ? `完成「${milestone.text}」` : `重新打开「${milestone.text}」`);
    });
  }

  function deleteMilestone(pid, mid) {
    const project = getProject(pid);
    const item = project && (project.milestones || []).find((m) => m.id === mid);
    if (!item) return;
    edit((doc) => {
      const target = doc.projects.find((p) => p.id === pid);
      target.milestones = target.milestones.filter((m) => m.id !== mid);
      target.updatedAt = iso();
    });
    toast('已删除小目标', '撤销', undo);
  }

  function addMilestone(pid, text) {
    const value = String(text || '').trim();
    if (!value) return false;
    edit((doc) => {
      const target = doc.projects.find((p) => p.id === pid);
      target.milestones.push({
        id: uid('m'),
        text: value,
        done: false,
        doneAt: null,
        due: '',
        note: '',
        order: target.milestones.length,
      });
      target.updatedAt = iso();
    }, { render: false });
    S.pendingFocus = 'milestone';
    render();
    return true;
  }

  function submitLog() {
    const input = $('#log-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const projectId = S.selected || null;
    edit((doc) => {
      doc.entries.unshift({ id: uid('e'), projectId, at: iso(), kind: 'note', text });
    }, { render: false });
    input.value = '';
    renderSide();
    toast('已记录');
  }

  function setField(pid, path, value) {
    const project = getProject(pid);
    if (!project) return;
    if (path === 'title') project.title = value;
    else if (path === 'field') project.field = value;
    else if (path === 'goal.text') project.goal.text = value;
    else if (path === 'goal.criteria') project.goal.criteria = value;
    else if (path === 'goal.targetDate') project.goal.targetDate = value;
    else if (path === 'startDate') project.startDate = value;
    else if (path === 'targetDate') project.targetDate = value;
    project.updatedAt = iso();
  }

  function setMilestoneField(pid, mid, path, value) {
    const project = getProject(pid);
    const item = project && (project.milestones || []).find((m) => m.id === mid);
    if (!item) return;
    if (path === 'text') item.text = value;
    else if (path === 'due') item.due = value;
    else if (path === 'note') item.note = value;
    project.updatedAt = iso();
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.ok === false) {
      throw new Error(json.error || ('请求失败 ' + response.status));
    }
    return json;
  }

  function addResourceMenu(anchor, category) {
    if (!S.selected) return;
    const projectId = S.selected;
    const cat = category || 'ref';
    openMenu(anchor, [
      {
        key: 'drop', label: '拖入文件夹 / 文件…', icon: 'folder',
        onClick: () => {
          postJson('/api/resources/drop-window', { projectId, category: cat })
            .catch((error) => toast('打不开接收窗口：' + error.message));
        },
      },
      { key: 'folder', label: '选择文件夹…', icon: 'folder', onClick: () => pickResources(projectId, 'folder', cat) },
      { key: 'files', label: '选择文件…', icon: 'file', onClick: () => pickResources(projectId, 'files', cat) },
    ]);
  }

  async function pickResources(projectId, mode, category) {
    try {
      const picked = await postJson('/api/resources/pick', { projectId, mode });
      if (!picked.paths || !picked.paths.length) return;
      const result = await postJson('/api/resources/add', { projectId, paths: picked.paths, category: category || 'ref' });
      await reloadFromDisk(true);
      const count = (result.added || []).length;
      toast(count ? `已添加 ${count} 项` : '这些已经在项目里了');
    } catch (error) {
      toast('添加失败：' + error.message);
    }
  }

  async function openResource(id) {
    if (!S.selected) return;
    try {
      await postJson('/api/resources/open', { projectId: S.selected, resourceId: id });
    } catch (error) {
      toast('打不开：' + error.message);
    }
  }

  async function removeResource(id) {
    if (!S.selected) return;
    try {
      await postJson('/api/resources/remove', { projectId: S.selected, resourceId: id });
      await reloadFromDisk(true);
      toast('已从项目中移除');
    } catch (error) {
      toast('移除失败：' + error.message);
    }
  }

  async function revealResource(id) {
    if (!S.selected) return;
    try {
      await postJson('/api/resources/reveal', { projectId: S.selected, resourceId: id });
    } catch (error) {
      toast('打不开文件夹：' + error.message);
    }
  }

  async function openNote(resourceId) {
    if (!S.selected) return;
    const root = $('#reader-root');
    root.innerHTML = '<div class="reader-backdrop"><div class="reader reader-loading">正在读取…</div></div>';
    try {
      const data = await postJson('/api/resources/read', { projectId: S.selected, resourceId });
      const html = window.RlogMarkdown ? window.RlogMarkdown.render(data.text) : `<pre>${esc(data.text)}</pre>`;
      const updated = data.mtime ? fmtStamp(new Date(data.mtime * 1000).toISOString()) : '';
      root.innerHTML = `
        <div class="reader-backdrop">
          <article class="reader" role="dialog" aria-modal="true">
            <header class="reader-head">
              <div class="reader-heading">
                <h2 class="reader-title">${esc(data.name)}</h2>
                <p class="reader-path" title="${esc(data.path)}">${esc(data.path)}</p>
              </div>
              <div class="reader-actions">
                ${updated ? `<span class="reader-time">更新于 ${esc(updated)}</span>` : ''}
                <button class="btn btn-sm" type="button" data-act="reveal-resource" data-id="${esc(resourceId)}">${icon('folder')}在文件夹中显示</button>
                <button class="icon-btn" type="button" data-act="close-reader" aria-label="关闭">${icon('close')}</button>
              </div>
            </header>
            <div class="reader-body md">${html}</div>
          </article>
        </div>`;
    } catch (error) {
      root.innerHTML = `
        <div class="reader-backdrop">
          <div class="reader reader-error">
            <p>读不出来：${esc(error.message)}</p>
            <button class="btn" type="button" data-act="close-reader">关闭</button>
          </div>
        </div>`;
    }
  }

  function closeReader() {
    const root = $('#reader-root');
    if (root) root.innerHTML = '';
  }

  // ---------------------------------------------------------------- 弹窗 / 菜单

  let closeModal = null;

  function openModal(html, options = {}) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const backdrop = $('.modal-backdrop', root);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      root.innerHTML = '';
      closeModal = null;
      if (typeof options.onClose === 'function') options.onClose();
    };
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop && !options.sticky) close();
    });
    closeModal = close;
    if (typeof options.onMount === 'function') options.onMount($('.modal', root), close);
    return close;
  }

  function confirmDialog({ title, body, okLabel = '确定', cancelLabel = '取消', danger = false }) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      openModal(`
        <h2>${esc(title)}</h2>
        <p>${esc(body)}</p>
        <div class="modal-actions">
          <button class="btn" type="button" data-close>${esc(cancelLabel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-ok>${esc(okLabel)}</button>
        </div>`, {
        onMount(root, done) {
          $('[data-close]', root).addEventListener('click', () => { finish(false); done(); });
          $('[data-ok]', root).addEventListener('click', () => { finish(true); done(); });
          setTimeout(() => $('[data-ok]', root).focus(), 30);
        },
        onClose() { finish(false); },
      });
    });
  }

  let menuAnchor = null;

  function openMenu(anchor, items) {
    closeMenu();
    menuAnchor = anchor;
    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.innerHTML = items.map((item) => item.sep
      ? '<div class="menu-sep"></div>'
      : item.note
        ? `<div class="menu-note">${esc(item.note)}</div>`
        : `<button type="button" class="menu-item ${item.danger ? 'danger' : ''}" data-key="${esc(item.key)}">${icon(item.icon || 'more')}${esc(item.label)}</button>`).join('');
    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    const width = menu.offsetWidth || 210;
    menu.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)) + 'px';
    menu.style.top = (rect.bottom + 6) + 'px';
    menu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-key]');
      if (!button) return;
      const key = button.dataset.key;
      closeMenu();
      const item = items.find((entry) => entry.key === key);
      if (item && item.onClick) item.onClick();
    });
    setTimeout(() => document.addEventListener('mousedown', onOutside, { capture: true }), 0);

    function onOutside(event) {
      if (!menu.contains(event.target)) closeMenu();
    }
    menu._onOutside = onOutside;
  }

  function closeMenu() {
    menuAnchor = null;
    $$('.menu').forEach((menu) => {
      if (menu._onOutside) document.removeEventListener('mousedown', menu._onOutside, { capture: true });
      menu.remove();
    });
  }

  function showSettings() {
    openModal(`
      <h2>设置</h2>
      <p>数据保存在下面这个文件里，程序每变动一次就原子写入，并每天自动备份一份。</p>
      <div class="modal-path">${esc(S.dataPath || '（尚未连接）')}</div>
      <div class="modal-field">
        <label>导出 / 备份</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" type="button" data-export="md">${icon('download')}导出 Markdown</button>
          <button class="btn btn-sm" type="button" data-export="json">${icon('download')}导出 JSON</button>
          <button class="btn btn-sm" type="button" data-import>${icon('upload')}导入 JSON</button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn" type="button" data-folder>${icon('folder')}打开数据文件夹</button>
        <button class="btn btn-primary" type="button" data-close>完成</button>
      </div>`, {
      onMount(root, done) {
        $('[data-export="md"]', root).addEventListener('click', () => downloadExport('md'));
        $('[data-export="json"]', root).addEventListener('click', () => downloadExport('json'));
        $('[data-import]', root).addEventListener('click', () => $('#import-file').click());
        $('[data-folder]', root).addEventListener('click', () => fetch('/api/reveal', { method: 'POST' }));
        $('[data-close]', root).addEventListener('click', done);
      },
    });
  }

  async function downloadExport(format) {
    const res = await fetch('/api/export?format=' + format);
    const text = await res.text();
    const blob = new Blob([text], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `科研日志-${today()}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('已导出');
  }

  async function importFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const ok = await confirmDialog({
        title: '导入并覆盖当前数据？',
        body: '当前数据会先备份一份，然后被这份文件替换。确定继续吗？',
        okLabel: '导入',
        danger: true,
      });
      if (!ok) return;
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || '导入失败');
      location.reload();
    } catch (error) {
      toast('导入失败：' + error.message);
    }
  }

  function loadDemo() {
    const stamp = iso();
    const demo = [
      {
        title: '单细胞转录组分析流程',
        field: '单细胞',
        status: 'active',
        goal: {
          text: '搭建一套可复现的单细胞分析流程，并在两个月内投出一篇方法学论文。',
          criteria: '流程在 3 套公开数据上跑通，论文投出且进入审稿。',
          targetDate: '',
        },
        milestones: [
          { text: '整理数据与质控标准', done: true },
          { text: '跑通基线聚类流程', done: false },
          { text: '加入批次校正对比实验', done: false },
          { text: '写方法部分初稿', done: false },
        ],
      },
      {
        title: '肠道菌群与免疫应答',
        field: '免疫',
        status: 'planned',
        goal: {
          text: '确认特定菌群代谢物对 T 细胞分化的影响，形成一篇研究论文的核心证据链。',
          criteria: '体外与动物实验各有一组显著结果。',
          targetDate: '',
        },
        milestones: [
          { text: '读完近三年相关综述', done: false },
          { text: '确定候选代谢物清单', done: false },
          { text: '设计第一批体外实验', done: false },
        ],
      },
      {
        title: '综述：单细胞多组学整合',
        field: '综述',
        status: 'done',
        goal: {
          text: '系统梳理单细胞多组学整合的方法与瓶颈，完成一篇约 8000 字的综述。',
          criteria: '投稿并被接收。',
          targetDate: '',
        },
        milestones: [
          { text: '确定综述框架', done: true },
          { text: '收集并精读 60 篇文献', done: true },
          { text: '完成初稿', done: true },
          { text: '两轮修改', done: true },
          { text: '投稿', done: true },
        ],
      },
    ];

    edit((doc) => {
      demo.forEach((item, index) => {
        const id = uid('p');
        doc.projects.push({
          id,
          title: item.title,
          field: item.field,
          status: item.status,
          goal: item.goal,
          milestones: item.milestones.map((m, mi) => ({
            id: uid('m'), text: m.text, done: m.done, doneAt: m.done ? stamp : null, due: '', note: '', order: mi,
          })),
          notes: '',
          createdAt: stamp,
          updatedAt: stamp,
          startDate: item.status === 'planned' ? '' : today(),
          targetDate: '',
          completedAt: item.status === 'done' ? stamp : null,
          archived: false,
          order: index,
        });
        doc.entries.push({
          id: uid('e'), projectId: id, at: stamp, kind: 'auto', text: '创建项目',
        });
        if (item.status === 'done') {
          doc.entries.push({
            id: uid('e'), projectId: id, at: stamp, kind: 'auto', text: '状态改为「已完成」',
          });
        }
      });
      doc.entries.push({
        id: uid('e'), projectId: null, at: stamp, kind: 'note',
        text: '示例数据：可以随意修改、删除，或从设置里导入你自己的备份。',
      });
    });
    S.selected = null;
    render();
    toast('已载入示例项目');
  }

  // ---------------------------------------------------------------- 事件

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-act]');
    if (!target) return;
    const act = target.dataset.act;
    const pid = target.dataset.pid || S.selected;
    const mid = target.dataset.mid;

    if (suppressClick && act === 'select') { suppressClick = false; return; }

    switch (act) {
      case 'select':
        selectProject(target.dataset.pid);
        break;
      case 'back':
        backToBoard();
        break;
      case 'filter':
        S.filter = target.dataset.filter;
        S.selected = null;
        S.view = 'board';
        render();
        break;
      case 'week':
        S.view = 'week';
        S.selected = null;
        S.dateEdit = null;
        render();
        break;
      case 'goto-ms':
        S.view = 'board';
        S.selected = target.dataset.pid;
        S.focusMs = target.dataset.mid;
        S.dateEdit = null;
        render();
        break;
      case 'goto-project':
        S.view = 'board';
        S.selected = target.dataset.pid;
        S.focusMs = null;
        S.dateEdit = null;
        render();
        break;
      case 'copy-week':
        copyWeekReview();
        break;
      case 'new-project':
        newProject();
        break;
      case 'demo':
        loadDemo();
        break;
      case 'toggle-ms':
        event.preventDefault();
        toggleMilestone(pid, mid);
        break;
      case 'delete-ms':
        deleteMilestone(pid, mid);
        break;
      case 'toggle-note': {
        const key = `${pid}:${mid}`;
        if (S.expanded.has(key)) S.expanded.delete(key); else S.expanded.add(key);
        render();
        break;
      }
      case 'clear-due':
        edit((doc) => {
          const project = doc.projects.find((p) => p.id === pid);
          const item = project && project.milestones.find((m) => m.id === mid);
          if (item) item.due = '';
        });
        break;
      case 'edit-date': {
        event.preventDefault();
        S.dateEdit = target.dataset.field;
        render();
        requestAnimationFrame(() => {
          const input = document.querySelector('input.date-input');
          if (!input) return;
          input.focus();
          try { if (input.showPicker) input.showPicker(); } catch { /* 忽略 */ }
        });
        break;
      }
      case 'copy-log': {
        const entry = entries().find((item) => item.id === target.dataset.id);
        if (!entry) break;
        copyText(entry.text).then((ok) => toast(ok ? '已复制这条进展' : '复制失败'));
        break;
      }
      case 'copy-log-all': {
        const current = S.selected ? getProject(S.selected) : null;
        const list = (current ? entries().filter((item) => item.projectId === current.id) : entries())
          .slice()
          .sort((a, b) => String(b.at).localeCompare(String(a.at)))
          .slice(0, 80);
        if (!list.length) { toast('还没有可以复制的进展'); break; }
        const text = list.map((item) => {
          const owner = !current && item.projectId ? getProject(item.projectId) : null;
          const who = owner ? `[${owner.title}] ` : '';
          return `${fmtStamp(item.at)}  ${who}${item.text}`;
        }).join('\n\n');
        copyText(text).then((ok) => toast(ok ? `已复制 ${list.length} 条进展` : '复制失败'));
        break;
      }
      case 'add-log':
        submitLog();
        break;
      case 'add-resource':
        event.stopPropagation();
        addResourceMenu(target, target.dataset.category);
        break;
      case 'open-resource':
        openResource(target.dataset.id);
        break;
      case 'open-note':
        openNote(target.dataset.id);
        break;
      case 'close-reader':
        closeReader();
        break;
      case 'remove-resource':
        event.stopPropagation();
        removeResource(target.dataset.id);
        break;
      case 'reveal-resource':
        event.stopPropagation();
        revealResource(target.dataset.id);
        break;
      case 'complete-project':
        if (S.selected) setStatus(S.selected, 'done');
        break;
      case 'delete-project':
        if (S.selected) deleteProject(S.selected);
        break;
      case 'open-menu':
        event.stopPropagation();
        openMenu(target, menuItems());
        break;
      case 'quit':
        fetch('/api/quit', { method: 'POST' });
        toast('程序已退出，可以关闭这个窗口了');
        break;
      default:
        break;
    }
  });

  document.addEventListener('change', (event) => {
    const dateInput = event.target.closest('input.date-input');
    if (dateInput) {
      setField(S.selected, dateInput.dataset.edit, dateInput.value);
      S.dateEdit = null;
      touch();
      render();
      return;
    }
    const select = event.target.closest('select[data-act="status"]');
    if (select) {
      setStatus(S.selected, select.value);
      return;
    }
    const editable = event.target.closest('input[data-edit], textarea[data-edit]');
    if (!editable) return;
    const path = editable.dataset.edit;
    const mid = editable.dataset.mid;
    if (path.startsWith('ms.')) {
      setMilestoneField(S.selected, mid, path.slice(3), editable.value);
      touch();
      if (path === 'ms.due') render();
    } else {
      setField(S.selected, path, editable.value);
      touch();
    }
  });

  document.addEventListener('input', (event) => {
    const editable = event.target.closest('[data-edit]:not(input):not(textarea)');
    if (!editable) return;
    const path = editable.dataset.edit;
    const text = editable.innerText.replace(/\u00a0/g, ' ').replace(/\n+$/, '');
    if (path.startsWith('ms.')) {
      setMilestoneField(S.selected, editable.dataset.mid, path.slice(3), text);
    } else {
      setField(S.selected, path, text);
    }
    touch();
  });

  document.addEventListener('focusout', (event) => {
    const editable = event.target.closest('[data-edit]');
    if (!editable) return;
    if (editable.classList.contains('detail-title') && !editable.innerText.trim()) {
      editable.innerText = '';
    }
  });

  document.addEventListener('keydown', (event) => {
    const tag = (event.target.tagName || '').toLowerCase();
    const editing = event.target.isContentEditable || tag === 'input' || tag === 'textarea';

    if (event.key === 'Escape' && $('#reader-root') && $('#reader-root').children.length) {
      event.preventDefault();
      closeReader();
      return;
    }

    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      const grip = event.target.closest('.ms-grip');
      if (grip) {
        event.preventDefault();
        moveMilestoneBy(grip.dataset.pid, grip.dataset.mid, event.key === 'ArrowUp' ? -1 : 1);
        return;
      }
    }

    if (event.key === 'Escape') {
      if (closeModal) { closeModal(); return; }
      if ($('.menu')) { closeMenu(); return; }
      if (editing) { event.target.blur(); return; }
      if (S.selected) { backToBoard(); return; }
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      newProject();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      $('#search').focus();
      $('#search').select();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !editing) {
      event.preventDefault();
      undo();
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      const addInput = event.target.closest('#new-milestone');
      if (addInput) {
        event.preventDefault();
        if (addMilestone(S.selected, addInput.value)) addInput.value = '';
        return;
      }
      const title = event.target.closest('.detail-title');
      if (title) {
        event.preventDefault();
        title.blur();
        return;
      }
    }
  });

  $('#search').addEventListener('input', (event) => {
    S.query = event.target.value;
    if (S.selected) S.selected = null;
    S.view = 'board';
    S.dateEdit = null;
    renderRail();
    renderMain();
    renderSide();
  });

  $('#new-project').addEventListener('click', newProject);

  $('#menu-btn').addEventListener('click', (event) => {
    event.stopPropagation();
    openMenu(event.currentTarget, menuItems());
  });

  document.addEventListener('click', (event) => {
    if (event.target.classList && event.target.classList.contains('reader-backdrop')) closeReader();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('.menu')) return;
    if (event.target.closest('#menu-btn')) return;
    if (menuAnchor && menuAnchor.contains(event.target)) return;
    closeMenu();
  });

  function menuItems() {
    return [
      { key: 'settings', label: '设置与备份', icon: 'settings', onClick: showSettings },
      { key: 'export-md', label: '导出 Markdown', icon: 'download', onClick: () => downloadExport('md') },
      { key: 'export-json', label: '导出 JSON', icon: 'download', onClick: () => downloadExport('json') },
      { key: 'import', label: '导入 JSON', icon: 'upload', onClick: () => $('#import-file').click() },
      { sep: true },
      { key: 'folder', label: '打开数据文件夹', icon: 'folder', onClick: () => fetch('/api/reveal', { method: 'POST' }) },
      { key: 'quit', label: '退出程序', icon: 'power', danger: true, onClick: () => {
        fetch('/api/quit', { method: 'POST' });
        toast('程序已退出，可以关闭这个窗口了');
      } },
    ];
  }

  $('#import-file').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) importFile(file);
    event.target.value = '';
  });

  // 拖拽：把卡片拖到另一列即改变状态
  document.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.card');
    if (!card) return;
    dragPid = card.dataset.pid;
    card.classList.add('dragging');
    try {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', dragPid);
    } catch { /* 忽略 */ }
  });

  document.addEventListener('dragend', (event) => {
    const card = event.target.closest('.card');
    if (card) card.classList.remove('dragging');
    $$('.column.drag-over').forEach((el) => el.classList.remove('drag-over'));
    dragPid = null;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 60);
  });

  document.addEventListener('dragover', (event) => {
    const column = event.target.closest('.column');
    if (!column) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!column.classList.contains('drag-over')) {
      $$('.column.drag-over').forEach((el) => el.classList.remove('drag-over'));
      column.classList.add('drag-over');
    }
  });

  document.addEventListener('dragleave', (event) => {
    const column = event.target.closest('.column');
    if (column && !column.contains(event.relatedTarget)) column.classList.remove('drag-over');
  });

  document.addEventListener('drop', (event) => {
    const column = event.target.closest('.column');
    if (!column || !dragPid) return;
    event.preventDefault();
    const status = column.dataset.status;
    const pid = dragPid;
    dragPid = null;
    $$('.column.drag-over').forEach((el) => el.classList.remove('drag-over'));
    setStatus(pid, status);
  });

  // 小目标拖动排序
  let dragMs = null;

  document.addEventListener('dragstart', (event) => {
    const grip = event.target.closest('.ms-grip');
    if (!grip) return;
    const row = grip.closest('.milestone');
    if (!row) return;
    dragMs = { pid: row.dataset.pid, mid: row.dataset.mid };
    row.classList.add('ms-dragging');
    try {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', dragMs.mid);
      event.dataTransfer.setDragImage(row, 18, 18);
    } catch { /* 忽略 */ }
  });

  document.addEventListener('dragover', (event) => {
    if (!dragMs) return;
    const row = event.target.closest('.milestone');
    if (!row || row.dataset.pid !== dragMs.pid || row.dataset.mid === dragMs.mid) return;
    event.preventDefault();
    try { event.dataTransfer.dropEffect = 'move'; } catch { /* 忽略 */ }
    const rect = row.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    $$('.milestone.ms-drop-before, .milestone.ms-drop-after').forEach((el) => {
      el.classList.remove('ms-drop-before', 'ms-drop-after');
    });
    row.classList.add(after ? 'ms-drop-after' : 'ms-drop-before');
  });

  document.addEventListener('dragleave', (event) => {
    const row = event.target.closest('.milestone');
    if (row && !row.contains(event.relatedTarget)) {
      row.classList.remove('ms-drop-before', 'ms-drop-after');
    }
  });

  document.addEventListener('drop', (event) => {
    if (!dragMs) return;
    const row = event.target.closest('.milestone');
    if (!row || row.dataset.pid !== dragMs.pid) return;
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    const { pid, mid } = dragMs;
    clearMilestoneDrag();
    reorderMilestone(pid, mid, row.dataset.mid, after);
  });

  document.addEventListener('dragend', () => {
    if (dragMs) clearMilestoneDrag();
  });

  function clearMilestoneDrag() {
    dragMs = null;
    $$('.milestone.ms-dragging, .milestone.ms-drop-before, .milestone.ms-drop-after').forEach((el) => {
      el.classList.remove('ms-dragging', 'ms-drop-before', 'ms-drop-after');
    });
  }

  function reorderMilestone(pid, mid, targetMid, after) {
    if (mid === targetMid) return;
    let moved = false;
    edit((doc) => {
      const project = doc.projects.find((p) => p.id === pid);
      if (!project) return;
      const list = project.milestones.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const from = list.findIndex((m) => m.id === mid);
      if (from < 0) return;
      const [item] = list.splice(from, 1);
      let to = list.findIndex((m) => m.id === targetMid);
      if (to < 0) to = list.length;
      if (after) to += 1;
      list.splice(to, 0, item);
      list.forEach((m, index) => { m.order = index; });
      project.updatedAt = iso();
      moved = true;
    });
    if (moved) toast('顺序已调整', '撤销', undo);
  }

  function moveMilestoneBy(pid, mid, delta) {
    const project = getProject(pid);
    if (!project) return;
    const list = project.milestones.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const index = list.findIndex((m) => m.id === mid);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= list.length) return;

    edit((doc) => {
      const current = doc.projects.find((p) => p.id === pid);
      if (!current) return;
      const items = current.milestones.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const from = items.findIndex((m) => m.id === mid);
      if (from < 0) return;
      const [item] = items.splice(from, 1);
      items.splice(target, 0, item);
      items.forEach((m, i) => { m.order = i; });
      current.updatedAt = iso();
    }, { render: false });

    S.focusGrip = mid;
    render();
  }

  // 关闭窗口时通知引擎：没有窗口了就退出
  window.addEventListener('pagehide', () => {
    try { navigator.sendBeacon('/api/bye'); } catch { /* 忽略 */ }
  });

  // 启动
  bootstrap();
})();
