/* The Empty Seat Diagnostic -- calculator, diagnostic, results and blueprint.
   A classic script (not a module) loaded from lite/index.html, so everything
   declared at the top level stays reachable from the markup's inline handlers
   and from scroll-prompt.js. */
/*
  EMAIL DELIVERY CONFIGURATION
  ----------------------------
  When someone completes the diagnostic, their contact details, score and answers
  are posted to Formspree, which emails them to whichever inbox owns the form.

  Two switches, both here:

    EMAIL_DELIVERY_ENABLED  master on/off. Set to false for local work so test
                            runs never reach a real inbox or burn the monthly
                            quota. The diagnostic still calculates and displays
                            results either way -- delivery is the only thing
                            this turns off.
    EMAIL_ENDPOINT          the Formspree form URL. Which inbox it delivers to is
                            set on formspree.io against that form, not here.

  Everything else lives on formspree.io, not in this file: which inbox receives
  the mail, spam filtering, and the allowed-domains list. Never put a private API
  key in here -- this file ships to the browser and anyone can read it.
*/
const EMAIL_DELIVERY_ENABLED = true;
const EMAIL_ENDPOINT = "https://formspree.io/f/mbgrwjez";
const questions = [
  { category: "business", text: "What best describes your current hiring situation?", hint: "Choose the one that feels most true right now.", options: [["We have made hires that did not work out and want to understand why",7],["We are about to start a search and want to do it right this time",10],["Stakeholders cannot align on what the right person looks like",0],["We have an open critical role and the search is stalling",3]] },
  { category: "scorecard", text: "How clearly defined is your hiring scorecard for this role?", hint: "Be honest. This is where many searches quietly fail.", options: [["We have a job description but no real scorecard",7],["Different people have different ideas of what great looks like",3],["We have a detailed, agreed-upon scorecard all interviewers use",10],["Honestly, we are winging it and hoping we know it when we see it",0]] },
  { category: "experience", text: "How would you rate your candidate experience right now?", hint: "Think about how the process feels to a high performer seeing it for the first time.", options: [["Inconsistent depending on the interviewer",3],["Best-in-class and consistently clear",10],["Candidates often disengage early",0],["Generally strong, with a few points of friction",7]] },
  { category: "human", type: "rating", scale: ["We focus on credentials", "We have a human profile"], text: "How clearly can you articulate the human traits that predict success in this role beyond skills and experience?", hint: "1 = we have never gone there, 5 = we have a precise profile", options: [["1",0],["2",2.5],["3",5],["4",7.5],["5",10]] },
  { category: "business", type: "rating", scale: ["No shared picture", "Fully aligned"], text: "How aligned are your key stakeholders on what this hire needs to accomplish in year one?", hint: "1 = we have never had that conversation, 5 = fully locked in", options: [["1",0],["2",2.5],["3",5],["4",7.5],["5",10]] },
  { category: "scorecard", text: "Is your compensation range aligned to the caliber of talent you actually need?", hint: "The market answers this question even when internal stakeholders do not.", options: [["There might be a gap",3],["Yes, we have benchmarked it",10],["We think so, but have not verified",7],["We are not sure, and it is a concern",0]] },
  { category: "experience", text: "How quickly and consistently do candidates hear back after each stage of your process?", hint: "Silence is a decision. Top candidates interpret it as one.", options: [["Within 48 hours, every time",10],["Usually within a week, but it varies",7],["It depends on who is driving the process at that moment",3],["We have probably gone silent on candidates without realizing it",0]] },
  { category: "human", text: "When top candidates disengage late in your process, what do you typically assume?", hint: "Your answer reveals a lot about current blind spots.", options: [["They received a better offer elsewhere",7],["Something in our process or communication pushed them away",10],["We honestly do not know because we rarely find out",0],["They were not as interested as they seemed",3]] }
];

/* Severity bands. Narrow enough that two levers only share a label when their
   scores are adjacent -- a 0 and a 2 no longer both read as "highest risk". */
function severityFor(score) {
  if (score <= 1) return { label: "Highest risk", tone: 0 };
  if (score <= 3) return { label: "High risk", tone: 1 };
  if (score <= 5) return { label: "Needs work", tone: 2 };
  if (score <= 7) return { label: "Minor gap", tone: 3 };
  return { label: "Strong", tone: 4 };
}

const categoryCopy = {
  business: ["Role Definition", "Align every decision-maker on the business problem and a written definition of year-one success before the search advances.", "When your decision-makers quietly picture different wins, you hire someone who succeeds at the wrong job, and everyone calls it a bad hire six months later."],
  scorecard: ["Outcome Scorecard", "Build one shared outcome scorecard and align every interviewer before the search advances.", "When interviewers are measuring different things, strong candidates get rejected and weak ones advance, and you won't catch it until it's on payroll."],
  experience: ["Candidate Experience", "Review every candidate touchpoint from first contact to offer. Fix the friction before the next strong candidate enters the process.", "Every silent week and inconsistent interview tells your best candidates you're not serious, so they take the other offer before you've decided."],
  human: ["Interview & Human Fit", "Build a human alignment profile that defines the leadership style that succeeds under pressure and the evidence interviewers should seek.", "Hire for résumé over how someone leads under pressure, and you get a leader who looks right on paper and stalls the moment it gets hard."]
};
const categoryModule = {
  business: "1",
  scorecard: "2",
  experience: "3",
  human: "4"
};
/* The closing line of the results summary. Keyed to whichever lever scored
   lowest, so the reader is told the one thing to fix first in plain English. */
