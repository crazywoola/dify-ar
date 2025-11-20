# Dify AR Experiments

A collection of Augmented Reality and Gesture Control web experiments using MediaPipe and standard web technologies.

## Features

### 1. Cyberpunk AR Workflow (`index.html`)
A futuristic, Cyberpunk 2077-themed AR dashboard for managing a coffee brewing workflow.
- **Gestures**:
  - **Pinch & Drag**: Move workflow nodes.
  - **"V" Sign**: Trigger system diagnostics ("Johnny Mode").
  - **Wave**: Reset the workspace.
- **Visuals**: Neon aesthetics, scanlines, and terminal-style logs.

### 2. Gesture Controlled PPT (`ppt.html`)
A presentation tool controlled entirely by hand gestures, built with Reveal.js.
- **Gestures**:
  - **Swipe Left/Right**: Navigate slides.
  - **Index Finger**: Virtual laser pointer.
- **Tech**: Reveal.js integration with MediaPipe Hands.

### 3. Harry Potter Spell Caster (`harry.html`)
An immersive AR dueling experience.
- **Gestures (Spells)**:
  - **Lumos**: Hold wand tip up (Light).
  - **Incendio**: Draw a circle (Fireball).
  - **Stupefy**: Quick thrust forward (Stun Bolt).
  - **Protego**: Open palm (Shield).
- **Features**: Training bot target, particle effects, and sound visualization.

## Getting Started

1. Clone the repository.
2. Run a local server (required for camera access and MediaPipe):
   ```bash
   python -m http.server 8000
   ```
3. Open your browser to:
   - `http://localhost:8000/index.html` for the Workflow.
   - `http://localhost:8000/ppt.html` for the Presentation.
   - `http://localhost:8000/harry.html` for the Spell Caster.

## Technologies
- **MediaPipe Hands**: For robust hand tracking and gesture recognition.
- **Reveal.js**: For the presentation framework.
- **HTML5 Canvas**: For visual effects and particle systems.

## License
MIT License - see [LICENSE](LICENSE) for details.
