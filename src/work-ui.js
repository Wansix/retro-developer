import { lightsAfter } from "./work-missions.js";

function node(tag, text, className = "") {
  const element = document.createElement(tag);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function button(text, handler) {
  const element = node("button", text, "act-btn");
  element.type = "button";
  element.addEventListener("click", handler);
  return element;
}

function placeGrid(className, size, build) {
  const grid = node("div", null, className);
  grid.append(...Array.from({ length: size }, (_, index) => build(index)));
  return grid;
}

export function buildWorkBoard(container, work, saved, { save, mistake }) {
  container.replaceChildren();
  const answer = saved?.id === work.id ? saved.answer : undefined;
  const store = value => save({ id: work.id, answer: value });

  switch (work.type) {
    case "quiz":
    case "review": {
      let selected = answer ?? null;
      const choices = work.choices.map((choice, index) => {
        const control = button("", () => {
          selected = index;
          store(selected);
          choices.forEach((option, position) => option.setAttribute("aria-pressed", String(position === index)));
        });
        control.append(work.type === "review" ? node("code", `${index + 1}  ${choice}`) : document.createTextNode(choice));
        control.setAttribute("aria-pressed", String(index === selected));
        return control;
      });
      container.append(...choices);
      return () => selected;
    }
    case "sudoku": {
      const numbers = answer ? [...answer] : [...work.clues];
      const board = placeGrid("puzzle-grid sudoku-grid", 16, index => {
        const clue = work.clues[index];
        const label = `${Math.floor(index / 4) + 1}행 ${index % 4 + 1}열`;
        if (clue) {
          const fixed = node("span", clue, "sudoku-clue");
          fixed.setAttribute("aria-label", `${label}, 주어진 값 ${clue}`);
          return fixed;
        }
        const cell = node("select");
        cell.setAttribute("aria-label", label);
        cell.append(...[0, 1, 2, 3, 4].map(value => new Option(value || "—", value)));
        cell.value = numbers[index];
        cell.addEventListener("change", () => {
          numbers[index] = Number(cell.value);
          store([...numbers]);
        });
        return cell;
      });
      container.append(board);
      return () => numbers.includes(0) ? null : numbers;
    }
    case "lights": {
      let presses = answer ?? 0;
      const status = node("p", "", "puzzle-state");
      status.setAttribute("role", "status");
      const board = placeGrid("puzzle-grid lights-grid", 9, index => button("", () => {
        presses ^= 1 << index;
        store(presses);
        paint();
      }));
      function paint() {
        const mask = lightsAfter(work.mask, presses);
        let faults = 0;
        Array.from(board.children).forEach((cell, index) => {
          const faulty = Boolean(mask & 1 << index);
          if (faulty) faults++;
          cell.classList.toggle("fault", faulty);
          cell.textContent = faulty ? "장애" : "정상";
          cell.setAttribute("aria-label", `서버 ${index + 1}, ${cell.textContent}`);
        });
        status.textContent = faults ? `장애 서버 ${faults}대` : "모든 서버 정상";
      }
      paint();
      container.append(board, status);
      return () => presses;
    }
    case "memory": {
      const matched = answer ? [...answer] : [];
      let opened = [];
      const status = node("p", "", "puzzle-state");
      status.setAttribute("role", "status");
      const board = placeGrid("puzzle-grid memory-grid", 6, index => button("", () => flip(index)));
      function flip(index) {
        if (opened.length === 2 || matched.includes(index) || opened.includes(index)) return;
        opened.push(index);
        paint();
        if (opened.length < 2) return;
        const [first, second] = opened;
        if (work.deck[first] === work.deck[second]) {
          matched.push(first, second);
          opened = [];
          store([...matched]);
          paint();
        } else {
          mistake([first, second]);
          setTimeout(() => { opened = []; paint(); }, 650);
        }
      }
      function paint() {
        Array.from(board.children).forEach((cell, index) => {
          const locked = matched.includes(index);
          const visible = locked || opened.includes(index);
          cell.classList.toggle("matched", locked);
          cell.textContent = visible ? work.deck[index] : "?";
          cell.setAttribute("aria-disabled", String(locked || opened.length === 2 || opened.includes(index)));
          cell.setAttribute("aria-label", `카드 ${index + 1}, ${visible ? work.deck[index] : "뒷면"}${locked ? ", 짝 확인됨" : ""}`);
        });
        status.textContent = `확인된 모듈 ${matched.length / 2}/3`;
      }
      paint();
      container.append(board, status);
      return () => matched.length === 6 ? matched : null;
    }
    case "qa": {
      const selected = new Set(answer ?? []);
      const panels = node("div", null, "qa-panels");
      const rowsPerPage = 2;
      let currentPage = 0;
      const headings = node("div", null, "qa-row qa-headings");
      headings.append(node("span", "항목"), node("strong", "기준 화면"), node("strong", "검수 화면"));
      const pages = Array.from({ length: Math.ceil(work.fields.length / rowsPerPage) }, () => node("div", null, "qa-page"));
      work.fields.forEach(([label, original, altered], index) => {
        const row = node("div", null, "qa-row");
        const value = work.differences.includes(index) ? altered : original;
        const cell = button(value, () => {
          if (selected.has(index)) selected.delete(index);
          else if (selected.size < 2) selected.add(index);
          cell.setAttribute("aria-pressed", String(selected.has(index)));
          store([...selected]);
        });
        cell.setAttribute("aria-label", `${label} · ${value}`);
        cell.setAttribute("aria-pressed", String(selected.has(index)));
        row.append(node("span", label), node("span", original), cell);
        pages[Math.floor(index / rowsPerPage)].append(row);
      });
      const pagination = node("div", null, "qa-pagination");
      const status = node("span");
      status.setAttribute("role", "status");
      const previous = button("이전 항목", () => movePage(currentPage - 1));
      const next = button("다음 항목", () => movePage(currentPage + 1));
      function movePage(page) {
        currentPage = page;
        pages.forEach((group, index) => { group.dataset.active = String(index === page); });
        status.textContent = `${page + 1} / ${pages.length}`;
        previous.disabled = page === 0;
        next.disabled = page === pages.length - 1;
        if (document.activeElement === previous && previous.disabled) next.focus({ preventScroll: true });
        if (document.activeElement === next && next.disabled) previous.focus({ preventScroll: true });
      }
      movePage(0);
      pagination.append(previous, status, next);
      panels.append(headings, ...pages, pagination);
      container.append(panels);
      return () => selected.size === 2 ? [...selected] : null;
    }
    case "design": {
      let position = answer ?? 0;
      const grid = placeGrid("puzzle-grid design-grid", 12, index => button("", () => place(index)));
      const arrows = node("div", null, "design-arrows");
      const directions = { ArrowLeft: [-1, 0, "← 왼쪽"], ArrowRight: [1, 0, "→ 오른쪽"], ArrowUp: [0, -1, "↑ 위"], ArrowDown: [0, 1, "↓ 아래"] };
      function place(index) {
        position = index;
        store(position);
        paint();
      }
      function shift([dx, dy]) {
        const col = position % 4 + dx;
        const row = Math.floor(position / 4) + dy;
        if (col >= 0 && col < 4 && row >= 0 && row < 3) place(row * 4 + col);
      }
      function paint() {
        Array.from(grid.children).forEach((cell, index) => {
          const target = index === work.target;
          cell.classList.toggle("design-target", target);
          cell.textContent = position === index ? "결제" : target ? "목표" : "";
          cell.setAttribute("aria-label", `${Math.floor(index / 4) + 1}행 ${index % 4 + 1}열${target ? ", 목표" : ""}${position === index ? ", 결제 버튼" : ""}`);
        });
      }
      const workspace = node("div");
      workspace.addEventListener("keydown", event => {
        const direction = directions[event.key];
        if (!direction) return;
        event.preventDefault();
        shift(direction);
      });
      Object.values(directions).forEach(direction => arrows.append(button(direction[2], () => shift(direction))));
      paint();
      workspace.append(grid, arrows);
      container.append(workspace);
      return () => position;
    }
  }
}
