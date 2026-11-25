import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import App from "@/App.vue";
import { routes } from "@/router/routes";

async function mountAt(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [createPinia(), router] } });
  await flushPromises(); // let lazy-loaded pages resolve
  return { wrapper, router };
}

describe("routes", () => {
  it.each([
    ["/", "Dashboard"],
    ["/compare", "Compare companies"],
    ["/research", "Research"],
    ["/upload", "Upload a report"],
  ])("%s shows the %s page", async (path, heading) => {
    const { wrapper } = await mountAt(path);
    expect(wrapper.get("h1").text()).toBe(heading);
  });

  it("shows a not-found page for unknown paths", async () => {
    const { wrapper } = await mountAt("/nope/deeper");
    expect(wrapper.get("h1").text()).toBe("Page not found");
  });

  it("navigates with the main nav and marks the current page", async () => {
    const { wrapper, router } = await mountAt("/");
    const link = (label: string) => wrapper.findAll("nav a").find((a) => a.text() === label)!;
    expect(link("Dashboard").classes()).toContain("active");

    await link("Research").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("research");
    expect(link("Research").classes()).toContain("active");
    expect(link("Dashboard").classes()).not.toContain("active");
  });
});
