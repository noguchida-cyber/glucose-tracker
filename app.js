const TARGET_AFTER2 = 140;

const state = {
  currentView: 'home',
  editingId: null,
};

const el = {
  headerTitle: document.getElementById('header-title'),
  backBtn: document.getElementById('back-btn'),
  views: {
    home: document.getElementById('view-home'),
    form: document.getElementById('view-form'),
    graph: document.getElementById('view-graph'),
    settings: document.getElementById('view-settings'),
  },
  navBtns: document.querySelectorAll('.nav-btn'),
  summaryLatest: document.getElementById('summary-latest'),
  summaryCount: document.getElementById('summary-count'),
  recentList: document.getElementById('recent-list'),
  btnNewRecord: document.getElementById('btn-new-record'),
  recordForm: document.getElementById('record-form'),
  fDate: document.getElementById('f-date'),
  fTime: document.getElementById('f-time'),
  fBefore: document.getElementById('f-before'),
  fAfter1: document.getElementById('f-after1'),
  fAfter2: document.getElementById('f-after2'),
  fMenu: document.getElementById('f-menu'),
  fNote: document.getElementById('f-note'),
  deltaDisplay: document.getElementById('delta-display'),
  feedbackBadge: document.getElementById('feedback-badge'),
  btnSave: document.getElementById('btn-save'),
  btnDelete: document.getElementById('btn-delete'),
  toast: document.getElementById('toast'),
};

