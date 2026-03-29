/* =====================================================
   DIGITAL MOOD JOURNAL — app.js
   ===================================================== */

// ===================== STATE =====================
const DEFAULT_STATE = {
  userName: '',
  entries: [],
  weeklySummary: null,
  monthlySummary: null,
  trendAnalysis: null,
  journalDraft: ''
};

let state = { ...DEFAULT_STATE };
let selectedMood = null;
let calendarDate = new Date();
let insightPeriod = 'week';

// ===================== MOOD CONFIG =====================
const MOODS = {
  'Happy':    { score: 5, cls: 'happy',   icon: 'fa-face-grin-stars', color: '#6bcb77' },
  'Good':     { score: 4, cls: 'good',    icon: 'fa-face-smile',      color: '#a8d8a8' },
  'Neutral':  { score: 3, cls: 'neutral', icon: 'fa-face-meh',        color: '#f9c74f' },
  'Sad':      { score: 2, cls: 'sad',     icon: 'fa-face-frown-open', color: '#f4a261' },
  'Very Sad': { score: 1, cls: 'verysad', icon: 'fa-face-sad-tear',   color: '#e76f51' }
};

const MOOD_EMOJIS = {
  'Happy': '😄', 'Good': '🙂', 'Neutral': '😐', 'Sad': '😟', 'Very Sad': '😢'
};

// ===================== LOCAL STORAGE =====================
function loadState() {
  try {
    const saved = localStorage.getItem('moodJournalState');
    if (saved) {
      const parsed = JSON.parse(saved);
      state = { ...DEFAULT_STATE, ...parsed };
    }
  } catch (e) {
    console.warn('Could not load state from LocalStorage:', e);
    state = { ...DEFAULT_STATE };
  }
}

function saveState() {
  try {
    localStorage.setItem('moodJournalState', JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state to LocalStorage:', e);
  }
}

// ===================== INITIALISATION =====================
function init() {
  loadState();
  setTodayDate();
  renderAll();
  setupEventListeners();
  if (!state.userName) openNameModal();
}

function setTodayDate() {
  const el = document.getElementById('entryDate');
  const today = new Date().toISOString().split('T')[0];
  el.value = today;
  el.max = today;
}

function renderAll() {
  updateHeader();
  updateMotivationalBanner();
  renderQuickStats();
  renderTimeline('all');
  renderCalendar();
  computeSummaries();
  renderInsights();
  renderJournalSection();
}

// ===================== HEADER =====================
function updateHeader() {
  const nameEl = document.getElementById('userName-display');
  const avatarEl = document.getElementById('userAvatarBtn');

  nameEl.textContent = state.userName || 'Set your name';

  if (state.userName) {
    avatarEl.textContent = state.userName.charAt(0).toUpperCase();
    avatarEl.style.fontFamily = "'DM Sans', sans-serif";
  } else {
    avatarEl.innerHTML = '<i class="fas fa-user"></i>';
  }
}

// ===================== MOTIVATIONAL BANNER =====================
function updateMotivationalBanner() {
  const messages = [
    { icon: '🌟', title: "Keep going, you're doing great!",       text: "Every small act of self-reflection is a step toward emotional clarity." },
    { icon: '🌱', title: "Your emotional awareness is growing!",   text: "Consistent journaling helps you understand your inner world better." },
    { icon: '🌈', title: "You're building self-compassion",        text: "Acknowledging your feelings — all of them — takes real courage." },
    { icon: '💛', title: "Emotions are information, not weakness", text: "Understanding them helps you respond, not just react." },
    { icon: '🦋', title: "Growth is rarely linear",                text: "Some days are harder than others — and that's perfectly okay." }
  ];

  const entries = state.entries || [];
  let chosen = messages[0];

  if (entries.length > 0) {
    const recent = entries.slice(0, 3);
    const avg = recent.reduce((a, e) => a + e.moodScore, 0) / recent.length;
    if (avg >= 4)     chosen = messages[0];
    else if (avg >= 3) chosen = messages[1];
    else               chosen = messages[3];
  }

  document.getElementById('motivational-banner').innerHTML = `
    <div class="banner-icon">${chosen.icon}</div>
    <div>
      <h3>${chosen.title}</h3>
      <p>${chosen.text}</p>
    </div>`;
}

// ===================== MOOD PICKER =====================
function setupMoodPicker() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMood = {
        type:  btn.dataset.mood,
        score: parseInt(btn.dataset.score)
      };
    });
  });
}

