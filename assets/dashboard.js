/* MAESTRO · exp_v2 dashboard — renderer and plot engine.
 * Reads window.MAESTRO_RUN (data/run_data.js). No libraries, no network access; works from file:// and GitHub Pages.
 * Do not put run data here: edit data/run_data.js instead.
 */
(function () {
  'use strict';

  var D = null;
  var DEMO = false;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var PAL = ['#2457d6', '#e8590c', '#0f8a5f', '#8f3fd1', '#c08a00', '#0b7285', '#c2255c', '#5c677d'];
  var ui = { stage: null, tab: 'overview', logKind: 'all' };

  /* ------------------------------------------------------------ DOM helpers */
  function append(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(n, x); }); return; }
    if (typeof c === 'object' && c.nodeType) { n.appendChild(c); return; }
    n.appendChild(document.createTextNode(String(c)));
  }
  function setAttrs(n, attrs, isSvg) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') { if (isSvg) n.setAttribute('class', v); else n.className = v; }
      else if (k === 'text') n.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (p) { n.style.setProperty(p, v[p]); });
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    });
  }
  function el(tag, attrs, children) { var n = document.createElement(tag); setAttrs(n, attrs, false); append(n, children); return n; }
  function sv(tag, attrs, children) { var n = document.createElementNS(SVGNS, tag); setAttrs(n, attrs, true); append(n, children); return n; }
  function byId(id) { return document.getElementById(id); }
  function fill(id, children) { var n = byId(id); if (!n) return null; n.textContent = ''; append(n, children); return n; }

  /* ------------------------------------------------------------ formatting */
  function fmtDate(s) {
    if (!s) return '—';
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(s));
    if (!m) return String(s);
    var out = parseInt(m[3], 10) + ' ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1];
    if (m[4]) out += ', ' + m[4] + ':' + m[5];
    return out;
  }
  function fmtShortDate(s) { var f = fmtDate(s); return f.replace(/ \d{4}/, ''); }
  function fmtH(h) { if (h == null) return '—'; var r = Math.round(h * 10) / 10; return (r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)) + ' h'; }
  function fmtNum(v) {
    if (v == null || v === '') return '—';
    if (typeof v !== 'number') return String(v);
    if (v === 0) return '0';
    var a = Math.abs(v);
    if (a >= 1e5 || a < 1e-3) return v.toExponential(2).replace('e', '×10^').replace('+', '');
    return String(+v.toPrecision(3));
  }
  function pct(x) { return Math.round(x * 100) + ' %'; }
  function clamp01(x) { x = +x || 0; return x < 0 ? 0 : x > 1 ? 1 : x; }

  /* ------------------------------------------------------------ status model */
  var ST = {
    done:    { label: 'Done', cls: 'st-done', color: 'var(--done)' },
    running: { label: 'Running', cls: 'st-running', color: 'var(--run)' },
    paused:  { label: 'Paused', cls: 'st-paused', color: 'var(--pause)' },
    gate:    { label: 'Waiting at gate', cls: 'st-gate', color: 'var(--gate)' },
    planned: { label: 'Planned', cls: 'st-planned', color: 'var(--plan)' },
    skipped: { label: 'Not triggered', cls: 'st-skipped', color: 'var(--skip)' },
    blocked: { label: 'Blocked', cls: 'st-blocked', color: 'var(--block)' }
  };
  function st(s) { return ST[s && s.status] || ST.planned; }
  function pill(text, cls, tip) { return el('span', { class: 'pill ' + cls, 'data-tip': tip || null }, text); }
  function stagePill(s) { return pill(st(s).label, st(s).cls); }
  function stageFrac(s) {
    switch (s.status) {
      case 'done': case 'skipped': case 'gate': return 1;
      case 'running': case 'paused': case 'blocked': return clamp01(s.progress);
      default: return 0;
    }
  }
  function overall() {
    var tot = 0, got = 0;
    D.stages.forEach(function (s) { tot += s.budget_h || 0; got += (s.budget_h || 0) * stageFrac(s); });
    return tot ? got / tot : 0;
  }
  function usedHours() {
    var any = false, sum = 0;
    D.stages.forEach(function (s) { if (s.used_h != null) { any = true; sum += s.used_h; } });
    if (D.meta.reserve_used_h != null) { any = true; sum += D.meta.reserve_used_h; }
    return any ? sum : null;
  }
  function currentStage() {
    var act = D.stages.filter(function (s) { return ['running', 'paused', 'gate', 'blocked'].indexOf(s.status) >= 0; });
    if (act.length) return { stage: act[0], active: true };
    var nxt = D.stages.filter(function (s) { return s.status === 'planned'; });
    return nxt.length ? { stage: nxt[0], active: false } : { stage: null, active: false };
  }
  function findStage(id) { return D.stages.filter(function (s) { return s.id === id; })[0] || null; }
  function stageIndex(id) { for (var i = 0; i < D.stages.length; i++) if (D.stages[i].id === id) return i; return -1; }

  var VERDICT = {
    'continue': { label: 'Continue', cls: 'st-done' },
    'adjust':   { label: 'Adjust', cls: 'st-gate' },
    'repeat':   { label: 'Repeat', cls: 'st-blocked' },
    'done':     { label: 'Done', cls: 'st-done' },
    'skipped':  { label: 'Not used', cls: 'st-skipped' }
  };
  function gateCleared(g) { return g.verdict === 'continue' || g.verdict === 'adjust' || g.verdict === 'done'; }
  function gatePill(g) { var v = VERDICT[g.verdict]; return v ? pill(v.label, v.cls) : pill('Pending', 'st-pending'); }
  function gateWhen(g) { return g.after ? 'After ' + g.after : 'Before ' + g.before; }

  function verdictPill(v, tip) {
    if (v === 'not justified') return pill('GC-DFT not justified', 'v-notj', tip);
    if (v === 'justified') return pill('GC-DFT justified', 'v-just', tip);
    if (v === 'open') return pill('Open', 'v-open', tip);
    return pill('Pending', 'st-pending', tip);
  }
  function triPill(v, yes, no) {
    if (v === true) return pill(yes || 'Pass', 'st-done');
    if (v === false) return pill(no || 'Fail', 'st-blocked');
    if (typeof v === 'string' && v) return pill(v, 'st-planned');
    return pill('Pending', 'st-pending');
  }

  /* ------------------------------------------------------------ icons */
  var ICONS = {
    progress: 'M3 17h4v-6H3v6zm7 0h4V7h-4v10zm7 0h4V3h-4v14z',
    clock: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 10.6l3.2 1.9-.9 1.5L11 13.4V7h2v5.6z',
    layers: 'M12 2l10 5-10 5L2 7l10-5zm-8.5 9.3L12 15.6l8.5-4.3L22 12l-10 5-10-5 1.5-.7zm0 4.6L12 20.2l8.5-4.3L22 16.6l-10 5-10-5 1.5-.7z',
    gate: 'M12 2l10 10-10 10L2 12 12 2zm0 4L6 12l6 6 6-6-6-6z',
    check: 'M9 16.2l-3.5-3.5L4 14.2 9 19.2 20 8.2l-1.5-1.5z',
    ledger: 'M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 11h8v1.6H8V11zm0 3.4h8V16H8v-1.6zm0 3.4h5v1.6H8v-1.6z',
    cloud: 'M7 18h10.5a4 4 0 00.6-8 6 6 0 00-11.4 1.6A3.3 3.3 0 007 18z',
    hand: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z',
    file: 'M6 2h8l6 6v14H6V2zm7 1.5V9h5.5L13 3.5z',
    code: 'M8.6 16.6L4 12l4.6-4.6L10 8.8 6.8 12l3.2 3.2-1.4 1.4zm6.8 0L14 15.2l3.2-3.2L14 8.8l1.4-1.4L20 12l-4.6 4.6z',
    image: 'M4 4h16v16H4V4zm2 2v9.6l3.5-3.5 2.5 2.5 3.5-4.1L18 13.8V6H6zm2.5 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z',
    handoff: 'M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4v-2z'
  };
  function icon(name, size) {
    size = size || 16;
    return sv('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' }, sv('path', { d: ICONS[name] || ICONS.file, fill: 'currentColor' }));
  }

  /* ------------------------------------------------------------ masthead */
  function renderMasthead() {
    var m = D.meta;
    byId('mh-eyebrow').textContent = m.project + ' · ' + m.arm + ' · ' + m.experiment;
    byId('mh-title').textContent = m.title;
    var rs = m.run_status || 'pre-launch';
    var rsLabel = { 'pre-launch': 'Pre-launch', running: 'Running', paused: 'Paused', 'at-gate': 'At a gate', complete: 'Complete' }[rs] || rs;
    var chips = [
      el('span', { class: 'mh-chip status ' + rs }, [el('span', { class: 'k' }, 'Status'), rsLabel]),
      el('span', { class: 'mh-chip' }, [el('span', { class: 'k' }, 'Budget'), m.budget_h + ' h agent time']),
      el('span', { class: 'mh-chip' }, [el('span', { class: 'k' }, m.launched ? 'Launched' : 'Launch'), fmtDate(m.launched || m.launch_planned)]),
      el('span', { class: 'mh-chip' }, [el('span', { class: 'k' }, 'Model'), m.model ? m.model + (m.effort ? ' · ' + m.effort : '') : 'to be set']),
      el('span', { class: 'mh-chip' }, [el('span', { class: 'k' }, 'Updated'), fmtDate(m.updated)])
    ];
    fill('mh-chips', chips);
    document.title = m.project + ' · ' + m.arm + ' · ' + m.experiment + ' dashboard';
  }

  /* ------------------------------------------------------------ overview */
  function kpi(iconName, label, value, of, sub, frac) {
    var pending = value == null;
    return el('div', { class: 'kpi' }, [
      el('div', { class: 'kpi-top' }, [el('span', { class: 'kpi-icon' }, icon(iconName, 15)), label]),
      el('div', { class: 'kpi-val' + (pending ? ' pending' : '') }, [pending ? '—' : value, of ? el('span', { class: 'of' }, ' ' + of) : null]),
      frac != null ? el('div', { class: 'kpi-bar' }, el('span', { style: { width: Math.round(clamp01(frac) * 100) + '%' } })) : null,
      el('div', { class: 'kpi-sub' }, sub)
    ]);
  }
  function renderOverview() {
    var m = D.meta;
    fill('ov-sub', m.status_note || '');
    var cs = currentStage();
    var done = D.stages.filter(function (s) { return s.status === 'done' || s.status === 'skipped'; }).length;
    var gates = D.gates.filter(function (g) { return g.kind === 'gate'; });
    var cleared = gates.filter(gateCleared).length;
    var used = usedHours();
    var iv = D.interventions || [];
    var ivInfra = iv.filter(function (x) { return x.kind === 'infrastructure'; }).length;
    var ivSteer = iv.filter(function (x) { return x.kind === 'steering'; }).length;
    var prog = overall();

    var left = el('div', { class: 'panel' }, [
      el('div', { class: 'status-line' }, [
        pill(cs.stage ? (cs.active ? 'Current: ' : 'Next: ') + cs.stage.id + ' ' + cs.stage.name : 'All stages finished', cs.active ? st(cs.stage).cls : 'st-planned'),
        el('span', { class: 'muted small' }, m.launched ? 'Launched ' + fmtDate(m.launched) : 'Launch planned ' + fmtDate(m.launch_planned) + ' · first results due ' + fmtDate(m.first_results_due))
      ]),
      el('p', { class: 'question' }, m.question),
      el('p', { class: 'strategy' }, m.strategy)
    ]);
    var setup = [
      ['Model', m.model ? m.model + (m.effort ? ' (effort ' + m.effort + ')' : '') : 'To be set at launch'],
      ['Run folder', m.run_folder ? el('code', null, m.run_folder) : 'Set at launch'],
      ['Launch', m.launched ? fmtDate(m.launched) : fmtDate(m.launch_planned) + ' (planned)'],
      ['First results', fmtDate(m.first_results_due)],
      ['Compute', '8 GB laptop; jobs above the local limit go to Google Colab'],
      ['Cost', m.cost_usd != null ? '$' + m.cost_usd.toFixed(2) + ' (client estimate)' : '—']
    ];
    var right = el('div', { class: 'panel' }, [
      el('div', { class: 'panel-title' }, 'Run set-up'),
      el('dl', { class: 'kv' }, setup.map(function (r) { return [el('dt', null, r[0]), el('dd', null, r[1])]; }))
    ]);
    var kpis = el('div', { class: 'grid grid-4 kpis' }, [
      kpi('progress', 'Progress', pct(prog), null, 'Time-weighted over the stage budgets', prog),
      kpi('clock', 'Agent time', used == null ? null : fmtH(used).replace(' h', ''), 'of ' + m.budget_h + ' h', used == null ? 'Not logged yet; gate waiting time excluded' : 'Reserve ' + m.reserve_h + ' h included in the budget', used == null ? null : used / m.budget_h),
      kpi('layers', 'Stages complete', String(done), 'of ' + D.stages.length, 'S05b counts as complete if not triggered', done / D.stages.length),
      kpi('gate', 'Gates cleared', String(cleared), 'of ' + gates.length, 'Gates A, B and C (continue or adjust)', gates.length ? cleared / gates.length : 0),
      kpi('check', 'Benchmarks passed', m.benchmarks_passed == null ? null : String(m.benchmarks_passed), m.benchmarks_registered != null ? 'of ' + m.benchmarks_registered : null, 'Registered before code; operator re-run counts'),
      kpi('ledger', 'Claims in ledger', m.claims_in_ledger == null ? null : String(m.claims_in_ledger), null, 'Every number traces to a claim and a script'),
      kpi('cloud', 'Colab units', m.colab_units_used == null ? null : String(m.colab_units_used), 'of ~' + m.colab_units_budget, 'Budget is an estimate, to be confirmed', m.colab_units_used == null ? null : m.colab_units_used / m.colab_units_budget),
      kpi('hand', 'Interventions', String(iv.length), null, ivInfra + ' infrastructure · ' + ivSteer + ' scientific steering')
    ]);
    fill('ov-body', [el('div', { class: 'hero' }, [left, right]), kpis]);
  }

  /* ------------------------------------------------------------ pipeline */
  function gatesAfter(id) { return D.gates.filter(function (g) { return g.after === id; }); }
  function inputsBefore(id) { return D.gates.filter(function (g) { return g.kind === 'input' && g.before === id; }); }
  function gateMarker(g) {
    var tip = g.title + ' · ' + gateWhen(g) + '\n' + g.who.join(', ') + '\n' + (VERDICT[g.verdict] ? 'Verdict: ' + VERDICT[g.verdict].label : 'Pending');
    var go = function () { focusGate(g.id); };
    if (g.kind === 'input') return el('span', { class: 'dot-in' + (gateCleared(g) ? ' cleared' : ''), 'data-tip': tip, role: 'button', tabindex: '0', onclick: go, 'aria-label': g.title }, 'i');
    var cls = 'gem' + (g.kind === 'checkpoint' ? ' optional' : '') + (gateCleared(g) ? ' cleared' : '');
    return el('span', { class: cls, 'data-tip': tip, role: 'button', tabindex: '0', onclick: go, 'aria-label': g.title }, el('span', null, g.kind === 'checkpoint' ? 'T' : g.id));
  }
  function renderPipeline() {
    var cols = [], items = [], notes = [];
    var stages = D.stages;
    var lead = inputsBefore(stages[0].id);
    if (lead.length) { cols.push('34px'); items.push(el('div', { class: 'conn' }, lead.map(gateMarker))); }
    stages.forEach(function (s, i) {
      cols.push('minmax(104px, 1fr)');
      var colIndex = cols.length;
      var c = st(s);
      var node = el('button', {
        type: 'button', class: 'pnode' + (s.conditional ? ' conditional' : '') + (ui.stage === s.id ? ' selected' : ''),
        'data-stage': s.id, onclick: function () { selectStage(s.id, true); },
        'data-tip': s.id + ' · ' + s.name + '\nExit: ' + s.exit + '\n' + s.human
      }, [
        el('span', { class: 'pnode-id' }, [s.id, el('span', { class: 'h' }, fmtH(s.budget_h))]),
        el('span', { class: 'pnode-name' }, s.short || s.name),
        pill(s.conditional && s.status === 'planned' ? 'Conditional' : c.label, c.cls),
        el('span', { class: 'mini-bar' }, el('span', { style: { width: Math.round(stageFrac(s) * 100) + '%', background: c.color } }))
      ]);
      items.push(node);
      s._col = colIndex;
      var markers = gatesAfter(s.id).concat(i < stages.length - 1 ? inputsBefore(stages[i + 1].id) : inputsBefore('Finish'));
      if (markers.length || i < stages.length - 1) {
        cols.push(markers.length > 1 ? '62px' : '38px');
        items.push(el('div', { class: 'conn' }, el('span', { style: { display: 'flex', gap: '6px', position: 'relative', 'z-index': '1' } }, markers.map(gateMarker))));
      }
    });
    var s03 = findStage('S03'), s04 = findStage('S04'), s05b = findStage('S05b');
    if (s03 && s04) notes.push(el('div', { class: 'pipe-note loop', style: { 'grid-row': '2', 'grid-column': s03._col + ' / ' + (s04._col + 1) } }, '↻ one S03 ⇄ S04 loop allowed, paid from the reserve'));
    if (s05b) notes.push(el('div', { class: 'pipe-note cond', style: { 'grid-row': '2', 'grid-column': s05b._col + ' / ' + (s05b._col + 1) } }, 'only if S05 triggers the DFT rule'));
    var pipe = el('div', { class: 'pipe', style: { 'grid-template-columns': cols.join(' ') } }, items.concat(notes));
    items.forEach(function (it, k) { it.style.gridRow = '1'; it.style.gridColumn = String(k + 1); });

    // segmented, time-weighted progress bar
    var seg = el('div', { class: 'seg-bar', role: 'img', 'aria-label': 'Progress by stage budget' });
    stages.forEach(function (s) {
      var c = st(s);
      seg.appendChild(el('div', {
        class: 'seg', style: { 'flex-grow': String(s.budget_h), 'flex-basis': '0' }, onclick: function () { selectStage(s.id, true); },
        'data-tip': s.id + ' · ' + s.name + '\nBudget ' + fmtH(s.budget_h) + ' · used ' + fmtH(s.used_h) + '\n' + c.label + ' · ' + pct(stageFrac(s))
      }, [el('i', { style: { width: Math.round(stageFrac(s) * 100) + '%', background: c.color, opacity: s.status === 'done' ? '0.85' : '0.7' } }), el('b', null, s.budget_h >= 1 ? s.id : '')]));
    });
    seg.appendChild(el('div', { class: 'seg reserve', style: { 'flex-grow': String(D.meta.reserve_h), 'flex-basis': '0' }, 'data-tip': 'Reserve · ' + fmtH(D.meta.reserve_h) + '\nS03 ⇄ S04 loop, repeats after gate verdicts, resumes\nUsed ' + fmtH(D.meta.reserve_used_h) }, el('b', null, 'Res.')));

    var prog = overall();
    var progressPanel = el('div', { class: 'panel' }, [
      el('div', { class: 'prog-head' }, [
        el('div', null, [el('span', { class: 'big' }, pct(prog)), el('span', { class: 'muted small' }, '  of planned agent time complete (time-weighted)')]),
        el('span', { class: 'muted small' }, 'Total budget ' + D.meta.budget_h + ' h incl. ' + D.meta.reserve_h + ' h reserve')
      ]),
      seg,
      el('div', { class: 'pipe-scroll', style: { 'margin-top': '14px' } }, pipe),
      el('div', { class: 'legend-row' }, [
        el('span', { class: 'sw' }, [el('span', { class: 'gem-s' }), 'Gate: stop and wait for review']),
        el('span', { class: 'sw' }, [el('span', { class: 'gem-s opt' }), 'Optional checkpoint']),
        el('span', { class: 'sw' }, [el('span', { class: 'in-s' }), 'Human input before the stage']),
        el('span', { class: 'sw' }, 'Dashed stage: conditional'),
        el('span', { class: 'sw' }, 'Stages over 2 h run as several ≤ 2 h sessions')
      ])
    ]);

    // budget plot (real data from the stage list)
    var cats = stages.map(function (s) { return s.id; }).concat(['Reserve']);
    var budgetSpec = {
      type: 'bar', title: 'Time budget per stage', subtitle: 'Planned vs used agent hours (reviewer waiting time not counted)',
      x: { label: 'Stage' }, y: { label: 'Agent hours', min: 0 }, categories: cats, height: 260,
      series: [
        { name: 'Planned', color: '#9fb3d9', points: stages.map(function (s) { return { x: s.id, y: s.budget_h }; }).concat([{ x: 'Reserve', y: D.meta.reserve_h }]) },
        { name: 'Used', color: '#1f4fd1', points: stages.filter(function (s) { return s.used_h != null; }).map(function (s) { return { x: s.id, y: s.used_h }; }).concat(D.meta.reserve_used_h != null ? [{ x: 'Reserve', y: D.meta.reserve_used_h }] : []) }
      ]
    };
    var budgetPlot = renderPlot('budget', budgetSpec);

    // current position
    var cs = currentStage();
    var pendingStops = D.gates.filter(function (g) { return g.verdict == null; });
    var nextStop = pendingStops[0];
    var nextEvent = (D.events || []).filter(function (e) { return e.planned; })[0];
    var pos = el('div', { class: 'panel' }, [
      el('div', { class: 'panel-title' }, 'Where the run stands'),
      el('dl', { class: 'kv' }, [
        el('dt', null, cs.active ? 'Current stage' : 'Next stage'),
        el('dd', null, cs.stage ? [el('a', { href: '#stage-' + cs.stage.id }, cs.stage.id + ' ' + cs.stage.name), ' ', stagePill(cs.stage)] : 'None'),
        el('dt', null, 'Next human stop'),
        el('dd', null, nextStop ? [el('a', { href: '#gates', onclick: function (e) { e.preventDefault(); focusGate(nextStop.id); } }, nextStop.title), ' · ' + gateWhen(nextStop) + ' · ' + nextStop.who.join(', ')] : 'None'),
        el('dt', null, 'Next milestone'),
        el('dd', null, nextEvent ? fmtDate(nextEvent.date) + ' · ' + nextEvent.text : 'None'),
        el('dt', null, 'Agent time'),
        el('dd', null, fmtH(usedHours()) + ' of ' + D.meta.budget_h + ' h'),
        el('dt', null, 'Reserve used'),
        el('dd', null, fmtH(D.meta.reserve_used_h) + ' of ' + fmtH(D.meta.reserve_h))
      ])
    ]);
    fill('pl-body', [progressPanel, el('div', { class: 'grid grid-2', style: { 'margin-top': '16px' } }, [budgetPlot, pos])]);
  }

  /* ------------------------------------------------------------ answer */
  function renderAnswer() {
    var V = D.verdicts || {};
    var rungs = ['L0', 'L1', 'L2'];
    var head = el('tr', null, [el('th', null, 'Quantity of interest'), el('th', { class: 'v1' }, 'exp_v1 (2D toy)')]
      .concat(rungs.map(function (r) { return el('th', null, r + ' · ' + ((D.ladder.filter(function (x) { return x.id === r; })[0] || {}).name || '')); }))
      .concat([el('th', null, 'Changes with fidelity?')]));
    var rows = D.qois.map(function (q) {
      var v1 = (V.v1 || {})[q.id] || {};
      var ch = (V.changes_with_fidelity || {})[q.id];
      return el('tr', null, [
        el('td', { class: 'q' }, q.label),
        el('td', { class: 'v1' }, [verdictPill(v1.verdict), v1.note ? el('span', { class: 'cell-note' }, v1.note) : null]),
      ].concat(rungs.map(function (r) {
        var c = (V[r] || {})[q.id];
        var verdict = c && typeof c === 'object' ? c.verdict : c;
        var note = c && typeof c === 'object' ? c.note : null;
        return el('td', null, [verdictPill(verdict), note ? el('span', { class: 'cell-note' }, note) : null]);
      })).concat([el('td', null, ch === true ? pill('Yes', 'st-gate') : ch === false ? pill('No', 'st-done') : pill('Pending', 'st-pending'))]));
    });
    var matrix = el('div', { class: 'panel' }, [
      el('div', { class: 'panel-title' }, 'Verdict per QoI and rung'),
      el('div', { class: 'rule-box' }, [pill('Decision rule', 'st-planned nodot'), el('span', null, D.meta.decision_rule)]),
      el('div', { style: { 'overflow-x': 'auto', 'margin-top': '12px' } }, el('table', { class: 'matrix' }, [el('thead', null, head), el('tbody', null, rows)])),
      el('div', { class: 'rec' }, [
        el('div', { class: 'block-title' }, 'Recommendation on transition-state calculations'),
        D.recommendation ? el('p', { class: 'goal' }, D.recommendation) : el('div', { class: 'empty' }, 'Pending. Written at S05 (Gate B) and finalised in S06.')
      ])
    ]);
    fill('an-body', [matrix, el('div', { class: 'plots', style: { 'margin-top': '16px' } }, [renderPlot('s05_rungs'), renderPlot('s05_sobol')])]);
  }

  /* ------------------------------------------------------------ ladder */
  function renderLadder() {
    var colors = { L0: '#64748b', L1: '#2457d6', L2: '#0b7285' };
    var cards = D.ladder.map(function (r) {
      return el('div', { class: 'panel rung' }, [
        el('div', { class: 'rung-head' }, [
          el('span', { class: 'rung-id', style: { background: colors[r.id] || '#2457d6' } }, r.id),
          el('div', null, [el('div', { class: 'rung-name' }, r.name), el('div', { class: 'muted small' }, 'Built in S04 · compared in S05')]),
          r.reference ? el('span', { class: 'flag-ref' }, 'Reference rung') : null
        ]),
        el('ul', null, r.physics.map(function (p) { return el('li', null, p); })),
        el('div', { class: 'rung-checks' }, [
          el('span', { class: 'lab' }, 'T0 benchmark'), triPill(r.t0),
          el('span', { class: 'lab' }, 'T1 benchmark'), triPill(r.t1),
          el('span', { class: 'lab' }, 'Morris screening'), triPill(r.morris, 'Done', 'Failed'),
          el('span', { class: 'lab' }, 'Validated against experiment'), triPill(r.validated, 'Within tolerance', 'Gap documented')
        ])
      ]);
    });
    var sys = el('div', { class: 'panel', style: { 'margin-top': '16px' } }, [
      el('div', { class: 'panel-title' }, 'System and assumptions (all rungs)'),
      el('dl', { class: 'kv' }, (D.meta.system || []).map(function (r) { return [el('dt', null, r[0]), el('dd', null, r[1])]; })),
      el('p', { class: 'info-note' }, 'Fallback: if S03 misses the tolerance, the highest validated rung becomes the S05 reference and the report states the limit.')
    ]);
    fill('ld-body', [el('div', { class: 'grid grid-3' }, cards), sys]);
  }

  /* ------------------------------------------------------------ stage detail */
  function selectStage(id, scroll) {
    if (!findStage(id)) return;
    ui.stage = id;
    renderStages();
    document.querySelectorAll('.pnode').forEach(function (n) { n.classList.toggle('selected', n.getAttribute('data-stage') === id); });
    if (scroll) {
      if (location.hash !== '#stage-' + id) { try { history.replaceState(null, '', '#stage-' + id); } catch (e) { /* file:// in some browsers */ } }
      var sec = byId('stages'); if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  function numSlot(n) {
    var pending = n.value == null || n.value === '';
    return el('div', { class: 'num' + (pending ? ' pending' : '') }, [
      el('span', { class: 'lab' }, n.label),
      el('span', { class: 'val' }, pending ? 'Pending' : [fmtNum(n.value), n.unit ? el('span', { class: 'u' }, n.unit) : null]),
      n.note ? el('span', { class: 'nt' }, n.note) : null
    ]);
  }
  function figSlot(f) {
    if (f.src) {
      return el('div', { class: 'fig' }, [
        el('div', { class: 'fig-media' }, el('img', { src: f.src, alt: f.title, loading: 'lazy', onclick: function () { openLightbox(f.src, f.title + (f.caption ? ' — ' + f.caption : '')); } })),
        el('div', { class: 'fig-body' }, [el('h5', null, f.title), f.caption ? el('p', null, f.caption) : null])
      ]);
    }
    return el('div', { class: 'fig pending' }, [
      el('div', { class: 'fig-media' }, [icon('image', 34), el('span', null, 'Figure pending'), f.expected ? el('code', null, 'figures/' + f.expected) : null]),
      el('div', { class: 'fig-body' }, [el('h5', null, f.title), f.caption ? el('p', null, f.caption) : null])
    ]);
  }
  function fileList(list, kind) {
    if (!list || !list.length) return el('div', { class: 'empty' }, kind === 'code' ? 'No code paths listed for this stage.' : 'No handoff files listed for this stage.');
    var base = D.meta.code_base;
    return el('ul', { class: 'files' }, list.map(function (f) {
      var target = base ? base.replace(/\/?$/, '/') + f.path : null;
      return el('li', null, [
        el('span', { class: 'ft' }, icon(kind === 'code' ? 'code' : 'handoff', 15)),
        el('span', { class: 'lab' }, f.label),
        target ? el('a', { href: target, target: '_blank', rel: 'noopener' }, el('code', null, f.path)) : el('code', null, f.path)
      ]);
    }));
  }
  function table(cols, rows) {
    return el('div', { style: { 'overflow-x': 'auto' } }, el('table', { class: 'tbl' }, [
      el('thead', null, el('tr', null, cols.map(function (c) { return el('th', null, c[0]); }))),
      el('tbody', null, rows.map(function (r) { return el('tr', null, cols.map(function (c) { var v = typeof c[1] === 'function' ? c[1](r) : r[c[1]]; return el('td', null, v == null || v === '' ? '—' : v); })); }))
    ]));
  }
  function renderStages() {
    var s = findStage(ui.stage) || D.stages[0];
    ui.stage = s.id;
    var idx = stageIndex(s.id);
    var list = el('div', { class: 'panel stage-list', role: 'tablist', 'aria-label': 'Stages' }, D.stages.map(function (x) {
      return el('button', { type: 'button', class: x.id === s.id ? 'selected' : '', onclick: function () { selectStage(x.id, false); } }, [
        el('span', { class: 'sid' }, x.id), el('span', null, x.short || x.name), el('span', { class: 'sdot', style: { background: st(x).color }, 'data-tip': st(x).label })
      ]);
    }));

    var nFilled = (s.numbers || []).filter(function (n) { return n.value != null && n.value !== ''; }).length;
    var nRes = (s.numbers || []).length + (s.plots || []).length + (s.figures || []).length;
    var nFiles = (s.code || []).length + (s.handoffs || []).length;
    var nRun = (s.sessions || []).length + (s.ram || []).length;
    var tabs = [['overview', 'Overview', null], ['results', 'Results', nRes], ['files', 'Files', nFiles], ['run', 'Run details', nRun]];
    var tabBar = el('div', { class: 'tabs', role: 'tablist' }, tabs.map(function (t) {
      return el('button', { type: 'button', role: 'tab', 'aria-selected': ui.tab === t[0] ? 'true' : 'false', class: 'tab' + (ui.tab === t[0] ? ' active' : ''), onclick: function () { ui.tab = t[0]; renderStages(); } },
        [t[1], t[2] != null ? el('span', { class: 'cnt' }, String(t[2])) : null]);
    }));

    var body;
    if (ui.tab === 'overview') {
      var around = D.gates.filter(function (g) { return g.after === s.id || g.before === s.id; });
      body = [
        el('div', { class: 'block-title' }, 'Goal'),
        el('p', { class: 'goal' }, s.goal),
        el('div', { class: 'exit-box' }, [pill('Exit criterion', 'st-planned nodot'), el('span', null, s.exit)]),
        el('div', { class: 'block-title' }, 'Outputs'),
        el('ul', { class: 'checklist' }, (s.outputs || []).map(function (o) {
          var mark = o.state === 'done' ? '✓' : o.state === 'check' ? '?' : '';
          return el('li', null, [el('span', { class: 'ck ' + (o.state || 'pending'), 'data-tip': o.state === 'check' ? 'To be checked' : o.state === 'done' ? 'Done' : 'Pending' }, mark), o.label]);
        })),
        around.length ? [el('div', { class: 'block-title' }, 'Human stops around this stage'),
          el('ul', { class: 'checklist' }, around.map(function (g) { return el('li', null, [gatePill(g), el('a', { href: '#gates', onclick: function (e) { e.preventDefault(); focusGate(g.id); } }, g.title), el('span', { class: 'muted small' }, gateWhen(g) + ' · ' + g.who.join(', '))]); }))] : null,
        s.notes && s.notes.length ? [el('div', { class: 'block-title' }, 'Notes'), el('ul', { class: 'notes' }, s.notes.map(function (n) { return el('li', null, n); }))] : null
      ];
    } else if (ui.tab === 'results') {
      body = [
        el('div', { class: 'block-title' }, 'Key numbers · ' + nFilled + ' of ' + (s.numbers || []).length + ' filled'),
        (s.numbers || []).length ? el('div', { class: 'nums' }, s.numbers.map(numSlot)) : el('div', { class: 'empty' }, 'No number slots defined for this stage.'),
        (s.plots || []).length ? [el('div', { class: 'block-title' }, 'Interactive plots'), el('div', { class: 'plots' + (s.plots.length === 1 ? ' one' : '') }, s.plots.map(function (p) { return renderPlot(p); }))] : null,
        (s.figures || []).length ? [el('div', { class: 'block-title' }, 'Figures'), el('div', { class: 'figs' }, s.figures.map(figSlot))] : null
      ];
    } else if (ui.tab === 'files') {
      body = [
        el('div', { class: 'block-title' }, 'Code'), fileList(s.code, 'code'),
        el('div', { class: 'block-title' }, 'Handoffs'), fileList(s.handoffs, 'handoff'),
        D.meta.code_base ? null : el('p', { class: 'info-note' }, 'Paths are relative to the run folder, which is fixed at launch. They become links once meta.code_base is set in data/run_data.js.')
      ];
    } else {
      var iv = (D.interventions || []).filter(function (x) { return x.stage === s.id; });
      body = [
        el('div', { class: 'block-title' }, 'Sessions'),
        (s.sessions || []).length ? table([['#', function (r) { return String((s.sessions.indexOf(r)) + 1); }], ['Start', function (r) { return fmtDate(r.start); }], ['End', function (r) { return fmtDate(r.end); }], ['Minutes', 'minutes'], ['Turns', 'turns'], ['Cost (USD)', function (r) { return r.cost_usd != null ? r.cost_usd.toFixed(2) : null; }], ['Note', 'note']], s.sessions)
          : el('div', { class: 'empty' }, 'No sessions logged yet. A stage longer than 2 h runs as several ≤ 2 h sessions, each ending with a checkpoint summary.'),
        el('div', { class: 'block-title' }, 'RAM and runtime per job'),
        (s.ram || []).length ? table([['Job', 'job'], ['Est. RAM (GB)', 'est_gb'], ['Est. runtime (min)', 'est_min'], ['Actual RAM (GB)', 'actual_gb'], ['Actual runtime (min)', 'actual_min'], ['Ran on', 'where']], s.ram)
          : el('div', { class: 'empty' }, 'No job estimates yet. Every calculation stage opens with a RAM and runtime estimate per job; jobs above the local limit go to Colab.'),
        el('div', { class: 'block-title' }, 'Interventions'),
        iv.length ? table([['Date', function (r) { return fmtDate(r.date); }], ['Kind', 'kind'], ['What', 'text']], iv) : el('div', { class: 'empty' }, 'None recorded for this stage.')
      ];
    }

    var detail = el('div', { class: 'panel' }, [
      el('div', { class: 'sd-head' }, [
        el('div', null, [
          el('div', { class: 'sd-title' }, [el('span', { class: 'sid' }, s.id), s.name, stagePill(s)]),
          el('div', { class: 'sd-meta' }, [
            el('span', { class: 'meta-chip' }, [el('span', { class: 'k' }, 'Budget'), fmtH(s.budget_h)]),
            el('span', { class: 'meta-chip' }, [el('span', { class: 'k' }, 'Used'), fmtH(s.used_h)]),
            el('span', { class: 'meta-chip' }, [el('span', { class: 'k' }, 'Progress'), pct(stageFrac(s))]),
            el('span', { class: 'meta-chip' }, [el('span', { class: 'k' }, 'Human role'), s.human])
          ])
        ]),
        el('div', { class: 'sd-nav' }, [
          el('button', { type: 'button', class: 'btn', disabled: idx <= 0, onclick: function () { selectStage(D.stages[idx - 1].id, false); } }, '← Previous'),
          el('button', { type: 'button', class: 'btn', disabled: idx >= D.stages.length - 1, onclick: function () { selectStage(D.stages[idx + 1].id, false); } }, 'Next →')
        ])
      ]),
      tabBar,
      el('div', { role: 'tabpanel' }, body)
    ]);
    fill('st-body', el('div', { class: 'stage-shell' }, [list, detail]));
  }

  /* ------------------------------------------------------------ gates */
  function focusGate(id) {
    var card = byId('gate-' + id);
    if (!card) return;
    document.querySelectorAll('.gate-card.focus').forEach(function (n) { n.classList.remove('focus'); });
    card.classList.add('focus');
    if (card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function renderGates() {
    var cards = D.gates.map(function (g) {
      var ic = g.kind === 'input' ? el('span', { class: 'in' + (gateCleared(g) ? ' cleared' : '') }, 'i')
        : el('span', { class: 'gem' + (g.kind === 'checkpoint' ? ' optional' : '') + (gateCleared(g) ? ' cleared' : '') }, el('span', null, g.kind === 'checkpoint' ? 'T' : g.id));
      var kindLabel = g.kind === 'input' ? 'Human input' : g.kind === 'checkpoint' ? 'Optional checkpoint' : 'Stop and wait';
      return el('div', { class: 'panel gate-card', id: 'gate-' + g.id }, [
        el('div', { class: 'gate-top' }, [el('span', { class: 'gate-icon' }, ic), el('div', null, [el('div', { class: 'gate-title' }, g.title), el('div', { class: 'gate-when' }, gateWhen(g) + ' · ' + kindLabel)])]),
        el('p', { class: 'what' }, g.what),
        g.notes ? el('p', { class: 'muted small', style: { margin: '0' } }, g.notes) : null,
        el('div', { class: 'gate-foot' }, [gatePill(g), g.date ? el('span', { class: 'muted' }, fmtDate(g.date)) : null, el('span', { class: 'who', style: { 'margin-left': 'auto' } }, g.who.map(function (w) { return el('span', { class: 'avatar' }, w); }))])
      ]);
    });
    fill('gt-body', el('div', { class: 'grid grid-4' }, cards));
  }

  /* ------------------------------------------------------------ log */
  function renderLog() {
    var evs = (D.events || []).map(function (e) { return e; });
    (D.interventions || []).forEach(function (x) { evs.push({ date: x.date, kind: 'intervention', text: (x.stage ? x.stage + ' · ' : '') + (x.kind === 'steering' ? 'Scientific steering: ' : 'Infrastructure: ') + x.text }); });
    evs.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var kinds = ['all'];
    evs.forEach(function (e) { if (kinds.indexOf(e.kind) < 0) kinds.push(e.kind); });
    var names = { all: 'All', meeting: 'Meetings', decision: 'Decisions', stage: 'Stages', gate: 'Gates', milestone: 'Milestones', intervention: 'Interventions', note: 'Notes' };
    var filters = el('div', { class: 'log-filters' }, kinds.map(function (k) {
      return el('button', { type: 'button', class: 'chip-btn' + (ui.logKind === k ? ' on' : ''), onclick: function () { ui.logKind = k; renderLog(); } }, names[k] || k);
    }));
    var shown = evs.filter(function (e) { return ui.logKind === 'all' || e.kind === ui.logKind; });
    var tl = el('ul', { class: 'timeline' }, shown.map(function (e) {
      return el('li', { class: e.planned ? 'planned' : '' }, [
        el('span', { class: 'dt' }, fmtDate(e.date)),
        el('span', null, pill((names[e.kind] || e.kind).replace(/s$/, ''), 'k-' + e.kind + ' nodot')),
        el('span', { class: 'txt' }, [e.text, e.planned ? el('span', { class: 'muted small' }, ' (planned)') : null])
      ]);
    }));
    fill('lg-body', el('div', { class: 'panel' }, [filters, tl]));
  }

  /* ------------------------------------------------------------ sources, footer */
  function renderSources() {
    // paths are relative to MAESTRO_docs; links_base points at the hosted docs repo, null = the local folder two levels up
    var base = D.meta.links_base ? D.meta.links_base.replace(/\/?$/, '/') : '../../';
    var cards = (D.links || []).map(function (l) {
      var rel = l.path.replace(/^(\.\.\/)+/, '');
      var ext = (rel.split('.').pop() || '').toUpperCase().slice(0, 4);
      return el('a', { class: 'panel src-card', href: base + rel, target: '_blank', rel: 'noopener', style: { 'text-decoration': 'none', color: 'inherit' } }, [
        el('span', { class: 'ft' }, ext),
        el('div', null, [el('h4', null, l.title), el('p', null, l.note), el('code', null, rel)])
      ]);
    });
    fill('sr-body', el('div', { class: 'grid grid-3' }, cards));
  }
  function renderFooter() {
    var m = D.meta;
    fill('footer-body', el('div', { class: 'footer-inner' }, [
      el('div', { class: 'footer-brand' }, [
        sv('svg', { viewBox: '0 0 32 32', width: 18, height: 18, 'aria-hidden': 'true' }, [
          sv('rect', { x: 1, y: 1, width: 30, height: 30, rx: 8, fill: '#c3ccdb' }),
          sv('path', { d: 'M8 23V10l8 8 8-8v13', fill: 'none', stroke: '#101827', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
        ]),
        el('strong', null, m.project + ' · ' + m.arm + ' · ' + m.experiment),
        el('span', null, '· updated ' + fmtDate(m.updated))
      ]),
      el('div', { class: 'footer-info' }, [
        'Data ', el('code', null, 'data/run_data.js'),
        el('span', { class: 'sep' }, '|'),
        DEMO ? el('strong', null, 'Demo data on ') : 'Example-data preview ',
        DEMO ? el('a', { href: 'index.html' }, 'leave demo') : el('a', { href: 'index.html?demo=1' }, '?demo=1')
      ])
    ]));
  }

  /* ============================================================ plot engine */
  function niceScale(vals, ax) {
    ax = ax || {};
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (ax.min != null) lo = ax.min;
    if (ax.max != null) hi = ax.max;
    if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
    if (lo === hi) { lo -= 0.5; hi += 0.5; }
    var span = hi - lo, raw = span / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), e = raw / mag;
    var step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
    var t0 = ax.min != null ? ax.min : Math.floor(lo / step) * step;
    var t1 = ax.max != null ? ax.max : Math.ceil(hi / step) * step;
    var ticks = [];
    for (var v = Math.ceil(t0 / step - 1e-9) * step; v <= t1 + step * 1e-6; v += step) ticks.push(+v.toFixed(10));
    var dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    return { lo: t0, hi: t1, ticks: ticks, fmt: function (x) { return x.toFixed(Math.min(dec, 6)); } };
  }
  function lin(d0, d1, r0, r1) { return function (v) { return r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0); }; }
  function matches(spec, s, stt) {
    if (!spec.filters || !s.where) return true;
    return spec.filters.every(function (f) { return s.where[f.key] == null || s.where[f.key] === stt.f[f.key]; });
  }
  function yLabel(spec, stt) {
    var y = spec.y || {};
    if (y.labelBy && stt.f[y.labelBy.key] && y.labelBy.map[stt.f[y.labelBy.key]]) return y.labelBy.map[stt.f[y.labelBy.key]];
    return y.label || '';
  }
  function colorMap(spec) {
    var map = {}, k = 0;
    (spec.series || []).forEach(function (s) { if (!(s.name in map)) { map[s.name] = s.color || PAL[k % PAL.length]; k++; } });
    return map;
  }
  function tipText(s, p, xl) {
    var t = s.name + '\n' + (xl != null ? xl + ': ' : '') + fmtNum(p.y != null ? p.y : p.mid);
    if (p.lo != null && p.hi != null) t += '  [' + fmtNum(p.lo) + ' – ' + fmtNum(p.hi) + ']';
    if (p.label) t += '\n' + p.label;
    if (p.note) t += '\n' + p.note;
    return t;
  }
  function xCats(spec, vis) {
    var c = spec.categories || (spec.x && spec.x.categories);
    if (c) return c.slice();
    var out = [];
    vis.forEach(function (s) { (s.points || []).forEach(function (p) { if (out.indexOf(p.x) < 0) out.push(p.x); }); });
    return out;
  }

  function buildSvg(id, spec, vis, active, has, stt) {
    var type = spec.type;
    var W = 640, H = spec.height || (type === 'interval' ? 250 : 290);
    var m = { t: 14, r: 18, b: 46, l: 58 };
    var catX = type === 'bar' || type === 'step' || (type === 'line' && spec.x && spec.x.categories);
    var cats = catX ? xCats(spec, vis) : null;
    var ycats = type === 'interval' ? xCats(spec, vis.map(function (s) { return { points: (s.points || []).map(function (p) { return { x: p.cat }; }) }; })) : null;
    if (type === 'interval') m.l = 110;
    var bwEst = cats && cats.length ? (W - m.l - m.r) / cats.length : 0;
    var rot = !!(cats && cats.some(function (c) { return String(c).length * 6.4 > bwEst - 8; }));
    if (rot) m.b = 76;
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var root = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'plot-svg', role: 'img', 'aria-label': spec.title, 'data-plot': id });
    var g = sv('g', { transform: 'translate(' + m.l + ',' + m.t + ')' });
    root.appendChild(g);
    root.appendChild(sv('text', { class: 'ax-label', x: m.l + iw / 2, y: H - 8, 'text-anchor': 'middle', text: (spec.x && spec.x.label) || '' }));
    if (type !== 'interval') root.appendChild(sv('text', { class: 'ax-label', transform: 'translate(15,' + (m.t + ih / 2) + ') rotate(-90)', 'text-anchor': 'middle', text: yLabel(spec, stt) }));
    var colors = colorMap(spec);

    function bandX(list) {
      var bw = iw / Math.max(list.length, 1);
      list.forEach(function (c, i) {
        var cx = i * bw + bw / 2;
        g.appendChild(sv('line', { class: 'ax-line', x1: cx, x2: cx, y1: ih, y2: ih + 4 }));
        g.appendChild(rot ? sv('text', { class: 'ax-tick', transform: 'translate(' + cx + ',' + (ih + 14) + ') rotate(-32)', 'text-anchor': 'end', text: c })
          : sv('text', { class: 'ax-tick', x: cx, y: ih + 17, 'text-anchor': 'middle', text: c }));
      });
      return bw;
    }
    function bandY(list) {
      var bh = ih / Math.max(list.length, 1);
      list.forEach(function (c, i) { g.appendChild(sv('text', { class: 'ax-tick', x: -10, y: i * bh + bh / 2, dy: '0.35em', 'text-anchor': 'end', style: { 'font-size': '12px', 'font-weight': '600' }, text: c })); });
      return bh;
    }
    function gridY(sc, y) { sc.ticks.forEach(function (t) { g.appendChild(sv('line', { class: 'ax-grid', x1: 0, x2: iw, y1: y(t), y2: y(t) })); g.appendChild(sv('text', { class: 'ax-tick', x: -8, y: y(t), dy: '0.32em', 'text-anchor': 'end', text: sc.fmt(t) })); }); }
    function gridX(sc, x) { sc.ticks.forEach(function (t) { g.appendChild(sv('line', { class: 'ax-grid', y1: 0, y2: ih, x1: x(t), x2: x(t) })); g.appendChild(sv('text', { class: 'ax-tick', y: ih + 17, x: x(t), 'text-anchor': 'middle', text: sc.fmt(t) })); }); }
    function axes() { g.appendChild(sv('line', { class: 'ax-line', x1: 0, x2: iw, y1: ih, y2: ih })); if (type !== 'interval') g.appendChild(sv('line', { class: 'ax-line', x1: 0, x2: 0, y1: 0, y2: ih })); }
    function errBar(x, ylo, yhi, color) {
      var st_ = color ? { stroke: color, 'stroke-width': 1.4 } : { class: 'err-bar' };
      function ln(a) { Object.keys(st_).forEach(function (k) { a[k] = st_[k]; }); return sv('line', a); }
      g.appendChild(ln({ x1: x, x2: x, y1: ylo, y2: yhi }));
      [ylo, yhi].forEach(function (yy) { g.appendChild(ln({ x1: x - 4, x2: x + 4, y1: yy, y2: yy })); });
    }

    if (!has) {
      g.appendChild(sv('rect', { class: 'ax-frame', x: 0, y: 0, width: iw, height: ih, rx: 4 }));
      if (cats && cats.length) bandX(cats);
      if (ycats && ycats.length) bandY(ycats);
      var stg = spec.stage ? 'Awaiting ' + spec.stage + ' results' : 'No data yet';
      g.appendChild(sv('text', { class: 'empty-msg', x: iw / 2, y: ih / 2 - 6, 'text-anchor': 'middle', text: stg }));
      g.appendChild(sv('text', { class: 'empty-sub', x: iw / 2, y: ih / 2 + 14, 'text-anchor': 'middle', text: 'data slot: plots.' + id }));
      return root;
    }

    var ys = [], xs = [];
    vis.forEach(function (s) { (s.points || []).forEach(function (p) { ['y', 'lo', 'hi', 'mid'].forEach(function (k) { if (typeof p[k] === 'number') (type === 'interval' ? xs : ys).push(p[k]); }); if (typeof p.x === 'number') xs.push(p.x); }); });

    if (type === 'bar') {
      if (spec.threshold) ys.push(spec.threshold.y);
      ys.push(0);
      var sy = niceScale(ys, spec.y), y = lin(sy.lo, sy.hi, ih, 0);
      gridY(sy, y); var bw = bandX(cats); axes();
      var k = Math.max(active.length, 1), gw = bw * 0.74, w = gw / k, base = y(Math.max(sy.lo, 0));
      active.forEach(function (s, si) {
        var col = colors[s.name];
        (s.points || []).forEach(function (p) {
          var ci = cats.indexOf(p.x); if (ci < 0 || p.y == null) return;
          var x0 = ci * bw + (bw - gw) / 2 + si * w, yv = y(p.y);
          g.appendChild(sv('rect', { class: 'mark', x: x0 + 1, y: Math.min(yv, base), width: Math.max(w - 2, 1), height: Math.max(Math.abs(base - yv), 0.5), rx: 2, fill: col, 'data-tip': tipText(s, p, p.x) }));
          if (p.lo != null && p.hi != null) errBar(x0 + w / 2, y(p.lo), y(p.hi), null);
        });
      });
      if (spec.threshold) {
        var ty = y(spec.threshold.y);
        g.appendChild(sv('line', { class: 'thr-line', x1: 0, x2: iw, y1: ty, y2: ty }));
        g.appendChild(sv('text', { class: 'thr-label', x: iw - 4, y: ty - 5, 'text-anchor': 'end', text: spec.threshold.label || '' }));
      }
    } else if (type === 'line') {
      var syl = niceScale(ys, spec.y), yl = lin(syl.lo, syl.hi, ih, 0), xf, bwl = 0;
      gridY(syl, yl);
      if (cats) { bwl = bandX(cats); xf = function (v) { return cats.indexOf(v) * bwl + bwl / 2; }; }
      else { var sxl = niceScale(xs, spec.x), xl = lin(sxl.lo, sxl.hi, 0, iw); gridX(sxl, xl); xf = xl; }
      axes();
      active.forEach(function (s) {
        var col = colors[s.name];
        var pts = (s.points || []).filter(function (p) { return p.y != null || (p.lo != null && p.hi != null); }).slice();
        if (!cats) pts.sort(function (a, b) { return a.x - b.x; });
        var mode = s.mode || 'line+points';
        if (s.band) {
          var bp = pts.filter(function (p) { return p.lo != null && p.hi != null; });
          if (bp.length > 1) {
            var d = bp.map(function (p, i) { return (i ? 'L' : 'M') + xf(p.x).toFixed(1) + ',' + yl(p.hi).toFixed(1); }).join('') +
              bp.slice().reverse().map(function (p) { return 'L' + xf(p.x).toFixed(1) + ',' + yl(p.lo).toFixed(1); }).join('') + 'Z';
            g.appendChild(sv('path', { d: d, fill: col, 'fill-opacity': 0.14, stroke: 'none', 'data-tip': s.name }));
          }
        }
        var lp = pts.filter(function (p) { return p.y != null; });
        if (mode.indexOf('line') >= 0 && lp.length > 1) {
          g.appendChild(sv('path', { d: lp.map(function (p, i) { return (i ? 'L' : 'M') + xf(p.x).toFixed(1) + ',' + yl(p.y).toFixed(1); }).join(''), fill: 'none', stroke: col, 'stroke-width': 2.2, 'stroke-dasharray': s.dash ? '6 4' : null, 'stroke-linejoin': 'round' }));
        }
        lp.forEach(function (p) {
          if (s.errorbars && p.lo != null && p.hi != null) errBar(xf(p.x), yl(p.lo), yl(p.hi), col);
          if (mode.indexOf('points') >= 0) g.appendChild(sv('circle', { class: 'mark pt-ring', cx: xf(p.x), cy: yl(p.y), r: 4, fill: col, 'stroke-width': 1.2, 'data-tip': tipText(s, p, cats ? p.x : fmtNum(p.x)) }));
        });
      });
    } else if (type === 'scatter') {
      var sxs = niceScale(xs, spec.x), sys = niceScale(ys, spec.y), xs_ = lin(sxs.lo, sxs.hi, 0, iw), ys_ = lin(sys.lo, sys.hi, ih, 0);
      gridY(sys, ys_); gridX(sxs, xs_); axes();
      var placed = [];
      function placeLabel(px, py, text) {
        var w = String(text).length * 6.2 + 2, h = 12;
        var tries = [[7, -6], [7, 14], [-w - 7, -6], [-w - 7, 14]];
        for (var i = 0; i < tries.length; i++) {
          var x0 = px + tries[i][0], y0 = py + tries[i][1] - 10;
          if (x0 < 0 || x0 + w > iw || y0 < 0 || y0 + h > ih) continue;
          var clash = placed.some(function (b) { return x0 < b[0] + b[2] && x0 + w > b[0] && y0 < b[1] + b[3] && y0 + h > b[1]; });
          if (!clash) { placed.push([x0, y0, w, h]); return [x0, y0 + 10]; }
        }
        return null;   // no free spot: the tooltip still names the point
      }
      active.forEach(function (s) {
        var col = colors[s.name];
        (s.points || []).forEach(function (p) {
          if (p.x == null || p.y == null) return;
          g.appendChild(sv('circle', { class: 'mark pt-ring', cx: xs_(p.x), cy: ys_(p.y), r: s.r || 5, fill: col, 'fill-opacity': s.opacity || 0.85, 'stroke-width': 1, 'data-tip': s.name + (p.label ? ' · ' + p.label : '') + '\nx = ' + fmtNum(p.x) + ', y = ' + fmtNum(p.y) + (p.note ? '\n' + p.note : '') }));
          if (spec.labels && p.label) { var pos = placeLabel(xs_(p.x), ys_(p.y), p.label); if (pos) g.appendChild(sv('text', { class: 'pt-label', x: pos[0], y: pos[1], text: p.label })); }
        });
      });
    } else if (type === 'interval') {
      var sxi = niceScale(xs, spec.x), xi = lin(sxi.lo, sxi.hi, 0, iw);
      gridX(sxi, xi); var bh = bandY(ycats); axes();
      var ki = Math.max(active.length, 1), inner = bh * 0.7, sub = inner / ki;
      active.forEach(function (s, si) {
        var col = colors[s.name];
        (s.points || []).forEach(function (p) {
          var ci = ycats.indexOf(p.cat); if (ci < 0) return;
          var yc = ci * bh + (bh - inner) / 2 + si * sub + sub / 2;
          var tip = s.name + ' · ' + p.cat + '\n' + (p.lo != null ? fmtNum(p.lo) + ' – ' + fmtNum(p.hi) : '') + (p.mid != null ? '  (central ' + fmtNum(p.mid) + ')' : '') + (p.note ? '\n' + p.note : '');
          if (p.lo != null && p.hi != null) g.appendChild(sv('line', { class: 'mark', x1: xi(p.lo), x2: xi(p.hi), y1: yc, y2: yc, stroke: col, 'stroke-width': Math.max(3, Math.min(9, sub * 0.6)), 'stroke-linecap': 'round', 'stroke-opacity': 0.85, 'data-tip': tip }));
          if (p.mid != null) g.appendChild(sv('circle', { class: 'mark', cx: xi(p.mid), cy: yc, r: 4.5, style: { fill: 'var(--panel)' }, stroke: col, 'stroke-width': 2, 'data-tip': tip }));
        });
      });
    } else if (type === 'step') {
      var sst = niceScale(ys, spec.y), yst = lin(sst.lo, sst.hi, ih, 0);
      gridY(sst, yst); var bws = bandX(cats); axes();
      active.forEach(function (s) {
        var col = colors[s.name], prev = null;
        (s.points || []).map(function (p) { return { p: p, ci: cats.indexOf(p.x) }; }).filter(function (o) { return o.ci >= 0 && o.p.y != null; })
          .sort(function (a, b) { return a.ci - b.ci; }).forEach(function (o) {
            var x0 = o.ci * bws + bws * 0.2, x1 = o.ci * bws + bws * 0.8, yy = yst(o.p.y);
            if (prev) g.appendChild(sv('line', { x1: prev.x, y1: prev.y, x2: x0, y2: yy, stroke: col, 'stroke-width': 1.3, 'stroke-dasharray': '4 3' }));
            g.appendChild(sv('line', { class: 'mark', x1: x0, x2: x1, y1: yy, y2: yy, stroke: col, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'data-tip': tipText(s, o.p, o.p.x) }));
            prev = { x: x1, y: yy };
          });
      });
    }
    return root;
  }

  function renderPlot(id, specOverride) {
    var spec = specOverride || (D.plots && D.plots[id]);
    if (!spec) return el('div', { class: 'empty' }, 'Plot "' + id + '" is not defined in data/run_data.js.');
    var stt = { f: {}, hidden: {} };
    (spec.filters || []).forEach(function (f) { stt.f[f.key] = f.default != null ? f.default : f.options[0]; });
    var body = el('div'), legend = el('div', { class: 'plot-legend' });
    var ctrl = el('div', { class: 'plot-ctrl' });
    (spec.filters || []).forEach(function (f) {
      var sel = el('select', { 'aria-label': f.label, onchange: function (e) { stt.f[f.key] = e.target.value; draw(); } },
        f.options.map(function (o) { return el('option', { value: o, selected: o === stt.f[f.key] }, (f.names && f.names[o]) || o); }));
      ctrl.appendChild(el('label', null, [f.label, sel]));
    });
    var bSvg = el('button', { type: 'button', class: 'icon-btn', title: 'Download this plot as SVG', onclick: function () { downloadSvg(id, body.querySelector('svg')); } }, 'SVG');
    var bDat = el('button', { type: 'button', class: 'icon-btn', title: 'Download the plotted data as JSON', onclick: function () { downloadData(id, spec); } }, 'Data');
    ctrl.appendChild(bSvg); ctrl.appendChild(bDat);
    var fig = el('figure', { class: 'plot', 'data-plot-id': id }, [
      el('div', { class: 'plot-head' }, [el('div', null, [el('h4', null, spec.title), spec.subtitle ? el('p', { class: 'plot-sub' }, spec.subtitle) : null]), ctrl]),
      body, legend
    ]);
    function draw() {
      var vis = (spec.series || []).filter(function (s) { return matches(spec, s, stt); });
      var has = vis.some(function (s) { return s.points && s.points.length; });
      var active = vis.filter(function (s) { return !stt.hidden[s.name]; });
      body.textContent = '';
      body.appendChild(buildSvg(id, spec, vis, active, has, stt));
      legend.textContent = '';
      var colors = colorMap(spec);
      if (has) {
        var seen = {};
        vis.forEach(function (s) {
          if (seen[s.name]) return; seen[s.name] = 1;
          legend.appendChild(el('button', { type: 'button', class: stt.hidden[s.name] ? 'off' : '', title: 'Show or hide this series', onclick: function () { stt.hidden[s.name] = !stt.hidden[s.name]; draw(); } },
            [el('span', { class: 'sw', style: { background: colors[s.name] } }), s.name]));
        });
      } else if (spec.expect && spec.expect.length) {
        legend.appendChild(el('span', { class: 'exp' }, 'Expected:'));
        spec.expect.forEach(function (n) { legend.appendChild(el('span', { class: 'exp', style: { display: 'inline-flex', 'align-items': 'center', gap: '6px' } }, [el('span', { class: 'sw' }), n])); });
      }
      if (!specOverride) legend.appendChild(el('span', { class: 'slot-id' }, 'plots.' + id));
      bDat.disabled = !has;
    }
    draw();
    return fig;
  }

  var SVG_EXPORT_CSS = '.ax-line{stroke:#334155;stroke-width:1}.ax-grid{stroke:#e2e8f0;stroke-width:1}.ax-tick{fill:#64748b;font-size:11px}' +
    '.ax-label{fill:#334155;font-size:12px;font-weight:600}.ax-frame{fill:none;stroke:#cbd5e1;stroke-dasharray:4 4}.empty-msg{fill:#64748b;font-size:13px;font-weight:600}' +
    '.empty-sub{fill:#64748b;font-size:11.5px;font-family:Consolas,monospace}.thr-line{stroke:#b91c1c;stroke-width:1.5;stroke-dasharray:6 4}.thr-label{fill:#b91c1c;font-size:11px;font-weight:700;stroke:#fff;stroke-width:4px;paint-order:stroke}.pt-label{fill:#334155;font-size:11px;stroke:#fff;stroke-width:3px;paint-order:stroke}' +
    'text{font-family:"Segoe UI",Arial,sans-serif}svg{--panel:#ffffff;--ink-2:#334155}.err-bar{stroke:#334155;stroke-width:1.4}.pt-ring{stroke:#ffffff}';
  function saveBlob(name, type, text) {
    var blob = new Blob([text], { type: type });
    var a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function downloadSvg(id, node) {
    if (!node) return;
    var c = node.cloneNode(true);
    c.setAttribute('xmlns', SVGNS);
    c.insertBefore(sv('style', { text: SVG_EXPORT_CSS }), c.firstChild);
    c.insertBefore(sv('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: '#ffffff' }), c.childNodes[1]);
    saveBlob('maestro_exp_v2_' + id + '.svg', 'image/svg+xml', new XMLSerializer().serializeToString(c));
  }
  function downloadData(id, spec) {
    var out = { plot: id, title: spec.title, x: spec.x, y: spec.y, series: spec.series, exported: new Date().toISOString(), demo: DEMO };
    saveBlob('maestro_exp_v2_' + id + '.json', 'application/json', JSON.stringify(out, null, 2));
  }

  /* ------------------------------------------------------------ tooltip, lightbox, theme, nav */
  function initTooltip() {
    var tip = byId('tip');
    if (!tip) return;
    function place(e) {
      var x = e.clientX + 14, y = e.clientY + 14, r = tip.getBoundingClientRect();
      if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
      if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }
    document.addEventListener('mouseover', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
      if (!t) { tip.hidden = true; return; }
      tip.textContent = t.getAttribute('data-tip');
      tip.hidden = false; place(e);
    });
    document.addEventListener('mousemove', function (e) { if (!tip.hidden) place(e); });
    window.addEventListener('scroll', function () { tip.hidden = true; }, { passive: true });
  }
  function openLightbox(src, caption) {
    var lb = byId('lightbox');
    lb.querySelector('img').src = src;
    lb.querySelector('img').alt = caption;
    lb.querySelector('figcaption').textContent = caption;
    lb.hidden = false;
  }
  function initLightbox() {
    var lb = byId('lightbox');
    if (!lb) return;
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lightbox-close')) lb.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') lb.hidden = true; });
  }
  function initTheme() {
    var btn = byId('theme-btn');
    if (!btn) return;
    function label() { btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? 'Light' : 'Dark'; }
    label();
    btn.addEventListener('click', function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (dark) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('maestro-expv2-dash-theme', dark ? 'light' : 'dark'); } catch (e) { /* storage off */ }
      label();
    });
  }
  function initNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.topnav a[href^="#"]'));
    if (!('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-80px 0px -65% 0px' });
    document.querySelectorAll('main .section').forEach(function (s) { obs.observe(s); });
  }
  function handleHash() {
    var m = /^#stage-(.+)$/.exec(location.hash || '');
    if (m && findStage(decodeURIComponent(m[1]))) selectStage(decodeURIComponent(m[1]), true);
  }

  /* ------------------------------------------------------------ boot */
  function renderAll() {
    renderMasthead(); renderOverview(); renderPipeline(); renderAnswer(); renderLadder(); renderStages(); renderGates(); renderLog(); renderSources(); renderFooter();
  }
  function start() {
    D = window.MAESTRO_RUN;
    if (!D || !D.stages) { fill('ov-body', el('div', { class: 'empty' }, 'data/run_data.js did not load or has a syntax error. Check the browser console.')); return; }
    if (DEMO) { var b = byId('demo-banner'); if (b) b.hidden = false; }
    var cs = currentStage();
    ui.stage = cs.stage ? cs.stage.id : D.stages[0].id;
    renderAll();
    initTooltip(); initLightbox(); initTheme(); initNav();
    handleHash();
    window.addEventListener('hashchange', handleHash);
  }
  function boot() {
    var demo = false;
    try { demo = new URLSearchParams(location.search).get('demo') === '1'; } catch (e) { demo = false; }
    if (!demo) { start(); return; }
    var sc = document.createElement('script');
    sc.src = 'data/demo_data.js';
    sc.onload = function () { if (typeof window.MAESTRO_DEMO === 'function' && window.MAESTRO_RUN) { window.MAESTRO_DEMO(window.MAESTRO_RUN); DEMO = true; } start(); };
    sc.onerror = function () { start(); };
    document.head.appendChild(sc);
  }
  window.MAESTRO_DASH = { version: 1, selectStage: function (id) { selectStage(id, true); }, rerender: function () { renderAll(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