function showView(name, title) {
  state.currentView = name;
  Object.entries(el.views).forEach(([key, node]) => {
    node.classList.toggle('active', key === name);
  });
  el.navBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });
  el.headerTitle.textContent = title || '血糖値記録';
  el.backBtn.style.display = (name === 'form') ? 'inline-block' : 'none';
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  setTimeout(() => el.toast.classList.remove('show'), 1800);
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function nowTimeStr() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${y}/${Number(m)}/${Number(d)}`;
}

function computeDeltas(before, after1, after2) {
  const delta1 = (before != null && after1 != null) ? after1 - before : null;
  const delta2 = (after1 != null && after2 != null) ? after2 - after1 : null;
  return { delta1, delta2 };
}

function updateLiveFeedback() {
  const before = el.fBefore.value !== '' ? Number(el.fBefore.value) : null;
  const after1 = el.fAfter1.value !== '' ? Number(el.fAfter1.value) : null;
  const after2 = el.fAfter2.value !== '' ? Number(el.fAfter2.value) : null;
  const { delta1, delta2 } = computeDeltas(before, after1, after2);

  const parts = [];
  parts.push(`食後1h変化: ${delta1 != null ? (delta1 > 0 ? '+' + delta1 : delta1) : '--'}`);
  parts.push(`食後2h変化: ${delta2 != null ? (delta2 > 0 ? '+' + delta2 : delta2) : '--'}`);
  el.deltaDisplay.textContent = parts.join(' / ');

  if (after2 != null) {
    const isGood = after2 <= TARGET_AFTER2;
    el.feedbackBadge.innerHTML = `<span class="feedback-badge ${isGood ? 'good' : 'bad'}">食後2h ${after2} mg/dL ・ 目標${TARGET_AFTER2}以下${isGood ? '達成' : '未達'}</span>`;
  } else {
    el.feedbackBadge.innerHTML = '';
  }
}

function openNewRecordForm() {
  state.editingId = null;
  el.recordForm.reset();
  el.fDate.value = todayStr();
  el.fTime.value = nowTimeStr();
  el.btnDelete.style.display = 'none';
  updateLiveFeedback();
  showView('form', '記録を追加');
}

function openEditRecordForm(record) {
  state.editingId = record.id;
  el.fDate.value = record.date;
  el.fTime.value = record.time;
  el.fBefore.value = record.before ?? '';
  el.fAfter1.value = record.after1 ?? '';
  el.fAfter2.value = record.after2 ?? '';
  el.fMenu.value = record.menu ?? '';
  el.fNote.value = record.note ?? '';
  el.btnDelete.style.display = 'block';
  updateLiveFeedback();
  showView('form', '記録を編集');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const before = el.fBefore.value !== '' ? Number(el.fBefore.value) : null;
  const after1 = el.fAfter1.value !== '' ? Number(el.fAfter1.value) : null;
  const after2 = el.fAfter2.value !== '' ? Number(el.fAfter2.value) : null;
  const { delta1, delta2 } = computeDeltas(before, after1, after2);

  const record = {
    date: el.fDate.value,
    time: el.fTime.value,
    before,
    after1,
    after2,
    delta1,
    delta2,
    menu: el.fMenu.value.trim(),
    note: el.fNote.value.trim(),
  };

  if (state.editingId != null) {
    record.id = state.editingId;
    await DB.updateRecord(record);
    showToast('記録を更新しました');
  } else {
    await DB.addRecord(record);
    showToast('記録を保存しました');
  }

  await refreshHome();
  showView('home');
}

async function handleDelete() {
  if (state.editingId == null) return;
  if (!confirm('この記録を削除しますか？')) return;
  await DB.deleteRecord(state.editingId);
  showToast('記録を削除しました');
  await refreshHome();
  showView('home');
}

function sortRecordsDesc(records) {
  return [...records].sort((a, b) => {
    const ka = `${a.date} ${a.time}`;
    const kb = `${b.date} ${b.time}`;
    return kb.localeCompare(ka);
  });
}

function renderRecentList(records) {
  const recent = sortRecordsDesc(records).slice(0, 10);
  if (recent.length === 0) {
    el.recentList.innerHTML = '<div class="empty-state">まだ記録がありません</div>';
    return;
  }
  el.recentList.innerHTML = recent.map((r) => {
    const after2Class = r.after2 != null ? (r.after2 <= TARGET_AFTER2 ? 'good' : 'bad') : '';
    return `
      <div class="record-card" data-id="${r.id}">
        <div class="rc-top">
          <span>${formatDateLabel(r.date)} ${r.time}</span>
        </div>
        <div class="rc-values">
          <div class="rc-val"><div class="num">${r.before ?? '-'}</div><div class="tag">食事前</div></div>
          <div class="rc-val"><div class="num">${r.after1 ?? '-'}</div><div class="tag">食後1h</div></div>
          <div class="rc-val"><div class="num ${after2Class}">${r.after2 ?? '-'}</div><div class="tag">食後2h</div></div>
        </div>
        <div class="rc-menu">${r.menu ? escapeHtml(r.menu) : ''}</div>
      </div>
    `;
  }).join('');

  el.recentList.querySelectorAll('.record-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const id = Number(card.dataset.id);
      const records2 = await DB.getAllRecords();
      const record = records2.find((r) => r.id === id);
      if (record) openEditRecordForm(record);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function refreshHome() {
  const records = await DB.getAllRecords();
  const sorted = sortRecordsDesc(records);

  const latestWithAfter2 = sorted.find((r) => r.after2 != null);
  if (latestWithAfter2) {
    const isGood = latestWithAfter2.after2 <= TARGET_AFTER2;
    el.summaryLatest.textContent = `${latestWithAfter2.after2}`;
    el.summaryLatest.className = `value ${isGood ? 'good' : 'bad'}`;
  } else {
    el.summaryLatest.textContent = '--';
    el.summaryLatest.className = 'value';
  }

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const countThisMonth = records.filter((r) => r.date.startsWith(ym)).length;
  el.summaryCount.textContent = `${countThisMonth}件`;

  renderRecentList(records);
}

function initNav() {
  el.navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      const titles = { home: '血糖値記録', graph: 'グラフ', settings: '設定' };
      showView(view, titles[view]);
      if (view === 'graph') refreshGraphs();
    });
  });
  el.backBtn.addEventListener('click', () => showView('home'));
}

// ---- グラフ ----
const charts = { trend3: null, after2: null, single: null };

const graphEl = {
  tabs: document.querySelectorAll('.graph-tab'),
  panels: {
    trend3: document.getElementById('graph-trend3'),
    after2: document.getElementById('graph-after2'),
    single: document.getElementById('graph-single'),
  },
  canvases: {
    trend3: document.getElementById('chart-trend3'),
    after2: document.getElementById('chart-after2'),
    single: document.getElementById('chart-single'),
  },
  recordSelect: document.getElementById('single-record-select'),
};

function initGraphTabs() {
  graphEl.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      graphEl.tabs.forEach((t) => t.classList.toggle('active', t === tab));
      const target = tab.dataset.graph;
      Object.entries(graphEl.panels).forEach(([key, node]) => {
        node.style.display = (key === target) ? 'block' : 'none';
      });
    });
  });
  graphEl.recordSelect.addEventListener('change', () => {
    const id = Number(graphEl.recordSelect.value);
    renderSingleChart(id);
  });
}

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    charts[key] = null;
  }
}

async function refreshGraphs() {
  const records = await DB.getAllRecords();
  const sorted = [...records].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  if (sorted.length === 0) {
    destroyChart('trend3');
    destroyChart('after2');
    destroyChart('single');
    graphEl.recordSelect.innerHTML = '<option>記録がありません</option>';
    return;
  }

  const labels = sorted.map((r) => `${formatDateLabel(r.date)} ${r.time}`);

  destroyChart('trend3');
  charts.trend3 = new Chart(graphEl.canvases.trend3, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '食事前', data: sorted.map((r) => r.before), borderColor: '#999', backgroundColor: '#999', tension: 0.2, spanGaps: true },
        { label: '食後1h', data: sorted.map((r) => r.after1), borderColor: '#e8a33d', backgroundColor: '#e8a33d', tension: 0.2, spanGaps: true },
        { label: '食後2h', data: sorted.map((r) => r.after2), borderColor: '#c43a3a', backgroundColor: '#c43a3a', tension: 0.2, spanGaps: true },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { ticks: { maxRotation: 60, minRotation: 60 } } },
    },
  });

  destroyChart('after2');
  const after2Colors = sorted.map((r) => (r.after2 != null && r.after2 <= TARGET_AFTER2) ? '#1a8a4a' : '#c43a3a');
  charts.after2 = new Chart(graphEl.canvases.after2, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '食後2h',
          data: sorted.map((r) => r.after2),
          borderColor: '#999',
          backgroundColor: after2Colors,
          pointBackgroundColor: after2Colors,
          pointRadius: 5,
          tension: 0.2,
          spanGaps: true,
        },
        {
          label: `目標 ${TARGET_AFTER2}`,
          data: sorted.map(() => TARGET_AFTER2),
          borderColor: '#1a1a1a',
          borderDash: [6, 6],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { ticks: { maxRotation: 60, minRotation: 60 } } },
    },
  });

  graphEl.recordSelect.innerHTML = sorted
    .slice()
    .reverse()
    .map((r) => `<option value="${r.id}">${formatDateLabel(r.date)} ${r.time}${r.menu ? ' - ' + r.menu : ''}</option>`)
    .join('');
  if (sorted.length > 0) {
    const latestId = sorted[sorted.length - 1].id;
    graphEl.recordSelect.value = latestId;
    renderSingleChart(latestId, sorted);
  }
}

async function renderSingleChart(id, recordsCache) {
  const records = recordsCache || await DB.getAllRecords();
  const record = records.find((r) => r.id === id);
  if (!record) return;

  destroyChart('single');
  charts.single = new Chart(graphEl.canvases.single, {
    type: 'line',
    data: {
      labels: ['食事前', '食後1h', '食後2h'],
      datasets: [
        {
          label: `${formatDateLabel(record.date)} ${record.time}`,
          data: [record.before, record.after1, record.after2],
          borderColor: '#1a1a1a',
          backgroundColor: '#1a1a1a',
          tension: 0.2,
          spanGaps: true,
          pointRadius: 5,
        },
        {
          label: `目標 ${TARGET_AFTER2}`,
          data: [TARGET_AFTER2, TARGET_AFTER2, TARGET_AFTER2],
          borderColor: '#c43a3a',
          borderDash: [6, 6],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

// ---- CSV ----
const CSV_HEADERS = ['No.', '日付', '時間', '食事前', '食後1h', '食後2h', '食後1h変化', '食後2h変化', 'メニュー', '備考'];

const settingsEl = {
  importStatus: document.getElementById('import-status'),
  btnExport: document.getElementById('btn-export-csv'),
  btnImport: document.getElementById('btn-import-csv'),
  fileInput: document.getElementById('csv-file-input'),
};

function csvEscape(value) {
  const str = (value == null) ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function exportCsv() {
  const records = await DB.getAllRecords();
  const sorted = sortRecordsDesc(records).reverse();
  const lines = [CSV_HEADERS.map(csvEscape).join(',')];
  sorted.forEach((r, i) => {
    lines.push([
      i + 1,
      r.date,
      r.time,
      r.before ?? '',
      r.after1 ?? '',
      r.after2 ?? '',
      r.delta1 ?? '',
      r.delta2 ?? '',
      r.menu ?? '',
      r.note ?? '',
    ].map(csvEscape).join(','));
  });
  const csvContent = '﻿' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `血糖値記録_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('CSVをダウンロードしました');
}

