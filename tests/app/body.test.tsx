// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Body } from "../../src/app/screens/Body";
import { Profile } from "../../src/app/screens/Profile";
import type { Row } from "../../src/shared/schema";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

const w = (Date: string, WeightKg: number, extra: Row = {}): Row => ({ ID: `b-${Date}`, Date, WeightKg, BodyFatPct: null, WaistCm: null, ArmCm: null, ...extra });
const profile: Row[] = [{ ID: "heightCm", Value: "170" }, { ID: "age", Value: "22" }, { ID: "sex", Value: "male" }];

let save: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;
let apply: ReturnType<typeof vi.fn>;
const setRows = (body: Row[], settings: Row[] = profile) => {
  data.current = { rows: { Body: body, Settings: settings }, save, remove, apply };
};
beforeEach(() => {
  save = vi.fn(async () => {});
  remove = vi.fn(async () => {});
  apply = vi.fn(async () => {});
  setRows([w("2026-11-15", 60.4), w("2026-11-18", 60.2), w("2026-11-21", 60)]);
});

const renderBody = () => render(<Body today="2026-11-22" onOpenProfile={vi.fn()} onOpenSettings={vi.fn()} onOpenTargets={vi.fn()} />);

test("logging a weight for a new day saves a new row with blank extras", async () => {
  renderBody();
  await userEvent.type(screen.getByLabelText("Weight (kg)"), "60.2");
  await userEvent.click(screen.getByRole("button", { name: "Save weigh-in" }));
  expect(save).toHaveBeenCalledWith("Body", { Date: "2026-11-22", WeightKg: 60.2, BodyFatPct: null, WaistCm: null, ArmCm: null });
});

test("a day that already has a weigh-in is updated, not duplicated", async () => {
  setRows([w("2026-11-22", 60.5, { WaistCm: 78 })]);
  renderBody();
  const kg = screen.getByLabelText("Weight (kg)");
  expect(kg).toHaveValue("60.5");
  await userEvent.clear(kg);
  await userEvent.type(kg, "60.3");
  await userEvent.click(screen.getByRole("button", { name: "Save weigh-in" }));
  expect(save).toHaveBeenCalledWith("Body", expect.objectContaining({ ID: "b-2026-11-22", WeightKg: 60.3, WaistCm: 78 }));
});

test("the optional stats are under More", async () => {
  renderBody();
  expect(screen.queryByLabelText("Body fat (%)")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "More" }));
  await userEvent.type(screen.getByLabelText("Weight (kg)"), "60");
  await userEvent.type(screen.getByLabelText("Body fat (%)"), "15");
  await userEvent.type(screen.getByLabelText("Waist (cm)"), "79");
  await userEvent.click(screen.getByRole("button", { name: "Save weigh-in" }));
  expect(save).toHaveBeenCalledWith("Body", { Date: "2026-11-22", WeightKg: 60, BodyFatPct: 15, WaistCm: 79, ArmCm: null });
});

test("weight is required and must be sensible", async () => {
  renderBody();
  await userEvent.click(screen.getByRole("button", { name: "Save weigh-in" }));
  expect(screen.getByText("Enter your weight")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Weight (kg)"), "600");
  await userEvent.click(screen.getByRole("button", { name: "Save weigh-in" }));
  expect(screen.getByText("Check the number")).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

test("the trend card shows the smoothed weight, its 7-day change and a chart", () => {
  const { container } = renderBody();
  const trend = within(screen.getByRole("region", { name: "Weight trend" }));
  expect(trend.getByText("60.2 kg")).toBeInTheDocument();
  expect(trend.getByText("−0.2 kg in 6 days")).toBeInTheDocument();
  expect(container.querySelectorAll("circle[data-point]")).toHaveLength(3);
});

test("BMI comes from height and the latest weight", () => {
  renderBody();
  expect(screen.getByText("BMI 20.8 · Healthy")).toBeInTheDocument();
});

test("without a height it asks for one", async () => {
  setRows([w("2026-11-21", 60)], []);
  const onOpenProfile = vi.fn();
  render(<Body today="2026-11-22" onOpenProfile={onOpenProfile} onOpenSettings={vi.fn()} onOpenTargets={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Add your height in Profile" }));
  expect(onOpenProfile).toHaveBeenCalled();
});

test("history lists weigh-ins newest first and can delete one", async () => {
  renderBody();
  const items = within(screen.getByRole("region", { name: "Weigh-ins" })).getAllByRole("button");
  expect(items[0]).toHaveTextContent("Sat 21 Nov · 60 kg");
  await userEvent.click(items[0]);
  expect(screen.getByLabelText("Weight (kg)")).toHaveValue("60");
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
  expect(remove).toHaveBeenCalledWith("Body", "b-2026-11-21");
});

test("logging a weight never changes a target", async () => {
  renderBody();
  await userEvent.type(screen.getByLabelText("Weight (kg)"), "65");
  await userEvent.click(screen.getByRole("button", { name: "Save weigh-in" }));
  const calls = [...save.mock.calls, ...apply.mock.calls].flat(2) as unknown[];
  expect(JSON.stringify(calls)).not.toMatch(/proteinTarget|kcalTarget/);
});

describe("Profile", () => {
  test("saves height, age and sex together", async () => {
    setRows([], []);
    render(<Profile onBack={() => {}} />);
    await userEvent.type(screen.getByLabelText("Height (cm)"), "170");
    await userEvent.type(screen.getByLabelText("Age"), "22");
    await userEvent.selectOptions(screen.getByLabelText("Sex"), "male");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(apply).toHaveBeenCalledWith([
      { tab: "Settings", row: { ID: "heightCm", Value: "170" } },
      { tab: "Settings", row: { ID: "age", Value: "22" } },
      { tab: "Settings", row: { ID: "sex", Value: "male" } },
    ]);
  });

  test("odd numbers are refused", async () => {
    setRows([], []);
    render(<Profile onBack={() => {}} />);
    await userEvent.type(screen.getByLabelText("Height (cm)"), "17");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Use 100 to 250 cm")).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("changing the date", () => {
  test("keeps a weight you typed when that day has no weigh-in", async () => {
    setRows([w("2026-11-20", 60.4)]);
    render(<Body today="2026-11-22" onOpenProfile={() => {}} onOpenSettings={() => {}} onOpenTargets={() => {}} />);
    await userEvent.type(screen.getByLabelText("Weight (kg)"), "60.1");
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-11-21" } });
    expect(screen.getByLabelText("Weight (kg)")).toHaveValue("60.1");
  });
  test("shows that day's weigh-in when it has one, and clears it again for an empty day", () => {
    setRows([w("2026-11-20", 60.4)]);
    render(<Body today="2026-11-22" onOpenProfile={() => {}} onOpenSettings={() => {}} onOpenTargets={() => {}} />);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-11-20" } });
    expect(screen.getByLabelText("Weight (kg)")).toHaveValue("60.4");
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-11-21" } });
    expect(screen.getByLabelText("Weight (kg)")).toHaveValue("");
  });
});

test("the trend says when the last weigh-in was", () => {
  setRows([w("2026-11-18", 60.4), w("2026-11-20", 60.2)]);
  render(<Body today="2026-11-22" onOpenProfile={() => {}} onOpenSettings={() => {}} onOpenTargets={() => {}} />);
  expect(within(screen.getByRole("region", { name: "Weight trend" })).getByText("Last weigh-in Fri 20 Nov")).toBeInTheDocument();
});
