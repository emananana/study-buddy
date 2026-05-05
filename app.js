const AUDIO_IDS = {
  rain: "rain-audio",
  classical: "classical-audio",
  lofi: "lofi-audio",
};

const DISTRACTION_AUDIO_IDS = {
  boo: "boo-audio",
  taunts: ["ih8u-audio", "digust-audio", "loser-audio"],
};

const DISTRACTION_AUDIO_COOLDOWN_MS = 3000;

const SOUND_LABELS = {
  rain: "Rain",
  classical: "Classical",
  lofi: "Lo-fi",
};

const FOCUSED_FROG_GIF = "assets/focusgorfgif.gif";

const BUDDY_STATES = {
  focused: {
    panelClass: "focused-state",
    statusText: "FOCUSED",
    triggerText: "none",
    message: "we are so locked in",
  },
  warning: {
    panelClass: "warning-state",
    statusText: "REFOCUS",
    triggerText: "attention drifting",
    message: "eyes back over here...",
  },
  distracted: {
    panelClass: "distracted-state",
    statusText: "DISTRACTED",
    triggerText: "off task",
    message: "LOCK IN!!! OR ELSE 🐸",
  },
};

const SUMMARY_DEFAULTS = {
  focusScore: 100,
  totalTime: "25 min",
  focusedTime: "25 min",
  distractedTime: "0 min",
  distractions: 0,
  lookingDown: 0,
  phoneDetected: 0,
  lookingAway: 0,
  verdict: "locked in",
  buddyMessage: "we are so locked in",
};

const appState = {
  currentScreen: "landing",
  sessionLength: 25,
  sound: "rain",
  sessionNumber: 1,
  liveStatus: "focused",
  liveTrigger: "none",
  liveMessage: BUDDY_STATES.focused.message,
  distractions: 0,
  liveFocusScore: 100,
  breakdown: {
    lookingDown: 0,
    phoneDetected: 0,
    lookingAway: 0,
  },
  timer: {
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    intervalId: null,
    isRunning: false,
  },
  sessionStats: {
    focusedSeconds: 0,
    distractedSeconds: 0,
  },
  summary: { ...SUMMARY_DEFAULTS },
};

const elements = {};
let lastDistractedAudioTime = 0;

function getAudioElement(audioId) {
  return document.getElementById(audioId);
}

function cacheElements() {
  elements.sessionTimer = document.getElementById("session-timer");
  elements.sessionNumber = document.getElementById("session-number");
  elements.currentSoundLabel = document.getElementById("current-sound-label");
  elements.status = document.getElementById("status");
  elements.distractions = document.getElementById("distractions");
  elements.liveFocusScore = document.getElementById("live-focus-score");
  elements.focusTrigger = document.getElementById("focus-trigger");
  elements.buddyPanel = document.getElementById("buddy-panel");
  elements.sessionShell = document.getElementById("session-shell");
  elements.focusMonitorCard = document.getElementById("focus-monitor-card");
  elements.sessionAngerLineLeft = document.getElementById("session-anger-line-left");
  elements.sessionAngerLineCenter = document.getElementById("session-anger-line-center");
  elements.sessionAngerLineRight = document.getElementById("session-anger-line-right");
  elements.summaryFocusScore = document.getElementById("summary-focus-score");
  elements.summaryTotalTime = document.getElementById("summary-total-time");
  elements.summaryFocusedTime = document.getElementById("summary-focused-time");
  elements.summaryDistractedTime = document.getElementById("summary-distracted-time");
  elements.summaryDistractions = document.getElementById("summary-distractions");
  elements.summaryDownCount = document.getElementById("summary-down-count");
  elements.summaryPhoneCount = document.getElementById("summary-phone-count");
  elements.summaryAwayCount = document.getElementById("summary-away-count");
  elements.summaryCardArt = document.getElementById("summary-card-art");
  elements.summaryVerdict = document.getElementById("summary-verdict");
  elements.summaryBuddyMessage = document.getElementById("summary-buddy-message");
  elements.summaryFocusRatio = document.getElementById("summary-focus-ratio");
  elements.summaryFocusFill = document.getElementById("summary-focus-fill");
  elements.summaryDistractedFill = document.getElementById("summary-distracted-fill");
  elements.summaryFocusMeterLabel = document.getElementById("summary-focus-meter-label");
  elements.summaryDistractedMeterLabel = document.getElementById("summary-distracted-meter-label");
  elements.summaryPhoneBar = document.getElementById("summary-phone-bar");
  elements.summaryAwayBar = document.getElementById("summary-away-bar");
  elements.summaryDownBar = document.getElementById("summary-down-bar");
  elements.startSessionButton = document.getElementById("start-session-btn");
  elements.startSessionImage = document.getElementById("start-session-img");
  elements.endSessionButton = document.getElementById("end-session-btn");
  elements.endFromBreakButton = document.getElementById("end-from-break-btn");
  elements.startAgainButton = document.getElementById("start-again-btn");
  elements.goHomeButton = document.getElementById("go-home-btn");
  elements.backgroundCamera = document.getElementById("bg-camera");
  elements.sessionBackgroundCamera = document.getElementById("session-bg-camera");
  elements.summaryBackgroundCamera = document.getElementById("summary-bg-camera");
  elements.fireflies = document.getElementById("fireflies");
  elements.frogContainer = document.getElementById("frog-container");
}

