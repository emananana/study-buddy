const videoElement = document.getElementById("webcam");
const canvasElement = document.getElementById("overlay");
const canvasContext = canvasElement?.getContext("2d");

const LANDMARKS = {
  noseTip: 1,
  mouthTop: 13,
  leftEyeOuter: 33,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  leftEyeInner: 133,
  rightEyeOuter: 263,
  rightEyeTop: 386,
  rightEyeBottom: 374,
  rightEyeInner: 362,
  leftFaceEdge: 234,
  rightFaceEdge: 454,
  leftIris: [468, 469, 470, 471],
  rightIris: [473, 474, 475, 476],
};

const THRESHOLDS = {
  objectCheckInterval: 900,
  phonePersistence: 1600,
  faceMissing: 2200,
  downwardWarning: 700,
  downwardDistracted: 1800,
  sideWarning: 700,
  sideDistracted: 1500,
  headTurnWarning: 700,
  headTurnDistracted: 1500,
};

const DRAWING = {
  font: "18px Arial",
  textColor: "white",
  phoneColor: "magenta",
};

const FOCUS_PENALTIES = {
  "phone detected": 15,
  "no face detected": 10,
  "looking down": 8,
  "eyes left": 6,
  "eyes right": 6,
  "head turned": 6,
};

const cvState = {
  distractionCount: 0,
  isDistracted: false,
  focusScore: 100,
  lastSeenFaceTime: Date.now(),
  downwardStartTime: null,
  sideLookStartTime: null,
  headTurnStartTime: null,
  objectModel: null,
  latestPhoneDetections: [],
  phoneDetected: false,
  lastObjectCheckTime: 0,
  lastPhoneSeenTime: 0,
  breakdown: {
    lookingDown: 0,
    phoneDetected: 0,
    lookingAway: 0,
  },
};

function resetBreakdown() {
  cvState.breakdown.lookingDown = 0;
  cvState.breakdown.phoneDetected = 0;
  cvState.breakdown.lookingAway = 0;
}

function resetCvSessionState() {
  cvState.distractionCount = 0;
  cvState.isDistracted = false;
  cvState.focusScore = 100;
  cvState.lastSeenFaceTime = Date.now();
  cvState.latestPhoneDetections = [];
  cvState.phoneDetected = false;
  cvState.lastObjectCheckTime = 0;
  cvState.lastPhoneSeenTime = 0;
  resetAttentionTimers();
  resetBreakdown();
  pushUiState("focused", "we are so locked in", "none");
}

function notifyApp(payload) {
  window.studyBuddyApp?.setFocusFeedback(payload);
}

function pushUiState(state, message, trigger) {
  notifyApp({
    state,
    message,
    trigger,
    distractionCount: cvState.distractionCount,
    focusScore: cvState.focusScore,
    breakdown: { ...cvState.breakdown },
  });
}

function setFocused() {
  cvState.isDistracted = false;
  pushUiState("focused", "we are so locked in", "none");
}

function setWarning(message = "Warning 😐", trigger = "attention drifting") {
  pushUiState("warning", message, trigger);
}

function applyFocusPenalty(trigger) {
  const penalty = FOCUS_PENALTIES[trigger] ?? 5;
  cvState.focusScore = Math.max(0, cvState.focusScore - penalty);
}

function incrementBreakdown(trigger) {
  if (trigger === "phone detected") {
    cvState.breakdown.phoneDetected += 1;
    return;
  }

  if (trigger === "looking down") {
    cvState.breakdown.lookingDown += 1;
    return;
  }

  if (trigger.startsWith("eyes ") || trigger === "head turned" || trigger === "no face detected") {
    cvState.breakdown.lookingAway += 1;
  }
}

function setDistracted(message = "Distracted 😡", trigger = "off task") {
  if (!cvState.isDistracted) {
    cvState.distractionCount += 1;
    incrementBreakdown(trigger);
    applyFocusPenalty(trigger);
    cvState.isDistracted = true;
  }

  pushUiState("distracted", message, trigger);
}