// ===================== SAVE ENTRY =====================
function saveEntry() {
  if (!selectedMood) {
    showToast('Please select a mood first!', 'error');
    return;
  }

  const date = document.getElementById('entryDate').value;
  if (!date) { showToast('Please select a date!', 'error'); return; }

  const note       = document.getElementById('shortNote').value.trim();
  const reflection = document.getElementById('reflectionText').value.trim();
  const intensity  = parseInt(document.getElementById('intensitySlider').value);

  // Remove any existing entry for the same date (deduplication)
  state.entries = state.entries.filter(e => e.date !== date);

  const entry = {
    id:         Date.now(),
    date,
    moodType:   selectedMood.type,
    moodScore:  selectedMood.score,
    intensity,
    note:       note || 'No note',
    reflection: reflection || ''
  };

  state.entries.push(entry);
  state.entries.sort((a, b) => b.date.localeCompare(a.date));

  saveState();
  showEmojiAnimation(selectedMood.type);
  showToast(`Mood saved! You felt ${selectedMood.type} today 💛`, 'success');
  clearTrackerForm();
  renderAll();

  // Navigate to timeline after a brief delay
  setTimeout(() => switchTab('timeline'), 800);
}

function clearTrackerForm() {
  selectedMood = null;
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('shortNote').value = '';
  document.getElementById('reflectionText').value = '';
  document.getElementById('intensitySlider').value = 5;
  document.getElementById('intensity-display').textContent = '5';
  setTodayDate();
}

// ===================== QUICK STATS (TRACKER TAB) =====================
function renderQuickStats() {
  const wrap = document.getElementById('quick-stats');
  const row  = document.getElementById('quickStatsRow');
  const entries = state.entries || [];

  if (entries.length === 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  const last7    = getLast7Entries();
  const avg      = last7.length ? (last7.reduce((a, e) => a + e.moodScore, 0) / last7.length).toFixed(1) : 0;
  const streak   = computeStreak();
  const dominant = getDominantMood(last7);
  const m        = dominant ? MOODS[dominant] : null;

  row.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--accent2)">
        <i class="fas fa-chart-line" style="color:var(--accent)"></i>
      </div>
      <div class="stat-value">${avg}</div>
      <div class="stat-label">7-Day Avg Mood</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--happy-light)">
        <i class="fas fa-fire" style="color:var(--happy)"></i>
      </div>
      <div class="stat-value">${streak}</div>
      <div class="stat-label">Day Streak</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--purple-light)">
        <i class="fas fa-book-open" style="color:var(--purple)"></i>
      </div>
      <div class="stat-value">${entries.length}</div>
      <div class="stat-label">Total Entries</div>
    </div>
    ${m ? `
    <div class="stat-card">
      <div class="stat-icon" style="background:${m.color}22">
        <i class="fas ${m.icon}" style="color:${m.color}"></i>
      </div>
      <div class="stat-value" style="font-size:1rem">${dominant}</div>
      <div class="stat-label">Top Mood (7 days)</div>
    </div>` : ''}
  `;
}

// ===================== TIMELINE =====================
function renderTimeline(filter) {
  const container = document.getElementById('timelineContainer');
  const entries   = getFilteredEntries(filter);

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-book-open"></i>
        <h3>No mood entries yet</h3>
        <p>Start by logging your first mood in the Tracker tab!</p>
      </div>`;
    return;
  }

  container.innerHTML = entries.map(entry => {
    const m       = MOODS[entry.moodType] || MOODS['Neutral'];
    const dateStr = formatDate(entry.date);

    return `
      <div class="timeline-card ${m.cls}" onclick="toggleReflection('ref-${entry.id}', this)">
        <div class="tc-header">
          <div class="tc-mood-icon ${m.cls}">
            <i class="fas ${m.icon}"></i>
          </div>
          <div class="tc-info">
            <div class="tc-mood-label">${entry.moodType}</div>
            <div class="tc-date">
              <i class="fas fa-calendar fa-xs" style="margin-right:4px"></i>${dateStr}
            </div>
          </div>
          ${entry.intensity ? `<span class="tc-intensity-pill"><i class="fas fa-bolt fa-xs"></i> ${entry.intensity}/10</span>` : ''}
          <button class="btn-icon" onclick="deleteEntry(event, '${entry.id}')" title="Delete entry">
            <i class="fas fa-trash-can"></i>
          </button>
        </div>
        <div class="tc-note">
          <i class="fas fa-quote-left fa-xs" style="margin-right:6px;opacity:0.4"></i>${escHtml(entry.note)}
        </div>
        ${entry.reflection ? `
          <div class="tc-toggle">
            <i class="fas fa-chevron-down fa-xs"></i> Show reflection
          </div>
          <div class="tc-reflection" id="ref-${entry.id}">${escHtml(entry.reflection)}</div>
        ` : ''}
      </div>`;
  }).join('');
}

