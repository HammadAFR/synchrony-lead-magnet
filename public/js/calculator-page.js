/* The standalone calculator page. A classic script, loaded after
   js/vacancy-cost.js, which is where the arithmetic and the handoff live --
   this file is only the wiring between three inputs and what they produce.

   The figures are stored on every complete answer rather than on the way out.
   Someone who fills this in and then reaches the diagnostic by any route -- the
   button, the nav, a bookmark, the back button -- should not be asked the same
   three questions twice. */

const pageRevenue = document.getElementById("pageRevenue");
const pageMonths = document.getElementById("pageMonths");
const pageHours = document.getElementById("pageHours");
const pageTotal = document.getElementById("pageTotal");
const pageSplit = document.getElementById("pageSplit");
const pageEmpty = document.getElementById("pageEmpty");
const pageRevenueDrag = document.getElementById("pageRevenueDrag");
const pageCoverage = document.getElementById("pageCoverage");
const pageToDiagnostic = document.getElementById("pageToDiagnostic");

let lastReported = null;
function updatePageCalc() {
  const revenue = parseFloat(pageRevenue.value) || 0;
  const months = parseFloat(pageMonths.value) || 0;
  const hours = parseFloat(pageHours.value) || 0;
  const { revenueDrag, leadershipDrag, total } = computeVacancyCost(revenue, months, hours);

  /* All three answered and a real total: a figure typed into one box is not an
     estimate, and must not be carried into the diagnostic as though it were. */
  const complete = pageRevenue.value !== "" && pageMonths.value !== "" && pageHours.value !== "" && total > 0;

  pageTotal.textContent = formatDollars(total);
  pageSplit.hidden = !complete;
  pageEmpty.hidden = complete;
  pageToDiagnostic.classList.toggle("is-ready", complete);

  if (!complete) return;
  /* Once per completed set of figures, not per keystroke. */
  if (lastReported !== total) {
    track("calculator_completed", { value: total, currency: "USD", source: "page" });
    lastReported = total;
  }
  pageRevenueDrag.textContent = formatDollars(revenueDrag);
  pageCoverage.textContent = formatDollars(leadershipDrag);
  rememberVacancyInputs(pageRevenue.value, pageMonths.value, pageHours.value);
}

[pageRevenue, pageMonths, pageHours].forEach(input => input.addEventListener("input", updatePageCalc));

/* This page is the calculator, so arriving is opening it -- the same funnel
   step the dialog reports, so the two routes stay comparable. */
track("calculator_opened", { source: "page" });
pageToDiagnostic.addEventListener("click", () => track("calculator_to_diagnostic"));

/* Coming back to this page mid-visit should not wipe the answers already given. */
const carried = recallVacancyInputs();
if (carried) {
  if (carried.revenue) pageRevenue.value = carried.revenue;
  if (carried.months) pageMonths.value = carried.months;
  if (carried.hours) pageHours.value = carried.hours;
}
updatePageCalc();