function showScreen(screenName) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === `${screenName}-screen`);
  });

  appState.currentScreen = screenName;
  document.body.dataset.screen = screenName;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateSessionTimerDisplay() {
  if (!elements.sessionTimer) {
    return;
  }

  elements.sessionTimer.textContent = formatTime(appState.timer.remainingSeconds);
}

function updateSoundLabels() {
  if (!elements.currentSoundLabel) {
    return;
  }

  elements.currentSoundLabel.textContent = SOUND_LABELS[appState.sound] || SOUND_LABELS.rain;
}

function updateSessionNumber() {
  if (elements.sessionNumber) {
    elements.sessionNumber.textContent = String(appState.sessionNumber);
  }
}

function updateLiveStats() {
  if (elements.distractions) {
    elements.distractions.textContent = String(appState.distractions);
  }

  if (elements.liveFocusScore) {
    elements.liveFocusScore.textContent = `${appState.liveFocusScore}%`;
  }
}

function getAngrySpeech(trigger) {
  if (trigger === "phone detected") {
    return ["GET OFF YOUR PHONE", "NO SCROLLING", "LOCK IN"];
  }

  if (trigger === "looking down") {
    return ["EYES UP", "DESK NOT PHONE", "LOCK IN"];
  }

  if (trigger === "no face detected") {
    return ["WHERE DID YOU GO", "GET BACK HERE", "LOCK IN"];
  }

  if (trigger.startsWith("eyes ")) {
    return ["LOOK HERE", "EYES ON SCREEN", "LOCK IN"];
  }

  if (trigger === "head turned") {
    return ["FACE FORWARD", "LOCK BACK IN", "PAY ATTENTION"];
  }

  return ["LOCK IN", "GET BACK TO WORK", "EYES ON SCREEN"];
}

function renderSessionMood(stateName) {
  if (!elements.sessionShell || !elements.focusMonitorCard) {
    return;
  }

  const previousState = elements.sessionShell.dataset.state;

  elements.sessionShell.dataset.state = stateName;
  elements.focusMonitorCard.dataset.state = stateName;

  if (stateName !== "distracted") {
    stopDistractedAudio();
  }

  if (stateName === previousState) {
    const [leftLine, centerLine, rightLine] = getAngrySpeech(appState.liveTrigger);

    if (elements.sessionAngerLineLeft) {
      elements.sessionAngerLineLeft.textContent = leftLine;
    }

    if (elements.sessionAngerLineCenter) {
      elements.sessionAngerLineCenter.textContent = centerLine;
    }

    if (elements.sessionAngerLineRight) {
      elements.sessionAngerLineRight.textContent = rightLine;
    }

    return;
  }

  if (stateName === "distracted") {
    playDistractedAudio();
  }

  const [leftLine, centerLine, rightLine] = getAngrySpeech(appState.liveTrigger);

  if (elements.sessionAngerLineLeft) {
    elements.sessionAngerLineLeft.textContent = leftLine;
  }

  if (elements.sessionAngerLineCenter) {
    elements.sessionAngerLineCenter.textContent = centerLine;
  }

  if (elements.sessionAngerLineRight) {
    elements.sessionAngerLineRight.textContent = rightLine;
  }
}

