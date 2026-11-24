/* 科研日志 —— 中英文界面切换（不改动用户数据） */
(function () {
  'use strict';

  const CJK = /[\u4e00-\u9fff]/;
  const STORAGE_KEY = 'rlog.locale';

  const EN = {
    '科研日志': 'ResearchLog',
    '进行中': 'Active',
    '未来': 'Planned',
    '已完成': 'Done',
    '暂停': 'Paused',
    '开始': 'Start',
    '目标': 'Target',
    '全部': 'All',
    '本周': 'This week',
    '项目': 'Projects',
    '项目列表': 'Projects',
    '新建项目': 'New project',
    '搜索项目、目标、小目标': 'Search projects, goals, milestones',
    '更多操作': 'More actions',
    '最近进展': 'Recent progress',
    '全部项目': 'All projects',
    '记录': 'Log',
    'Ctrl + Enter 记录': 'Ctrl + Enter to log',
    '复制当前列表（纯文本，适合贴进周报）': 'Copy this list (plain text, ready for a weekly report)',
    '复制当前列表': 'Copy list',
    '复制这条进展': 'Copy this entry',
    '进展日志': 'Progress log',
    '大目标': 'Main goal',
    '成功判据': 'Success criteria',
    '资料与项目库': 'Resources & repositories',
    '文献': 'Papers',
    '项目库': 'Repositories',
    '笔记': 'Notes',
    '挂文献 PDF、项目文件夹或 Markdown 笔记，之后点一下就能打开。':
      'Attach PDFs, project folders or Markdown notes; one click opens them later.',
    '小目标': 'Milestones',
    '删除项目': 'Delete project',
    '进展': 'Progress',
    '项目状态': 'Status',
    '研究领域 / 标签': 'Field / tags',
    '添加一个小目标，回车即可': 'Add a milestone and press Enter',
    '逾期': 'Overdue',
    '今天': 'Today',
    '昨天': 'Yesterday',
    '明天': 'Tomorrow',
    '· 今天': '· Today',
    '· 7 天内': '· Within 7 days',
    '未来 7 天': 'Next 7 days',
    '复制回顾': 'Copy review',
    '本周完成': 'Completed this week',
    '本周进展': 'Progress this week',
    '久未更新': 'Stale',
    '设置': 'Settings',
    '设置与备份': 'Settings & backup',
    '导出 / 备份': 'Export / backup',
    '导出 Markdown': 'Export Markdown',
    '导出 JSON': 'Export JSON',
    '导入 JSON': 'Import JSON',
    '打开数据文件夹': 'Open data folder',
    '完成': 'Done',
    '取消': 'Cancel',
    '确定': 'OK',
    '确认': 'Confirm',
    '关闭': 'Close',
    '删除': 'Delete',
    '保存': 'Save',
    '撤销': 'Undo',
    '清除': 'Clear',
    '添加': 'Add',
    '拖入文件夹 / 文件…': 'Drop a folder / file…',
    '选择文件夹…': 'Choose folder…',
    '选择文件…': 'Choose file…',
    '在文件夹中显示': 'Show in folder',
    '从项目中移除': 'Remove from project',
    '备注与截止日期': 'Note & due date',
    '拖动排序（也可以 Alt + ↑ / ↓）': 'Drag to reorder (or Alt + ↑ / ↓)',
    '拖动排序': 'Drag to reorder',
    '正在读取…': 'Loading…',
    '读不出来：': 'Cannot read: ',
    '更新于': 'Updated',
    '创建于': 'Created',
    '还没有项目': 'No projects yet',
    '点右上角「新建项目」开始': 'Click “New project” to start',
    '还没有进展记录。': 'No progress yet.',
    '写下第一条，之后就有一条时间线。': 'Write the first one to start a timeline.',
    '随手记一条进展…': 'Jot down a progress note…',
    '今天做了什么、结果如何、下一步…': 'What did you do today? Results? Next steps?',
    '还没有写大目标': 'No main goal yet',
    '未命名项目': 'Untitled project',
    '还有小目标没完成': 'Milestones remaining',
    '标记完成': 'Mark done',
    '标记未完成': 'Mark not done',
    '删除这个项目？': 'Delete this project?',
    '导入并覆盖当前数据？': 'Import and overwrite current data?',
    '当前数据会先备份一份，然后被这份文件替换。确定继续吗？':
      'Current data will be backed up first, then replaced by this file. Continue?',
    '小目标全部完成。要把这个项目标记为「已完成」吗？':
      'All milestones are done. Mark this project as Done?',
    '数据保存在下面这个文件里，程序每变动一次就原子写入，并每天自动备份一份。':
      'Data lives in the file below. Every change is written atomically, with a daily backup.',
    '拖动卡片可以改变项目状态；所有改动自动保存。':
      'Drag cards to change project status; all changes save automatically.',
    '已载入示例项目': 'Sample projects loaded',
    '已载入磁盘上的最新版本': 'Loaded the latest version from disk',
    '数据文件已被外部修改，已载入最新版本': 'Data changed externally; latest version loaded',
    '数据文件在外部被修改了，当前修改尚未保存': 'Data changed externally; your changes are not saved yet',
    '程序已退出，可以关闭这个窗口了': 'The engine has exited; you can close this window',
    '请求失败': 'Request failed',
    '未知错误': 'Unknown error',
    '保存失败：': 'Save failed: ',
    '导入失败：': 'Import failed: ',
    '打不开：': 'Cannot open: ',
    '打不开文件夹：': 'Cannot open folder: ',
    '打不开接收窗口：': 'Cannot open the drop window: ',
    '添加失败：': 'Add failed: ',
    '移除失败：': 'Remove failed: ',
    '读取失败': 'Read failed',
    '复制失败': 'Copy failed',
    '已复制': 'Copied',
    '已复制这条进展': 'Entry copied',
    '已添加': 'Added',
    '已导出': 'Exported',
    '已记录': 'Logged',
    '资料已添加': 'Resource added',
    '这些已经在项目里了': 'Already in this project',
    '已从项目中移除': 'Removed from project',
    '已删除小目标': 'Milestone deleted',
    '已撤销上一步': 'Undone',
    '没有可以撤销的操作': 'Nothing to undo',
    '项目已删除': 'Project deleted',
    '创建项目': 'Project created',
    '状态改为「已完成」': 'Status changed to Done',
    '状态改为「进行中」': 'Status changed to Active',
    '状态改为「未来」': 'Status changed to Planned',
    '状态改为「暂停」': 'Status changed to Paused',
    '顺序已调整': 'Order updated',
    '周报已复制到剪贴板': 'Weekly report copied to clipboard',
    '还没有可以复制的进展': 'No progress to copy',
    '无法连接本地引擎': 'Cannot connect to the local engine',
    '问题反馈': 'Feedback',
    '数据与备份': 'Data & backup',
    '从第一个项目开始': 'Start with your first project',
    '完成的项目会留在这里': 'Completed projects will stay here',
    '把在做的项目拖到这里': 'Drag active projects here',
    '把还没启动的想法放这里': 'Park ideas that have not started yet',
    '最近 7 天': 'Last 7 days',
    '导出失败': 'Export failed',
    '导入成功': 'Imported',
  };

  const PATTERNS = [
    [/^已添加 (\d+) 项$/, 'Added $1 item(s)'],
    [/^已复制 (\d+) 条进展$/, 'Copied $1 entries'],
    [/^(\d+) 天$/, '$1 days'],
    [/^(\d+) 天前$/, '$1 days ago'],
    [/^今天 (.+)$/, 'Today $1'],
    [/^昨天 (.+)$/, 'Yesterday $1'],
    [/^明天 (.+)$/, 'Tomorrow $1'],
    [/^(\d+) 项$/, '$1 items'],
    [/^(\d+) 个项目$/, '$1 projects'],
    [/^逾期 (\d+) 天$/, '$1 days overdue'],
    [/^创建于 (.+) · 更新于 昨天$/, 'Created $1 · Updated yesterday'],
    [/^创建于 (.+) · 更新于 今天$/, 'Created $1 · Updated today'],
    [/^创建于 (.+) · 更新于 (.+)$/, 'Created $1 · Updated $2'],
    [/^· 更新于 昨天$/, '· Updated yesterday'],
    [/^· 更新于 今天$/, '· Updated today'],
    [/^· 更新于 (.+)$/, '· Updated $1'],
    [/^最近 7 天 · (.+) – (.+)$/, 'Last 7 days · $1 – $2'],
    [/^还有 (\d+) 个小目标没有打勾。仍然标记为已完成吗？$/, '$1 milestones are still unchecked. Mark as Done anyway?'],
    [/^「(.+)」还有 (\d+) 个小目标没有打勾。仍然标记为已完成吗？$/, '“$1” still has $2 unchecked milestone(s). Mark as Done anyway?'],
    [/^「(.+)」和它的小目标、进展记录都会被删除。删除后可以用 Ctrl\+Z 撤销。$/, '“$1”, its milestones and progress will be deleted. You can undo with Ctrl+Z.'],
    [/^完成「(.+)」$/, 'Completed “$1”'],
    [/^重新打开「(.+)」$/, 'Reopened “$1”'],
    [/^(.+)。请关闭窗口后重新双击「科研日志」。$/, '$1. Close this window and reopen ResearchLog.'],
    [/^保存失败：(.*)$/, 'Save failed: $1'],
    [/^导入失败：(.*)$/, 'Import failed: $1'],
    [/^打不开：(.*)$/, 'Cannot open: $1'],
    [/^打不开文件夹：(.*)$/, 'Cannot open folder: $1'],
    [/^打不开接收窗口：(.*)$/, 'Cannot open the drop window: $1'],
    [/^添加失败：(.*)$/, 'Add failed: $1'],
    [/^移除失败：(.*)$/, 'Remove failed: $1'],
    [/^读不出来：(.*)$/, 'Cannot read: $1'],
  ];

  const SKIP_TEXT = [
    '.card', '.milestone', '.detail-title', '.goal-text', '.goal-criteria',
    '.resource-label', '.log-project', '.log-text[data-kind="note"]', '.log-input',
    '.reader-body', '.reader-title', '.modal-path', '.project-item', '.week-text', '.week-project',
    '#lang-btn', 'script', 'style', 'noscript',
  ].join(', ');

  const SKIP_ATTR = [
    '.card', '.milestone', '.detail-title', '.goal-text', '.goal-criteria',
    '.resource-label', '.project-item', '.week-text', '.week-project', '.modal-path',
    '.reader-body', '.reader-title', '#lang-btn',
  ].join(', ');

  let locale = 'zh';
  const textRecords = new WeakMap();
  const attrRecords = new WeakMap();

  function normalize(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function translate(value) {
    if (locale !== 'en') return value;
    const key = normalize(value);
    if (!key) return value;
    if (Object.prototype.hasOwnProperty.call(EN, key)) return EN[key];
    for (const [pattern, replacement] of PATTERNS) {
      if (pattern.test(key)) return key.replace(pattern, replacement);
    }
    return value;
  }

  function applyText(node) {
    const raw = node.nodeValue;
    if (!raw) return;
    const current = raw.trim();
    if (!current) return;

    let record = textRecords.get(node);
    if (record && record.last !== current) record = null;
    if (!record) {
      if (!CJK.test(current)) return;
      record = { original: current, last: current };
      textRecords.set(node, record);
    } else if (!CJK.test(record.original)) {
      return;
    }

    const value = locale === 'en' ? translate(record.original) : record.original;
    if (current === value) {
      record.last = value;
      return;
    }
    node.nodeValue = raw.replace(current, value);
    record.last = value;
  }

  function applyAttr(element, attr) {
    const current = element.getAttribute(attr);
    if (current == null) return;

    let store = attrRecords.get(element);
    if (!store) {
      store = {};
      attrRecords.set(element, store);
    }
    let record = store[attr];
    if (record && record.last !== current) record = null;
    if (!record) {
      if (!CJK.test(current)) return;
      record = { original: current, last: current };
      store[attr] = record;
    } else if (!CJK.test(record.original)) {
      return;
    }

    const value = locale === 'en' ? translate(record.original) : record.original;
    if (current === value) {
      record.last = value;
      return;
    }
    element.setAttribute(attr, value);
    record.last = value;
  }

  const ATTRS = ['placeholder', 'title', 'aria-label', 'data-placeholder'];

  function walk(root) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      const parent = root.parentElement;
      if (parent && !parent.closest(SKIP_TEXT)) applyText(root);
      return;
    }
    if (!(root instanceof Element)) return;

    if (!root.closest(SKIP_ATTR)) {
      for (const attr of ATTRS) {
        if (root.hasAttribute(attr)) applyAttr(root, attr);
      }
      for (const element of root.querySelectorAll('[placeholder],[title],[aria-label],[data-placeholder]')) {
        if (element.closest(SKIP_ATTR)) continue;
        for (const attr of ATTRS) {
          if (element.hasAttribute(attr)) applyAttr(element, attr);
        }
      }
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP_TEXT)) continue;
      applyText(node);
    }
  }

  function updateButton() {
    const button = document.getElementById('lang-btn');
    if (!button) return;
    const label = locale === 'en' ? '中文' : 'EN';
    if (button.textContent !== label) button.textContent = label;
    const title = locale === 'en' ? '切换到中文' : 'Switch to English';
    if (button.title !== title) button.title = title;
    button.setAttribute('aria-label', title);
  }

  function updateTitle() {
    document.title = locale === 'en' ? 'ResearchLog' : '科研日志';
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      walk(document.body);
      updateButton();
      updateTitle();
    });
  }

  function setLocale(next) {
    locale = next === 'en' ? 'en' : 'zh';
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch (error) {
      /* 忽略隐私模式下的写入失败 */
    }
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
    walk(document.body);
    updateButton();
    updateTitle();
    schedule();
  }

  function init() {
    let stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      stored = null;
    }
    if (stored === 'en' || stored === 'zh') {
      locale = stored;
    } else {
      const language = (navigator.language || '').toLowerCase();
      locale = language.startsWith('zh') ? 'zh' : 'en';
    }

    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
    const button = document.getElementById('lang-btn');
    if (button) {
      button.addEventListener('click', () => setLocale(locale === 'en' ? 'zh' : 'en'));
    }

    walk(document.body);
    updateButton();
    updateTitle();

    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  window.RlogI18n = {
    init,
    setLocale,
    t: translate,
    get locale() {
      return locale;
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