const leverNextStep = {
  business: "Revisit role clarity and the evaluation process before advancing the search.",
  scorecard: "Agree on one shared list of what success looks like, and what proof counts, before the next interview.",
  experience: "Tighten your response times and make every interview consistent, before the next strong candidate walks.",
  human: "Decide which leadership traits matter under pressure, and what evidence proves them, before candidates enter the process."
};

let current = 0;
let answers = new Array(questions.length).fill(null);
let recommendedBlueprintModule = "1";
let lastVacancyEstimate = null;
const formatDollars = value => "$" + Math.round(value).toLocaleString();
function computeVacancyCost(quota, months, hours) {
  const revenueDrag = (quota / 12) * months * 0.20;
  const leadershipDrag = hours * 4.33 * months * 200;
  return { revenueDrag, leadershipDrag, total: Math.round(revenueDrag + leadershipDrag) };
}
const questionView = document.getElementById("questionView");
const contactGate = document.getElementById("contactGate");
const results = document.getElementById("results");
const optionsEl = document.getElementById("options");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");

function renderQuestion() {
  const q = questions[current];
  document.getElementById("questionText").textContent = q.text;
  document.getElementById("questionHint").textContent = q.hint;
  document.getElementById("stepLabel").textContent = `Question ${current + 1} of ${questions.length}`;
  const pct = Math.round(((current + 1) / questions.length) * 100);
  document.getElementById("stepProgressFill").style.width = `${pct}%`;
  document.getElementById("stepPercent").textContent = `${pct}%`;
  document.getElementById("progressBar").style.width = `${((current + 1) / questions.length) * 100}%`;
  optionsEl.innerHTML = "";
  optionsEl.classList.toggle("rating-options", q.type === "rating");
  optionsEl.setAttribute("role", "group");
  optionsEl.setAttribute("aria-label", q.text);
  const ratingScale = document.getElementById("ratingScale");
  ratingScale.hidden = q.type !== "rating";
  if (q.type === "rating") {
    document.getElementById("ratingLow").textContent = q.scale[0];
    document.getElementById("ratingHigh").textContent = q.scale[1];
  }
  q.options.forEach(([label, score], index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option" + (answers[current]?.index === index ? " selected" : "");
    button.textContent = label;
    button.setAttribute("aria-pressed", answers[current]?.index === index ? "true" : "false");
    if (q.type === "rating") button.setAttribute("aria-label", `Rate ${index + 1} of 5: ${q.scale[0]} to ${q.scale[1]}`);
    button.addEventListener("click", () => {
      /* First answer means they are in it -- the hero nudge has nothing left to say. */
      document.body.dataset.diagnosticStarted = "true";
      answers[current] = { index, score, label, category: q.category };
      [...optionsEl.children].forEach(el => { el.classList.remove("selected", "option-pulse"); el.setAttribute("aria-pressed", "false"); });
      button.classList.add("selected");
      button.setAttribute("aria-pressed", "true");
      void button.offsetWidth;
      button.classList.add("option-pulse");
      nextBtn.disabled = false;
    });
    optionsEl.appendChild(button);
  });
  backBtn.style.visibility = current === 0 ? "hidden" : "visible";
  nextBtn.disabled = answers[current] === null;
  nextBtn.textContent = current === questions.length - 1 ? "Complete Diagnostic" : "Next";
  questionView.classList.remove("question-animate");
  void questionView.offsetWidth;
  questionView.classList.add("question-animate");
}

nextBtn.addEventListener("click", () => {
  if (answers[current] === null) return;
  if (current < questions.length - 1) {
    current += 1;
    renderQuestion();
  } else {
    questionView.style.display = "none";
    contactGate.style.display = "block";
    document.getElementById("progressBar").style.width = "100%";
  }
});

backBtn.addEventListener("click", () => { if (current > 0) { current -= 1; renderQuestion(); } });

document.getElementById("contactBack").addEventListener("click", () => {
  contactGate.style.display = "none";
  questionView.style.display = "block";
});

