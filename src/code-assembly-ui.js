import { validAssemblyOrder } from "./code-assembly.js";

const $ = id => document.getElementById(id);

export function mountAssembly(onChange) {
  const selected = $("assembly-placed");
  const pool = $("assembly-pool");
  const reset = $("assembly-reset");
  let plan;
  let order = [];
  let disabled = false;

  function button(label, action, title) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "assembly-key";
    node.textContent = label;
    if (title) node.setAttribute("aria-label", title);
    node.disabled = disabled;
    node.onclick = action;
    return node;
  }

  function change(next, focus) {
    order = next;
    onChange([...order]);
    render();
    if (focus) document.getElementById(focus)?.focus({ preventScroll: true });
  }

  function setup(nextPlan, saved) {
    plan = nextPlan;
    order = validAssemblyOrder(plan, saved) ? [...saved] : [];
    for (const [id, text] of [["assembly-before", plan.before], ["assembly-after", plan.after]]) {
      $(id).textContent = text;
      $(id).classList.toggle("hidden", !text);
    }
    render();
  }

  function pieceButton(piece, placed, index) {
    const label = placed ? "제거" : "추가";
    const id = (placed ? "assembly-selected-" : "assembly-choice-") + piece.id;
    const node = button(piece.text, () => {
      const next = placed ? order.filter(item => item !== piece.id) : [...order, piece.id];
      change(next, (placed ? "assembly-choice-" : "assembly-selected-") + piece.id);
    }, `${label} · ${piece.text.trim()}`);
    node.id = id;
    node.classList.add("assembly-piece");
    if (!placed) return node;
    const row = document.createElement("li");
    row.append(node);
    for (const [step, title] of [[-1, "위로"], [1, "아래로"]]) {
      const target = index + step;
      const move = button(step === -1 ? "↑" : "↓", () => {
        const next = [...order];
        [next[index], next[target]] = [next[target], next[index]];
        change(next, id);
      }, `${index + 1}번 조각 ${title} 이동`);
      move.disabled ||= target < 0 || target >= order.length;
      row.append(move);
    }
    return row;
  }

  function render() {
    if (!plan) return;
    const pieces = new Map(plan.pieces.map(piece => [piece.id, piece]));
    selected.replaceChildren(...order.map((id, index) => pieceButton(pieces.get(id), true, index)));
    pool.replaceChildren(...plan.pieces.filter(piece => !order.includes(piece.id)).map(piece => pieceButton(piece, false)));
    $("assembly-empty").classList.toggle("hidden", order.length > 0);
    reset.disabled = disabled || !order.length;
  }

  reset.onclick = () => change([], pool.querySelector("button")?.id ?? ("assembly-choice-" + plan.pieces[0].id));
  return {
    setup,
    setBusy(value) {
      if (disabled === value) return;
      disabled = value;
      render();
    },
    order: () => [...order],
  };
}
