import { DEPLOYMENT_WORK } from "../src/project-work.js";
import { LANGUAGES } from "../src/office-languages.js";
import { makeWork, WORK_TYPES } from "../src/work-missions.js";
import { SURVIVAL, standardTaskMinutes } from "../src/survival.js";
import { formatMinutes } from "../src/records-schema.js";
import { PROBLEM_CATALOGUE, PROBLEM_GROUPS, WORK_SCHEDULE, workdayLabel } from "./problem-catalogue.js";

const $ = id => document.getElementById(id);
const panelIds = ["dialogue", "problems"];
const difficulty = $("problem-difficulty");
const day = $("problem-day");
const language = $("problem-language");
const search = $("problem-search");
const previewSeed = 417;

function element(tag, text, css) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (css) node.className = css;
  return node;
}

function showTab() {
  const active = location.hash === "#problems" ? "problems" : "dialogue";
  for (const id of panelIds) {
    $(id + "-panel").hidden = id !== active;
    if (id === active) $(id + "-tab").setAttribute("aria-current", "page");
    else $(id + "-tab").removeAttribute("aria-current");
  }
}

function timing(slots) {
  if (!slots.length) return "현재 새 게임에서 미출제";
  return slots.map(slot =>
    workdayLabel(slot.day) + (slot.afterLunch ? " 점심 이후" : "") + (slot.fixed ? " · 고정" : " · 후보")).join(" / ");
}

function detail(entry) {
  const work = makeWork(entry.key, previewSeed, language.value);
  const card = element("details", null, "problem-card");
  const summary = element("summary");
  summary.append(element("strong", work.type === "quiz" ? work.notice : work.title), element("span", timing(entry.slots), "problem-time"));
  card.append(summary);
  const body = element("div", null, "problem-detail");
  if (work.type === "quiz") body.append(element("h4", work.title));
  const estimate = entry.slots.length ? formatMinutes(standardTaskMinutes(work)) : work.estimate;
  const basics = [WORK_TYPES[work.type], work.fundamentals ? "한 줄 문법" : null, estimate ? `기준 예상 ${estimate}` : null,
    ...(work.tags ?? [])].filter(Boolean);
  body.append(element("p", basics.join(" · "), "bank-note"));
  if (entry.key === DEPLOYMENT_WORK) body.append(element("p", entry.slots[0].label));
  if (work.brief) body.append(element("p", work.brief));
  if (work.requirement) body.append(element("p", work.requirement));
  if (work.choices) {
    const list = element("ul");
    list.append(...work.choices.map(choice => element("li", choice)));
    body.append(list);
  }
  if (work.starter) body.append(element("h4", LANGUAGES[language.value].file + " 시작 코드"), element("pre", work.starter));
  if (work.publicExamples?.length) {
    body.append(element("h4", "공개 테스트 예시"), element("pre", work.publicExamples.join("\n")));
  } else if (work.expectedOut) body.append(element("h4", "기대 출력"), element("pre", work.expectedOut));
  card.append(body);
  return card;
}

function renderProblems() {
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = PROBLEM_CATALOGUE.filter(({ key, group, work, slots }) =>
    (!difficulty.value || group === difficulty.value) &&
    (!day.value || (day.value === "unused" ? !slots.length : slots.some(slot => slot.day === Number(day.value)))) &&
    terms.every(term => [key, work.title, work.notice, ...(work.tags ?? [])].join(" ").toLowerCase().includes(term)));
  $("problem-count").textContent = `${matches.length}개 업무 · ${matches.filter(entry => entry.slots.length).length}개 현재 출제 후보`;
  const groups = [];
  for (const [group, label] of Object.entries(PROBLEM_GROUPS)) {
    const entries = matches.filter(entry => entry.group === group)
      .sort((a, b) => (a.slots[0]?.day ?? Infinity) - (b.slots[0]?.day ?? Infinity));
    if (!entries.length) continue;
    const section = element("section", null, "problem-group");
    section.append(element("h3", label), ...entries.map(detail));
    groups.push(section);
  }
  $("problem-results").replaceChildren(...(groups.length ? groups : [element("p", "조건에 맞는 문제가 없습니다.")]));
}

function buildSchedule() {
  const rows = [];
  for (let number = 1; number <= SURVIVAL.workdays; number++) {
    day.add(new Option(workdayLabel(number), String(number)));
    const row = element("li");
    const filter = element("button", workdayLabel(number));
    filter.type = "button";
    filter.onclick = () => {
      day.value = String(number);
      renderProblems();
      $("problem-results").scrollIntoView({ block: "nearest" });
    };
    const slots = WORK_SCHEDULE.filter(slot => slot.day === number);
    const label = slots.map(slot =>
      (slot.afterLunch ? "점심 이후 " : "") + slot.label + (slot.fixed ? "" : ` (${slot.keys.length}개 중 1)`)).join(" + ");
    row.append(filter, element("span", label));
    rows.push(row);
  }
  $("problem-schedule-days").replaceChildren(...rows);
  day.add(new Option("현재 새 게임에서 미출제", "unused"));
}

for (const [id, label] of Object.entries(PROBLEM_GROUPS)) difficulty.add(new Option(label, id));
for (const [id, { name }] of Object.entries(LANGUAGES)) language.add(new Option(name, id));
buildSchedule();
for (const field of [difficulty, day, language]) field.addEventListener("change", renderProblems);
search.addEventListener("input", renderProblems);
window.addEventListener("hashchange", showTab);
showTab();
renderProblems();