function toggleReflection(id, card) {
  const ref    = document.getElementById(id);
  if (!ref) return;
  const toggle = card.querySelector('.tc-toggle');
  ref.classList.toggle('open');
  if (toggle) {
    toggle.innerHTML = ref.classList.contains('open')
      ? '<i class="fas fa-chevron-up fa-xs"></i> Hide reflection'
      : '<i class="fas fa-chevron-down fa-xs"></i> Show reflection';
  }
}

function deleteEntry(e, id) {
  e.stopPropagation();
  if (!confirm('Delete this entry?')) return;
  state.entries = state.entries.filter(en => String(en.id) !== String(id));
  saveState();
  renderAll();
  showToast('Entry deleted', 'error');
}

// ===================== CALENDAR =====================
function renderCalendar() {
  const year   = calendarDate.getFullYear();
  const month  = calendarDate.getMonth();
  const title  = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const today  = new Date().toISOString().split('T')[0];

  document.getElementById('calTitle').textContent = title;

  const firstDay     = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const daysInPrev   = new Date(year, month, 0).getDate();
  const totalCells   = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  // Build date → entry map
  const entryMap = {};
  (state.entries || []).forEach(e => { entryMap[e.date] = e; });

  let cells = '';

  for (let i = 0; i < totalCells; i++) {
    let day, dYear = year, dMonth = month, cls = '';

    if (i < firstDay) {
      day    = daysInPrev - firstDay + i + 1;
      dMonth = month - 1;
      cls    = 'other-month';
      if (dMonth < 0) { dMonth = 11; dYear--; }
    } else if (i >= firstDay + daysInMonth) {
      day    = i - firstDay - daysInMonth + 1;
      dMonth = month + 1;
      cls    = 'other-month';
      if (dMonth > 11) { dMonth = 0; dYear++; }
    } else {
      day = i - firstDay + 1;
    }

    const dateStr = `${dYear}-${String(dMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const entry   = entryMap[dateStr];
    const moodCls = entry ? (MOODS[entry.moodType]?.cls || '') : '';
    const moodIcon = entry ? (MOODS[entry.moodType]?.icon || '') : '';

    cells += `
      <div class="cal-day ${cls} ${entry ? 'has-entry' : ''} ${moodCls} ${isToday ? 'today' : ''}">
        ${entry ? `<div class="cal-dot"><i class="fas ${moodIcon} fa-xs"></i></div>` : ''}
        <div class="cal-day-num">${day}</div>
        ${entry ? `
          <div class="cal-tooltip">
            ${entry.moodType}: ${entry.note.substring(0, 40)}${entry.note.length > 40 ? '…' : ''}
          </div>` : ''}
      </div>`;
  }

  document.getElementById('calGrid').innerHTML = cells;
}

// ===================== SUMMARIES =====================
function computeSummaries() {
  state.weeklySummary  = buildSummary(getLast7Entries());
  state.monthlySummary = buildSummary(getLast30Entries());
  state.trendAnalysis  = computeTrend();
  saveState();
}

function buildSummary(entries) {
  if (!entries.length) return null;

  const total = entries.length;
  const avg   = entries.reduce((a, e) => a + e.moodScore, 0) / total;

  const dist = {};
  Object.keys(MOODS).forEach(k => { dist[k] = 0; });
  entries.forEach(e => { if (dist[e.moodType] !== undefined) dist[e.moodType]++; });

  const best     = entries.reduce((a, b) => b.moodScore > a.moodScore ? b : a, entries[0]);
  const dominant = Object.entries(dist).sort((a, b) => b[1] - a[1])[0][0];

  return { total, avg, dist, best, dominant };
}

function computeTrend() {
  const entries = (state.entries || []).slice(0, 10);
  if (entries.length < 3) return null;

  const recent3 = entries.slice(0, 3).reduce((a, e) => a + e.moodScore, 0) / 3;
  const olderEntries = entries.slice(3);
  const older = olderEntries.length
    ? olderEntries.reduce((a, e) => a + e.moodScore, 0) / olderEntries.length
    : recent3;

  const diff = recent3 - older;
  if (diff > 0.5)  return 'improving';
  if (diff < -0.5) return 'declining';
  return 'stable';
}

// ===================== INSIGHTS =====================
function renderInsights() {
  const summary = insightPeriod === 'week' ? state.weeklySummary : state.monthlySummary;
  renderInsightStats(summary);
  renderBarChart(summary);
  renderPieChart(summary);
  renderLineChart();
  renderInsightList(summary);
  renderConsistency();
}

function renderInsightStats(summary) {
  const container = document.getElementById('insightStats');

  if (!summary) {
    container.innerHTML = `
      <div class="empty-state" style="width:100%">
        <i class="fas fa-chart-pie"></i>
        <h3>No data yet</h3>
        <p>Add entries to see your insights!</p>
      </div>`;
    return;
  }

  const m     = MOODS[summary.dominant] || MOODS['Neutral'];
  const trend = state.trendAnalysis;
  const trendLabel = trend
    ? `<span class="trend-badge ${trend}">${
        trend === 'improving' ? '↑ Improving' :
        trend === 'declining' ? '↓ Declining' : '→ Stable'
      }</span>`
    : '';

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--accent2)">
        <i class="fas fa-list" style="color:var(--accent)"></i>
      </div>
      <div class="stat-value">${summary.total}</div>
      <div class="stat-label">Entries</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--good-light)">
        <i class="fas fa-star" style="color:var(--good)"></i>
      </div>
      <div class="stat-value">${summary.avg.toFixed(1)}</div>
      <div class="stat-label">Avg Score</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:${m.color}22">
        <i class="fas ${m.icon}" style="color:${m.color}"></i>
      </div>
      <div class="stat-value" style="font-size:0.9rem">${summary.dominant}</div>
      <div class="stat-label">Top Mood</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--purple-light)">
        <i class="fas fa-arrow-trend-up" style="color:var(--purple)"></i>
      </div>
      <div class="stat-value" style="font-size:1rem">${trendLabel || 'N/A'}</div>
      <div class="stat-label">Trend</div>
    </div>
  `;
}

function renderBarChart(summary) {
  const container = document.getElementById('moodBarChart');

  if (!summary) {
    container.innerHTML = '<div style="color:var(--text3);font-size:0.82rem;text-align:center;padding:20px">No data</div>';
    return;
  }

  const total = summary.total || 1;
  const barColors = {
    'Happy': '#6bcb77', 'Good': '#a8d8a8', 'Neutral': '#f9c74f',
    'Sad':   '#f4a261', 'Very Sad': '#e76f51'
  };

  container.innerHTML = Object.entries(summary.dist).map(([mood, count]) => `
    <div class="bar-row">
      <div class="bar-label">${mood}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(count / total * 100).toFixed(1)}%; background:${barColors[mood]}"></div>
      </div>
      <div class="bar-count">${count}</div>
    </div>`).join('');
}

function renderPieChart(summary) {
  const canvas = document.getElementById('pieChart');
  const legend = document.getElementById('pieLegend');
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, 200, 200);

  if (!summary || !summary.total) {
    ctx.fillStyle = '#f0eae3';
    ctx.beginPath(); ctx.arc(100, 100, 80, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b0a89f'; ctx.font = '13px DM Sans'; ctx.textAlign = 'center';
    ctx.fillText('No data', 100, 107);
    legend.innerHTML = '';
    return;
  }

  const pieColors = {
    'Happy': '#6bcb77', 'Good': '#a8d8a8', 'Neutral': '#f9c74f',
    'Sad':   '#f4a261', 'Very Sad': '#e76f51'
  };

  const data  = Object.entries(summary.dist).filter(([, v]) => v > 0);
  const total = data.reduce((a, [, v]) => a + v, 0);
  let start   = -Math.PI / 2;

  // Draw slices
  data.forEach(([mood, count]) => {
    const slice = (count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(100, 100);
    ctx.arc(100, 100, 85, start, start + slice);
    ctx.closePath();
    ctx.fillStyle   = pieColors[mood];
    ctx.fill();
    ctx.strokeStyle = '#fffdf9';
    ctx.lineWidth   = 3;
    ctx.stroke();
    start += slice;
  });

  // Centre donut hole
  ctx.beginPath(); ctx.arc(100, 100, 45, 0, Math.PI * 2);
  ctx.fillStyle = '#fffdf9'; ctx.fill();

  // Centre text
  ctx.fillStyle = '#3d3530';
  ctx.font      = 'bold 18px serif';
  ctx.textAlign = 'center';
  ctx.fillText(total, 100, 104);
  ctx.fillStyle = '#b0a89f';
  ctx.font      = '11px sans-serif';
  ctx.fillText('entries', 100, 118);

  // Legend
  legend.innerHTML = data.map(([mood, count]) => `
    <div class="pie-legend-item">
      <div class="pie-legend-dot" style="background:${pieColors[mood]}"></div>
      ${mood} (${Math.round(count / total * 100)}%)
    </div>`).join('');
}

function renderLineChart() {
  const canvas = document.getElementById('lineChart');
  const ctx    = canvas.getContext('2d');
  const w      = canvas.offsetWidth || 600;
  canvas.width = w;
  ctx.clearRect(0, 0, w, 80);

  const entries  = insightPeriod === 'week' ? getLast7Entries() : getLast30Entries();
  const reversed = [...entries].reverse();

  if (reversed.length < 2) {
    ctx.fillStyle = '#b0a89f';
    ctx.font      = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Add more entries to see trend', w / 2, 45);
    return;
  }

  const pad = { l: 30, r: 20, t: 10, b: 20 };
  const cw  = w - pad.l - pad.r;
  const ch  = 80 - pad.t - pad.b;

  // Grid lines
  ctx.strokeStyle = '#ede7de';
  ctx.lineWidth   = 1;
  [1, 2, 3, 4, 5].forEach(i => {
    const y = pad.t + ch - ((i - 1) / 4) * ch;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
  });

  // Points
  const pts = reversed.map((e, i) => ({
    x: pad.l + (i / (reversed.length - 1)) * cw,
    y: pad.t + ch - ((e.moodScore - 1) / 4) * ch
  }));

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
  grad.addColorStop(0, 'rgba(201,168,124,0.25)');
  grad.addColorStop(1, 'rgba(201,168,124,0)');

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pad.t + ch);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, pad.t + ch);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Smooth line using bezier curves
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.forEach((p, i) => {
    if (i === 0) return;
    const prev = pts[i - 1];
    const cpx  = (prev.x + p.x) / 2;
    ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
  });
  ctx.strokeStyle = '#c9a87c';
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // Data-point dots
  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle   = '#c9a87c'; ctx.fill();
    ctx.strokeStyle = '#fffdf9'; ctx.lineWidth = 2; ctx.stroke();
  });
}

