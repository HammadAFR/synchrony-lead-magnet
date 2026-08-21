/* Michael's scroll prompt. Loaded after the card's markup, which is why it is
   a separate file rather than part of app.js -- app.js runs earlier in the
   document, before the <aside> exists. */
/* ---- Michael scroll prompt: boards once the hero is behind them, rides until spent ----
   The hero already carries its own calculator CTA, so the nudge would only compete
   with it (and on a phone sit right on top of it). It waits until the hero has left
   the screen entirely, then acts as the reminder for anyone who scrolled past
   without getting their number.

   The nudge asks "do you have your number yet?", so how far it travels -- and where
   tapping it leads -- depends on whether they do. With a number in hand the question
   is answered, so it steps off as the diagnostic arrives. Without one it keeps pace
   through the diagnostic's opening copy and only leaves once the questions
   themselves are on screen. */
(() => {
  const prompt = document.querySelector("[data-mn-scroll-prompt]");
  const assessment = document.getElementById("assessment");
  if (!prompt || !assessment) return;
  const hero = document.querySelector(".hero");
  const button = prompt.querySelector(".mn-scroll-prompt__button");
  const questionCard = document.querySelector(".assessment-card");
  const hasNumber = () => document.body.dataset.calculatorUsed === "true";

  /* Two finish lines. With a number in hand it steps off as the diagnostic
     section arrives. Without one it rides through the opening copy and leaves the
     instant the question card reaches the bottom of the screen -- the header is
     only a few hundred pixels tall, so waiting any longer would park the prompt
     on top of the questions. */
  const finishLine = () => (hasNumber() || !questionCard)
    ? { el: assessment, at: window.innerHeight * 0.82 }
    : { el: questionCard, at: window.innerHeight };
  const isSpent = () => {
    if (document.body.dataset.diagnosticStarted === "true") return true;
    if (document.body.dataset.diagnosticTaken === "true") return true;
    const { el, at } = finishLine();
    return el.getBoundingClientRect().top < at;
  };

  /* Latched with an 80px dead band so a nudge of the scroll wheel right on the
     hero's edge cannot strobe the card in and out. */
  let aboard = false;
  const hasArrived = () => {
    if (!hero) return true;
    const bottom = hero.getBoundingClientRect().bottom;
    if (!aboard && bottom <= 0) aboard = true;
    else if (aboard && bottom > 80) aboard = false;
    return aboard;
  };

  const update = () => {
    const arrived = hasArrived();
    /* Back at the top of the page: re-arm a card that was dismissed by a tap. */
    if (!arrived) prompt.classList.remove("is-dismissed");
    prompt.classList.toggle("is-visible", arrived && !isSpent());
    button.setAttribute("aria-label", hasNumber()
      ? "Go to the complimentary 5-minute diagnostic"
      : "Open the Vacancy Cost Calculator");
  };

  /* The card sells the calculator, so it hands them the calculator -- unless they
     already have their number, in which case the only thing left is the diagnostic.
     Only the diagnostic hop dismisses it; the dialog hides the card by itself, and
     closing it empty-handed should leave the reminder standing. */
  button.addEventListener("click", () => {
    if (hasNumber()) {
      assessment.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "start" });
      prompt.classList.add("is-dismissed");
    } else {
      openCostCalc();
    }
  });

  window.addEventListener("scroll", update, { passive: true });
  /* Running the calculator moves the finish line and flips the tap target, and
     that happens without a scroll. */
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ["data-calculator-used"] });
  update();
})();
