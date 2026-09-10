// Shared onboarding links for the six October 2026 sports.
// Kept in sync with src/data/sports.js — Pages Functions can't import from src/.
// Underscore prefix keeps this out of the /api route table.
export const SPORT_ONBOARDING = {
  "badminton": {
    title: "Badminton",
    whatsapp: "https://chat.whatsapp.com/LvkKAFZqC9FETVISdKyyag?s=cl&p=i&ilr=4&amv=0",
    rulebook: "/rulebooks/badminton-rulebook.pdf",
    contacts: ["8587030989 - Mr. Karamvir Dagar","8813980162 - Mr. Gaurav Bisht"]
  },
  "table-tennis": {
    title: "Table Tennis",
    whatsapp: "https://chat.whatsapp.com/LoCHtJnmasOKvQBwjjjeOl",
    rulebook: "/rulebooks/table-tennis-rulebook.pdf",
    contacts: ["8587030989 - Mr. Karamvir Dagar","8813980162 - Mr. Gaurav Bisht"]
  },
  "chess": {
    title: "Chess",
    whatsapp: "https://chat.whatsapp.com/Fkp0QDQfe8mKj4ISLhhPFA",
    rulebook: "/rulebooks/chess-rulebook.pdf",
    contacts: ["8587030989 - Mr. Karamvir Dagar","8813980162 - Mr. Gaurav Bisht"]
  },
  "swimming": {
    title: "Swimming",
    whatsapp: "https://chat.whatsapp.com/FrGiHtzSbzb0b0iRZwUnAJ?s=hd&p=i&mlu=2&ilr=0",
    rulebook: "/rulebooks/swimming-rulebook.pdf",
    contacts: ["8587030989 - Mr. Karamvir Dagar","8813980162 - Mr. Gaurav Bisht"]
  },
  "gymnastics": {
    title: "Gymnastics",
    whatsapp: "https://chat.whatsapp.com/DE4j2DvqIezAtmyIMsdfv4",
    rulebook: "/rulebooks/gymnastics-rulebook.pdf",
    contacts: ["8587030989 - Mr. Karamvir Dagar","8813980162 - Mr. Gaurav Bisht"]
  },
  "shooting": {
    title: "Shooting",
    whatsapp: "https://chat.whatsapp.com/CwIUIy8UDko9t9zCOE6MoA?s=cl&p=i&ilr=4&amv=0",
    rulebook: "/rulebooks/shooting-rulebook.pdf",
    contacts: ["8587030989 - Mr. Karamvir Dagar","8813980162 - Mr. Gaurav Bisht"]
  }
};

export function onboardingFor(slug) {
  return SPORT_ONBOARDING[String(slug || "").toLowerCase()] || null;
}