function setBuddyState(stateName, overrides = {}) {
  const state = BUDDY_STATES[stateName] || BUDDY_STATES.focused;

  appState.liveStatus = stateName;
  appState.liveTrigger = overrides.triggerText ?? state.triggerText;
  appState.liveMessage = overrides.message ?? state.message;

  if (!elements.status || !elements.focusTrigger) {
    return;
  }

  elements.status.textContent = overrides.statusText ?? state.statusText;
  elements.focusTrigger.textContent = appState.liveTrigger;
  renderSessionMood(stateName);
}

function populateSummary() {
  const { summary } = appState;
  const focusPercent = Math.max(0, Math.min(100, summary.focusScore));
  const distractedPercent = Math.max(0, 100 - focusPercent);
  const breakdownMax = Math.max(summary.phoneDetected, summary.lookingAway, summary.lookingDown, 1);

  if (elements.summaryFocusScore) {
    elements.summaryFocusScore.textContent = `${summary.focusScore}%`;
  }

  if (elements.summaryTotalTime) {
    elements.summaryTotalTime.textContent = summary.totalTime;
  }

  if (elements.summaryFocusedTime) {
    elements.summaryFocusedTime.textContent = summary.focusedTime;
  }

  if (elements.summaryDistractedTime) {
    elements.summaryDistractedTime.textContent = summary.distractedTime;
  }

  if (elements.summaryDistractions) {
    elements.summaryDistractions.textContent = String(summary.distractions);
  }

  if (elements.summaryDownCount) {
    elements.summaryDownCount.textContent = String(summary.lookingDown);
  }

  if (elements.summaryPhoneCount) {
    elements.summaryPhoneCount.textContent = String(summary.phoneDetected);
  }

  if (elements.summaryAwayCount) {
    elements.summaryAwayCount.textContent = String(summary.lookingAway);
  }

  if (elements.summaryCardArt) {
    elements.summaryCardArt.src = summary.focusScore <= 70 ? "assets/cardmad.png" : "assets/cardhappy.png";
  }

  if (elements.summaryVerdict) {
    elements.summaryVerdict.textContent = summary.verdict;
  }

  if (elements.summaryBuddyMessage) {
    elements.summaryBuddyMessage.textContent = summary.buddyMessage;
  }

  if (elements.summaryFocusRatio) {
    elements.summaryFocusRatio.textContent = `${focusPercent}% on task`;
  }

  if (elements.summaryFocusFill) {
    elements.summaryFocusFill.style.width = `${focusPercent}%`;
  }

  if (elements.summaryDistractedFill) {
    elements.summaryDistractedFill.style.width = `${distractedPercent}%`;
  }

  if (elements.summaryFocusMeterLabel) {
    elements.summaryFocusMeterLabel.textContent = `Focused ${summary.focusedTime}`;
  }

  if (elements.summaryDistractedMeterLabel) {
    elements.summaryDistractedMeterLabel.textContent = `Distracted ${summary.distractedTime}`;
  }

  if (elements.summaryPhoneBar) {
    elements.summaryPhoneBar.style.width = `${(summary.phoneDetected / breakdownMax) * 100}%`;
  }

  if (elements.summaryAwayBar) {
    elements.summaryAwayBar.style.width = `${(summary.lookingAway / breakdownMax) * 100}%`;
  }

  if (elements.summaryDownBar) {
    elements.summaryDownBar.style.width = `${(summary.lookingDown / breakdownMax) * 100}%`;
  }
}

function resetTimer() {
  const sessionSeconds = appState.sessionLength * 60;

  appState.timer.totalSeconds = sessionSeconds;
  appState.timer.remainingSeconds = sessionSeconds;
}

function stopTimerInterval() {
  if (appState.timer.intervalId) {
    clearInterval(appState.timer.intervalId);
    appState.timer.intervalId = null;
  }
}

