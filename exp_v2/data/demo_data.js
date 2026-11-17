/* MAESTRO · exp_v2 dashboard — EXAMPLE data for layout checks only.
 * Loaded only when the page is opened as index.html?demo=1, which also shows a banner.
 * Every value below is synthetic. Nothing here is a run result, a literature value or a forecast.
 */
window.MAESTRO_DEMO = function (D) {
  'use strict';
  function seeded(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  var rnd = seeded(7);
  function S(id) { return D.stages.filter(function (s) { return s.id === id; })[0]; }

  // stage states, to show every pill and bar style
  S('S01').status = 'done'; S('S01').used_h = 2.4;
  S('S02').status = 'done'; S('S02').used_h = 1.6;
  S('S03').status = 'running'; S('S03').progress = 0.55; S('S03').used_h = 2.7;
  S('S03').sessions = [
    { start: '2026-11-18T09:10', end: '2026-11-18T11:05', minutes: 115, turns: 140, cost_usd: null, note: 'Example session' },
    { start: '2026-11-18T13:00', end: '2026-11-18T13:50', minutes: 50, turns: 61, cost_usd: null, note: 'Example session' }
  ];
  S('S03').ram = [{ job: 'example 2D reproduction mesh', est_gb: 1.2, est_min: 20, actual_gb: 1.0, actual_min: 17, where: 'Laptop' }];
  D.meta.run_status = 'running';
  D.gates.filter(function (g) { return g.id === 'A'; })[0].verdict = 'continue';
  D.gates.filter(function (g) { return g.id === 'A'; })[0].date = '2026-11-18';
  S('S01').numbers[0].value = 24; S('S01').numbers[1].value = 9;
  D.interventions = [{ date: '2026-11-18', stage: 'S03', kind: 'infrastructure', text: 'Example: usage-limit pause and resume.' }];

  var P = D.plots;
  P.s01_evidence.series = [
    { name: 'Cu/Al', points: [{ x: 'Galvanic current', y: 3 }, { x: 'pH map', y: 1 }, { x: 'SVET', y: 2 }, { x: 'SECM', y: 1 }, { x: 'Polarisation', y: 3 }] },
    { name: 'Analogous galvanic/ORR', points: [{ x: 'Galvanic current', y: 5 }, { x: 'pH map', y: 3 }, { x: 'SVET', y: 4 }, { x: 'SECM', y: 2 }, { x: 'Polarisation', y: 6 }] }
  ];
  var facets = ['Cu(111)', 'Cu(100)', 'Cu(110)', 'Facet mixture'];
  P.s02_j0.series = [
    { name: 'Literature', points: facets.slice(0, 3).map(function (f, i) { return { cat: f, lo: -9.5 + i * 0.4, hi: -7.2 + i * 0.3, mid: -8.3 + i * 0.35 }; }) },
    { name: 'Sampled range', points: facets.map(function (f, i) { return { cat: f, lo: -9.8 + i * 0.3, hi: -6.9 + i * 0.2, mid: -8.2 + i * 0.25 }; }) }
  ];
  P.s02_alpha.series = [
    { name: 'From RDS estimate', points: facets.slice(0, 3).map(function (f, i) { return { cat: f, lo: 0.32 + i * 0.03, hi: 0.62 - i * 0.02, mid: 0.47 }; }) },
    { name: 'Sampled range', points: facets.map(function (f) { return { cat: f, lo: 0.3, hi: 0.65, mid: 0.48 }; }) }
  ];
  P.s02_coupling.series = ['Cu(111)', 'Cu(100)', 'Cu(110)'].map(function (f, k) {
    var pts = [];
    for (var i = 0; i < 40; i++) { var x = -9.4 + k * 0.4 + rnd() * 2.2; pts.push({ x: +x.toFixed(2), y: +(0.75 + 0.04 * x + (rnd() - 0.5) * 0.12).toFixed(3) }); }
    return { name: f, r: 3.5, opacity: 0.7, points: pts };
  });
  var xs = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
  P.s03_validation.series = [
    { name: 'Experiment', mode: 'points', errorbars: true, points: xs.map(function (x) { var y = 10.2 - 1.6 * Math.exp(-x); return { x: x, y: +(y + (rnd() - 0.5) * 0.3).toFixed(2), lo: +(y - 0.35).toFixed(2), hi: +(y + 0.35).toFixed(2) }; }) },
    { name: 'Our model', mode: 'line', points: xs.map(function (x) { return { x: x, y: +(10.15 - 1.55 * Math.exp(-x)).toFixed(2) }; }) },
    { name: 'Registered tolerance', mode: 'line', band: true, dash: true, points: xs.map(function (x) { var y = 10.15 - 1.55 * Math.exp(-x); return { x: x, lo: +(y - 0.5).toFixed(2), hi: +(y + 0.5).toFixed(2) }; }) }
  ];
  var params = ['log10 j0', 'alpha_c', 'delta', 'w_Cu', 'D_O2', 'c_O2', 'kappa', 'k_hyd'];
  P.s04_morris.series = [];
  ['L0', 'L1', 'L2'].forEach(function (r, ri) {
    ['Ig', 'depth', 'pH'].forEach(function (q, qi) {
      P.s04_morris.series.push({ name: 'Parameters', where: { rung: r, qoi: q }, points: params.map(function (p, i) { var mu = Math.max(0.02, (1 - i / params.length) * (0.9 - 0.2 * ri) * rnd() + (qi === 2 && i < 2 ? 0.35 : 0)); return { x: +mu.toFixed(3), y: +(mu * (0.3 + 0.8 * rnd())).toFixed(3), label: p }; }) });
    });
  });
  P.s05_sobol.series = [];
  ['L0', 'L1', 'L2'].forEach(function (r) {
    ['Ig', 'depth', 'pH'].forEach(function (q) {
      var s1 = params.map(function (p, i) { return Math.max(0, (q === 'pH' && i < 2 ? 0.22 : 0.05) + (i === 2 || i === 3 ? 0.25 : 0) + (rnd() - 0.5) * 0.08); });
      P.s05_sobol.series.push({ name: 'S1 (first order)', where: { rung: r, qoi: q }, points: params.map(function (p, i) { var v = +s1[i].toFixed(3); return { x: p, y: v, lo: Math.max(0, +(v - 0.06).toFixed(3)), hi: +(v + 0.06).toFixed(3) }; }) });
      P.s05_sobol.series.push({ name: 'ST (total)', where: { rung: r, qoi: q }, points: params.map(function (p, i) { var v = +(s1[i] * 1.3 + 0.02).toFixed(3); return { x: p, y: v, lo: Math.max(0, +(v - 0.07).toFixed(3)), hi: +(v + 0.07).toFixed(3) }; }) });
    });
  });
  var base = { Ig: [42, 37, 33], depth: [18, 15, 14], pH: [10.6, 10.1, 9.7] };
  P.s05_rungs.series = [];
  Object.keys(base).forEach(function (q) {
    P.s05_rungs.series.push({ name: 'Median with 90 % interval', where: { qoi: q }, errorbars: true, points: ['L0', 'L1', 'L2'].map(function (r, i) { var v = base[q][i]; return { x: r, y: v, lo: +(v * 0.85).toFixed(2), hi: +(v * 1.15).toFixed(2) }; }) });
    P.s05_rungs.series.push({ name: 'Literature j₀, α = 0.5', where: { qoi: q }, mode: 'line+points', dash: true, points: ['L0', 'L1', 'L2'].map(function (r, i) { return { x: r, y: +(base[q][i] * 1.04).toFixed(2) }; }) });
  });
  P.s05b_fed.series = ['Cu(111)', 'Cu(100)', 'Cu(110)'].map(function (f, k) {
    var g = [4.92, 3.9 - 0.1 * k, 3.4 - 0.15 * k, 1.9 - 0.1 * k, 0.9 - 0.05 * k, 0];
    return { name: f + ' · U = 0 V vs RHE', points: P.s05b_fed.x.categories.map(function (c, i) { return { x: c, y: +g[i].toFixed(2) }; }) };
  });
};
