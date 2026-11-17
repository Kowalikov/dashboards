/* MAESTRO · Arm A · exp_v2 — dashboard data (the ONLY file to edit during the run).
 *
 * Sources: decisions/exp_v2/2026_11_16_exp_v2_run_scope.md (stage plan, gates, QoIs, DFT rule)
 *          decisions/exp_v2/2026_11_16_exp_v2_handoff_synthesis.md (v1 reference, meetings, M1-M18)
 *
 * Conventions
 *  - null  = not measured / not decided yet. The page shows it as a pending slot; never type a guess.
 *  - Stage status: "planned" | "running" | "paused" | "gate" (stage done, waiting for review)
 *                  | "done" | "skipped" (S05b not triggered) | "blocked"
 *  - progress: 0..1, only read while a stage is running / paused / blocked.
 *  - used_h: agent hours actually used by the stage (sum of its sessions).
 *  - Paths in code/handoffs are relative to meta.code_base (the run folder or a repo URL).
 *    While code_base is null they are shown as plain text, not as links.
 *  - Figures: copy the PNG/SVG into dashboards/exp_v2/figures/ and set src: "figures/<file>".
 *  - Plots: fill series[].points; every plot keeps its axes and categories when empty.
 *  - Open index.html?demo=1 to preview the plots with example data (clearly bannered, never run data).
 */
