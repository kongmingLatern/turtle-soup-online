# 海龟汤在线联机

一个纯前端的海龟汤开局工具，使用 Vue 3 + TypeScript + Element Plus + SCSS 构建，可静态部署到 Vercel。

## 功能

- 本地昵称和主持人/玩家身份
- 自定义汤面、标题和汤底
- 玩家实时提交问题
- 主持人判定：是、不是、是也不是、不重要
- 所有问题和判定在同一浏览器多窗口之间实时同步
- 主持人画板：颜色、笔刷粗细、清空画板
- 汤底隐藏/显示，适合主持人共享屏幕
- 暗黑模式切换
- 房间链接复制和按 room 参数进入房间

## 纯前端联机说明

项目没有后端，数据保存在浏览器 localStorage 中，并通过 BroadcastChannel/storage event 在同一设备的多标签页之间同步。部署到 Vercel 后可以直接打开使用；如果需要跨设备、跨网络的真正实时联机，需要后续接入 WebSocket、Supabase Realtime、Firebase 或自建服务。

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## 部署到 Vercel

1. 将项目推送到 GitHub。
2. 在 Vercel 新建项目并导入该仓库。
3. Framework Preset 选择 Vite。
4. Build Command 使用 `npm run build`。
5. Output Directory 使用 `dist`。

