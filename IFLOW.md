# 宝宝数字乐园 - 项目分析文档

## 项目概述

这是一个基于 Angular 和 Ionic 框架开发的儿童数字学习应用，名为"宝宝数字乐园"。该应用专为幼儿设计，通过多种互动游戏帮助儿童学习数字概念。项目使用 TypeScript 开发，并集成了 Capacitor 用于移动端打包，目前支持 Android 平台。

### 主要技术栈

- **前端框架**: Angular 19
- **移动端框架**: Ionic 8
- **UI 样式**: Tailwind CSS 3
- **移动端打包**: Capacitor 7
- **游戏引擎**: PixiJS 8 (用于高性能游戏场景)
- **音频处理**: Howler.js 2
- **状态管理**: Angular Signals + 自定义 Store
- **拖拽功能**: Angular CDK DragDrop
- **字体**: Comic Neue (儿童友好字体)

### 项目架构

```
src/
├── app/
│   ├── pages/           # 页面组件
│   │   ├── home/                    # 主页
│   │   ├── learn-numbers/           # 数字学习
│   │   ├── listen-numbers/          # 数字听选
│   │   ├── number-bubbles-pixi/     # 数字泡泡 (PixiJS版本)
│   │   ├── number-train-pixi/       # 数字小火车 (PixiJS版本)
│   │   └── number-market-pixi/      # 数字超市 (PixiJS版本)
│   ├── components/       # 通用组件
│   │   ├── bear/                     # 小熊组件
│   │   └── modal/                    # 模态框组件
│   ├── store/           # 状态管理
│   ├── service/         # 服务层
│   └── assets/          # 静态资源
└── environments/        # 环境配置
```

## 核心功能模块

### 1. 数字学习 (learn-numbers)
- 点击数字播报读音
- 显示数字图片和说明
- 支持入门模式(0-9)和进阶模式(10-99)

### 2. 数字听选 (listen-numbers)
- 系统随机播报数字
- 用户点击选择对应数字卡片
- 即时反馈正确/错误

### 3. 数字泡泡 (number-bubbles-pixi)
- 使用 PixiJS 实现高性能动画
- 数字泡泡从上方下落
- 用户需点击对应数字泡泡
- 包含爆炸粒子效果

### 4. 数字小火车 (number-train-pixi)
- 拖拽数字车厢排序
- 训练数字顺序理解
- PixiJS 实现流畅动画

### 5. 数字超市 (number-market-pixi)
- 根据数量要求选择商品
- 增强数字与数量的对应理解
- 拖拽交互体验

## 构建和运行

### 开发环境启动
```bash
# 安装依赖
yarn install

# 启动开发服务器
yarn start
# 或
ng serve --host 0.0.0.0 --port 4200
```

### 构建生产版本
```bash
# 构建 Web 版本
yarn build
# 或
ng build

# 构建 Android 版本
yarn build
npx cap sync android
npx cap open android
```

### 测试和代码质量
```bash
# 运行单元测试
yarn test
# 或
ng test

# 代码检查
yarn lint
# 或
ng lint
```

### 移动端图标生成
```bash
# 生成应用图标
yarn icon
# 或
yarn capacitor-assets generate
```

## 开发约定

### 代码风格
- 使用 Prettier 进行代码格式化
- ESLint 进行代码质量检查
- TypeScript 严格模式
- 组件命名使用 PascalCase
- 文件命名使用 kebab-case

### 项目结构约定
- 页面组件放在 `pages/` 目录
- 通用组件放在 `components/` 目录
- 状态管理使用 `store/` 目录
- 服务层放在 `service/` 目录
- 每个功能模块包含独立的样式、模板和逻辑文件

### 组件开发模式
- 使用 Angular Signals 进行状态管理
- PixiJS 组件实现高性能游戏场景
- 音频服务统一管理音效播放
- 响应式设计适配不同屏幕尺寸

### 状态管理模式
- 每个功能模块有独立的 Store
- 使用 Signals 管理组件状态
- 服务层处理业务逻辑
- 组件保持轻量，专注 UI 渲染

## 资源管理

### 音频资源
- 位置: `src/assets/audio/`
- 按功能模块组织目录结构
- 使用 Howler.js 统一管理播放
- 支持 MP3 格式

### 图片资源
- 位置: `src/assets/images/`
- 按功能模块组织
- 使用 WebP 格式优化加载性能

### 字体资源
- 使用 Comic Neue 字体
- 位置: `src/assets/webfonts/`
- 支持多种字重和格式

## 移动端配置

### Capacitor 配置
- 应用 ID: `com.coolcao.numbers.ionic`
- 应用名称: `宝宝数字乐园`
- 输出目录: `www`
- 支持 Android 平台

### 屏幕方向锁定
- 使用 `@capacitor/screen-orientation` 插件
- 支持横屏和竖屏模式

## 性能优化

### PixiJS 优化
- 使用对象池减少 GC 压力
- 纹理缓存和复用
- 分层渲染优化
- 粒子效果优化

### Angular 优化
- OnPush 变更检测策略
- 懒加载路由模块
- 代码分割和 tree shaking
- 生产环境构建优化

## 已知问题和技术债务

1. 部分组件存在 Canvas 和 PixiJS 两个版本，需要统一
2. 音频预加载机制需要优化
3. 状态管理可以进一步抽象和标准化
4. 移动端手势交互需要增强

## 未来规划

1. 支持 iOS 平台
2. 添加更多数字游戏模式
3. 实现学习进度跟踪
4. 增加家长控制功能
5. 优化动画性能和用户体验