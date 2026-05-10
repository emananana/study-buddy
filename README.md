# Study or Else

<img width="800" height="517" alt="1gif" src="https://github.com/user-attachments/assets/1bd74780-3cc7-41fb-bab4-346fa7793500" />

<img width="800" height="517" alt="froggif" src="https://github.com/user-attachments/assets/ffa97945-4736-486e-9a71-88f3917b47be" />


Study or Else is a frog-themed focus timer that uses live computer vision to monitor attention during a study session. It combines a Pomodoro-style timer, webcam-based focus tracking, phone detection, live UI feedback, and a session summary screen.

The project is built as a static web app with HTML, CSS, and JavaScript, and uses MediaPipe Face Mesh plus TensorFlow.js COCO-SSD directly in the browser.

## Features

- Select a `25`, `45`, or `60` minute study session
- Choose background audio: `rain`, `classical`, or `lo-fi`
- Use webcam-based focus monitoring during the session
- Detect:
  - face presence
  - head orientation
  - eye gaze direction
  - phone presence in the frame
- Trigger focused, warning, and distracted states
- Show live visual feedback with frog-themed animations and sounds
- Track:
  - focus score
  - distraction count
  - distraction breakdown
  - focused vs distracted time
- Display a summary screen at the end of the session

## How It Works

The system pipeline is:

1. `Webcam input`
2. `Face landmark detection` with MediaPipe Face Mesh
3. `Phone detection` with COCO-SSD
4. `Feature extraction`
   - head turn
   - head vertical angle
   - eye gaze left/right
   - eye gaze up/down
   - phone state
5. `Rule-based focus logic`
   - focused
   - warning
   - distracted
6. `UI feedback and session tracking`

### Computer vision logic

The CV system lives in [`cv.js`](/Users/emanabu-ali/Desktop/study-buddy/cv.js).

It uses:

- `MediaPipe Face Mesh` for facial landmarks and iris tracking
- `TensorFlow.js COCO-SSD` for object detection, specifically `cell phone`

From the landmarks, the app estimates:

- whether the head is facing forward
- whether the head is tilted down
- whether the eyes are looking left, right, center, up, or down

The phone detector runs periodically and keeps detections alive briefly so the result does not flicker between frames.

### Focus-state rules

The system classifies the user with temporal rules instead of a learned classifier.

It checks for:

- phone detected
- no face detected
- looking down too long
- head turned too long
- eyes looking away too long

There is also a custom `study posture` rule: if the user is looking downward in a way that resembles reading notes or working on an iPad, the system can still count that as focused instead of distracted.

Distractions reduce the focus score and update the session breakdown.

## Tech Stack

- `HTML`
- `CSS`
- `JavaScript`
- `MediaPipe Face Mesh`
- `TensorFlow.js`
- `COCO-SSD`

## Project Structure

```text
study-buddy/
├── index.html      # App structure and screens
├── style.css       # Visual styling and animations
├── app.js          # App state, timer, UI logic, summary logic
├── cv.js           # Computer vision pipeline and focus-state rules
├── assets/         # Images, GIFs, sound effects, background audio
└── Team30.pptx     # Presentation deck
```

## Running Locally

Because the app uses the webcam, it should be opened from a local server, not by double-clicking the HTML file directly.

### Option 1: VS Code Live Server

If you use VS Code, open the folder and run `Live Server`.

### Option 2: Python local server

From the project folder:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Grant camera permission when the browser asks.

## Main Screens

- `Landing screen`
  - session length selection
  - sound selection
  - start session

- `Session screen`
  - countdown timer
  - focus monitor card
  - live webcam overlay
  - frog-based warning and distraction feedback

- `Summary screen`
  - focus score card
  - focused vs distracted time
  - distraction breakdown
  - session verdict
