/* Optional map pacing and sampled diagnostics. Never calls simulation mutations. */
(() => {
  'use strict';
  const root = typeof window === 'undefined' ? globalThis : window;
  const api = root.__geoLite;
  if (!api || api.monthEnd) return;
  const VERSION = '1.2.0', KEY = 'geo.codex.monthEndFocus.v1';
  let focus = true, attached = false, lastDraw = -Infinity, awakeUntil = 0;
  let session = null, epoch, current = null, previousAt = null, detail = null, toggle = null;
  const history = [];
  const clock = () => root.performance.now();
  try { focus = root.localStorage.getItem(KEY) !== 'off'; } catch (_) {}

  function report() {
    return {
      version: VERSION, focus, sampleLimit: 20,
      measurement: 'Renderer-observed work intervals; includes worker, waiting and scheduling time. Map CPU is synchronous main-thread time, not GPU or worker time.',
      current: current ? { ...current, observedMs: clock() - current.startedAt } : null,
      completed: history.map(item => ({ ...item }))
    };
  }
  function refresh() {
    if (toggle) {
      toggle.textContent = focus ? 'On' : 'Off';
      toggle.setAttribute('aria-pressed', String(focus));
    }
    if (detail) {
      const last = history[history.length - 1];
      detail.textContent = last
        ? `Last observed calculation: ${(last.observedMs / 1000).toFixed(2)} s. Map work: ${last.mapCpuMs.toFixed(1)} ms across ${last.mapDraws} draws; ${last.focusSkips} map updates skipped. ${last.outcome}.`
        : 'No completed calculations observed in this session.';
    }
  }
  function setFocus(value) {
    focus = !!value;
    try { root.localStorage.setItem(KEY, focus ? 'on' : 'off'); } catch (_) {}
    lastDraw = -Infinity;
    refresh();
  }
  function finish(at, outcome) {
    if (!current) return;
    history.push({ ...current, observedMs: at - current.startedAt,
      endUncertaintyMs: previousAt === null ? null : at - previousAt, outcome });
    if (history.length > 20) history.shift();
    current = null;
    refresh();
  }
  function mount() {
    const doc = root.document, pane = doc?.getElementById('pane-graphics');
    if (!pane || doc.getElementById('geo-lite-month-end-control')) return;
    const row = doc.createElement('div');
    row.id = 'geo-lite-month-end-control'; row.className = 'set-row';
    const label = doc.createElement('div'); label.className = 'set-label';
    const title = doc.createElement('span'); title.className = 'set-name'; title.textContent = 'Month-end map focus';
    const desc = doc.createElement('span'); desc.className = 'set-desc';
    desc.textContent = 'Draw the idle map once a second during calculations. Moving or using the map restores faster drawing.';
    label.append(title, desc);
    const control = doc.createElement('div'); control.className = 'set-ctrl';
    toggle = doc.createElement('button'); toggle.type = 'button'; toggle.className = 'k';
    toggle.setAttribute('aria-label', 'Month-end map focus');
    toggle.addEventListener('click', () => setFocus(!focus));
    control.append(toggle); row.append(label, control); pane.append(row);
    const timing = doc.createElement('div'); timing.className = 'set-row';
    detail = doc.createElement('span'); detail.className = 'set-desc';
    timing.append(detail); pane.append(timing); refresh();
  }

  api.monthEnd = { version: VERSION, report, setFocus, get enabled() { return focus; } };
  const attach = api.attach;
  api.attach = function(options) {
    const result = attach.call(this, options);
    if (attached) return result;
    attached = true;
    const globe = options.globe, update = globe.update;
    const wake = () => { awakeUntil = clock() + 1400; };
    for (const event of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) {
      globe.container?.addEventListener(event, wake, { passive: true });
    }
    root.addEventListener?.('resize', wake);
    root.addEventListener?.('keydown', wake);
    globe.update = function(dt) {
      const at = clock(), next = options.getSession?.();
      if (next !== session || next?.sessionEpoch !== epoch) {
        // A load/new campaign is a separate observation, even if its bridge is reused.
        history.length = 0; current = null; previousAt = null; lastDraw = -Infinity;
        session = next; epoch = next?.sessionEpoch; refresh();
      }
      const work = session?.simulationWorkStatus?.();
      const busy = !!work?.active && !session?.failure && !session?.closed;
      if (busy && !current) {
        lastDraw = -Infinity;
        current = { startedAt: at, dayAtStart: session?.day ?? null,
          startUncertaintyMs: previousAt === null ? null : at - previousAt,
          mapCpuMs: 0, mapDraws: 0, focusSkips: 0 };
      }
      if (!busy && current) finish(at, session?.failure || session?.closed ? 'Session stopped' : 'Work became inactive');
      previousAt = at;
      const capture = globe._captureViewport || root.document?.body?.classList.contains('cinema-recording');
      // Pacing only this map method leaves the application's UI and worker loop running.
      if (focus && api.enabled && busy && !capture && !globe._focusAnim && at >= awakeUntil && at - lastDraw < 1000) {
        current.focusSkips++;
        return;
      }
      lastDraw = at;
      const before = current ? api.snapshot() : null, started = clock();
      try { return update.call(this, dt); }
      finally {
        if (current) {
          current.mapCpuMs += Math.max(0, clock() - started);
          current.mapDraws += Math.max(0, api.snapshot().rendered - before.rendered);
        }
      }
    };
    mount();
    return result;
  };
})();
