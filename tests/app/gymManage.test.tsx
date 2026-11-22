// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Exercises } from "../../src/app/screens/Exercises";
import { Routines } from "../../src/app/screens/Routines";
import type { Row } from "../../src/shared/schema";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

const exercises: Row[] = [
  { ID: "bench", Name: "Bench press", MuscleGroup: "Chest", SortOrder: 2 },
  { ID: "lat", Name: "Lat pulldown", MuscleGroup: "Back", SortOrder: 1 },
  { ID: "pec", Name: "Pec deck (chest)", MuscleGroup: "Chest", SortOrder: 3 },
  { ID: "tricep", Name: "Tricep", MuscleGroup: "Arms", SortOrder: 4 },
  { ID: "curl", Name: "Bicep curl", MuscleGroup: "Arms", SortOrder: 5 },
];
const push: Row = { ID: "push", Name: "Push", Weekdays: "1,4", ExerciseIDs: "bench,pec,tricep" };
const pull: Row = { ID: "pull", Name: "Pull", Weekdays: "2,5", ExerciseIDs: "lat,curl" };

let save: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;
let apply: ReturnType<typeof vi.fn>;
beforeEach(() => {
  save = vi.fn(async () => {});
  remove = vi.fn(async () => {});
  apply = vi.fn(async () => {});
  data.current = { rows: { Exercises: exercises, Routines: [push, pull], Settings: [] }, save, remove, apply };
});

describe("Exercises", () => {
  test("lists exercises in order with their muscle group", () => {
    render(<Exercises onBack={() => {}} />);
    const rows = within(screen.getByRole("list", { name: "Exercises" })).getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Lat pulldown");
    expect(rows[0]).toHaveTextContent("Back");
  });

  test("adding one puts it at the end; a name that exists (any case) is refused", async () => {
    render(<Exercises onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add exercise" }));
    await userEvent.type(screen.getByLabelText("Name"), "Leg press");
    await userEvent.selectOptions(screen.getByLabelText("Muscle group"), "Legs");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith("Exercises", { Name: "Leg press", MuscleGroup: "Legs", SortOrder: 6 });

    await userEvent.click(screen.getByRole("button", { name: "Add exercise" }));
    await userEvent.type(screen.getByLabelText("Name"), "bench PRESS");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Already exists")).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(1);
  });

  test("deleting one also takes it out of its routines; history stays", async () => {
    render(<Exercises onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Bench press/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/Past sets stay in your history\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(apply).toHaveBeenCalledWith([
      { tab: "Exercises", removeId: "bench" },
      { tab: "Routines", row: { ...push, ExerciseIDs: "pec,tricep" } },
    ]);
  });

  test("rest time is saved as a whole number of seconds between 15 and 600", async () => {
    render(<Exercises onBack={() => {}} />);
    const rest = screen.getByLabelText("Rest timer (seconds)");
    expect(rest).toHaveValue("90");
    await userEvent.clear(rest);
    await userEvent.type(rest, "10");
    await userEvent.click(screen.getByRole("button", { name: "Save rest time" }));
    expect(screen.getByText("Use 15 to 600 seconds")).toBeInTheDocument();
    await userEvent.clear(rest);
    await userEvent.type(rest, "120");
    await userEvent.click(screen.getByRole("button", { name: "Save rest time" }));
    expect(save).toHaveBeenCalledWith("Settings", { ID: "restSeconds", Value: "120" });
  });
});

describe("Routines", () => {
  test("lists routines with their days", () => {
    render(<Routines onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /Push/ })).toHaveTextContent("Mon, Thu · 3 exercises");
  });

  test("editing days and order saves the routine", async () => {
    render(<Routines onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Push/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sat" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Tricep up" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith("Routines", { ...push, Weekdays: "1,4,6", ExerciseIDs: "bench,tricep,pec" });
  });

  test("exercises can be added and removed", async () => {
    render(<Routines onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Pull/ }));
    await userEvent.click(screen.getByRole("button", { name: "Remove Bicep curl" }));
    await userEvent.selectOptions(screen.getByLabelText("Add exercise"), "tricep");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith("Routines", expect.objectContaining({ ID: "pull", ExerciseIDs: "lat,tricep" }));
  });

  test("a new routine needs a name", async () => {
    render(<Routines onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add routine" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Enter a name")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Name"), "Legs");
    await userEvent.click(screen.getByRole("button", { name: "Wed" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith("Routines", { Name: "Legs", Weekdays: "3", ExerciseIDs: "" });
  });

  test("deleting a routine asks first", async () => {
    render(<Routines onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Pull/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(remove).toHaveBeenCalledWith("Routines", "pull");
  });
});
