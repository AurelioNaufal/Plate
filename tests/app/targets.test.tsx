// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Targets } from "../../src/app/screens/Targets";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

let save: ReturnType<typeof vi.fn>;
beforeEach(() => {
  save = vi.fn(async () => {});
  data.current = { rows: { Settings: [] }, save };
});

test("shows the default protein target and a blank calorie target", () => {
  render(<Targets onBack={() => {}} />);
  expect(screen.getByLabelText("Protein (g/day)")).toHaveValue("120");
  expect(screen.getByLabelText("Calories (kcal/day, optional)")).toHaveValue("");
});

test("saving writes both Settings rows", async () => {
  const onBack = vi.fn();
  render(<Targets onBack={onBack} />);
  const protein = screen.getByLabelText("Protein (g/day)");
  await userEvent.clear(protein);
  await userEvent.type(protein, "130");
  await userEvent.type(screen.getByLabelText("Calories (kcal/day, optional)"), "2,200");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith("Settings", { ID: "proteinTarget", Value: "130" });
  expect(save).toHaveBeenCalledWith("Settings", { ID: "kcalTarget", Value: "2200" });
  expect(onBack).toHaveBeenCalled();
});

test("protein is required and must be a number", async () => {
  render(<Targets onBack={() => {}} />);
  const protein = screen.getByLabelText("Protein (g/day)");
  await userEvent.clear(protein);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByText("Enter a protein target")).toBeInTheDocument();
  await userEvent.type(protein, "lots");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByText("Use a number")).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

test("clearing the calorie target saves it blank", async () => {
  data.current = { rows: { Settings: [{ ID: "kcalTarget", Value: "2200" }] }, save };
  render(<Targets onBack={() => {}} />);
  await userEvent.clear(screen.getByLabelText("Calories (kcal/day, optional)"));
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith("Settings", { ID: "kcalTarget", Value: null });
});

describe("estimate and suggestions", () => {
  const profile = [{ ID: "heightCm", Value: "170" }, { ID: "age", Value: "22" }, { ID: "sex", Value: "male" }];
  const weights = (kg: number) => [{ ID: "b1", Date: "2026-11-20", WeightKg: kg }, { ID: "b2", Date: "2026-11-21", WeightKg: kg }];
  let apply: ReturnType<typeof vi.fn>;
  const setRows = (settings: object[], kg: number | null) => {
    apply = vi.fn(async () => {});
    data.current = { rows: { Settings: settings, Body: kg === null ? [] : weights(kg) }, save, apply };
  };

  test("shows the maintenance estimate and fills it in on request, without saving", async () => {
    setRows([...profile, { ID: "kcalTarget", Value: "2000" }, { ID: "targetSuggestionDismissed", Value: "120|2400" }], 60);
    render(<Targets onBack={() => {}} />);
    expect(screen.getByText("Estimated maintenance: 2,400 kcal")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use estimate" }));
    expect(screen.getByLabelText("Calories (kcal/day, optional)")).toHaveValue("2400");
    expect(save).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  test("without a profile it says what's missing", () => {
    setRows([], 60);
    render(<Targets onBack={() => {}} />);
    expect(screen.getByText("Add height, age and sex in Profile for an estimate")).toBeInTheDocument();
    setRows(profile, null);
    render(<Targets onBack={() => {}} />);
    expect(screen.getByText("Log your weight on the Body tab for an estimate")).toBeInTheDocument();
  });

  test("a suggestion is applied only when Update is tapped", async () => {
    setRows([...profile, { ID: "kcalTarget", Value: "2400" }], 63);
    render(<Targets onBack={() => {}} />);
    expect(screen.getByText("Your weight trend is 63.0 kg. Suggested: 125 g protein, 2,450 kcal.")).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(apply).toHaveBeenCalledWith([
      { tab: "Settings", row: { ID: "proteinTarget", Value: "125" } },
      { tab: "Settings", row: { ID: "kcalTarget", Value: "2450" } },
    ]);
    expect(screen.getByLabelText("Protein (g/day)")).toHaveValue("125");
  });

  test("Not now remembers this exact suggestion", async () => {
    setRows([...profile, { ID: "kcalTarget", Value: "2400" }], 63);
    render(<Targets onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(save).toHaveBeenCalledWith("Settings", { ID: "targetSuggestionDismissed", Value: "125|2450" });
  });
});
