import {
  currentDraft,
  writeDraft,
  syncDraft,
  forgetDraft,
  clearDrafts,
} from './performance-store.js';
const notice = document.getElementById('notice');
const root = document.getElementById('workout');
let row;
let busy = false;
const el = (tag, text) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
};
async function save(draft) {
  if (busy) return;
  busy = true;
  try {
    row = await writeDraft(row.owner, draft, row.revision);
    notice.textContent = 'Saved on this device. Sync when connected.';
    render();
  } catch (e) {
    notice.textContent = e.message;
  } finally {
    busy = false;
  }
}
function render() {
  root.replaceChildren();
  if (!row) {
    notice.textContent =
      'No workout is saved on this device. Start one in Performance while connected.';
    document.getElementById('sync').disabled = true;
    return;
  }
  root.append(el('h2', row.draft.title));
  root.append(
    el(
      'p',
      `${row.draft.sets.filter((s) => s.done).length} of ${row.draft.sets.length} sets recorded · ${row.draft.unit}`,
    ),
  );
  if (row.draft.status !== 'active') {
    root.append(el('p', row.draft.status === 'complete' ? 'Workout finished.' : 'Workout ended.'));
    return;
  }
  row.draft.sets.forEach((set, index) => {
    const box = el('section');
    box.className = 'set';
    box.dataset.done = String(set.done);
    box.append(el('h3', `${index + 1}. ${set.exercise}`));
    const fields = el('div');
    fields.className = 'fields';
    const inputs = {};
    for (const [key, title, max] of [
      ['reps', 'Reps', 100],
      ['load', row.draft.unit, 1500],
      ['effort', 'Effort / 10', 10],
    ]) {
      const label = el('label', title);
      const input = el('input');
      input.type = 'number';
      input.min = key === 'effort' ? '1' : '0';
      input.max = String(max);
      input.step = key === 'load' ? '0.5' : '1';
      input.value = set[key] ?? '';
      input.disabled = set.done;
      label.append(input);
      fields.append(label);
      inputs[key] = input;
    }
    box.append(fields);
    const button = el('button', set.done ? 'Undo set' : 'Record set');
    button.onclick = () => {
      const reps = Number(inputs.reps.value);
      const load = Number(inputs.load.value);
      const effort = inputs.effort.value === '' ? null : Number(inputs.effort.value);
      if (
        !set.done &&
        (!inputs.reps.value ||
          !inputs.load.value ||
          !Number.isInteger(reps) ||
          reps < 1 ||
          reps > 100 ||
          load < 0 ||
          load > 1500 ||
          (effort !== null && (!Number.isInteger(effort) || effort < 1 || effort > 10)))
      ) {
        notice.textContent = 'Enter valid reps, load and optional effort.';
        return;
      }
      void save({
        ...row.draft,
        sets: row.draft.sets.map((s) =>
          s.id === set.id ? { ...s, reps, load, effort, done: !set.done } : s,
        ),
      });
    };
    box.append(button);
    root.append(box);
  });
  const painLabel = el('label');
  const pain = el('input');
  pain.type = 'checkbox';
  pain.checked = row.draft.pain;
  pain.onchange = () => void save({ ...row.draft, pain: pain.checked });
  painLabel.append(pain, document.createTextNode(' I noticed pain or discomfort'));
  root.append(painLabel);
  const finish = el('button', 'Finish workout');
  finish.style.marginTop = '24px';
  finish.disabled = !row.draft.sets.some((s) => s.done);
  finish.onclick = () =>
    void save({ ...row.draft, status: 'complete', endedAt: new Date().toISOString() });
  root.append(finish);
}
document.getElementById('sync').onclick = async () => {
  if (!row || busy) return;
  busy = true;
  try {
    row = await syncDraft(row.owner);
    notice.textContent = 'Workout synced to your account.';
    render();
  } catch (e) {
    notice.textContent = e.message;
  } finally {
    busy = false;
  }
};
document.getElementById('forget').onclick = async () => {
  if (row && confirm('Remove this device copy? Unsynced sets will be lost.')) {
    await forgetDraft(row.owner);
    row = null;
    render();
  }
};
try {
  if (document.cookie.split('; ').includes('performance-reset=1')) {
    await clearDrafts();
    document.cookie = 'performance-reset=; Max-Age=0; Path=/; SameSite=Strict';
  }
  row = await currentDraft();
  render();
  if (row)
    notice.textContent = 'Device workout · saved locally. Your account is updated only after sync.';
} catch (e) {
  notice.textContent = e.message;
}
