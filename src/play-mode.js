export const MODE_RULESET = 13;
export const PLAY_MODES = {
  assembly: "코드 조립 모드",
  real_coding: "리얼 코딩 모드",
};
export const isPlayMode = mode => Object.hasOwn(PLAY_MODES, mode);
export const playMode = state => state?.ruleset >= MODE_RULESET && state.mode === "assembly" ? "assembly" : "real_coding";

// The two modes initially use the same allowance. Each can be tuned independently.
export const MODE_TIMER_MULTIPLIER = { assembly: 1, real_coding: 1 };
