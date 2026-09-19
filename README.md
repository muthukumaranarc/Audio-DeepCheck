# Audio-DeepCheck
Audio DeepCheck is an AI-powered voice authenticity and anti-spoofing system. It combines multiple specialized models (Wav2Vec2, AASIST, prosody/F0 analysis, and spectrogram anomaly detection) into a master fusion model to detect synthetic speech and deepfake audio accurately while providing clear explainability.

## Quick Start (Windows)

You can launch the entire ecosystem with a single double-click:

### 1. Launch All Services
- Double-click **`run-all.bat`** (or **`start.bat`**) in the project root folder.
- The script automatically checks prerequisites (Node.js, npm, Maven, Java, Python), initializes dependencies if needed, and launches each microservice in its own titled console window:
  - **AI Model Service (FastAPI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
  - **Backend API & Signaling (Spring Boot)**: [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health)
  - **Live Web Dashboard (Vite / React)**: [http://localhost:3000](http://localhost:3000)
  - **Mobile Call Simulator (Vite / React)**:
    - User A (Caller): [http://localhost:5174?user=A](http://localhost:5174?user=A)
    - User B (Receiver): [http://localhost:5174?user=B](http://localhost:5174?user=B)
- After a short initialization delay, your default browser opens these interfaces automatically.

### 2. Stop All Services
- Double-click **`stop-all.bat`** in the project root to cleanly terminate all processes listening on ports `8000`, `8080`, `3000`, and `5174`.

### 3. Launching Individual Services
If you ever want to run or debug a specific component independently:
- **`start-ai.bat`**: Runs FastAPI AI Model on port 8000.
- **`start-backend.bat`**: Runs Spring Boot Backend on port 8080.
- **`start-frontend.bat`**: Runs Dashboard on port 3000.
- **`start-simulator.bat`**: Runs Mobile Call Simulator on port 5174.