contactGate.addEventListener("submit", async event => {
  event.preventDefault();
  bpVoice.prime();
  contactGate.style.display = "none";
  const completedAnswers = answers.filter(Boolean);
  const rawTotal = completedAnswers.reduce((sum, answer) => sum + answer.score, 0);
  /* Percentage drives the tier bands and the ring arc; the visitor sees it out of 40,
     one point per lever-tenth across the four levers. */
  const total = Math.round((rawTotal / (completedAnswers.length * 10)) * 100);
  const scoreOutOf40 = Math.round(total * 0.4);
  const leverOrder = ["business", "scorecard", "experience", "human"];
  const categoryScores = completedAnswers.reduce((groups, answer) => {
    if (!groups[answer.category]) groups[answer.category] = [];
    groups[answer.category].push(answer.score);
    return groups;
  }, {});
  const leverStats = leverOrder
    .filter(category => categoryScores[category])
    .map(category => ({
      category,
      score: Math.round(categoryScores[category].reduce((sum, score) => sum + score, 0) / categoryScores[category].length)
    }));
  const dimensionList = document.getElementById("dimensionList");
  dimensionList.innerHTML = leverStats.map(lever => {
    const level = severityFor(lever.score);
    return `<div class="dimension-row" style="--dimension-accent:var(--scb-${level.tone})"><div class="dimension-head"><span class="dimension-name">${categoryCopy[lever.category][0]}</span><span class="dimension-pct"><strong style="color:var(--sc-${level.tone})">${lever.score}</strong>/10</span></div><div class="dimension-track" aria-hidden="true"><div class="dimension-fill" style="background:var(--scb-${level.tone})"></div></div><span class="dimension-state" style="color:var(--sc-${level.tone})">${level.label}</span></div>`;
  }).join("");
  const leverAverages = [...leverStats].sort((a, b) => a.score - b.score || leverOrder.indexOf(a.category) - leverOrder.indexOf(b.category));
  const belowEight = leverAverages.filter(lever => lever.score < 8).slice(0, 3);
  const weak = belowEight.length ? belowEight : [leverAverages[0]];
  const tier = total >= 75 ? "High Clarity" : total >= 45 ? "Developing" : "High Risk";
  /* Where you stand, then the one lever to fix first. The second half changes
     with the weakest lever so two people with the same score are not told the
     same thing to go and do. */
  const standing = total >= 75
    ? "Your fundamentals are stronger than most, and the opportunity now is to lock in the remaining gaps before growth pressure exposes them."
    : total >= 45
      ? "Several gaps are costing you candidate quality, search speed, or leadership alignment, and the fixes are clear and actionable."
      : "The next critical hire carries substantial alignment and execution risk.";
  const weakest = leverAverages[0];
  const step = leverNextStep[weakest.category] || leverNextStep.business;
  const nextStep = `Your lowest lever is ${categoryCopy[weakest.category][0]}, at ${weakest.score}/10. ${step}`;
  const summary = `${standing} ${nextStep}`;
  document.getElementById("tier").textContent = tier;
  document.getElementById("summary").textContent = summary;
  document.getElementById("primaryLever").textContent = categoryCopy[weakest.category][0];
  const primaryLevel = severityFor(weakest.score);
  const primaryLeverScore = document.getElementById("primaryLeverScore");
  primaryLeverScore.textContent = `${weakest.score}/10 · ${primaryLevel.label}`;
  primaryLeverScore.style.color = `var(--sc-${primaryLevel.tone})`;
  const resultCostCard = document.getElementById("resultCostCard");
  if (lastVacancyEstimate) {
    document.getElementById("resultCostValue").textContent = formatDollars(lastVacancyEstimate);
    resultCostCard.hidden = false;
  } else {
    resultCostCard.hidden = true;
  }
  document.getElementById("gaps").innerHTML = weak.map((gap, index) => {
    const level = severityFor(gap.score);
    return `<div class="focus-item" style="--focus-accent:var(--scb-${level.tone})"><div class="focus-priority">Priority ${String(index + 1).padStart(2, "0")}</div><div class="focus-head"><span class="focus-name">${categoryCopy[gap.category][0]}</span><span class="gap-score" style="background:var(--scb-${level.tone})">${gap.score}/10</span></div><span class="gap-level" style="color:var(--sc-${level.tone})">${level.label}</span><p class="gap-consequence">${categoryCopy[gap.category][2]}</p></div>`;
  }).join("");
  const primaryModule = categoryModule[weak[0].category] || "1";
  recommendedBlueprintModule = primaryModule;
  const noGap = leverAverages[0].score >= 8;
  const tiedTop = weak.filter(gap => gap.score === weak[0].score);
  let primaryModuleReference;
  if (noGap) {
    primaryModuleReference = `<li><strong>Start with Lever 0${primaryModule}: ${categoryCopy[weak[0].category][0]}</strong>. No lever scored as a gap, so begin with your relatively lowest and pressure-test it.</li>`;
  } else if (tiedTop.length > 1) {
    const tiedNames = tiedTop.map(gap => categoryCopy[gap.category][0]);
    const others = tiedNames.slice(1);
    const othersText = others.length === 1 ? others[0] : others.slice(0, -1).join(", ") + " and " + others[others.length - 1];
    primaryModuleReference = `<li><strong>${tiedTop.length} levers are tied at your highest risk: ${tiedNames.join(", ")}.</strong> Start with Lever 0${primaryModule}: ${categoryCopy[weak[0].category][0]}. It sits earliest in the chain, and the fixes below only hold once it is solid. Then work through ${othersText}, in that order.</li>`;
  } else {
    primaryModuleReference = `<li><strong>Start with Lever 0${primaryModule}: ${categoryCopy[weak[0].category][0]}</strong>. Your highest priority gap points there.</li>`;
  }
  document.getElementById("recommendations").innerHTML = primaryModuleReference + weak.map(gap => `<li>${categoryCopy[gap.category][1]}</li>`).join("");
  const contact = {
    firstName: document.getElementById("firstName").value,
    lastName: document.getElementById("lastName").value,
    email: document.getElementById("email").value,
    emailOptIn: (contactGate.querySelector("input[name='emailOptIn']:checked") || {}).value || "No",
    company: document.getElementById("company").value
  };
  const priorityGaps = weak.map(gap => ({ category: categoryCopy[gap.category][0], score: gap.score }));
  const answerLog = questions
    .map((question, index) => answers[index] ? ({ question: question.text, answer: answers[index].label, score: answers[index].score }) : null)
    .filter(Boolean);
  /* Formspree labels each row in the email with the key it was sent under, and
     renders them in the order they arrive -- so the keys are written as plain
     titles, ordered the way someone opening a new lead reads it: who they are,
     then what the diagnostic concluded, then the detail behind it.

     `_subject` and `_replyto` are Formspree's own fields -- the first sets the
     subject line, the second makes Reply go straight back to the person who took
     the diagnostic. Underscore-prefixed keys are reserved, so neither of them
     shows up as a row.

     Deliberately not awaited. The page promises results "immediately on the
     screen", so a slow or unreachable endpoint must never hold them back. */
  if (EMAIL_DELIVERY_ENABLED && EMAIL_ENDPOINT) {
    const lead = {
      _subject: `Empty Seat Diagnostic: ${contact.firstName} ${contact.lastName}, ${contact.company} (${scoreOutOf40}/40, ${tier})`,
      _replyto: contact.email,
      "Name": `${contact.firstName} ${contact.lastName}`,
      "Company": contact.company,
      "Work Email": contact.email,
      "Email Opt-In": contact.emailOptIn,
      "Hiring Clarity Score": `${scoreOutOf40} / 40`,
      "Risk Tier": tier,
      "Vacancy Cost Estimate": lastVacancyEstimate ? formatDollars(lastVacancyEstimate) : "Calculator not completed",
      "Priority Levers": priorityGaps.map(gap => `${gap.category}: ${gap.score}/10`).join("\n"),
      "Diagnostic Answers": answerLog.map((entry, index) => `${index + 1}. ${entry.question}\n   -> ${entry.answer} (${entry.score}/10)`).join("\n\n"),
      "Submitted": new Date().toLocaleString(),
      "Page": window.location.href
    };
    fetch(EMAIL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(lead)
    }).then(async response => {
      if (response.ok) console.info("[email] Diagnostic results sent.");
      else console.error("[email] Formspree rejected the submission.", response.status, await response.json().catch(() => ({})));
    }).catch(error => console.error("[email] The diagnostic results could not be sent.", error));
  }
  results.classList.add("show");
  /* The hero nudge has done its job -- retire it for the rest of the visit. */
  document.body.dataset.diagnosticTaken = "true";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    dimensionList.querySelectorAll(".dimension-fill").forEach((el, index) => {
      el.style.width = (leverStats[index].score * 10) + "%";
    });
  }));
  const blueprint = document.getElementById("blueprint");
  if (blueprint) {
    blueprint.hidden = false;
    activateBlueprintModule(primaryModule);
  }
    results.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "start" });
  revealScore(total, scoreOutOf40);
});



