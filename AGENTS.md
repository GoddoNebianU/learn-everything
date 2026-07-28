# LEARN-EVERYTHING

lernu.cc 根域名门户。索引 + 介绍网站，提供进入三个学习项目（learn-languages / learn-music / learn-sciences）的入口。Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS v4 + next-intl（EN/ZH，cookie-based，无 URL locale 段——同 learn-music 架构）。消费 `@goddonebianu/design-system` 做 UI 原语。部署在 Vercel，根域名 `lernu.cc`。

## 定位

本仓库**只是门户**：一个落地页，三张卡片指向三个子域名：

| 子站     | 子域名           | 项目仓库        |
| -------- | ---------------- | --------------- |
| 语言学习 | `lang.lernu.cc`  | learn-languages |
| 音乐学习 | `music.lernu.cc` | learn-music     |
| 理工学习 | `sci.lernu.cc`   | learn-sciences  |

卡片链接是**跨子域的外部链接**（`https://lang.lernu.cc` 等），用原生 `<a>`（不是 `next/link`），同标签页导航。

## 任务完成流程

每次代码修改完成后，必须按顺序执行：

```
1. pnpm lint              # 代码质量
2. pnpm lint:i18n         # i18n 死键 + 翻译完整性检查
3. pnpm lint:max-lines    # 文件行数检查
4. pnpm build             # 构建验证
5. git commit             # 提交改动
```

> 不要跳过 lint 直接 commit，也不要跳过 build 直接结束。lint/build 失败说明改动有问题。删除/重命名文件时，必须同步更新引用该文件的测试和导入。

## 技术栈

Next.js 16 (App Router) · React 19 + Compiler · TypeScript · Tailwind CSS v4 · next-intl (2 语言: en-US/zh-CN) · ESLint ^9。无数据库、无认证、无 PWA、无 Server Actions（除 `set-locale` 这个唯一的 cookie 写入 action）。

## 目录结构

```
app/
├── globals.css                # @import "tailwindcss" + @source design-system + @import tokens.css
├── layout.tsx                 # 根布局：NextIntlClientProvider + getLocale + 静态 metadata（SEO）
└── page.tsx                   # / — 门户落地页（server component，getTranslations）：hero + 3 张子站卡片
proxy.ts                       # Cookie-based locale 检测（Accept-Language → locale cookie），Next.js 16 proxy.ts
messages/
├── en-US.json                 # 命名空间：home, langSwitch
└── zh-CN.json
src/
├── actions/
│   └── set-locale.ts          # "use server" — 写 locale cookie（LanguageSwitcher 调用）
├── components/
│   └── LanguageSwitcher.tsx   # EN / 中文 切换（header 右侧）— setLocale + router.refresh
├── config/
│   └── i18n.ts                # SUPPORTED_LOCALES (en-US, zh-CN) + DEFAULT_LOCALE
└── i18n/
    └── request.ts             # getRequestConfig：读 locale cookie → import messages/<locale>.json
scripts/lint/
├── check-file-length.ts       # 400 行文件上限检查
├── find-unused-i18n-keys.ts   # AST-based i18n 死键 + 翻译完整性检查
├── i18n-unused-baseline.json  # 已知未用键基线
└── i18n/
    ├── ast-analyzer.ts        # useTranslations/getTranslations 调用 AST 分析
    └── json-utils.ts          # messages JSON flatten / prune 工具
```

## 约定

