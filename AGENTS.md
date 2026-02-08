# AGENTS.md - Project Architecture & Implementation Details

## 1. Project Overview
**Project Name:** Numbers Ionic (Baby Numbers / 宝宝数字乐园)
**Purpose:** An educational mobile application designed for babies and toddlers to learn numbers through interactive games and audio feedback.
**Target Platform:** Mobile (Android focus via Capacitor) & Web.

## 2. Technology Stack
- **Framework:** Angular 19
- **UI Toolkit:** Ionic 8 (components & routing)
- **Styling:** Tailwind CSS 3 (utility-first CSS)
- **State Management:** Angular Signals (Lightweight Store Pattern)
- **Mobile Runtime:** Capacitor 7
- **Game Engine:** PixiJS v8 (for high-performance 2D game components)
- **Audio:** Howler.js (for managing sound effects and voiceovers)
- **Storage:** @ionic/storage-angular (IndexedDB/LocalStorage wrapper)

## 3. Architecture Design

### 3.1. High-Level Architecture
The application follows a **Monolithic Modular** architecture typical of Angular applications but modernized with **Standalone Components** principles (though currently using `AppModule` for bootstrapping) and **Signal-based State Management**.

- **Presentation Layer:** Angular Components (Pages & Shared Components).
- **Business Logic Layer:** Angular Services & Stores.
- **Data Persistence:** Ionic Storage Service.
- **Game Rendering Layer:** PixiJS managed via dedicated Engine Services.

### 3.2. Core Modules
The application is structured into a single main module `AppModule` (likely for simplicity) but logically divided into features:

- **AppModule:** Bootstraps the application, imports core libraries (Ionic, Storage, Animations).
- **AppRoutingModule:** Handles navigation between different game modes (Home, Learn, Listen, Bubbles, Train, etc.).
- **Shared Components:**
  - `BearComponent`: Likely an animated character or mascot.
  - `ModalComponent`: Generic overlay for messages or game results.

### 3.3. State Management (Store Pattern)
Instead of heavy libraries like NgRx, the project uses **Angular Signals** to create lightweight, reactive stores.

- **AppStore (`src/app/store/app.store.ts`):**
  - Manages global state: `isDarkMode`, `learnMode` (Starter/Advanced), `platform` (Web/Android/iOS), `showHeader/Footer`.
  - Exposes read-only signals and modifier methods.
- **Feature Stores:** Each game module has its own store (e.g., `NumberBubblesStore`, `LearnNumbersStore`) to manage game-specific configuration and state (numbers list, game duration, difficulty).

### 3.4. Service Layer
Services are singletons providing core functionality:

- **AppService:** Handles platform-specific actions like Screen Orientation (locking portrait/landscape).
- **AudioService:** Wrapper around `Howler.js`. Handles preloading, playing, stopping, and volume control for audio assets.
- **StorageService:** Wrapper around `IonicStorage` for persisting user progress (e.g., tutorial completion).
- **Feature-Specific Services:**
  - `*AudioService`: Specialized audio handling for specific games (e.g., `NumberBubblesAudioService`).
  - `*PixiEngineService`: Manages PixiJS `Application` instance, canvas attachment, and game loop.
  - `*EntityService`: Manages game entities (e.g., `NumberBubblesBubbleService`).

## 4. Module Design & Technical Details

### 4.1. Navigation & Routing
Routes are defined in `app-routing.module.ts` using `PreloadAllModules` strategy (though currently all components seem to be eagerly loaded in `AppModule`).
Key Routes:
- `/home`: Main Dashboard.
- `/learn-numbers`: Interactive number cards.
- `/listen-numbers`: Audio quiz.
- `/number-bubbles`: Falling bubbles game (PixiJS).
- `/number-train`: Train ordering game (PixiJS).
- `/number-market`: Shopping cart game (PixiJS).
- `/vending-machine`: Vending machine game (PixiJS).

### 4.2. PixiJS Integration Strategy
The project integrates PixiJS for performance-critical game modules. The pattern typically observed (e.g., in `NumberBubblesPixiComponent`) is:

1.  **Component (`*.component.ts`):**
    - Acts as the "Controller".
    - Manages Angular UI (HTML overlays, buttons, score displays).
    - Subscribes to Stores and inputs.
    - **Delegates** rendering to the `EngineService`.
    - Handles higher-level game loop logic (timer, score tracking, win/loss conditions).
2.  **Engine Service (`*PixiEngineService`):**
    - Initializes `PIXI.Application`.
    - Manages the `canvas` element and appends it to the DOM.
    - Exposes `startLoop`/`stopLoop` methods.
    - Manages top-level Pixi Containers (`uiContainer`, `gameContainer`, `overlayContainer`).
3.  **Entity Service (`*BubbleService`, etc.):**
    - Pure logic for game entities (Bubbles, Particles).
    - Factory methods to create Pixi Sprites/Graphics.
    - Update logic (movement, physics simulations).
    - Interaction handling (hit testing).

### 4.3. Key Features Implementation

#### Learn Numbers
- **Logic:** Displays number cards. Clicking triggers audio pronunciation.
- **State:** Uses `LearnNumbersStore` to switch between 'Starter' (0-9) and 'Advanced' (10-99).

#### Number Bubbles (PixiJS Game)
- **Mechanic:** Bubbles with numbers fall from the top. Player must click bubbles matching the "Target Numbers".
- **Tech Details:**
  - **Loop:** `requestAnimationFrame` via Pixi Ticker for smooth rendering + RxJS `interval` for game logic (bubble spawning).
  - **Spawning:** Pseudo-random generation algorithm balancing target vs. distractor bubbles.
  - **Feedback:** Visual "Explosion" particle effect (Pixi) and Audio feedback (Howler) on click.
  - **Responsiveness:** Dynamic bubble sizing based on screen width.

#### Audio System
- **Assets:** MP3 files located in `src/assets/audio/`.
- **Implementation:** `AudioService` provides `play(key)`, `playSequence(keys)`. It handles concurrent audio policies (e.g., interrupting previous sounds).

#### Data Persistence
- **Storage:** Uses `@ionic/storage` (IndexedDB fallback to LocalStorage).
- **Usage:** Stores simple flags like `number_bubbles_tutorial_done` to improve UX by not showing tutorials repeatedly.

## 5. Development Workflow
- **Build:** `ng build` for web, `ionic capacitor build android` for mobile.
- **Assets:** Asset generation (icons/splash) via `@capacitor/assets`.
- **Linting:** ESLint + Prettier.

## 6. Directory Structure
```
src/
├── app/
│   ├── components/       # Shared Angular components
│   ├── pages/            # Game modules/Pages
│   │   ├── [feature]/    # e.g., number-bubbles-pixi
│   │   │   ├── *.component.ts
│   │   │   ├── services/ # Feature-specific Pixi/Logic services
│   ├── pixi-core/        # (Proposed) Shared PixiJS utilities
│   ├── service/          # Core singleton services (App, Audio, Storage)
│   ├── store/            # Signal-based stores
│   ├── app.module.ts     # Main module
├── assets/               # Static assets (images, audio, fonts)
```