document.getElementById("takeBlueprintBtn").addEventListener("click", () => {
  bpVoice.prime();
  const blueprint = document.getElementById("blueprint");
  blueprint.hidden = false;
  activateBlueprintModule(recommendedBlueprintModule);
  blueprint.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "start" });
});


/* ---- About page: standalone Cost of Vacancy calculator dialog ---- */
const costCalcDialog = document.getElementById("costCalcDialog");
function openCostCalc() {
  if (costCalcDialog.showModal) costCalcDialog.showModal();
  else costCalcDialog.setAttribute("open", "");
}
if (costCalcDialog) {
  const ccRevenue = document.getElementById("costCalcRevenue");
  const ccMonths = document.getElementById("costCalcMonths");
  const ccHours = document.getElementById("costCalcHours");
  const ccTotal = document.getElementById("costCalcTotal");
  const ccInsight = document.getElementById("costCalcInsight");
  const ccToDiagnostic = document.getElementById("costCalcToDiagnostic");
  const ccToDiagnosticNote = document.getElementById("costCalcToDiagnosticNote");
  function updateCostCalc() {
    const quota = parseFloat(ccRevenue.value) || 0;
    const months = parseFloat(ccMonths.value) || 0;
    const hours = parseFloat(ccHours.value) || 0;
    const { revenueDrag, leadershipDrag, total } = computeVacancyCost(quota, months, hours);
    ccTotal.textContent = formatDollars(total);
    const touched = ccRevenue.value !== "" || ccMonths.value !== "" || ccHours.value !== "";
    /* Having a number means all three inputs answered and a real total on the
       board -- a single figure typed into one box is not an estimate. The hero
       nudge and the diagnostic lock both read this, and clearing any field puts
       them back to not having one. */
    const hasNumber = ccRevenue.value !== "" && ccMonths.value !== "" && ccHours.value !== "" && total > 0;
    /* The figure the results quote back is only ever overwritten by another
       complete one. Reworking the inputs mid-diagnostic moves it to the new
       total; emptying a field leaves the last real number standing, so the
       results never end up quoting a blank. */
    if (hasNumber) lastVacancyEstimate = total;
    if (hasNumber) document.body.dataset.calculatorUsed = "true";
    else delete document.body.dataset.calculatorUsed;
    /* A partial answer already puts a figure on screen, so the way through to the
       diagnostic stays shut until it is a real one -- otherwise this button lands
       them on a locked card with no idea why. */
    ccToDiagnostic.disabled = !hasNumber;
    ccToDiagnosticNote.textContent = hasNumber
      ? ""
      : "Fill in all three inputs to get your number and unlock the diagnostic.";
    if (!touched) {
      ccInsight.innerHTML = `<h4>Enter your numbers to see your estimated cost of waiting.</h4><p>Assumes $200/hr as the fully loaded value of executive time, not salary, and a 20% revenue factor. Both sit below what SVP and CRO benchmarks support.</p>`;
      return;
    }
    ccInsight.innerHTML = `<h4>Your estimated vacancy cost breakdown</h4><p><strong>Revenue at Risk:</strong> ${formatDollars(revenueDrag)} &middot; <strong>Executive Coverage Cost:</strong> ${formatDollars(leadershipDrag)}</p><p>Coverage cost is what you pay when your CEO or leadership team runs the seat instead of running their own. It's approximate by design. Because the cost of waiting is rarely zero.</p>`;
  }
  [ccRevenue, ccMonths, ccHours].forEach(input => input.addEventListener("input", updateCostCalc));
  document.getElementById("costCalcClose").addEventListener("click", () => costCalcDialog.close());
  costCalcDialog.addEventListener("click", event => { if (event.target === costCalcDialog) costCalcDialog.close(); });
  document.getElementById("costCalcToDiagnostic").addEventListener("click", () => {
    costCalcDialog.close();
    document.getElementById("assessment").scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "start" });
  });
}