function renderInsightList(summary) {
  const container = document.getElementById('insightList');

  if (!summary) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-lightbulb"></i>
        <h3>Insights will appear here</h3>
        <p>Your weekly insights will appear once you add more entries.</p>
      </div>`;
    return;
  }

  const insights = [];
  const trend    = state.trendAnalysis;

  // Trend insight
  if (trend === 'improving') {
    insights.push({ type: 'positive', icon: 'fa-arrow-trend-up', title: 'Improving Trend',
      text: 'Your mood has improved over the last few days. Keep it up! 🌱' });
  } else if (trend === 'declining') {
    insights.push({ type: 'warning', icon: 'fa-arrow-trend-down', title: 'Declining Trend',
      text: 'Your mood seems to be dipping lately. Consider some self-care activities.' });
  } else {
    insights.push({ type: 'neutral', icon: 'fa-minus', title: 'Stable Mood',
      text: 'Your emotional state has been consistent recently.' });
  }

  // Average insight
  if (summary.avg >= 4) {
    insights.push({ type: 'positive', icon: 'fa-face-smile', title: 'Great Emotional Health',
      text: "Your average mood score is strong! You're thriving emotionally." });
  } else if (summary.avg < 2.5) {
    insights.push({ type: 'warning', icon: 'fa-heart', title: 'Be Kind to Yourself',
      text: 'Your scores suggest a tough period. Prioritize rest and connection.' });
  }

  // Consistency insight
  const consistency = computeConsistencyScore();
  if (consistency >= 70) {
    insights.push({ type: 'positive', icon: 'fa-fire', title: 'High Consistency!',
      text: `You logged moods ${consistency}% of days this period. Excellent self-awareness!` });
  } else {
    insights.push({ type: 'info', icon: 'fa-calendar-check', title: 'Build Your Habit',
      text: `You've logged ${consistency}% of days. Daily check-ins create richer insights.` });
  }

  // Reflection depth insight
  const withReflections = (state.entries || []).filter(e => e.reflection && e.reflection.length > 20);
  if (withReflections.length >= 3) {
    insights.push({ type: 'positive', icon: 'fa-book-open', title: 'Active Reflector',
      text: "You're writing detailed reflections — a sign of deep emotional intelligence." });
  }

  container.innerHTML = insights.map(i => `
    <div class="insight-item ${i.type}">
      <div class="insight-icon"><i class="fas ${i.icon}"></i></div>
      <div>
        <h4>${i.title}</h4>
        <p>${i.text}</p>
      </div>
    </div>`).join('');
}

