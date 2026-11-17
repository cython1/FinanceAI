import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createQueryClient } from "./lib/queryClient";
import { routes } from "./routes";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("routes", () => {
  it.each([
    ["/", "Dashboard"],
    ["/compare", "Compare companies"],
    ["/research", "Research"],
    ["/upload", "Upload a report"],
  ])("%s shows the %s page", (path, heading) => {
    renderAt(path);
    expect(
      screen.getByRole("heading", { level: 1, name: heading }),
    ).toBeInTheDocument();
  });

  it("shows a not-found page for unknown paths", () => {
    renderAt("/nope");
    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
  });

  it("navigates with the main nav and marks the current page", async () => {
    const router = renderAt("/");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveClass(
      "active",
    );

    await userEvent.click(screen.getByRole("link", { name: "Research" }));
    expect(router.state.location.pathname).toBe("/research");
    expect(screen.getByRole("link", { name: "Research" })).toHaveClass(
      "active",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveClass(
      "active",
    );
    expect(nav).toBeInTheDocument();
  });
});