function parseCsvDate(str) {
  const m = str.trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  const m2 = str.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m2) {
    return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  }
  return str.trim();
}

function parseCsvTime(str) {
  const m = str.trim().match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return str.trim();
}

function parseNumberOrNull(str) {
  const t = (str ?? '').trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

function parseCsvText(text) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;
  const cleanText = text.replace(/^﻿/, '');
  while (i < cleanText.length) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\r') { i += 1; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue; }
    field += ch; i += 1;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

async function importCsvFile(file) {
  const text = await file.text();
  const rows = parseCsvText(text);
  if (rows.length < 2) {
    alert('CSVにデータ行が見つかりませんでした');
    return;
  }
  const dataRows = rows.slice(1); // ヘッダー行を除く

  const records = dataRows.map((cols) => {
    const [, dateStr, timeStr, beforeStr, after1Str, after2Str, , , menuStr, noteStr] = cols;
    const before = parseNumberOrNull(beforeStr);
    const after1 = parseNumberOrNull(after1Str);
    const after2 = parseNumberOrNull(after2Str);
    const { delta1, delta2 } = computeDeltas(before, after1, after2);
    return {
      date: parseCsvDate(dateStr || ''),
      time: parseCsvTime(timeStr || ''),
      before,
      after1,
      after2,
      delta1,
      delta2,
      menu: (menuStr || '').trim(),
      note: (noteStr || '').trim(),
    };
  }).filter((r) => r.date);

  if (records.length === 0) {
    alert('取り込めるデータがありませんでした');
    return;
  }

  await DB.bulkAddRecords(records);
  await DB.setMeta('hasImported', true);
  showToast(`${records.length}件取り込みました`);
  await refreshHome();
  await updateImportStatus();
}

let hasImportedCache = false;

async function updateImportStatus() {
  hasImportedCache = !!(await DB.getMeta('hasImported'));
  settingsEl.importStatus.textContent = hasImportedCache
    ? '※すでに一度インポート済みです。再度インポートすると記録が重複する可能性があります。'
    : '過去のスプレッドシートのデータをCSVで取り込めます。通常は最初の1回だけ行ってください。';
}

function initSettings() {
  settingsEl.btnExport.addEventListener('click', exportCsv);
  settingsEl.btnImport.addEventListener('click', () => {
    if (hasImportedCache) {
      const ok = confirm('すでにインポート済みです。もう一度インポートすると記録が重複する可能性があります。続けますか？');
      if (!ok) return;
    }
    settingsEl.fileInput.click();
  });
  settingsEl.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await importCsvFile(file);
    settingsEl.fileInput.value = '';
  });
  updateImportStatus();
}

function init() {
  initNav();
  initGraphTabs();
  initSettings();
  el.btnNewRecord.addEventListener('click', openNewRecordForm);
  el.recordForm.addEventListener('submit', handleFormSubmit);
  el.btnDelete.addEventListener('click', handleDelete);
  [el.fBefore, el.fAfter1, el.fAfter2].forEach((input) => {
    input.addEventListener('input', updateLiveFeedback);
  });
  refreshHome();
}

document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => reg.update()).catch(() => {});
  });

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}