function drawDot(x, y, color = "white", radius = 5) {
  canvasContext.beginPath();
  canvasContext.arc(x, y, radius, 0, 2 * Math.PI);
  canvasContext.fillStyle = color;
  canvasContext.fill();
}

function drawLine(x1, y1, x2, y2, color = "yellow", width = 2) {
  canvasContext.beginPath();
  canvasContext.moveTo(x1, y1);
  canvasContext.lineTo(x2, y2);
  canvasContext.strokeStyle = color;
  canvasContext.lineWidth = width;
  canvasContext.stroke();
}

function drawText(text, x, y, color = DRAWING.textColor) {
  canvasContext.fillStyle = color;
  canvasContext.font = DRAWING.font;
  canvasContext.fillText(text, x, y);
}

function toPixelCoords(landmark) {
  return {
    x: landmark.x * canvasElement.width,
    y: landmark.y * canvasElement.height,
  };
}

function averagePoint(points) {
  const totals = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 }
  );

  return {
    x: totals.x / points.length,
    y: totals.y / points.length,
  };
}

function getLandmark(landmarks, index) {
  return landmarks[index];
}

function getAverageLandmark(landmarks, indices) {
  return averagePoint(indices.map((index) => getLandmark(landmarks, index)));
}

function isHeadForward(landmarks) {
  const noseTip = getLandmark(landmarks, LANDMARKS.noseTip);
  const leftFace = getLandmark(landmarks, LANDMARKS.leftFaceEdge);
  const rightFace = getLandmark(landmarks, LANDMARKS.rightFaceEdge);
  const faceCenterX = (leftFace.x + rightFace.x) / 2;
  const faceWidth = Math.abs(rightFace.x - leftFace.x);
  const noseOffset = Math.abs(noseTip.x - faceCenterX);

  return noseOffset < faceWidth * 0.14;
}

function getHeadVerticalDirection(landmarks) {
  const noseTip = getLandmark(landmarks, LANDMARKS.noseTip);
  const leftEye = getLandmark(landmarks, LANDMARKS.leftEyeOuter);
  const rightEye = getLandmark(landmarks, LANDMARKS.rightEyeOuter);
  const mouthTop = getLandmark(landmarks, LANDMARKS.mouthTop);
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const faceHeight = Math.abs(mouthTop.y - eyeCenterY);

  if (faceHeight < 1e-6) {
    return "center";
  }

  const verticalRatio = (noseTip.y - eyeCenterY) / faceHeight;

  if (verticalRatio < 0.4) {
    return "up";
  }

  if (verticalRatio > 0.68) {
    return "down";
  }

  return "center";
}

function estimateHorizontalGaze(landmarks) {
  const leftEyeOuter = getLandmark(landmarks, LANDMARKS.leftEyeOuter);
  const leftEyeInner = getLandmark(landmarks, LANDMARKS.leftEyeInner);
  const rightEyeInner = getLandmark(landmarks, LANDMARKS.rightEyeInner);
  const rightEyeOuter = getLandmark(landmarks, LANDMARKS.rightEyeOuter);
  const leftIris = getAverageLandmark(landmarks, LANDMARKS.leftIris);
  const rightIris = getAverageLandmark(landmarks, LANDMARKS.rightIris);
  const leftDenominator = leftEyeInner.x - leftEyeOuter.x;
  const rightDenominator = rightEyeOuter.x - rightEyeInner.x;

  if (Math.abs(leftDenominator) < 1e-6 || Math.abs(rightDenominator) < 1e-6) {
    return 0.5;
  }

  const leftRatio = (leftIris.x - leftEyeOuter.x) / leftDenominator;
  const rightRatio = (rightIris.x - rightEyeInner.x) / rightDenominator;

  return (leftRatio + rightRatio) / 2;
}

function getGazeHorizontalDirection(landmarks) {
  const gazeRatio = estimateHorizontalGaze(landmarks);

  if (gazeRatio < 0.34) {
    return "left";
  }

  if (gazeRatio > 0.66) {
    return "right";
  }

  return "center";
}

