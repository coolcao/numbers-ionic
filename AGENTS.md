# 宝宝数字乐园 (Numbers Ionic) - 智能体分析文档

## 1. 项目概述

**宝宝数字乐园** 是一款专为儿童设计的早教启蒙 Android 应用，旨在通过生动有趣的互动游戏帮助宝宝认知数字、学习数数和简单的加法运算。

项目采用混合开发模式，结合了 Angular 的组件化架构与 PixiJS 的高性能图形渲染能力，提供了从基础认知到逻辑运算的进阶学习路径。

### 当前状态 (2026-02-03)
- **开发阶段**: 功能迭代与性能优化中
- **目标平台**: Android (通过 Capacitor 打包)
- **核心亮点**: 
    - 结合 DOM (UI) 与 WebGL (游戏) 的混合架构。
    - 针对移动端低端设备进行了详细的性能调优（GPU 动画、音频互斥、内存管理）。

## 2. 技术栈

| 领域 | 技术/库 | 版本 | 说明 |
| :--- | :--- | :--- | :--- |
| **核心框架** | Angular | ^19.0.0 | 全新的 Signal 响应式架构 |
| **UI 组件库** | Ionic Framework | ^8.0.0 | 提供移动端原生交互体验 |
| **样式系统** | Tailwind CSS | ^3.0 | 实用优先的原子化 CSS |
| **跨平台运行时** | Capacitor | ^7.2.0 | Android 原生桥接与打包 |
| **游戏引擎** | PixiJS | ^8.14.3 | 高性能 2D 渲染 (WebGL/WebGPU) |
| **音频引擎** | Howler.js | ^2.2.4 | 音频播放、互斥管理、跨平台兼容 |
| **状态管理** | Angular Signals | - | 轻量级响应式状态管理 (Store Pattern) |

## 3. 项目架构

### 3.1 目录结构
```text
src/
├── app/
│   ├── pages/                   # 核心功能模块 (按路由划分)
│   │   ├── home/                # 首页 (入口、设置、资源预加载)
│   │   ├── learn-numbers/       # [DOM] 数字认知 (0-99)
│   │   ├── listen-numbers/      # [DOM] 听音选数
│   │   ├── number-bubbles-pixi/ # [Pixi] 数字泡泡游戏
│   │   ├── number-train-pixi/   # [Pixi] 数字小火车
│   │   ├── number-market-pixi/  # [Pixi] 数字超市
│   │   └── vending-machine-pixi/# [Pixi] 自动售卖机 (加法运算)
│   ├── store/                   # 全局与模块级状态 (Signals)
│   ├── service/                 # 核心单例服务 (Audio, Storage, App)
│   └── components/              # 通用 UI 组件
└── assets/                      # 静态资源 (音频、图片、字体)
```

### 3.2 架构设计模式
1.  **混合渲染架构 (Hybrid Rendering)**:
    -   **DOM 层**: 用于 `LearnNumbers` 和 `ListenNumbers`。利用 Angular 的声明式模板和 CSS 3D Transforms (GPU 加速) 处理静态展示和轻量级动画。优势是开发效率高、文字清晰、无障碍支持好。
    -   **WebGL 层 (PixiJS)**: 用于 `Bubbles`, `Train`, `Market`, `Vending`。处理大量精灵(Sprites)、粒子系统、物理碰撞和复杂拖拽交互。优势是性能强悍，适合动态游戏。

2.  **服务与状态**:
    -   **Store Pattern**: 使用 `Injectable` 服务 + `Signals` (`computed`, `effect`) 管理状态。
    -   **Service Layer**: 
        -   `EngineService`: 负责 PixiJS `Application` 的生命周期（Init, Resize, Destroy）。
        -   `GameService`: 负责具体的游戏规则和业务逻辑。
        -   `LayoutService`: 负责游戏场景的绘制。

## 4. 功能模块与代码分析

### 4.1 核心服务 (Core Services)

*   **`AudioService`**: 
    -   **互斥策略**: 实现了单声道逻辑，播放新音频前自动调用 `stopAll()`，防止声音重叠。
    -   **异步修复**: 解决了音频被中断时 Promise 挂起的问题（监听 `stop` 事件）。
*   **`StorageService`**: 封装 Ionic Storage，提供持久化存储（如教程完成状态）。
*   **`AppService`**: 处理屏幕方向锁定（横/竖屏）、全屏模式等原生能力。

### 4.2 DOM 模块 (UI/Learning)

1.  **数字学习 (Learn Numbers)**
    -   **功能**: 点击卡片展示详情（大图、发音、助记词）。
    -   **优化**: 移除了高消耗的 `backdrop-blur`，改为半透明背景；图片按需预加载；动画使用 `transform: scale` 避免重排。
    -   **模式**: 入门(0-9) / 进阶(0-99)。

2.  **数字听选 (Listen Numbers)**
    -   **功能**: 听指令选择正确卡片。
    -   **优化**: 动画属性从 `width` 优化为 `transform: scaleX`，确保低端机 60FPS 流畅度。