function renderConsistency() {
  const score  = computeConsistencyScore();
  const r      = 36;
  const circ   = 2 * Math.PI * r;
  const dash   = (score / 100) * circ;
  const container = document.getElementById('consistencyWidget');

  container.innerHTML = `
    <div class="consistency-wrap">
      <div class="consistency-ring">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="${r}" fill="none" stroke="#ede7de" stroke-width="7"/>
          <circle cx="40" cy="40" r="${r}" fill="none" stroke="#c9a87c" stroke-width="7"
            stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
            stroke-linecap="round"
            style="transition: stroke-dasharray 1s ease"/>
        </svg>
        <div class="ring-text">${score}%</div>
      </div>
      <div class="consistency-info">
        <h4>Logging Consistency</h4>
        <p>${
          score >= 70 ? "You're on a great streak! Keep it up." :
          score >= 40 ? 'Good progress. Try to log daily for richer insights.' :
          'Start building your daily check-in habit.'
        }</p>
      </div>
    </div>
    <div style="margin-top:14px;font-size:0.78rem;color:var(--text3)">
      ${getConsistencyMessage(score)}
    </div>`;
}

// ===================== JOURNAL =====================
function renderJournalSection() {
  if (state.journalDraft) {
    document.getElementById('journalText').value = state.journalDraft;
  }
  updateWordCount();
  renderRecentReflections();
}