/* ---- Michael's voice note ----
   Plays once, the first time his card arrives beside the blueprint. While it
   runs a small badge on the headshot mutes and unmutes it; when the clip ends
   the badge retires. Browsers block programmatic audio until the page has been
   interacted with, and Safari/iOS want the gesture to have touched this element,
   so it is primed on the "See my results" submit and on the blueprint button. */
const bpVoice = (() => {
  const audio = document.getElementById("bpVoice");
  const toggle = document.getElementById("bpVoiceToggle");
  if (!audio || !toggle) return { prime() {}, playOnce() {}, whenEnded() {} };

  let primed = false;
  let played = false;
  const endedHandlers = [];

  function paint() {
    const muted = audio.muted || audio.paused;
    toggle.classList.toggle("is-muted", muted);
    toggle.setAttribute("aria-label", muted ? "Play Michael's message" : "Mute Michael's message");
  }

  function retire() {
    toggle.hidden = true;
    endedHandlers.forEach(fn => fn());
  }

  toggle.addEventListener("click", () => {
    if (audio.paused) { audio.muted = false; audio.play().catch(() => {}); }
    else { audio.muted = !audio.muted; }
    paint();
  });
  audio.addEventListener("ended", retire);
  /* A clip that cannot load counts as finished, so nothing is left waiting on it. */
  audio.addEventListener("error", retire);
  audio.addEventListener("play", paint);
  audio.addEventListener("pause", paint);

  return {
    /* Unlock the element inside a real user gesture. iOS blesses an element the
       moment play() is called during a gesture, so pause synchronously on the
       next line: playback never renders (no audible blip) but the element stays
       unlocked. Priming muted would only buy muted rights on iOS, which is no
       use to us -- the whole point is audible speech later. */
    prime() {
      if (primed) return;
      primed = true;
      audio.preload = "auto";
      audio.muted = false;
      const attempt = audio.play();
      audio.pause();
      audio.currentTime = 0;
      if (attempt && attempt.catch) attempt.catch(() => {});
    },
    playOnce() {
      if (played) return;
      played = true;
      toggle.hidden = false;
      audio.muted = false;
      const attempt = audio.play();
      if (attempt && attempt.catch) attempt.catch(() => {});
      paint();
    },
    /* Fires when the clip runs out -- the card uses it to see itself out. */
    whenEnded(fn) { endedHandlers.push(fn); }
  };
})();

/* ---- Michael's note: swipes in beside the blueprint, then sees itself out ----
   The card is only ever in play once the blueprint has been opened, and only
   while the blueprint is the thing on screen. It swipes in from the right edge,
   holds for a beat so the arrival is not talked over, plays his message, and
   swipes back out a second after the clip ends -- for good. The closing CTA
   keeps the centre of the section to itself throughout. */
(() => {
  const card = document.getElementById("bpNoteCard");
  const section = document.getElementById("blueprint");
  if (!card || !section) return;

  const SETTLE_MS = 3000;   /* card lands -> message starts */
  const EXIT_MS = 1000;     /* message ends -> card leaves */

  let frame = 0;
  let cueTimer = 0;
  let speaking = false;     /* message is running: hold the card put */
  let retired = false;      /* said its piece: never comes back */

  function show() {
    if (card.hidden) {
      card.hidden = false;
      /* One frame parked off screen so the entrance has somewhere to travel from. */
      requestAnimationFrame(() => card.classList.add("is-visible"));
    } else {
      card.classList.add("is-visible");
    }
    if (!cueTimer && !speaking) {
      cueTimer = window.setTimeout(() => {
        cueTimer = 0;
        speaking = true;
        bpVoice.playOnce();
      }, SETTLE_MS);
    }
  }

  function hide() {
    if (cueTimer) { window.clearTimeout(cueTimer); cueTimer = 0; }
    card.classList.remove("is-visible");
  }

  bpVoice.whenEnded(() => {
    window.setTimeout(() => {
      retired = true;
      speaking = false;
      hide();
    }, EXIT_MS);
  });

  function update() {
    frame = 0;
    if (retired) { hide(); return; }
    /* Once he is talking the card stays put, wherever the reader has scrolled to. */
    if (speaking) { show(); return; }
    if (section.hidden) {
      card.hidden = true;
      hide();
      return;
    }
    const r = section.getBoundingClientRect();
    /* On screen means: the section has started and has not yet scrolled past. */
    const onScreen = r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.25;
    if (onScreen) show();
    else hide();
  }

  function schedule() { if (!frame) frame = requestAnimationFrame(update); }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  /* The blueprint is revealed only after the diagnostic, so re-check then. */
  new MutationObserver(schedule).observe(section, { attributes: true, attributeFilter: ["hidden"] });
  schedule();
})();

