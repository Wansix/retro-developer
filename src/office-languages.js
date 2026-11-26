import { seedValue } from "./seeded.js";

export const LANGUAGES = {
  python: { name: "Python", file: "main.py", assignment: "전표 정리랑 업무 자동화를 맡아." },
  javascript: { name: "JavaScript", file: "main.js", assignment: "쇼핑몰 화면과 기능을 맡아." },
  cpp: { name: "C++", file: "main.cpp", assignment: "사내 프로그램을 고치고 쇼핑몰 연동을 맡아." },
};

export function assignedLanguage(seed, familiar) {
  const available = Object.keys(LANGUAGES).filter(language => language !== familiar);
  return available[seedValue(seed, 861) % available.length];
}