function estimateVerticalGaze(landmarks) {
  const leftEyeTop = getLandmark(landmarks, LANDMARKS.leftEyeTop);
  const leftEyeBottom = getLandmark(landmarks, LANDMARKS.leftEyeBottom);
  const rightEyeTop = getLandmark(landmarks, LANDMARKS.rightEyeTop);
  const rightEyeBottom = getLandmark(landmarks, LANDMARKS.rightEyeBottom);
  const leftIris = getAverageLandmark(landmarks, LANDMARKS.leftIris);
  const rightIris = getAverageLandmark(landmarks, LANDMARKS.rightIris);
  const leftDenominator = leftEyeBottom.y - leftEyeTop.y;
  const rightDenominator = rightEyeBottom.y - rightEyeTop.y;

  if (Math.abs(leftDenominator) < 1e-6 || Math.abs(rightDenominator) < 1e-6) {
    return 0.5;
  }

  const leftRatio = (leftIris.y - leftEyeTop.y) / leftDenominator;
  const rightRatio = (rightIris.y - rightEyeTop.y) / rightDenominator;

  return (leftRatio + rightRatio) / 2;
}

function getGazeVerticalDirection(landmarks) {
  const verticalRatio = estimateVerticalGaze(landmarks);

  if (verticalRatio < 0.36) {
    return "up";
  }

  if (verticalRatio > 0.6) {
    return "down";
  }

  return "center";
}

async function loadObjectModel() {
  if (window.tf?.ready) {
    await window.tf.ready();
  }

  cvState.objectModel = await cocoSsd.load();
  console.log("COCO-SSD loaded");
}

async function detectObjects() {
  if (
    !cvState.objectModel ||
    !videoElement ||
    videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
  ) {
    return;
  }

  const predictions = await cvState.objectModel.detect(videoElement);
  const now = Date.now();

  cvState.latestPhoneDetections = predictions.filter((prediction) => {
    return prediction.class === "cell phone" && prediction.score >= 0.3;
  });

  if (cvState.latestPhoneDetections.length > 0) {
    cvState.lastPhoneSeenTime = now;
  }

  cvState.phoneDetected = now - cvState.lastPhoneSeenTime <= THRESHOLDS.phonePersistence;
}

function drawPhoneDetections() {
  cvState.latestPhoneDetections.forEach((detection) => {
    const [x, y, width, height] = detection.bbox;

    canvasContext.strokeStyle = DRAWING.phoneColor;
    canvasContext.lineWidth = 3;
    canvasContext.strokeRect(x, y, width, height);

    drawText(
      `Phone ${(detection.score * 100).toFixed(0)}%`,
      x,
      y > 10 ? y - 8 : y + 18,
      DRAWING.phoneColor
    );
  });
}

function resetAttentionTimers() {
  cvState.downwardStartTime = null;
  cvState.sideLookStartTime = null;
  cvState.headTurnStartTime = null;
}

function getElapsed(startTime, now) {
  return startTime === null ? 0 : now - startTime;
}

function markTimerStart(key, now) {
  if (cvState[key] === null) {
    cvState[key] = now;
  }
}

function handlePhoneDistraction() {
  resetAttentionTimers();
  setDistracted("Phone detected 😡", "phone detected");
}

function handleMissingFace(now) {
  resetAttentionTimers();

  if (now - cvState.lastSeenFaceTime > THRESHOLDS.faceMissing) {
    setDistracted("No face detected 😡", "no face detected");
  } else {
    setWarning("Face lost 😐", "face lost");
  }
}

function handleDownwardAttention(now) {
  markTimerStart("downwardStartTime", now);
  cvState.sideLookStartTime = null;
  cvState.headTurnStartTime = null;

  const downwardElapsed = getElapsed(cvState.downwardStartTime, now);

  if (downwardElapsed > THRESHOLDS.downwardDistracted) {
    setDistracted("Looking down too long 😡", "looking down");
    return;
  }

  if (downwardElapsed > THRESHOLDS.downwardWarning) {
    setWarning("Looking down... 😐", "looking down");
    return;
  }

  setFocused();
}

