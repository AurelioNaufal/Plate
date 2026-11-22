// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Export } from "../../src/app/screens/Export";
import { Money } from "../../src/app/screens/Money";
import { realWeek } from "../fixtures/week";

const share = vi.hoisted(() => ({ fn: vi.fn(async (_files: { name: string; text: string }[]) => {}) }));
vi.mock("../../src/app/download", () => ({ shareOrDownload: share.fn }));
vi.mock("../../src/app/store", () => ({
  useData: () => ({
    rows: {
      Transactions: realWeek,
      Body: [{ ID: "b1", Date: "2026-11-10", WeightKg: 60.2 }, { ID: "b0", Date: "2026-10-02", WeightKg: 61 }],
      Meals: [], Recurring: [], SavedFoods: [], Workouts: [], Categories: [],
    },
    pending: [],
  }),
}));

beforeEach(() => share.fn.mockClear());

test("one file per checked type, for the chosen range", async () => {
  render(<Export today="2026-11-22" onBack={() => {}} />);
  await userEvent.click(screen.getByLabelText("Transactions"));
  await userEvent.click(screen.getByLabelText("Body"));
  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(share.fn).toHaveBeenCalledTimes(1);
  const files = share.fn.mock.calls[0][0] as { name: string; text: string }[];
  expect(files.map((f) => f.name)).toEqual(["plate-transactions-2026-11.csv", "plate-body-2026-11.csv"]);
  expect(files[1].text.split("\r\n").filter(Boolean)).toHaveLength(2); // header + the November weigh-in
});

test("all time and a picked month change the range", async () => {
  render(<Export today="2026-11-22" onBack={() => {}} />);
  await userEvent.click(screen.getByLabelText("Body"));
  await userEvent.click(screen.getByLabelText("All time"));
  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  expect((share.fn.mock.calls[0][0] as { name: string }[])[0].name).toBe("plate-body-all.csv");

  await userEvent.click(screen.getByLabelText("Pick a month"));
  await userEvent.clear(screen.getByLabelText("Month"));
  await userEvent.type(screen.getByLabelText("Month"), "2026-10");
  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  expect((share.fn.mock.calls[1][0] as { name: string }[])[0].name).toBe("plate-body-2026-10.csv");
});

test("nothing checked asks for one", async () => {
  render(<Export today="2026-11-22" onBack={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(screen.getByText("Pick at least one")).toBeInTheDocument();
  expect(share.fn).not.toHaveBeenCalled();
  expect(screen.getByText(/Full backup: open your Plate Sheet → File → Download → Microsoft Excel \(\.xlsx\)\./)).toBeInTheDocument();
});

test("Money's Export sends the entries on screen, named after the period", async () => {
  render(<Money today="2026-11-12" onOpen={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  const files = share.fn.mock.calls[0][0] as { name: string; text: string }[];
  expect(files.map((f) => f.name)).toEqual(["plate-transactions-2026-11-08_2026-11-14.csv"]);
  expect(files[0].text.split("\r\n").filter(Boolean)).toHaveLength(1 + 18);
});
