// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LineChart, BarChart, PairBarChart } from "../../src/app/components/charts";

const pts = [
  { x: "2026-11-16", y: 60.4 },
  { x: "2026-11-18", y: 60.1 },
  { x: "2026-11-21", y: 59.8 },
];

test("LineChart draws a dot per point and carries its summary label", () => {
  const { container } = render(<LineChart points={pts} unit="kg" label="Weight, last 90 days" />);
  expect(screen.getByRole("img", { name: "Weight, last 90 days" })).toBeInTheDocument();
  expect(container.querySelectorAll("circle[data-point]")).toHaveLength(3);
});

test("LineChart draws the trend as one line", () => {
  const { container } = render(<LineChart points={pts} trend={pts} unit="kg" label="Weight" />);
  expect(container.querySelectorAll("polyline[data-trend]")).toHaveLength(1);
});

test("tapping a point shows its value", async () => {
  const { container } = render(<LineChart points={pts} unit="kg" label="Weight" />);
  await userEvent.click(container.querySelectorAll("[data-hit]")[1]);
  expect(screen.getByText("Nov 18 · 60.1 kg")).toBeInTheDocument();
});

test("one point draws one dot; no points says so", () => {
  const { container } = render(<LineChart points={[pts[0]]} unit="kg" label="Weight" />);
  expect(container.querySelectorAll("circle[data-point]")).toHaveLength(1);
  render(<LineChart points={[]} unit="kg" label="Empty" />);
  expect(screen.getByText("No data yet")).toBeInTheDocument();
});

test("BarChart draws one bar per value with its formatted value on tap", async () => {
  const bars = [
    { label: "Aug", value: 900 },
    { label: "Sep", value: 0 },
    { label: "Oct", value: 1500 },
    { label: "Nov", value: 1200 },
  ];
  const { container } = render(<BarChart bars={bars} label="Food by month" format={(v) => `NT$${v}`} />);
  expect(container.querySelectorAll("[data-bar]")).toHaveLength(4);
  expect(screen.getByRole("img", { name: "Food by month" })).toBeInTheDocument();
  await userEvent.click(container.querySelectorAll("[data-hit]")[2]);
  expect(screen.getByText("Oct · NT$1500")).toBeInTheDocument();
});

test("PairBarChart shows a legend with both series names", () => {
  const { container } = render(
    <PairBarChart groups={[{ label: "Oct", a: 5000, b: 4200 }, { label: "Nov", a: 5000, b: 5600 }]} aName="Income" bName="Spent" label="Income vs spent" format={(v) => `NT$${v}`} />,
  );
  expect(screen.getByText("Income")).toBeInTheDocument();
  expect(screen.getByText("Spent")).toBeInTheDocument();
  expect(container.querySelectorAll("[data-bar]")).toHaveLength(4);
});