function handleSideLook(now, gazeHorizontal) {
  markTimerStart("sideLookStartTime", now);
  cvState.headTurnStartTime = null;

  const sideElapsed = getElapsed(cvState.sideLookStartTime, now);

  if (sideElapsed > THRESHOLDS.sideDistracted) {
    setDistracted(`Eyes ${gazeHorizontal} 😡`, `eyes ${gazeHorizontal}`);
    return;
  }

  if (sideElapsed > THRESHOLDS.sideWarning) {
    setWarning(`Eyes ${gazeHorizontal} 😐`, `eyes ${gazeHorizontal}`);
    return;
  }

  setFocused();
}

function handleHeadTurn(now) {
  markTimerStart("headTurnStartTime", now);
  const headElapsed = getElapsed(cvState.headTurnStartTime, now);

  if (headElapsed > THRESHOLDS.headTurnDistracted) {
    setDistracted("Head turned 😡", "head turned");
    return;
  }

  if (headElapsed > THRESHOLDS.headTurnWarning) {
    setWarning("Head turned 😐", "head turned");
    return;
  }

  setFocused();
}

function updateFocusState({
  faceDetected,
  headForward,
  headVertical,
  gazeHorizontal,
  gazeVertical,
  phoneDetected,
}) {
  const now = Date.now();

  if (phoneDetected) {
    handlePhoneDistraction();
    return;
  }

  if (!faceDetected) {
    handleMissingFace(now);
    return;
  }

  cvState.lastSeenFaceTime = now;

  const definitelyLookingDown = headVertical === "down" && gazeVertical === "down";
  const sideLook = gazeHorizontal !== "center";
  const headTurned = !headForward;
  const fullyFocused =
    headForward &&
    headVertical === "center" &&
    gazeHorizontal === "center" &&
    gazeVertical === "center";

  if (fullyFocused) {
    resetAttentionTimers();
    setFocused();
    return;
  }

  if (definitelyLookingDown) {
    handleDownwardAttention(now);
    return;
  }

  cvState.downwardStartTime = null;

  if (sideLook) {
    handleSideLook(now, gazeHorizontal);
    return;
  }

  cvState.sideLookStartTime = null;

  if (headTurned) {
    handleHeadTurn(now);
    return;
  }

  cvState.headTurnStartTime = null;
  resetAttentionTimers();
  setFocused();
}

function getPixelSummary(landmarks) {
  const nose = toPixelCoords(getLandmark(landmarks, LANDMARKS.noseTip));
  const leftFace = toPixelCoords(getLandmark(landmarks, LANDMARKS.leftFaceEdge));
  const rightFace = toPixelCoords(getLandmark(landmarks, LANDMARKS.rightFaceEdge));
  const faceCenter = {
    x: (leftFace.x + rightFace.x) / 2,
    y: (leftFace.y + rightFace.y) / 2,
  };
  const leftIris = toPixelCoords(getAverageLandmark(landmarks, LANDMARKS.leftIris));
  const rightIris = toPixelCoords(getAverageLandmark(landmarks, LANDMARKS.rightIris));
  const leftEyeOuter = toPixelCoords(getLandmark(landmarks, LANDMARKS.leftEyeOuter));
  const leftEyeInner = toPixelCoords(getLandmark(landmarks, LANDMARKS.leftEyeInner));
  const rightEyeInner = toPixelCoords(getLandmark(landmarks, LANDMARKS.rightEyeInner));
  const rightEyeOuter = toPixelCoords(getLandmark(landmarks, LANDMARKS.rightEyeOuter));

  return {
    nose,
    leftFace,
    rightFace,
    faceCenter,
    leftIris,
    rightIris,
    leftEyeOuter,
    leftEyeInner,
    rightEyeInner,
    rightEyeOuter,
  };
}