/* ---- Blueprint: module tab switching ---- */
function activateBlueprintModule(module) {
  document.querySelectorAll(".blueprint-tab").forEach(tab => {
    const isActive = tab.dataset.module === module;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  document.querySelectorAll(".blueprint-module").forEach(panel => panel.classList.toggle("active", panel.dataset.modulePanel === module));
}
document.querySelectorAll(".blueprint-tab").forEach(tab => {
  tab.addEventListener("click", () => activateBlueprintModule(tab.dataset.module));
});

/* ---- Blueprint Module 02: Outcome Scorecard ---- */
const scorecardOutcomes = [
  "Builds or significantly improves a repeatable sales process",
  "Hits a specific revenue number or growth rate within 12 months",
  "Recruits, develops, and retains high-performing sales reps",
  "Builds strong customer relationships and protects existing revenue",
  "Partners effectively with marketing, product, and finance",
  "Brings credibility in the required vertical, market, or channel",
  "Operates with autonomy and earns leadership trust quickly"
];
const scorecardRatings = new Array(scorecardOutcomes.length).fill(0);
const scorecardEl = document.getElementById("blueprintScorecard");

function updateScorecardInsight() {
  const completed = scorecardRatings.filter(Boolean).length;
  const total = scorecardRatings.reduce((sum, rating) => sum + rating, 0);
  document.getElementById("blueprintScore").textContent = total;
  const insight = document.getElementById("scorecardInsight");
  if (completed < scorecardRatings.length) {
    insight.innerHTML = `<h4>Rate ${scorecardRatings.length - completed} more outcome${scorecardRatings.length - completed === 1 ? "" : "s"}.</h4><p>The total is only a completion signal. The useful output is which outcomes become non-negotiable interview anchors and which should receive less attention.</p>`;
    return;
  }
  const critical = scorecardOutcomes.filter((_, index) => scorecardRatings[index] === 5);
  const secondary = scorecardOutcomes.filter((_, index) => scorecardRatings[index] === 4);
  const lower = scorecardOutcomes.filter((_, index) => scorecardRatings[index] <= 2);
  const warning = critical.length > 3
    ? "You marked more than three outcomes as non-negotiable. Narrowing that list will make evaluation clearer."
    : "Your highest-rated outcomes should become the shared evidence anchors used by every interviewer.";
  insight.innerHTML = `<h4>Your scorecard readout</h4><p>${warning}</p><ul><li><strong>Non-negotiable outcomes:</strong> ${critical.length ? critical.join("; ") : "None selected. Revisit what success absolutely requires."}</li><li><strong>Important supporting outcomes:</strong> ${secondary.length ? secondary.join("; ") : "None rated 4."}</li><li><strong>Lower-priority outcomes:</strong> ${lower.length ? lower.join("; ") : "None. Check whether every outcome truly deserves equal interview time."}</li></ul>`;
}

if (scorecardEl) {
  scorecardOutcomes.forEach((outcome, outcomeIndex) => {
    const item = document.createElement("div");
    item.className = "scorecard-item";
    const row = document.createElement("div");
    row.className = "scorecard-row";
    const label = document.createElement("span");
    label.textContent = outcome;
    const buttons = document.createElement("div");
    buttons.className = "score-buttons";
    for (let value = 1; value <= 5; value += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = value;
      button.setAttribute("aria-label", `Rate "${outcome}" ${value} of 5`);
      button.addEventListener("click", () => {
        scorecardRatings[outcomeIndex] = value;
        [...buttons.children].forEach((candidate, index) => candidate.classList.toggle("selected", index + 1 === value));
        updateScorecardInsight();
      });
      buttons.appendChild(button);
    }
    row.append(label, buttons);
    item.appendChild(row);
    scorecardEl.appendChild(item);
  });
}

/* ---- Blueprint Module 03: Candidate Experience Audit ---- */
const experienceItems = [
  "Every candidate hears back within 48 hours of each stage",
  "One person owns communication for the entire search",
  "Candidates know the stages and timeline before their first interview",
  "Every interviewer walks in prepared, having reviewed the materials",
  "Finalists who are not selected get a respectful, personal close",
  "You ask candidates for feedback on the process itself"
];
const experienceAnswers = new Array(experienceItems.length).fill(null);
const experienceEl = document.getElementById("experienceAudit");
const experienceInsight = document.getElementById("experienceInsight");

function updateExperienceInsight() {
  const answered = experienceAnswers.filter(value => value !== null).length;
  if (answered < experienceItems.length) {
    const remaining = experienceItems.length - answered;
    experienceInsight.innerHTML = `<h4>${remaining} to go.</h4><p>Answer for the process you run today, not the one you intend to build.</p>`;
    return;
  }
  const yes = experienceAnswers.filter(value => value === true).length;
  const message = yes >= 5
    ? "Your process is likely attracting the leaders you want. Protect it: assign an owner so it survives busy weeks."
    : yes >= 3
      ? "Your process has friction a strong candidate will feel. Each no below is a specific, fixable blind spot."
      : "Your process is likely repelling the exact leaders you most need. Fix communication speed and ownership before sourcing another candidate.";
  const noItems = experienceItems.filter((_, index) => experienceAnswers[index] === false);
  const noList = noItems.length ? `<ul>${noItems.map(item => `<li>${item}</li>`).join("")}</ul>` : "";
  experienceInsight.innerHTML = `<h4>${yes} of 6: your candidate experience readout</h4><p>${message}</p>${noList}`;
}

if (experienceEl) {
  experienceItems.forEach((item, itemIndex) => {
    const wrapper = document.createElement("div");
    wrapper.className = "scorecard-item";
    const row = document.createElement("div");
    row.className = "scorecard-row";
    const label = document.createElement("span");
    label.textContent = item;
    const buttons = document.createElement("div");
    buttons.className = "yesno-buttons";
    [["Yes", true], ["No", false]].forEach(([text, value]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.setAttribute("aria-label", `${item}: ${text}`);
      button.addEventListener("click", () => {
        experienceAnswers[itemIndex] = value;
        [...buttons.children].forEach(child => child.classList.toggle("selected", child === button));
        updateExperienceInsight();
      });
      buttons.appendChild(button);
    });
    row.append(label, buttons);
    wrapper.appendChild(row);
    experienceEl.appendChild(wrapper);
  });
}

/* ---- Diagnostic lock: tracks whether they have a number, both ways ----
   Locking is applied here rather than in the markup so a script failure leaves
   the diagnostic reachable rather than sealed shut. Emptying any calculator
   field puts the panel back, since the number is the reason these questions are
   worth answering -- but only up until they start answering. Dropping a panel
   over work already done would read as a reset, and their figure is kept for the
   results either way. */
(() => {
  const card = document.querySelector(".assessment-card");
  const lock = document.getElementById("assessmentLock");
  const content = card && card.querySelector(".assessment-content");
  if (!card || !lock || !content) return;

  const hasNumber = () => document.body.dataset.calculatorUsed === "true";
  const hasStarted = () => document.body.dataset.diagnosticStarted === "true";
  let fadeTimer = 0;

  function open() {
    window.clearTimeout(fadeTimer);
    card.classList.remove("is-locked");
    content.removeAttribute("inert");
    lock.classList.add("is-open");
    /* Out of the layout, but only once the fade has played. */
    fadeTimer = window.setTimeout(() => { lock.hidden = true; }, 500);
  }

  function close() {
    window.clearTimeout(fadeTimer);
    card.classList.add("is-locked");
    content.setAttribute("inert", "");
    lock.hidden = false;
    /* A frame in the laid-out state so the panel fades back rather than snapping. */
    requestAnimationFrame(() => lock.classList.remove("is-open"));
  }

  if (hasNumber()) lock.hidden = true;
  else close();

  new MutationObserver(() => {
    if (hasNumber()) open();
    else if (!hasStarted()) close();
  }).observe(document.body, { attributes: true, attributeFilter: ["data-calculator-used"] });
})();

const mobileNavQuery = window.matchMedia("(max-width: 860px)");
let lastNavScrollY = window.scrollY;

function syncMobileMainNavSpace() {
  if (!mobileNavQuery.matches || document.body.classList.contains("profile-mode")) {
    document.documentElement.style.removeProperty("--mobile-main-nav-height");
    return;
  }
  const wasCompact = document.body.classList.contains("mobile-main-nav-compact");
  document.body.classList.remove("mobile-main-nav-compact");
  const mainNav = document.querySelector("body > nav");
  document.documentElement.style.setProperty("--mobile-main-nav-height", `${mainNav.offsetHeight}px`);
  if (wasCompact) document.body.classList.add("mobile-main-nav-compact");
}

function resetMobileNavState() {
  document.body.classList.remove("mobile-main-nav-compact", "mobile-profile-nav-hidden");
  syncMobileMainNavSpace();
  lastNavScrollY = window.scrollY;
}

/* ---- Nav dropdown menu ---- */
const navMenuToggle = document.getElementById("navMenuToggle");
const navMenu = document.getElementById("navMenu");
function closeNavMenu() {
  if (!navMenu || navMenu.hidden) return;
  navMenu.hidden = true;
  navMenuToggle.setAttribute("aria-expanded", "false");
  navMenuToggle.setAttribute("aria-label", "Open menu");
}
function openNavMenu() {
  navMenu.hidden = false;
  navMenuToggle.setAttribute("aria-expanded", "true");
  navMenuToggle.setAttribute("aria-label", "Close menu");
}
if (navMenuToggle && navMenu) {
  navMenuToggle.addEventListener("click", event => {
    event.stopPropagation();
    navMenu.hidden ? openNavMenu() : closeNavMenu();
  });
  navMenu.addEventListener("click", event => { if (event.target.closest("a, button")) closeNavMenu(); });
  document.addEventListener("click", event => {
    if (!navMenu.hidden && !navMenu.contains(event.target) && event.target !== navMenuToggle) closeNavMenu();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeNavMenu(); });
}

/* ---- Lite contact dialog ---- */
const contactDialog = document.getElementById("contactDialog");
function openContactDialog() {
  if (contactDialog.showModal) contactDialog.showModal();
  else contactDialog.setAttribute("open", "");
}
if (contactDialog) {
  document.getElementById("contactDialogClose").addEventListener("click", () => contactDialog.close());
  contactDialog.addEventListener("click", event => { if (event.target === contactDialog) contactDialog.close(); });
}

function updateMobileNavState() {
  const currentY = Math.max(window.scrollY, 0);
  const delta = currentY - lastNavScrollY;
  if (Math.abs(delta) < 5) return;
  const isProfileMode = document.body.classList.contains("profile-mode");
  const profileNav = document.querySelector(".profile-nav");
  const hideThreshold = isProfileMode && profileNav ? profileNav.offsetHeight + 24 : 120;

  if (delta > 0 && currentY > hideThreshold) {
    if (isProfileMode) {
      document.body.classList.add("mobile-profile-nav-hidden");
      document.body.classList.remove("mobile-main-nav-compact");
    } else {
      document.body.classList.add("mobile-main-nav-compact");
      document.body.classList.remove("mobile-profile-nav-hidden");
      closeNavMenu();
    }
  } else {
    document.body.classList.remove("mobile-main-nav-compact", "mobile-profile-nav-hidden");
  }

  if (currentY < 40) resetMobileNavState();
  lastNavScrollY = currentY;
}

window.addEventListener("scroll", updateMobileNavState, { passive: true });
mobileNavQuery.addEventListener("change", resetMobileNavState);
window.addEventListener("resize", syncMobileMainNavSpace);
syncMobileMainNavSpace();

if (location.hash === "#michael") setView("michael", false);

/* ---- Motion: scroll reveal, count-ups, score ring ---- */
const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function countUp(el, target, duration) {
  if (!el) return;
  if (REDUCE_MOTION) { el.textContent = target; return; }
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

function revealScore(total, display) {
  const scoreEl = document.getElementById("score");
  const arc = document.getElementById("scoreArc");
  const tierEl = document.getElementById("tier");
  const ringColor = total >= 75 ? "var(--green-500)" : total >= 45 ? "var(--blue-500)" : "var(--risk-500)";
  const textColor = total >= 75 ? "var(--green-300)" : total >= 45 ? "var(--blue-400)" : "var(--risk-300)";
  const circumference = 2 * Math.PI * 64;
  if (arc) {
    arc.style.strokeDasharray = circumference;
    arc.style.strokeDashoffset = circumference;
    arc.style.stroke = ringColor;
  }
  if (scoreEl) scoreEl.style.color = textColor;
  if (tierEl) tierEl.style.color = textColor;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    results.classList.add("reveal-in");
    if (arc) arc.style.strokeDashoffset = circumference * (1 - total / 100);
    countUp(scoreEl, display, 1150);
  }));
}

