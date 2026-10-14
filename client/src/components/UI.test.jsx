// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { Button, Field, Empty, RequestCard } from "./UI";
afterEach(cleanup);
describe("Accessible task controls", () => {
  it("renders navigation as a real link", () => {
    render(
      <MemoryRouter>
        <Button to="/register/donor">Become a donor</Button>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: "Become a donor" }),
    ).toHaveAttribute("href", "/register/donor");
  });
  it("associates a form label and exposes validation feedback", () => {
    render(
      <Field label="Your email" error={{ message: "Enter a valid email." }}>
        <input type="email" />
      </Field>,
    );
    expect(screen.getByLabelText(/Your email/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email.");
  });
  it("offers clear guidance when no records exist", () => {
    render(<Empty title="No active requirements.">Try another city.</Empty>);
    expect(screen.getByRole("heading")).toHaveTextContent(
      "No active requirements.",
    );
    expect(screen.getByText("Try another city.")).toBeVisible();
  });
  it("opens the exact reviewed requirement through its action", () => {
    const request = {
      _id: "abc",
      bloodGroup: "O-",
      urgency: "critical",
      unitsRequired: 2,
      demo: true,
      updatedAt: new Date().toISOString(),
      hospitalId: { name: "Demo Hospital", city: "Pune" },
    };
    let selected;
    render(<RequestCard request={request} onDetails={(r) => (selected = r)} />);
    expect(screen.getByText("DEMO REQUIREMENT")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "See how you can help" }),
    );
    expect(selected).toBe(request);
  });
});
