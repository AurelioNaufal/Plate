// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Categories } from "../../src/app/screens/Categories";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

let save: ReturnType<typeof vi.fn>;
let renameCategory: ReturnType<typeof vi.fn>;
beforeEach(() => {
  save = vi.fn(async () => {});
  renameCategory = vi.fn(async () => ({ ok: true }));
  data.current = {
    rows: {
      Categories: [
        { ID: "c1", Name: "Food", Type: "expense", Hidden: false, SortOrder: 1 },
        { ID: "c2", Name: "Health", Type: "expense", Hidden: false, SortOrder: 2 },
        { ID: "c3", Name: "Family", Type: "income", Hidden: false, SortOrder: 1 },
      ],
    },
    save,
    renameCategory,
  };
});

test("adding a name that already exists (any case) is refused", async () => {
  render(<Categories onBack={() => {}} />);
  await userEvent.type(screen.getByLabelText("New expense category"), "food");
  await userEvent.click(screen.getByRole("button", { name: "Add expense category" }));
  expect(screen.getByText("Already exists")).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

test("adding a new category saves it at the end of its list", async () => {
  render(<Categories onBack={() => {}} />);
  await userEvent.type(screen.getByLabelText("New expense category"), "Supplements");
  await userEvent.click(screen.getByRole("button", { name: "Add expense category" }));
  expect(save).toHaveBeenCalledWith("Categories", expect.objectContaining({ Name: "Supplements", Type: "expense", Hidden: false, SortOrder: 3 }));
});

test("rename goes through renameCategory", async () => {
  render(<Categories onBack={() => {}} />);
  const food = screen.getByRole("listitem", { name: "Food" });
  await userEvent.click(within(food).getByRole("button", { name: "Rename" }));
  const input = within(food).getByLabelText("New name for Food");
  await userEvent.clear(input);
  await userEvent.type(input, "Meals");
  await userEvent.click(within(food).getByRole("button", { name: "Save name" }));
  expect(renameCategory).toHaveBeenCalledWith("c1", "Meals");
});

test("hide saves Hidden true and keeps the category", async () => {
  render(<Categories onBack={() => {}} />);
  const health = screen.getByRole("listitem", { name: "Health" });
  await userEvent.click(within(health).getByRole("button", { name: "Hide" }));
  expect(save).toHaveBeenCalledWith("Categories", expect.objectContaining({ ID: "c2", Name: "Health", Hidden: true }));
});
