/* The Empty Seat Diagnostic -- the vacancy cost calculation itself.
   A classic script (not a module) loaded ahead of app.js and of the standalone
   calculator page, so both read the same arithmetic rather than keeping a copy
   each. Two copies of a formula is two answers to the same question, and the
   day they disagree is the day the number stops being trustworthy.

   The assumptions behind the two constants are set out on the calculator page
   and in the dialog: $200/hour as the fully loaded value of executive time, and
   a 20% revenue factor. Change one here and it changes everywhere. */

const formatDollars = value => "$" + Math.round(value).toLocaleString();

function computeVacancyCost(quota, months, hours) {
  const revenueDrag = (quota / 12) * months * 0.20;
  const leadershipDrag = hours * 4.33 * months * 200;
  return { revenueDrag, leadershipDrag, total: Math.round(revenueDrag + leadershipDrag) };
}

/* Carried between the standalone calculator and the diagnostic so nobody is
   asked for the same three numbers twice. sessionStorage rather than local:
   it belongs to this visit, and a figure from last week is not their number. */
const VACANCY_HANDOFF = "stp-vacancy-estimate";

function rememberVacancyInputs(revenue, months, hours) {
  try {
    sessionStorage.setItem(VACANCY_HANDOFF, JSON.stringify({ revenue, months, hours }));
  } catch (error) {
    /* Private browsing and blocked site data both throw. Losing the handoff
       costs a retype; throwing here would cost them the page. */
  }
}

function recallVacancyInputs() {
  try {
    const raw = sessionStorage.getItem(VACANCY_HANDOFF);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}