function renderRecentReflections() {
  const container   = document.getElementById('recentReflections');
  const withRef     = (state.entries || []).filter(e => e.reflection && e.reflection.trim());

  if (withRef.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-feather"></i>
        <h3>No reflections yet</h3>
        <p>Add detailed reflections to your mood entries to see them here.</p>
      </div>`;
    return;
  }

  container.innerHTML = withRef.slice(0, 5).map(entry => {
    const m = MOODS[entry.moodType] || MOODS['Neutral'];
    return `
      <div style="padding:14px 0;border-bottom:1px solid var(--bg2)">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:8px">
          <div class="tc-mood-icon ${m.cls}" style="width:30px;height:30px;border-radius:8px;font-size:0.9rem">
            <i class="fas ${m.icon}"></i>
          </div>
          <div>
            <div style="font-size:0.82rem;font-weight:500;color:var(--text)">${entry.moodType}</div>
            <div style="font-size:0.72rem;color:var(--text3)">${formatDate(entry.date)}</div>
          </div>
        </div>
        <div style="font-family:'Fraunces',serif;font-size:0.88rem;color:var(--text2);line-height:1.7;font-weight:300">
          ${escHtml(entry.reflection).substring(0, 300)}${entry.reflection.length > 300 ? '…' : ''}
        </div>
      </div>`;
  }).join('');
}

function updateWordCount() {
  const text  = document.getElementById('journalText').value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  document.getElementById('wordCountDisplay').textContent = words;
}

// ===================== HELPER UTILITIES =====================
function getLast7Entries() {
  const d = new Date(); d.setDate(d.getDate() - 6);
  const from = d.toISOString().split('T')[0];
  return (state.entries || []).filter(e => e.date >= from);
}

function getLast30Entries() {
  const d = new Date(); d.setDate(d.getDate() - 29);
  const from = d.toISOString().split('T')[0];
  return (state.entries || []).filter(e => e.date >= from);
}

function getFilteredEntries(filter) {
  const entries = state.entries || [];
  if (filter === 'week')  return getLast7Entries();
  if (filter === 'month') return getLast30Entries();
  return entries;
}

function getDominantMood(entries) {
  if (!entries.length) return null;
  const cnt = {};
  entries.forEach(e => { cnt[e.moodType] = (cnt[e.moodType] || 0) + 1; });
  return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
}

function computeStreak() {
  const entries = state.entries || [];
  if (!entries.length) return 0;
  const dateSet = new Set(entries.map(e => e.date));
  let streak = 0;
  const d = new Date();
  while (streak <= 365) {
    const ds = d.toISOString().split('T')[0];
    if (dateSet.has(ds)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function computeConsistencyScore() {
  const days    = insightPeriod === 'week' ? 7 : 30;
  const entries = insightPeriod === 'week' ? getLast7Entries() : getLast30Entries();
  return Math.round((entries.length / days) * 100);
}

function getConsistencyMessage(score) {
  if (score >= 90) return "🏆 Outstanding! You're a journaling champion.";
  if (score >= 70) return '⭐ Excellent consistency. Your self-awareness is growing.';
  if (score >= 50) return '📈 Good effort! Keep building this healthy habit.';
  return '🌱 Every entry counts. Start small, build momentum.';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===================== UI HELPERS =====================
function showToast(msg, type = '') {
  const container = document.getElementById('toastContainer');
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success'
    ? 'fa-check-circle'
    : type === 'error'
    ? 'fa-circle-exclamation'
    : 'fa-info-circle';

  toast.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showEmojiAnimation(mood) {
  const emoji = MOOD_EMOJIS[mood] || '✨';
  const el    = document.createElement('div');
  el.className    = 'emoji-burst';
  el.textContent  = emoji;
  el.style.left   = (window.innerWidth  / 2 - 20) + 'px';
  el.style.top    = (window.innerHeight / 2)       + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

function switchTab(name) {
  document.querySelectorAll('.nav-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name)
  );
  document.querySelectorAll('.section').forEach(s =>
    s.classList.toggle('active', s.id === `tab-${name}`)
  );
  if (name === 'insights') { computeSummaries(); renderInsights(); }
  if (name === 'calendar')  renderCalendar();
}

// ===================== NAME MODAL =====================
function openNameModal() {
  document.getElementById('nameModal').classList.add('open');
  document.getElementById('nameInput').value = state.userName || '';
  setTimeout(() => document.getElementById('nameInput').focus(), 200);
}

function closeNameModal() {
  document.getElementById('nameModal').classList.remove('open');
}

// ===================== EVENT LISTENERS =====================
function setupEventListeners() {
  // Mood picker
  setupMoodPicker();

  // Intensity slider
  document.getElementById('intensitySlider').addEventListener('input', function () {
    document.getElementById('intensity-display').textContent = this.value;
  });

  // Tracker buttons
  document.getElementById('saveEntry').addEventListener('click', saveEntry);
  document.getElementById('clearForm').addEventListener('click', clearTrackerForm);

  // Navigation tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Timeline filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTimeline(btn.dataset.filter);
    });
  });

  // Calendar navigation
  document.getElementById('calPrev').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  });

  // Insights period toggle
  document.getElementById('periodWeek').addEventListener('click', () => {
    insightPeriod = 'week';
    document.getElementById('periodWeek').classList.add('active');
    document.getElementById('periodMonth').classList.remove('active');
    computeSummaries();
    renderInsights();
  });
  document.getElementById('periodMonth').addEventListener('click', () => {
    insightPeriod = 'month';
    document.getElementById('periodMonth').classList.add('active');
    document.getElementById('periodWeek').classList.remove('active');
    computeSummaries();
    renderInsights();
  });

  // User name modal
  document.getElementById('userAvatarBtn').addEventListener('click', openNameModal);
  document.getElementById('userName-display').addEventListener('click', openNameModal);
  document.getElementById('saveName').addEventListener('click', () => {
    const name = document.getElementById('nameInput').value.trim();
    if (name) { state.userName = name; saveState(); updateHeader(); }
    closeNameModal();
  });
  document.getElementById('cancelName').addEventListener('click', closeNameModal);
  document.getElementById('nameModal').addEventListener('click', e => {
    if (e.target === document.getElementById('nameModal')) closeNameModal();
  });
  document.getElementById('nameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('saveName').click();
  });

  // Journal
  document.getElementById('journalText').addEventListener('input', function () {
    updateWordCount();
    state.journalDraft = this.value;
    saveState();
  });
  document.getElementById('clearJournal').addEventListener('click', () => {
    document.getElementById('journalText').value = '';
    state.journalDraft = '';
    saveState();
    updateWordCount();
  });
  document.getElementById('saveJournal').addEventListener('click', () => {
    const text = document.getElementById('journalText').value.trim();
    if (!text) { showToast('Nothing to save!', 'error'); return; }

    const today    = new Date().toISOString().split('T')[0];
    const existing = (state.entries || []).find(e => e.date === today);

    if (existing) {
      existing.reflection = text;
      saveState();
      showToast("Reflection saved to today's entry!", 'success');
    } else {
      showToast("No entry for today yet. Save a mood entry first!", 'error');
    }

    renderRecentReflections();
  });

  // Writing prompts
  document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const ta     = document.getElementById('journalText');
      const prompt = chip.dataset.prompt;
      ta.value = ta.value ? `${ta.value}\n\n${prompt}\n` : `${prompt}\n`;
      ta.focus();
      updateWordCount();
    });
  });

  // Re-render line chart on window resize
  window.addEventListener('resize', () => { renderLineChart(); });
}

// ===================== SEED SAMPLE DATA =====================
function seedIfEmpty() {
  if (state.entries && state.entries.length > 0) return;

  const moodTypes = ['Happy', 'Good', 'Neutral', 'Good', 'Sad', 'Happy', 'Good'];
  const notes = [
    'Great walk this morning',
    'Productive day at work',
    'Feeling a bit off',
    'Had lunch with a friend',
    'Difficult conversation today',
    'Weekend vibes!',
    'Steady and grounded'
  ];
  const now = new Date();

  moodTypes.forEach((mt, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    state.entries.push({
      id:         Date.now() - (6 - i) * 100000,
      date:       d.toISOString().split('T')[0],
      moodType:   mt,
      moodScore:  MOODS[mt].score,
      intensity:  Math.floor(Math.random() * 5) + 5,
      note:       notes[i],
      reflection: i % 2 === 0
        ? `Today I took a moment to appreciate the small things. ${notes[i]} made a real difference in my mood.`
        : ''
    });
  });

  state.entries.sort((a, b) => b.date.localeCompare(a.date));
  saveState();
}

// ===================== BOOTSTRAP =====================
loadState();
seedIfEmpty();
init();