function startTimer() {
  stopTimerInterval();
  appState.timer.isRunning = true;

  appState.timer.intervalId = window.setInterval(() => {
    if (!appState.timer.isRunning) {
      return;
    }

    if (appState.timer.remainingSeconds <= 0) {
      stopTimerInterval();
      appState.timer.isRunning = false;
      endSession();
      return;
    }

    if (appState.liveStatus === "distracted") {
      appState.sessionStats.distractedSeconds += 1;
    } else {
      appState.sessionStats.focusedSeconds += 1;
    }

    appState.timer.remainingSeconds -= 1;
    updateSessionTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  appState.timer.isRunning = false;
}

function resumeTimer() {
  appState.timer.isRunning = true;
}

function stopAllSounds() {
  Object.values(AUDIO_IDS).forEach((audioId) => {
    const audioElement = getAudioElement(audioId);

    if (!audioElement) {
      return;
    }

    audioElement.pause();
    audioElement.currentTime = 0;
  });
}

function playSelectedSound() {
  stopAllSounds();

  const selectedAudioId = AUDIO_IDS[appState.sound];
  const audioElement = selectedAudioId ? getAudioElement(selectedAudioId) : null;

  if (!audioElement) {
    return;
  }

  audioElement.volume = 0.4;
  audioElement.play().catch((error) => {
    console.error("Unable to play audio:", error);
  });
}

function playDistractedAudio() {
  const now = Date.now();

  if (now - lastDistractedAudioTime < DISTRACTION_AUDIO_COOLDOWN_MS) {
    return;
  }

  lastDistractedAudioTime = now;

  const booAudio = getAudioElement(DISTRACTION_AUDIO_IDS.boo);
  const tauntAudioId =
    DISTRACTION_AUDIO_IDS.taunts[Math.floor(Math.random() * DISTRACTION_AUDIO_IDS.taunts.length)];
  const tauntAudio = getAudioElement(tauntAudioId);

  if (booAudio) {
    booAudio.pause();
    booAudio.currentTime = 0;
    booAudio.volume = 0.45;
    booAudio.play().catch((error) => {
      console.error("Unable to play boo effect:", error);
    });
  }

  if (tauntAudio) {
    tauntAudio.pause();
    tauntAudio.currentTime = 0;
    tauntAudio.volume = 0.95;
    tauntAudio.play().catch((error) => {
      console.error("Unable to play taunt effect:", error);
    });
  }
}

function stopDistractedAudio() {
  const distractionAudioIds = [DISTRACTION_AUDIO_IDS.boo, ...DISTRACTION_AUDIO_IDS.taunts];

  distractionAudioIds.forEach((audioId) => {
    const audioElement = getAudioElement(audioId);

    if (!audioElement) {
      return;
    }

    audioElement.pause();
    audioElement.currentTime = 0;
  });
}

function resetSessionMetrics() {
  appState.distractions = 0;
  appState.liveFocusScore = 100;
  lastDistractedAudioTime = 0;
  appState.sessionStats = {
    focusedSeconds: 0,
    distractedSeconds: 0,
  };
  appState.breakdown = {
    lookingDown: 0,
    phoneDetected: 0,
    lookingAway: 0,
  };
  appState.summary = {
    ...SUMMARY_DEFAULTS,
    totalTime: `${appState.sessionLength} min`,
    focusedTime: `${appState.sessionLength} min`,
  };
  updateLiveStats();
  setBuddyState("focused");
  window.studyBuddyCv?.resetSession();
}

function getSummaryVerdict(focusScore) {
  if (focusScore >= 90) {
    return {
      verdict: "academic weapon",
      buddyMessage: "locked in the whole time",
    };
  }

  if (focusScore >= 75) {
    return {
      verdict: "pretty solid session",
      buddyMessage: "good work, keep the momentum up",
    };
  }

  if (focusScore >= 60) {
    return {
      verdict: "focus slipped a bit",
      buddyMessage: "not bad, but the frog saw everything",
    };
  }

  return {
    verdict: "frog intervention required",
    buddyMessage: "phone away, eyes up, we go again next round",
  };
}

function updateSummaryFromSession() {
  const focusedSeconds = appState.sessionStats.focusedSeconds;
  const distractedSeconds = appState.sessionStats.distractedSeconds;
  const completedSeconds = focusedSeconds + distractedSeconds;
  const verdict = getSummaryVerdict(appState.liveFocusScore);

  appState.summary = {
    focusScore: appState.liveFocusScore,
    totalTime: `${Math.max(1, Math.round(completedSeconds / 60))} min`,
    focusedTime: `${Math.round(focusedSeconds / 60)} min`,
    distractedTime: `${Math.round(distractedSeconds / 60)} min`,
    distractions: appState.distractions,
    lookingDown: appState.breakdown.lookingDown,
    phoneDetected: appState.breakdown.phoneDetected,
    lookingAway: appState.breakdown.lookingAway,
    verdict: verdict.verdict,
    buddyMessage: verdict.buddyMessage,
  };
}

function startSession() {
  resetTimer();
  resetSessionMetrics();
  updateSessionNumber();
  updateSessionTimerDisplay();
  updateSoundLabels();
  playSelectedSound();
  showScreen("session");
  startTimer();
}

function goToBreak() {
  pauseTimer();
  stopAllSounds();
  showScreen("break");
}

function resumeSession() {
  showScreen("session");
  renderSessionMood(appState.liveStatus);
  playSelectedSound();
  resumeTimer();
}

function endSession() {
  stopTimerInterval();
  appState.timer.isRunning = false;
  updateSummaryFromSession();
  populateSummary();
  stopAllSounds();
  showScreen("summary");
}

function goHome() {
  stopTimerInterval();
  appState.timer.isRunning = false;
  stopAllSounds();
  showScreen("landing");
}

function handleSessionLengthSelection(button, lengthButtons) {
  lengthButtons.forEach((lengthButton) => {
    lengthButton.classList.remove("active");
  });

  button.classList.add("active");
  appState.sessionLength = Number(button.dataset.length);
  resetTimer();
  updateSessionTimerDisplay();
}

function setSoundButtonImage(button, imagePath) {
  const image = button.querySelector("img");

  if (image) {
    image.src = imagePath;
  }
}

function handleSoundSelection(button, soundButtons) {
  soundButtons.forEach((soundButton) => {
    soundButton.classList.remove("active");
    setSoundButtonImage(soundButton, soundButton.dataset.default);
  });

  button.classList.add("active");
  appState.sound = button.dataset.sound;
  setSoundButtonImage(button, button.dataset.hover);
  updateSoundLabels();
}

function setupChoiceButtons() {
  const lengthButtons = document.querySelectorAll("[data-length]");
  const soundButtons = document.querySelectorAll("[data-sound]");

  lengthButtons.forEach((button) => {
    button.addEventListener("click", () => {
      handleSessionLengthSelection(button, lengthButtons);
    });
  });

  soundButtons.forEach((button) => {
    button.addEventListener("mouseenter", () => {
      setSoundButtonImage(button, button.dataset.hover);
    });

    button.addEventListener("mouseleave", () => {
      const imagePath = button.classList.contains("active") ? button.dataset.hover : button.dataset.default;
      setSoundButtonImage(button, imagePath);
    });

    button.addEventListener("click", () => {
      handleSoundSelection(button, soundButtons);
    });
  });
}

function setupImageButtonHovers() {
  if (!elements.startSessionButton || !elements.startSessionImage) {
    return;
  }

  elements.startSessionButton.addEventListener("mouseenter", () => {
    elements.startSessionImage.src = "assets/startsession2.png";
  });

  elements.startSessionButton.addEventListener("mouseleave", () => {
    elements.startSessionImage.src = "assets/startsession.png";
  });
}

function setupButtons() {
  if (elements.startSessionButton) {
    elements.startSessionButton.addEventListener("click", startSession);
  }

  if (elements.endSessionButton) {
    elements.endSessionButton.addEventListener("click", endSession);
  }

  if (elements.endFromBreakButton) {
    elements.endFromBreakButton.addEventListener("click", endSession);
  }

  if (elements.startAgainButton) {
    elements.startAgainButton.addEventListener("click", startSession);
  }

  if (elements.goHomeButton) {
    elements.goHomeButton.addEventListener("click", goHome);
  }

  if (elements.debugButton) {
    elements.debugButton.addEventListener("click", () => {
      document.body.classList.toggle("debug-on");
    });
  }
}

async function startBackgroundCamera() {
  if (
    (!elements.backgroundCamera && !elements.sessionBackgroundCamera && !elements.summaryBackgroundCamera) ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    if (elements.backgroundCamera) {
      elements.backgroundCamera.srcObject = stream;
    }

    if (elements.sessionBackgroundCamera) {
      elements.sessionBackgroundCamera.srcObject = stream;
    }

    if (elements.summaryBackgroundCamera) {
      elements.summaryBackgroundCamera.srcObject = stream;
    }
  } catch (error) {
    console.error("Background camera error:", error);
  }
}

function createFireflies(count = 12) {
  if (!elements.fireflies) {
    return;
  }

  elements.fireflies.innerHTML = "";

  for (let index = 0; index < count; index += 1) {
    const firefly = document.createElement("span");

    firefly.className = "firefly";
    firefly.style.left = `${Math.random() * 100}%`;
    firefly.style.top = `${Math.random() * 100}%`;
    firefly.style.width = `${6 + Math.random() * 8}px`;
    firefly.style.height = firefly.style.width;
    firefly.style.animationDuration = `${8 + Math.random() * 8}s, ${2 + Math.random() * 3}s`;

    const delay = Math.random() * 5;
    firefly.style.animationDelay = `${delay}s, ${delay / 2}s`;

    elements.fireflies.appendChild(firefly);
  }
}

function spawnFrog() {
  if (!elements.frogContainer) {
    return;
  }

  const frog = document.createElement("img");

  frog.src = "assets/frog1.png";
  frog.className = "floating-frog";
  frog.style.left = `${Math.random() * 100}vw`;
  frog.style.width = `${30 + Math.random() * 30}px`;
  frog.style.animationDuration = `${8 + Math.random() * 6}s`;

  elements.frogContainer.appendChild(frog);

  window.setTimeout(() => {
    frog.remove();
  }, 14000);
}

function startAmbientFrogs() {
  window.setInterval(spawnFrog, 2500);
}

function exposeDemoHelpers() {
  window.demoFocused = () => {
    showScreen("session");
    setBuddyState("focused");
  };

  window.demoWarning = () => {
    showScreen("session");
    setBuddyState("warning");
  };

  window.demoDistracted = () => {
    showScreen("session");
    setBuddyState("distracted");
  };

  window.demoBreak = () => {
    showScreen("break");
  };

  window.demoSummary = () => {
    showScreen("summary");
    populateSummary();
  };
}

function exposeCvHooks() {
  window.studyBuddyApp = {
    setFocusFeedback({ state, trigger, message, distractionCount, focusScore, breakdown }) {
      if (typeof distractionCount === "number") {
        appState.distractions = distractionCount;
      }

      if (typeof focusScore === "number") {
        appState.liveFocusScore = focusScore;
      }

      if (breakdown) {
        appState.breakdown = {
          lookingDown: breakdown.lookingDown ?? appState.breakdown.lookingDown,
          phoneDetected: breakdown.phoneDetected ?? appState.breakdown.phoneDetected,
          lookingAway: breakdown.lookingAway ?? appState.breakdown.lookingAway,
        };
      }

      updateLiveStats();
      setBuddyState(state, {
        triggerText: trigger,
        message,
      });
    },
  };
}

function bootstrap() {
  cacheElements();
  document.body.dataset.screen = appState.currentScreen;
  setupChoiceButtons();
  setupButtons();
  setupImageButtonHovers();
  exposeDemoHelpers();
  exposeCvHooks();
  updateSessionTimerDisplay();
  updateSoundLabels();
  updateSessionNumber();
  updateLiveStats();
  populateSummary();
  createFireflies();
  startAmbientFrogs();
  startBackgroundCamera();
}

document.addEventListener("DOMContentLoaded", bootstrap);