### 4.3 PixiJS 游戏模块 (Games)

3.  **数字泡泡 (Number Bubbles)**
    -   **玩法**: 点击正确的下落泡泡。
    -   **技术**: 粒子爆炸效果；修复了 Game Loop 无法停止的闭包 Bug；使用了对象池思想建议（待完全实现）。

4.  **数字小火车 (Number Train)**
    -   **玩法**: 拖拽车厢进行数字排序。
    -   **技术**: 复杂的拖拽逻辑；Canvas 层级管理；独立的 `SceneService` 和 `TrainService` 架构。

5.  **数字超市 (Number Market)**
    -   **玩法**: 将指定数量的商品拖入购物车。
    -   **技术**: 碰撞检测 (Hit Testing)；纹理资源管理（修复了销毁时误删纹理缓存的问题）。

6.  **自动售卖机 (Vending Machine)** *[NEW]*
    -   **玩法**: 模拟购物体验，通过拖拽 1元/5元/10元 硬币凑出商品价格（加法运算）。
    -   **技术**: 
        -   目前采用单组件架构 (`VendingMachinePixiComponent`)，包含完整的场景绘制、交互逻辑。
        -   实现了硬币吸入动画、找零逻辑、撒花特效。
        -   资源按需加载优化。

## 5. 构建与运行

### 环境要求
- Node.js 18+
- Yarn
- Android Studio (用于 Android 开发/打包)
- Xcode (用于 iOS 开发/打包，仅限 macOS)
- CocoaPods (用于 iOS 依赖管理)

### 常用命令

#### 通用开发
```bash
# 安装依赖
yarn install

# 启动开发服务器 (本地调试)
yarn start

# 构建 Web 产物 (生成 www 目录)
yarn build
```

#### Android 平台
```bash
# 添加 Android 平台 (仅首次需要)
npx cap add android

# 同步 Web 构建产物到 Android 项目
npx cap sync android

# 打开 Android Studio 进行调试/打包 APK
npx cap open android

# 仅运行 Android 项目 (需连接设备或模拟器)
npx cap run android
```

#### iOS 平台
```bash
# 添加 iOS 平台 (仅首次需要)
npx cap add ios

# 同步 Web 构建产物到 iOS 项目
npx cap sync ios

# 打开 Xcode 进行调试/打包 IPA
npx cap open ios

# 仅运行 iOS 项目 (需连接设备或模拟器)
npx cap run ios
```

#### 图标与启动图生成
```bash
# 根据 resources 目录生成各平台图标
yarn capacitor-assets generate
```

## 6. 开发约定

### 6.1 代码风格
- **格式化**: 使用 Prettier 进行代码格式化。
- **质量检查**: 使用 ESLint 进行代码质量检查。
- **严格模式**: 遵循 TypeScript 严格模式。
- **命名规范**:
    - 组件命名使用 `PascalCase` (如 `NumberTrainComponent`)。
    - 文件命名使用 `kebab-case` (如 `number-train.component.ts`)。

### 6.2 项目结构约定
- **页面组件**: 位于 `src/app/pages/`。
- **通用组件**: 位于 `src/app/components/`。
- **状态管理**: 位于 `src/app/store/`。
- **服务层**: 位于 `src/app/service/`。
- **模块独立性**: 每个功能模块应包含独立的样式、模板和逻辑文件。

### 6.3 组件与状态开发模式
- **状态管理**: 使用 Angular Signals 管理状态，每个功能模块建议有独立的 Store。
- **高性能场景**: 涉及大量动态物体、拖拽或物理碰撞的场景必须使用 PixiJS 实现。
- **业务逻辑**: 服务层 (Service) 处理核心业务逻辑，组件保持轻量，专注 UI 渲染。
- **响应式布局**: 必须适配不同屏幕尺寸（手机、平板、横屏、竖屏）。

### 6.4 性能军规 (必读)
1.  **动画**: 严禁在动画中修改 `width`, `height`, `margin`, `top/left` 等触发重排的属性。必须使用 `transform` (scale, translate, rotate) 和 `opacity`。
2.  **PixiJS 销毁**: 在 `ngOnDestroy` 中必须销毁 `Application`，但需设置 `{ texture: false }` 以保留纹理缓存供后续使用。
3.  **音频互斥**: 所有组件必须通过全局 `AudioService` 播放声音，严禁私自实例化 `Howl` 对象，以确保音频互斥策略生效。
4.  **资源加载**: 大图必须使用 `ImagePreloaderService` 或 Pixi `Assets` 进行预加载/按需加载。

### 6.5 资源与路由约定
- **资源命名**:
    - 图片: `assets/images/{module_name}/{id}.png`
    - 音频: `assets/audio/{module_name}/{action}.mp3`
- **路由参数**: 所有游戏页面统一接收 `mode` 参数：
    - `starter`: 入门模式 (0-9)
    - `advanced`: 进阶模式 (10-99)
