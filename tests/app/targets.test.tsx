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