function countUpStat(el) {
  const raw = el.textContent.trim();
  const match = raw.match(/^(\D*)(\d[\d,]*)(.*)$/);
  if (!match || /\d/.test(match[3]) || REDUCE_MOTION) return;
  const prefix = match[1];
  const target = parseInt(match[2].replace(/,/g, ""), 10);
  const suffix = match[3];
  const format = value => prefix + value.toLocaleString() + suffix;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / 1200, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = format(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = raw;
  }
  el.textContent = format(0);
  requestAnimationFrame(tick);
}

(function initScrollMotion() {
  const revealSelector = [
    ".why-diagnostic blockquote", ".why-mantra",
    ".audit-intro .section-title", ".audit-intro .body-lg", ".intro-note",
    ".area-row",
    ".quote-band blockquote", ".quote-band cite",
    ".assessment-head .section-title", ".assessment-description",
    ".about-card", ".about-copy .section-title", ".about-copy > p", ".credential", ".about-actions",
    ".final-cta .eyebrow", ".final-cta .section-title", ".final-cta p", ".final-cta .btn",
    ".profile-about .section-title", ".profile-quote", ".profile-credential", ".profile-copy p",
    ".profile-testimonials .section-title",
    ".profile-belief", ".profile-pillar", ".profile-serve-card",
    ".profile-cost .section-title", ".profile-cost p",
    ".profile-contact .section-title", ".profile-contact p",
    ".profile-feedback .section-title", ".profile-feedback-copy > p", ".feedback-promise"
  ].join(",");
  const excludeSelector = ".hero, #questionView, #contactGate, #results";
  const revealEls = [...document.querySelectorAll(revealSelector)].filter(el => !el.closest(excludeSelector));

  if (REDUCE_MOTION || !("IntersectionObserver" in window)) {
    revealEls.forEach(el => el.classList.add("revealed"));
  } else {
    const childIndex = new Map();
    revealEls.forEach(el => {
      const parent = el.parentElement;
      const index = childIndex.get(parent) || 0;
      el.style.setProperty("--reveal-delay", Math.min(index, 5) * 65 + "ms");
      childIndex.set(parent, index + 1);
      el.setAttribute("data-reveal", "");
    });
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(el => observer.observe(el));
    requestAnimationFrame(() => revealEls.forEach(el => el.classList.add("reveal-ready")));

    const statEls = [...document.querySelectorAll(".profile-stat strong, .profile-cost .profile-credential strong")];
    const statObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          countUpStat(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    statEls.forEach(el => statObserver.observe(el));
  }
})();

renderQuestion();
