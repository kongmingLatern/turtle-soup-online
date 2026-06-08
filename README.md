# 海龟汤在线联机

海龟汤在线联机前端，使用 Vue 3 + TypeScript + Element Plus + SCSS 构建，可静态部署到 Vercel。当前版本已改为调用 NestJS 后端，不再使用浏览器本地缓存模拟联机。

## 功能

- 账号密码登录/注册
- 自定义汤面、标题和汤底
- 玩家实时提交问题
- 主持人判定：是、不是、是也不是、不重要
- 所有问题和判定通过后端 Socket.IO 实时同步
- 主持人画板：颜色、笔刷粗细、清空画板
- 汤底隐藏/显示，适合主持人共享屏幕
- 暗黑模式切换
- 房间链接复制和按 room 参数进入房间
- 内置汤面库和用户自建汤面

## 开发

```bash
npm install
cp .env.example .env
npm run dev
```

默认连接 `http://127.0.0.1:3001`，请先启动后端项目 `../turtle-soup-server`。

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
6. Environment Variables 配置 `VITE_API_BASE_URL` 为你的后端公网地址。