window.MAESTRO_RUN = {
  schema: 1,

  meta: {
    project: "MAESTRO",
    arm: "Arm A",
    experiment: "exp_v2",
    title: "exp_v2 run dashboard",
    updated: "2026-11-17",
    run_status: "pre-launch",            // pre-launch | running | paused | at-gate | complete
    status_note: "Run scope under review by the reviewers (due 17 Nov). Launch planned for the evening of 17 Nov, after their feedback.",
    launch_planned: "2026-11-17",
    launched: null,
    first_results_due: "2026-11-19",
    model: null,                         // e.g. "claude-opus-5-5"; also fixes the run folder name
    effort: null,
    run_folder: null,                    // e.g. "arm_A/exp_v2_<model>_30h"
    code_base: null,                     // e.g. "../../../arm_A/exp_v2_<model>_30h/" or a repo URL
    links_base: null,                    // where MAESTRO_docs lives for the Sources tiles; null = local folder (../../),
                                         // e.g. "https://github.com/<org>/maestro-docs/blob/main/" when hosted
    budget_h: 30,
    reserve_h: 1.5,
    reserve_used_h: null,
    colab_units_budget: 100,             // operator's estimate, to be confirmed (~15 h A100 or ~20 h T4)
    colab_units_used: null,
    cost_usd: null,
    benchmarks_registered: null,
    benchmarks_passed: null,
    claims_in_ledger: null,
    question: "Does an atomistically computed charge-transfer coefficient α and exchange current density j₀ change the macroscopic Cu/Al galvanic-corrosion prediction enough to justify grand-canonical DFT transition-state calculations, compared with literature values or α = 0.5?",
    strategy: "Build a ladder of FEM models (toy → intermediate → realistic 3D), validate the top rung against experiment, run the same sensitivity analysis on every rung, and check whether the conclusion changes. DFT runs only where it can change that conclusion.",
    decision_rule: "GC-DFT is justified for a QoI if the first-order Sobol index of j₀ or α_c is ≥ X = 0.2, or the QoI shifts ≥ Y = 25 % across plausible α/j₀ values, on the validated rung.",
    decision_rule_X: 0.2,
    decision_rule_Y_pct: 25,
    system: [
      ["Couple", "Cu/Al galvanic couple, 3D (Cu particle or strip in Al)"],
      ["Electrolyte", "Aerated 0.1 M NaCl, 25 °C, bulk immersion"],
      ["Cathode", "ORR on Cu only; cathodic leg only, anodic α = 0"],
      ["Cu facets", "Cu(111), Cu(100), Cu(110), alkaline set"],
      ["Potentials", "Always vs RHE, stated on every figure and table"],
      ["j₀ and α_c", "Coupled through shared energetics; j₀ anchored to experiment"]
    ]
  },

  /* ------------------------------------------------------------------ stages */
  stages: [
    {
      id: "S00", name: "Setup", short: "Setup",
      budget_h: 0.5, used_h: null, status: "done", progress: 1,
      human: "Human input before the stage (done)",
      goal: "venv, PySCF, FEM stack, RAM check.",
      exit: "Done.",
      outputs: [
        { label: "Agent .venv built", state: "done" },
        { label: "PySCF installed", state: "done" },
        { label: "Quantum ESPRESSO installed (believed, not yet checked)", state: "check" },
        { label: "FEM stack installed and import-tested", state: "check" },
        { label: "tectonic for the LaTeX paper (C3)", state: "check" },
        { label: "Colab offload path smoke-tested before launch", state: "pending" }
      ],
      numbers: [
        { label: "Laptop RAM", value: 8, unit: "GB", note: "Orchestration + small jobs" },
        { label: "Per-process RAM cap", value: null, unit: "GB", note: "Must match CLAUDE.md (v1: ≤ 2 GB)" },
        { label: "PySCF version", value: null },
        { label: "FEM stack", value: null },
        { label: "Quantum ESPRESSO", value: null, note: "Open item from 16 Nov" },
        { label: "Colab units available", value: null, note: "Estimate ~100, to confirm" }
      ],
      plots: [], figures: [],
      code: [ { label: "Environment freeze", path: "agent/env_freeze.txt" }, { label: "Requirements", path: "agent/requirements.txt" } ],
      handoffs: [],
      sessions: [], ram: [],
      notes: ["Confirm what S00 actually installed (PySCF; Quantum ESPRESSO?) before launch."]
    },
    {
      id: "S01", name: "Evidence and validation targets", short: "Evidence + targets",
      budget_h: 3, used_h: null, status: "planned", progress: 0,
      human: "Gate A after the stage: both reviewers (stop and wait)",
      goal: "Validated FEM studies for Cu/Al or analogous galvanic/ORR systems with experimental data (current, pH maps, SVET/SECM). Choose one study to reproduce, plus a fallback. Equations for each rung; benchmark register including experimental targets; evidence on the continuum-vs-DFT ordering (M10).",
      exit: "Target study + tolerances registered.",
      outputs: [
        { label: "Evidence table of validated FEM studies with experimental data", state: "pending" },
        { label: "Target study to reproduce + fallback study", state: "pending" },
        { label: "Equations for L0, L1, L2", state: "pending" },
        { label: "Benchmark register incl. experimental targets and tolerances", state: "pending" },
        { label: "Literature evidence on continuum-vs-DFT ordering (M10)", state: "pending" },
        { label: "Gate A review package", state: "pending" }
      ],
      numbers: [
        { label: "Studies screened", value: null },
        { label: "Studies with experimental data", value: null },
        { label: "Target study", value: null },
        { label: "Fallback study", value: null },
        { label: "Validation tolerance", value: null },
        { label: "Benchmarks registered", value: null }
      ],
      plots: ["s01_evidence"],
      figures: [
        { title: "Evidence map", caption: "Candidate studies against system similarity and type of experimental data.", expected: "S01_evidence_map.png", src: null },
        { title: "Benchmark register", caption: "Registered targets with tolerances, exported as a table figure.", expected: "S01_benchmark_register.png", src: null }
      ],
      code: [ { label: "Stage plan", path: "agent/state/S01_plan.md" }, { label: "Stage outputs", path: "agent/runs/S01/" }, { label: "Benchmarks", path: "agent/benchmarks/" } ],
      handoffs: [ { label: "Sources", path: "agent/SOURCES.md" }, { label: "Claim ledger", path: "agent/CLAIMS.md" } ],
      sessions: [], ram: [], notes: []
    },
    {
      id: "S02", name: "Parameter ranges", short: "Parameter ranges",
      budget_h: 2, used_h: null, status: "planned", progress: 0,
      human: "AI-assessed, no stop",
      goal: "j₀ and α_c per facet from literature and scaling relations, coupled sampling, facet-weighted mixture, handoff.json. No DFT up front.",
      exit: "Ranges with sources for all 3 facets.",
      outputs: [
        { label: "j₀ range per facet with sources", state: "pending" },
        { label: "α_c range per facet (from RDS estimate, carried as a distribution)", state: "pending" },
        { label: "Coupled j₀–α_c sampling through shared energetics", state: "pending" },
        { label: "Facet-weighted mixture", state: "pending" },
        { label: "handoff.json", state: "pending" }
      ],
      numbers: [
        { label: "log₁₀ j₀ · Cu(111)", value: null, unit: "A cm⁻²" },
        { label: "log₁₀ j₀ · Cu(100)", value: null, unit: "A cm⁻²" },
        { label: "log₁₀ j₀ · Cu(110)", value: null, unit: "A cm⁻²" },
        { label: "α_c range (mixture)", value: null },
        { label: "Facet weights", value: null },
        { label: "Sources used", value: null }
      ],
      plots: ["s02_j0", "s02_alpha", "s02_coupling"],
      figures: [],
      code: [ { label: "Stage plan", path: "agent/state/S02_plan.md" }, { label: "Stage outputs", path: "agent/runs/S02/" } ],
      handoffs: [ { label: "Parameter handoff", path: "agent/runs/S02/handoff.json" } ],
      sessions: [], ram: [], notes: []
    },
    {
      id: "S03", name: "Reproduce a published study", short: "Reproduce study",
      budget_h: 5, used_h: null, status: "planned", progress: 0,
      human: "AI-assessed; optional checkpoint by the electrochemistry reviewer after the stage (scope Q9)",
      goal: "Rebuild the chosen study's model in our FEM stack and match its experimental data.",
      exit: "Within the registered tolerance, or the gap documented.",
      outputs: [
        { label: "Chosen study rebuilt in our FEM stack", state: "pending" },
        { label: "Model vs experiment comparison", state: "pending" },
        { label: "Tolerance verdict, or documented gap with likely causes", state: "pending" }
      ],
      numbers: [
        { label: "Study reproduced", value: null },
        { label: "Observable compared", value: null },
        { label: "Registered tolerance", value: null },
        { label: "Achieved deviation", value: null },
        { label: "Verdict", value: null, note: "Within tolerance / gap documented" },
        { label: "S03 ⇄ S04 loop used", value: null, note: "At most one, paid from the reserve" }
      ],
      plots: ["s03_validation"],
      figures: [
        { title: "Reproduced geometry and mesh", caption: "The published set-up rebuilt in our FEM stack.", expected: "S03_geometry_mesh.png", src: null },
        { title: "Model vs experiment", caption: "Agent figure of the reproduction against the published data.", expected: "S03_model_vs_experiment.png", src: null }
      ],
      code: [ { label: "Stage plan", path: "agent/state/S03_plan.md" }, { label: "Stage outputs", path: "agent/runs/S03/" } ],
      handoffs: [],
      sessions: [], ram: [], notes: ["Long stage: runs as several ≤ 2 h sessions with the same fixed goal."]
    },
    {
      id: "S04", name: "FEM ladder on Cu/Al", short: "FEM ladder",
      budget_h: 7, used_h: null, status: "planned", progress: 0,
      human: "AI-assessed, no stop",
      goal: "Transfer the validated method. L0 toy (v1 2D), L1 3D with O₂ transport, L2 realistic 3D. T0/T1 benchmarks and Morris screening per rung.",
      exit: "All rungs pass T0/T1; screening done.",
      outputs: [
        { label: "L0 rebuilt (v1 2D toy)", state: "pending" },
        { label: "L1 3D with O₂ transport", state: "pending" },
        { label: "L2 realistic 3D (Nernst–Planck, Al³⁺ hydrolysis, film)", state: "pending" },
        { label: "T0/T1 benchmarks per rung", state: "pending" },
        { label: "Morris screening per rung", state: "pending" }
      ],
      numbers: [
        { label: "L0 · T0 / T1", value: null },
        { label: "L1 · T0 / T1", value: null },
        { label: "L2 · T0 / T1", value: null },
        { label: "L2 mesh size", value: null, unit: "DOF" },
        { label: "L2 peak RAM", value: null, unit: "GB" },
        { label: "L2 ran on", value: null, note: "Laptop or Colab" }
      ],
      plots: ["s04_morris"],
      figures: [
        { title: "L2 surface pH map", caption: "Spatial map of surface pH on the Cu/Al couple (QoI).", expected: "S04_L2_pH_map.png", src: null },
        { title: "L2 current density", caption: "Cathodic current density on Cu and anodic flux on Al.", expected: "S04_L2_current_density.png", src: null },
        { title: "L1 O₂ concentration field", caption: "O₂ depletion around the Cu feature.", expected: "S04_L1_O2_field.png", src: null },
        { title: "3D geometry", caption: "Cu particle or strip embedded in Al.", expected: "S04_geometry.png", src: null }
      ],
      code: [ { label: "Stage plan", path: "agent/state/S04_plan.md" }, { label: "Stage outputs", path: "agent/runs/S04/" } ],
      handoffs: [],
      sessions: [], ram: [], notes: ["L2 (3D Nernst–Planck) will most likely need Colab."]
    },
    {
      id: "S05", name: "Compare across rungs and decide", short: "Compare + decide",
      budget_h: 6, used_h: null, status: "planned", progress: 0,
      human: "Input before: decision metric. Gate B after: both reviewers",
      goal: "Sobol N ≥ 512 per rung (a verified surrogate is allowed on L2). Does the conclusion change with fidelity? Map QoIs to the decision metric. Evaluate the DFT rule.",
      exit: "Verdict per QoI per rung.",
      outputs: [
        { label: "Sobol N ≥ 512 on L0, L1, L2", state: "pending" },
        { label: "Surrogate for L2 verified (if used)", state: "pending" },
        { label: "Verdict per QoI per rung", state: "pending" },
        { label: "QoIs mapped to the decision metric", state: "pending" },
        { label: "DFT rule evaluated (§5)", state: "pending" },
        { label: "Gate B review package", state: "pending" }
      ],
      numbers: [
        { label: "Sobol N (L0 / L1 / L2)", value: null },
        { label: "Reference rung", value: null, note: "Highest validated rung" },
        { label: "Decision metric", value: null, note: "Set by reviewers before S05 (Q5)" },
        { label: "Conclusion changes with fidelity?", value: null },
        { label: "DFT rule triggered?", value: null },
        { label: "Surrogate error on L2", value: null }
      ],
      plots: ["s05_sobol", "s05_rungs"],
      figures: [
        { title: "QoI → decision mapping", caption: "What each QoI shift means for the engineering decision.", expected: "S05_decision_mapping.png", src: null }
      ],
      code: [ { label: "Stage plan", path: "agent/state/S05_plan.md" }, { label: "Stage outputs", path: "agent/runs/S05/" } ],
      handoffs: [],
      sessions: [], ram: [], notes: []
    },
    {
      id: "S05b", name: "Targeted DFT (conditional)", short: "Targeted DFT",
      budget_h: 3, used_h: null, status: "planned", progress: 0, conditional: true,
      human: "AI; reviewed at Gate C",
      goal: "Only if S05 triggers the rule: fixed-charge DFT on the 4e⁻ intermediates (O₂*, OOH*, O*, OH*) for the triggered facet(s), then re-evaluate the QoIs on the reference rung, without rebuilding the FEM. If not triggered, the time goes to the reserve.",
      exit: "Narrowed range + re-evaluated QoIs, or \"not triggered\" with reasons.",
      outputs: [
        { label: "Per-job justification: range narrowed, why literature is not enough", state: "pending" },
        { label: "Per-job RAM and runtime estimate", state: "pending" },
        { label: "Free energies, limiting potential, RDS estimate", state: "pending" },
        { label: "QoIs re-evaluated on the reference rung", state: "pending" }
      ],
      numbers: [
        { label: "Triggered?", value: null },
        { label: "Jobs that passed the rule", value: null },
        { label: "Facets computed", value: null },
        { label: "Limiting potential", value: null, unit: "V vs RHE" },
        { label: "Narrowed range", value: null },
        { label: "Re-evaluated QoI shift", value: null, unit: "%" }
      ],
      plots: ["s05b_fed"],
      figures: [],
      code: [ { label: "Stage plan", path: "agent/state/S05b_plan.md" }, { label: "Stage outputs", path: "agent/runs/S05b/" } ],
      handoffs: [],
      sessions: [], ram: [], notes: ["Grand-canonical DFT transition states are out of scope for this run."]
    },
    {
      id: "S06", name: "Report", short: "Report",
      budget_h: 2, used_h: null, status: "planned", progress: 0,
      human: "Gate C after: both reviewers (+ project lead)",
      goal: "Paper (LaTeX → PDF) with a Figure 1 that tells the whole story (the question, the ladder and the answer) and extensive SI documenting every stage.",
      exit: "PDF + SI built; claim ledger consistent.",
      outputs: [
        { label: "report/paper.tex + refs.bib → paper.pdf", state: "pending" },
        { label: "Figure 1: question, ladder, answer", state: "pending" },
        { label: "Supplementary Information, stage by stage", state: "pending" },
        { label: "Claim ledger consistent with the paper", state: "pending" }
      ],
      numbers: [
        { label: "Paper pages", value: null },
        { label: "Figures", value: null },
        { label: "SI sections", value: null },
        { label: "Claims in ledger", value: null },
        { label: "Claims verified", value: null },
        { label: "References", value: null }
      ],
      plots: [],
      figures: [
        { title: "Figure 1", caption: "The question, the FEM ladder and the answer in one figure.", expected: "S06_figure1.png", src: null }
      ],
      code: [ { label: "Paper source", path: "agent/report/paper.tex" }, { label: "Bibliography", path: "agent/report/refs.bib" } ],
      handoffs: [ { label: "Paper PDF", path: "agent/report/paper.pdf" } ],
      sessions: [], ram: [], notes: []
    }
  ],

  /* ------------------------------------------------------------------ gates and inputs (slide 7) */
  gates: [
    { id: "IN0", kind: "input", before: "S00", title: "Input before S00", who: ["Operator"], what: "Operator questionnaire and run set-up.", verdict: "done", date: "2026-11-16", notes: "" },
    { id: "A", kind: "gate", after: "S01", title: "Gate A", who: ["QC reviewer", "Electrochemistry reviewer"], what: "Evidence, equations per rung, target study and tolerances; plan for S02.", verdict: null, date: null, notes: "" },
    { id: "T", kind: "checkpoint", after: "S03", title: "Optional checkpoint", who: ["Electrochemistry reviewer"], what: "Reproduced study against experiment, before the method is transferred to Cu/Al.", verdict: null, date: null, notes: "Only if the electrochemistry reviewer asks for it (scope Q9)." },
    { id: "IN5", kind: "input", before: "S05", title: "Input before S05", who: ["QC reviewer", "Electrochemistry reviewer"], what: "Decision metric: which engineering decision the result maps to, and what change counts as material (scope Q5).", verdict: null, date: null, notes: "" },
    { id: "B", kind: "gate", after: "S05", title: "Gate B", who: ["QC reviewer", "Electrochemistry reviewer"], what: "Verdict per QoI per rung, decision mapping, DFT-rule evaluation; plan for S05b/S06.", verdict: null, date: null, notes: "Cover for 20–30 Nov to be decided (scope Q8)." },
    { id: "C", kind: "gate", after: "S06", title: "Gate C", who: ["Electrochemistry reviewer", "QC reviewer", "Project lead"], what: "Paper, Figure 1, SI and the S05b outcome.", verdict: null, date: null, notes: "" },
    { id: "IN9", kind: "input", before: "Finish", title: "Input before finish", who: ["Operator"], what: "Post-run deliverables specification.", verdict: null, date: null, notes: "" }
  ],

  /* ------------------------------------------------------------------ FEM ladder */
  ladder: [
    { id: "L0", name: "Toy", physics: ["v1 2D secondary-current model", "Nernst-film pH"], t0: null, t1: null, morris: null, validated: null, reference: false },
    { id: "L1", name: "Intermediate", physics: ["3D geometry", "O₂ transport"], t0: null, t1: null, morris: null, validated: null, reference: false },
    { id: "L2", name: "Realistic", physics: ["3D Nernst–Planck: O₂, OH⁻, Na⁺, Cl⁻, Al³⁺", "Al³⁺ hydrolysis and buffering", "Simplified film"], t0: null, t1: null, morris: null, validated: null, reference: false }
  ],

  /* ------------------------------------------------------------------ the answer */
  qois: [
    { id: "Ig", label: "Galvanic current I_g" },
    { id: "depth", label: "Al penetration depth, 24 h" },
    { id: "pH", label: "Peak surface pH" }
  ],
  // Verdict values: "not justified" | "justified" | "open" | null (pending)
  verdicts: {
    v1: {
      Ig:    { verdict: "not justified", note: "v1 (2D toy, Sobol N = 48): S1 of j₀ ≤ 0.06; controlled by δ and Cu feature size" },
      depth: { verdict: "not justified", note: "v1 (2D toy, Sobol N = 48): S1 of j₀ ≤ 0.06" },
      pH:    { verdict: "open", note: "v1: S1 j₀ = 0.20 ± 0.18, S1 α_c = 0.27 ± 0.34; uncertainty larger than the value" }
    },
    L0: { Ig: null, depth: null, pH: null },
    L1: { Ig: null, depth: null, pH: null },
    L2: { Ig: null, depth: null, pH: null },
    changes_with_fidelity: { Ig: null, depth: null, pH: null }
  },
  recommendation: null,      // final recommendation on transition-state calculations (S05/S06)

  /* ------------------------------------------------------------------ plots (empty until the run fills them) */
  plots: {
    s01_evidence: {
      stage: "S01", type: "bar", title: "Candidate studies by experimental data type",
      x: { label: "Experimental data in the study" }, y: { label: "Studies", min: 0 },
      categories: ["Galvanic current", "pH map", "SVET", "SECM", "Polarisation"],
      expect: ["Cu/Al", "Analogous galvanic/ORR"], series: []
    },
    s02_j0: {
      stage: "S02", type: "interval", title: "j₀ range per Cu facet",
      x: { label: "log₁₀ j₀ / A cm⁻² (ORR, alkaline)" },
      categories: ["Cu(111)", "Cu(100)", "Cu(110)", "Facet mixture"],
      expect: ["Literature", "Scaling relations", "Sampled range"], series: []
    },
    s02_alpha: {
      stage: "S02", type: "interval", title: "α_c range per Cu facet",
      x: { label: "Cathodic charge-transfer coefficient α_c", min: 0, max: 1 },
      categories: ["Cu(111)", "Cu(100)", "Cu(110)", "Facet mixture"],
      expect: ["From RDS estimate", "Sampled range"], series: []
    },
    s02_coupling: {
      stage: "S02", type: "scatter", title: "Coupled j₀–α_c samples",
      subtitle: "Shared energetics: ΔG(OH*), surface terms, solvation",
      x: { label: "log₁₀ j₀ / A cm⁻²" }, y: { label: "α_c", min: 0, max: 1 },
      expect: ["Cu(111)", "Cu(100)", "Cu(110)"], series: []
    },
    s03_validation: {
      stage: "S03", type: "line", title: "Reproduction against experiment",
      subtitle: "Axes follow the observable of the chosen study",
      x: { label: "Position or time (set by the target study)" }, y: { label: "Observable (set by the target study)" },
      expect: ["Experiment", "Our model", "Registered tolerance"], series: []
    },
    s04_morris: {
      stage: "S04", type: "scatter", title: "Morris screening per rung", labels: true,
      x: { label: "μ* (mean absolute elementary effect)", min: 0 }, y: { label: "σ (interaction / non-linearity)", min: 0 },
      filters: [ { key: "rung", label: "Rung", options: ["L0", "L1", "L2"], default: "L2" },
                 { key: "qoi", label: "QoI", options: ["Ig", "depth", "pH"], names: { Ig: "Galvanic current", depth: "Al depth", pH: "Peak pH" } } ],
      expect: ["Parameters"], series: []
    },
    s05_sobol: {
      stage: "S05", type: "bar", title: "Sobol indices per parameter",
      x: { label: "Parameter" }, y: { label: "Sobol index", min: 0, max: 1 },
      threshold: { y: 0.2, label: "X = 0.2" },
      filters: [ { key: "rung", label: "Rung", options: ["L0", "L1", "L2"], default: "L2" },
                 { key: "qoi", label: "QoI", options: ["Ig", "depth", "pH"], names: { Ig: "Galvanic current", depth: "Al depth", pH: "Peak pH" }, default: "pH" } ],
      expect: ["S1 (first order)", "ST (total)"], series: []
    },
    s05_rungs: {
      stage: "S05", type: "line", title: "Does the QoI change with FEM fidelity?",
      x: { label: "FEM rung", categories: ["L0", "L1", "L2"] },
      y: { label: "QoI", labelBy: { key: "qoi", map: { Ig: "Galvanic current I_g", depth: "Al penetration depth at 24 h", pH: "Peak surface pH" } } },
      filters: [ { key: "qoi", label: "QoI", options: ["Ig", "depth", "pH"], names: { Ig: "Galvanic current", depth: "Al depth", pH: "Peak pH" }, default: "pH" } ],
      expect: ["Median with 90 % interval", "Literature j₀, α = 0.5"], series: []
    },
    s05b_fed: {
      stage: "S05b", type: "step", title: "4e⁻ ORR free-energy diagram",
      subtitle: "Fixed-charge DFT; only if S05 triggers the DFT rule",
      x: { label: "Reaction coordinate", categories: ["O₂ + *", "O₂*", "OOH*", "O*", "OH*", "H₂O + *"] },
      y: { label: "ΔG / eV (U vs RHE stated in legend)" },
      expect: ["Cu(111)", "Cu(100)", "Cu(110)"], series: []
    }
  },

  /* ------------------------------------------------------------------ interventions (infrastructure vs scientific steering) */
  interventions: [],   // { date, stage, kind: "infrastructure" | "steering", text }

  /* ------------------------------------------------------------------ log */
  events: [
    { date: "2026-10-20", kind: "milestone", text: "exp_v1 complete: 7/7 stages, 79.1 min active of 285 min timeboxed." },
    { date: "2026-10-26", kind: "meeting", text: "Weekly sync: v2 needs human validation gates; pipeline first, demonstrator later." },
    { date: "2026-10-30", kind: "meeting", text: "Technical review of the v1 report: couple j₀ and α_c, potentials vs RHE, upgrade the pH model." },
    { date: "2026-11-16", kind: "meeting", text: "Weekly sync: reviewers ask for a validated FEM ladder before any DFT; reviewer dashboard agreed." },
    { date: "2026-11-16", kind: "decision", text: "DFT only where it can change the answer (S05b, after S05). Stages redesigned around the FEM ladder." },
    { date: "2026-11-16", kind: "stage", text: "S00 setup done (venv, PySCF)." },
    { date: "2026-11-16", kind: "milestone", text: "Run scope sent to the reviewers." },
    { date: "2026-11-17", kind: "gate", text: "Scope review by the reviewers due.", planned: true },
    { date: "2026-11-17", kind: "milestone", text: "Launch, evening, after review feedback.", planned: true },
    { date: "2026-11-19", kind: "milestone", text: "First partial results to the QC reviewer.", planned: true },
    { date: "2026-11-20", kind: "note", text: "Gate B cover for 20–30 Nov to be decided (scope Q8).", planned: true }
  ],

  /* ------------------------------------------------------------------ source documents (paths relative to MAESTRO_docs; see meta.links_base) */
  links: [
    { title: "Run scope (styled)", path: "decisions/exp_v2/2026_11_16_exp_v2_run_scope.html", note: "The scope for review, with the questions for the reviewers." },
    { title: "Run scope (Markdown)", path: "decisions/exp_v2/2026_11_16_exp_v2_run_scope.md", note: "Source text of the stage plan and the DFT rule." },
    { title: "Handoff synthesis", path: "decisions/exp_v2/2026_11_16_exp_v2_handoff_synthesis.md", note: "What v1 proved, the meetings, changes C1–C7 and M1–M18." },
    { title: "exp_v1 outcome", path: "decisions/exp_v1/2026_10_20_exp_v1_outcome.md", note: "The v1 verdict this run tests." },
    { title: "exp_v1 paper (PDF)", path: "papers/exp_v1/paper.pdf", note: "Internal draft of the v1 report." },
    { title: "exp_v2 plan deck", path: "presentations/ArmA_exp_v2_plan.pptx", note: "Slide 7: gate plan; slide 5: modelling notes." }
  ]
};