- **`@goddonebianu/design-system` 组件库（card/shadow 美学）**: 通用 UI 元素（按钮、卡片、容器、标题等）一律用包内原语，禁重写本地等价物。Subpath 导入（`@goddonebianu/design-system/card`），禁 barrel 聚合导入（`@goddonebianu/design-system` 裸导入禁止）。
- **Card/shadow 布局**: 卡片用 `<Card variant="default" padding="lg">`（默认带 `shadow-xl`）+ hover 上浮 `hover:-translate-y-0.5 hover:shadow-primary`；header 用 `<Container>` + `shadow-sm` + `bg-card`；页面外层背景用 `bg-background-secondary`（让 card 浮起来）。
- **子站链接用原生 `<a>`**: 卡片指向子域名（`https://lang.lernu.cc` 等），是跨站外部链接，用 `<a href>`，不用 `next/link`（`next/link` 仅用于站内导航；本站目前只有单页 `/`）。
- **i18n（cookie-based，无 URL locale 段）**: Locale 从 `locale` cookie 解析（首次访问由 `proxy.ts` 按 Accept-Language 设置）。Client 组件 `useTranslations('Namespace')`，Server 组件 `getTranslations('Namespace')`。切换语言经 `LanguageSwitcher` → `setLocale` server action 写 cookie + `router.refresh()`。
- **Container 用法**: 内容宽度约束用 `<Container size="2xl" padding="sm">`。
- **Tailwind CSS v4**: `app/globals.css` 用 `@import "tailwindcss"` + `@source "../node_modules/@goddonebianu/design-system/src"`（扫描包内 class）+ `@import "@goddonebianu/design-system/tokens.css"`（注入语义 token）。**不要**在 globals.css 里覆盖 body 字体/背景——让 tokens.css 的默认值生效；页面级背景由 `page.tsx` 的 `bg-background-secondary` 控制。
- **metadata 静态导出**: `app/layout.tsx` 的 `export const metadata` 是静态的（英文 SEO 基线），`NEXT_PUBLIC_BASE_URL` 环境变量控制 `metadataBase`（默认 `https://lernu.cc`）。Locale 不影响 metadata——门户内容文案的本地化由 `page.tsx` 内的 `t()` 负责。
- **React Compiler** 已启用（`reactCompiler: true` in `next.config.ts`）——不要手写 `useMemo`/`useCallback`/`memo()`。
- **路径别名** `@/*` → `./src/*`（tsconfig paths）。
- **Default exports** for page components, **named exports** for lib/component utilities。

## 反模式（禁止）

- `as any` / `@ts-ignore` / `@ts-expect-error`：绕过类型系统
- Barrel 聚合导入 `@goddonebianu/design-system`（裸导入）：必须用 subpath（`@goddonebianu/design-system/button`）
- 内联 SVG 图标：用 `lucide-react`
- 原生 `confirm()` / `prompt()` / `alert()`
- 手动 `useMemo` / `useCallback` / `memo()`：React Compiler 自动处理
- 渲染阶段调用 `setState` / 读写 `localStorage` / `window` / `document`：浏览器 API 只能在 `useEffect` 或事件处理函数中用
- `.then()` 无 `.catch()`：用 `async/await` + try/catch，或链式 `.catch()`
- 复制粘贴 `@goddonebianu/design-system` 原语为本地组件：直接 import 原语
- 在本仓库引入 DB / 认证 / AI / PWA / 业务模块——门户保持极简，复杂能力属于各子站
- 给某 locale 新增 i18n key 而不补全所有 `SUPPORTED_LOCALES`：`lint:i18n` 强制翻译完整性（缺失 / 空值占位符永远失败，不走 baseline）

## 命令

```bash
pnpm dev            # next dev — dev server
pnpm build          # next build — production build
pnpm start          # next start — serve production build
pnpm lint           # eslint
pnpm lint:max-lines # 400 行文件上限检查
pnpm lint:i18n      # AST-based i18n 死键 + 翻译完整性检查（--check 模式）
pnpm typecheck      # tsc --noEmit
pnpm format         # prettier --check .
pnpm format:fix     # prettier --write .
```

Husky `pre-commit` 运行 `lint-staged`（eslint on `*.{ts,tsx}`，prettier --check on `*.{ts,tsx,css,json,md}`）。

## i18n lint 维护

- `pnpm lint:i18n` 是 CI gate（任何回归 exit 1）。
- 新增的合法未用键（暂时没用到但要保留）：跑 `pnpm tsx scripts/lint/find-unused-i18n-keys.ts --update-baseline` 把它加入 `i18n-unused-baseline.json`。
- 清理确认无用的键：跑 `pnpm tsx scripts/lint/find-unused-i18n-keys.ts --delete-unused`（从所有 locale 删除 + 清空 baseline）。
- 基线里的键若已重新被使用（stale），lint 会提示，跑 `--update-baseline` 收缩基线。

## 子站接入 checklist（新增子站时）

1. 在 `app/page.tsx` 的 `PROJECTS` 数组加一项：`{ href, titleKey, descKey, icon }`。
2. 在 `messages/en-US.json` 与 `messages/zh-CN.json` 的 `home` 命名空间同时加 `titleKey` / `descKey` 两个键（`lint:i18n` 强制双 locale 完整）。
3. `icon` 从 `lucide-react` 选一个语义匹配的。
4. 跑 `pnpm lint:i18n && pnpm build` 验证。

## 部署

Vercel，框架选 Next.js。根域名 `lernu.cc`。子域名 DNS 各自指向对应子站的 Vercel project。无需环境变量即可 build（`NEXT_PUBLIC_BASE_URL` 可选，默认 `https://lernu.cc`）。
