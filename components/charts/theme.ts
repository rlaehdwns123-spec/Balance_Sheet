"use client";

import { useEffect, useState } from "react";

/**
 * 차트 색. SVG 속성에는 CSS 변수를 믿고 쓸 수 없어 라이트/다크 값을 JS에서 고른다.
 * 계열색은 dataviz 기본 팔레트 슬롯 1~5 (고정 순서, 라이트/다크 각각 검증됨).
 */
const LIGHT = {
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"],
  ink: "#0b0b0b",
  inkSecondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  surface: "#ffffff",
  cursor: "rgba(11,11,11,0.05)",
};

const DARK: typeof LIGHT = {
  series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"],
  ink: "#ffffff",
  inkSecondary: "#c3c2b7",
  muted: "#898781",
  grid: "#2c2c2a",
  axis: "#383835",
  surface: "#0a0a0a",
  cursor: "rgba(255,255,255,0.06)",
};

export type ChartTheme = typeof LIGHT;

/** html.dark 클래스(ThemeToggle)를 관찰해 차트 테마를 고른다 */
export function useChartTheme(): ChartTheme {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return dark ? DARK : LIGHT;
}