function drawFaceDebug(points, analysis) {
  drawDot(points.nose.x, points.nose.y, "blue", 5);
  drawDot(points.leftFace.x, points.leftFace.y, "red", 5);
  drawDot(points.rightFace.x, points.rightFace.y, "red", 5);
  drawDot(points.faceCenter.x, points.faceCenter.y, "lime", 5);
  drawLine(points.faceCenter.x, points.faceCenter.y, points.nose.x, points.nose.y, "yellow", 2);

  drawDot(points.leftIris.x, points.leftIris.y, "cyan", 4);
  drawDot(points.rightIris.x, points.rightIris.y, "cyan", 4);

  drawDot(points.leftEyeOuter.x, points.leftEyeOuter.y, "white", 3);
  drawDot(points.leftEyeInner.x, points.leftEyeInner.y, "white", 3);
  drawDot(points.rightEyeInner.x, points.rightEyeInner.y, "white", 3);
  drawDot(points.rightEyeOuter.x, points.rightEyeOuter.y, "white", 3);

  drawLine(
    points.leftEyeOuter.x,
    points.leftEyeOuter.y,
    points.leftEyeInner.x,
    points.leftEyeInner.y,
    "rgba(255,255,255,0.4)",
    1
  );

  drawLine(
    points.rightEyeInner.x,
    points.rightEyeInner.y,
    points.rightEyeOuter.x,
    points.rightEyeOuter.y,
    "rgba(255,255,255,0.4)",
    1
  );

  drawPhoneDetections();
  drawText(`Head H: ${analysis.headForward ? "forward" : "turned"}`, 20, 30);
  drawText(`Head V: ${analysis.headVertical}`, 20, 55);
  drawText(`Eyes H: ${analysis.gazeHorizontal}`, 20, 80);
  drawText(`Eyes V: ${analysis.gazeVertical}`, 20, 105);
  drawText(`Phone: ${cvState.phoneDetected ? "detected" : "none"}`, 20, 130);
}

const faceMesh = new FaceMesh({
  locateFile(file) {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
  },
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

faceMesh.onResults((results) => {
  canvasContext.clearRect(0, 0, canvasElement.width, canvasElement.height);

  const now = Date.now();
  const shouldRunObjectCheck =
    cvState.objectModel && now - cvState.lastObjectCheckTime > THRESHOLDS.objectCheckInterval;

  if (shouldRunObjectCheck) {
    cvState.lastObjectCheckTime = now;
    detectObjects().catch((error) => {
      console.error("Object detection error:", error);
    });
  }

  const landmarks = results.multiFaceLandmarks?.[0];

  if (!landmarks) {
    updateFocusState({
      faceDetected: false,
      headForward: false,
      headVertical: "none",
      gazeHorizontal: "none",
      gazeVertical: "none",
      phoneDetected: cvState.phoneDetected,
    });

    drawPhoneDetections();
    drawText(`Phone: ${cvState.phoneDetected ? "detected" : "none"}`, 20, 30);
    return;
  }

  const analysis = {
    headForward: isHeadForward(landmarks),
    headVertical: getHeadVerticalDirection(landmarks),
    gazeHorizontal: getGazeHorizontalDirection(landmarks),
    gazeVertical: getGazeVerticalDirection(landmarks),
  };

  updateFocusState({
    faceDetected: true,
    phoneDetected: cvState.phoneDetected,
    ...analysis,
  });

  drawFaceDebug(getPixelSummary(landmarks), analysis);
});

async function startCvApp() {
  if (!videoElement || !canvasElement || !canvasContext) {
    return;
  }

  canvasElement.width = 640;
  canvasElement.height = 480;

  await loadObjectModel();

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
    },
    width: 640,
    height: 480,
  });

  camera.start();
}

startCvApp().catch((error) => {
  console.error("CV startup error:", error);
});

window.studyBuddyCv = {
  resetSession: resetCvSessionState,
};
