import { NavLink, Outlet } from "react-router";
import { NAV_ITEMS } from "../routes";

export function AppLayout() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">FinanceAI</span>
        <nav aria-label="Main">
          <ul className="nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <NavLink to={item.path} end={item.path === "/"}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
