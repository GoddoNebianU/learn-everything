# LEARN-EVERYTHING · 学一切

lernu.cc 根域名门户（品牌「学一切」/「Learn Everything」），**身兼两职**：(1) 入口索引站，四张卡片指向四个子域名学习项目；(2) **中心认证宿主**（SSO host），唯一拥有 better-auth 的 auth schema DDL，注册/登录/邮件验证/忘记密码/登出全在此。Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS v4 + next-intl（8 语言：en-US / zh-CN / ug-CN / eo / fr-FR / es-ES / it-IT / de-DE；cookie-based，无 URL locale 段）+ Prisma 7（仅 `auth` schema）+ better-auth + nodemailer。消费 `@goddonebianu/design-system` 做 UI 原语。部署在 Vercel，根域名 `lernu.cc`。

## 定位

**两件事，一个仓库：**

1. **门户**：落地页 `/`，四张卡片指向四个子站。
2. **中心认证宿主**：`app/(auth)/*`（login/signup/logout/forgot-password/reset-password）+ `app/api/auth/[...all]` 路由。账户数据库与 learn-languages / learn-together 共用（详见「认证架构」），唯一推 auth schema DDL 的一端。

| 子站   | 子域名              | 项目仓库        |
| ------ | ------------------- | --------------- |
| 学语言 | `lang.lernu.cc`     | learn-languages |
| 学音乐 | `music.lernu.cc`    | learn-music     |
| 学科学 | `sci.lernu.cc`      | learn-sciences  |
| 学一起 | `together.lernu.cc` | learn-together  |

卡片链接是**跨子域的外部链接**（`https://lang.lernu.cc` 等），用原生 `<a>`（不是 `next/link`），同标签页导航。

## 任务完成流程

每次代码修改完成后，必须按顺序执行：

```
1. pnpm lint                  # 代码质量
2. pnpm lint:auth             # 认证守卫检查（所有 server action 须有 getSession/requireUserId，或 // @public 豁免）
3. pnpm lint:auth-schema-drift # auth schema 漂移自检（确保本地 mirror 与 DB 一致）
4. pnpm lint:i18n             # i18n 死键 + 翻译完整性检查
5. pnpm lint:max-lines        # 文件行数检查
6. pnpm typecheck             # 类型检查
7. pnpm build                 # 构建验证
8. git commit                 # 提交改动
```

> 不要跳过 lint 直接 commit，也不要跳过 build 直接结束。lint/build 失败说明改动有问题。删除/重命名文件时，必须同步更新引用该文件的测试和导入。

## 技术栈

Next.js 16 (App Router) · React 19 + Compiler · TypeScript · Tailwind CSS v4 · next-intl (8 语言: en-US / zh-CN / ug-CN / eo / fr-FR / es-ES / it-IT / de-DE) · Prisma 7（multiSchema，仅 `auth` schema）· better-auth（SSO 宿主）· nodemailer（SMTP 经 env）· Zod v4 · ESLint ^9。无 Zustand、无 PWA。语言切换走客户端 cookie + `window.location.reload()`，无 server action。

## 认证架构（中心 SSO 宿主）

lernu.cc 是跨子域 cookie SSO 的**唯一宿主**。详细机制见根 `AGENTS.md`「共享资源 · 跨子域 SSO」。本仓库内的关键约束：

- **auth schema DDL 唯一由此仓库推**：`prisma/schema.prisma` 的 `datasource.schemas = ["auth"]`。包含 4 个 better-auth 身份模型（User/Session/Account/Verification）+ AuthEvent 审计表（宿主拥有）。learn-languages / learn-together 是消费者，只镜像只读，绝不推 auth DDL。
- **SMTP 经 env，非 DB**：邮件凭证（host/port/secure/user/pass/from）是静态环境变量 `SMTP_*`，由 `src/lib/env.ts` zod 校验（`SMTP_PORT` coerce number、`SMTP_SECURE` string→boolean）。不存 SystemConfig 表，改 SMTP 需 redeploy。本仓库**无** learn-languages 的 `clearSmtpTransporter` 热改机制——env 运行时不可变，transporter 是 module 级单例懒加载。
- **跨子域 cookie**：`src/lib/auth/index.ts` 配 `advanced.crossSubDomainCookies: { enabled: true, domain: "lernu.cc" }` + `trustedOrigins` 含 `lernu.cc` / `lang.lernu.cc` / `together.lernu.cc`。session cookie 名两端必须一致——`useSecureCookies` 不让 better-auth 从 `BETTER_AUTH_URL` 协议推导（dev http / prod https 不对称会让 cookie 名 `__Secure-` 前缀错位），相关细节见注释。
- **登录入口唯一在 `lernu.cc`**：消费者无登录页。子域跳 `lernu.cc/login?redirect=<绝对 *.lernu.cc URL>`，宿主 `src/lib/safe-subdomain-redirect.ts` 的 `getSafeSubdomainRedirectPath` 只放行三 origin（exact set，不 wildcard）。跨子域回流必须 `window.location.href`（不是 `router.push`），见 `src/lib/navigate-safe-redirect.ts`。
- **登出在宿主执行**（RFC 6265）：子域无法清父域 `.lernu.cc` cookie，消费者 `signOutAction` 先作废 DB session 再 `redirect(hostLogoutUrl())` 跳本仓库 `/logout` 清 cookie。本仓库 `/logout` 服务端 `auth.api.signOut` + 记录 AuthEvent + `redirect("/login?redirect=...")`。
- **AuthEvent 审计**：`src/modules/auth-event/` 写宿主端审计（signup/login/logout/email-verify/forgot-pw 等）。better-auth `databaseHooks.user/session.create.after` 自动写；`recordAuthEvent` 是 plain async（非 `"use server"`），DB 失败只 log 不阻断 auth 流程。
- **IP 限流是 best-effort**（`src/lib/ip-limiter.ts`）：单实例内存计数，多实例部署可被绕过。真共享存储限流（Redis/Upstash）是 separate scope。注释里写明此约束。
- **`BETTER_AUTH_SECRET` per-environment**：dev `.env` 一组、prod `.env.production` 一组，与两消费者同值。HMAC 签名校验靠它，不一致则 token 跨 app 解析失败。

## 目录结构

```
app/
├── globals.css                    # @import "tailwindcss" + @source design-system + @import tokens.css
├── layout.tsx                     # 根布局：NextIntlClientProvider + getLocale + 静态 metadata
├── page.tsx                       # / — 门户落地页（server component）：hero + 4 张子站卡片
├── (auth)/                        # 认证页面组（宿主独有）
│   ├── layout.tsx
│   ├── login/                     # LoginClient + page（读 ?redirect=，跨子域回流）
│   ├── signup/
│   ├── logout/                    # server component：signOut + AuthEvent + redirect
│   ├── forgot-password/
│   └── reset-password/
└── api/
    └── auth/[...all]/route.ts     # better-auth HTTP 入口（toNextJsHandler）
proxy.ts                            # Cookie-based locale 检测（Accept-Language → locale cookie）
messages/<8 locales>.json
src/
├── components/
│   ├── AuthFormShell.tsx          # 认证表单共用壳
│   └── LanguageSwitcher.tsx       # Dropdown（8 locales，header right）
├── config/{app.ts,i18n.ts}        # SUPPORTED_LOCALES (8) + DEFAULT_LOCALE
├── i18n/request.ts                # getRequestConfig：读 locale cookie → import messages
├── lib/
│   ├── auth/
│   │   ├── index.ts               # betterAuth({...}) 宿主实例（SSO triple + plugins + hooks）
│   │   └── auth-client.ts         # createAuthClient（react + usernameClient plugin）
│   ├── db/                        # Prisma client（PrismaPg adapter，generated/prisma/）
│   ├── email/                     # nodemailer transporter + sendEmail（SMTP_* env，无热改）
│   ├── env.ts                     # zod 校验 DATABASE_URL/BETTER_AUTH_*/SMTP_*/NODE_ENV
│   ├── errors.ts                  # ExpectedError 等
│   ├── ip-limiter.ts              # best-effort 内存 IP 限流
│   ├── logger/                    # Winston
│   ├── navigate-safe-redirect.ts  # 跨子域回流用 window.location.href
│   └── safe-subdomain-redirect.ts # getSafeSubdomainRedirectPath（只放行 3 个 *.lernu.cc origin）
└── modules/
    ├── auth/                      # forgot-password server action + service + repository
    └── auth-event/                # AuthEvent 审计写入（recordAuthEvent）
scripts/lint/
├── check-auth.ts                  # lint:auth — server action 守卫扫描
├── check-auth-schema-drift.ts     # auth schema 漂移自检（identity 列 + 表存在性）
├── check-file-length.ts           # 400 行文件上限
├── find-unused-i18n-keys.ts       # AST-based i18n 死键 + 翻译完整性
└── i18n-unused-baseline.json
```

## 约定

- **`@goddonebianu/design-system` 组件库（card/shadow 美学）**: 通用 UI 元素（按钮、卡片、容器、标题等）一律用包内原语，禁重写本地等价物。Subpath 导入（`@goddonebianu/design-system/card`），禁 barrel 聚合导入（`@goddonebianu/design-system` 裸导入禁止）。
- **Card/shadow 布局**: 卡片用 `<Card variant="default" padding="lg">`（默认带 `shadow-xl`）+ hover 上浮 `hover:-translate-y-0.5 hover:shadow-primary`；header 用 `<Container>` + `shadow-sm` + `bg-card`；页面外层背景用 `bg-background-secondary`（让 card 浮起来）。
- **子站链接用原生 `<a>`**: 卡片指向子域名（`https://lang.lernu.cc` 等），是跨站外部链接，用 `<a href>`，不用 `next/link`（`next/link` 仅用于站内导航）。
- **i18n（cookie-based，8 语言，无 URL locale 段）**: Locale 从 `locale` cookie 解析（首次访问由 `proxy.ts` 按 Accept-Language 检测并设置）。Client 组件 `useTranslations('Namespace')`，Server 组件 `getTranslations('Namespace')`。切换语言经 `LanguageSwitcher` dropdown → 客户端写 `document.cookie` + `window.location.reload()`。
- **Container 用法**: 内容宽度约束用 `<Container size="2xl" padding="sm">`。
- **Tailwind CSS v4**: `app/globals.css` 用 `@import "tailwindcss"` + `@source "../node_modules/@goddonebianu/design-system/src"`（扫描包内 class）+ `@import "@goddonebianu/design-system/tokens.css"`（注入语义 token）。**不要**在 globals.css 里覆盖 body 字体/背景——让 tokens.css 的默认值生效；页面级背景由 `page.tsx` 的 `bg-background-secondary` 控制。
- **metadata 静态导出**: `app/layout.tsx` 的 `export const metadata` 是静态的（英文 SEO 基线，品牌名「Learn Everything」），`NEXT_PUBLIC_BASE_URL` 环境变量控制 `metadataBase`（默认 `https://lernu.cc`）。Locale 不影响 metadata——门户内容文案的本地化由 `page.tsx` 内的 `t()` 负责。
- **React Compiler** 已启用（`reactCompiler: true` in `next.config.ts`）——不要手写 `useMemo`/`useCallback`/`memo()`。
- **路径别名** `@/*` → `./src/*`（tsconfig paths）。
- **Default exports** for page components, **named exports** for lib/component utilities。

## 反模式（禁止）

- `as any` / `@ts-ignore` / `@ts-expect-error`：绕过类型系统
- Barrel 聚合导入 `@goddonebianu/design-system`（裸导入）：必须用 subpath（`@goddonebianu/design-system/button`）
- 内联 SVG 图标：用 `lucide-react`
- 原生 `confirm()` / `prompt()` / `alert()`
- 手动 `useMemo` / `useCallback` / `memo()`：React Compiler 自动处理
- 渲染阶段调用 `setState` / 读写 `localStorage` / `window` / `document`：浏览器 API 只能在 `useEffect` 或事件处理函数中用（跨子域回流在事件处理函数里读 `window.location.href` 是合法的）
- `.then()` 无 `.catch()`：用 `async/await` + try/catch，或链式 `.catch()`
- 复制粘贴 `@goddonebianu/design-system` 原语为本地组件：直接 import 原语
- **改 auth schema 不跑 `pnpm db:push-safe`**：宿主推 auth DDL 必须先过 `lint:auth-schema-drift`，且要同时推 dev（`.env`）和 prod（`.env.production`）两库
- **消费者镜像漂移**：若改了 auth schema 的 identity 列或新增 auth 表，**必须同步通知 learn-languages / learn-together 更新镜像**，否则消费者的 `db push` 会静默 drop 未镜像的表（如 AuthEvent）
- 给某 locale 新增 i18n key 而不补全所有 `SUPPORTED_LOCALES`：`lint:i18n` 强制翻译完整性（缺失 / 空值占位符永远失败，不走 baseline）
- 在认证流程里裸 try/catch 吞异常：`recordAuthEvent` 的 try/catch 是「审计失败不阻断 auth」的特例（带 log），其余认证路径错误必须显式处理

## 命令

```bash
pnpm dev                  # next dev
pnpm build                # next build
pnpm start                # next start
pnpm lint                 # eslint
pnpm lint:auth            # server action 认证守卫扫描（// @public 豁免公开函数）
pnpm lint:auth-schema-drift # auth schema 漂移自检
pnpm lint:max-lines       # 400 行文件上限
pnpm lint:i18n            # AST-based i18n 死键 + 翻译完整性（--check）
pnpm typecheck            # tsc --noEmit
pnpm db:push-safe         # lint:auth-schema-drift && prisma db push（守卫在前）
pnpm db:push              # prisma db push（无守卫，慎用）
pnpm format               # prettier --check .
pnpm format:fix           # prettier --write .
```

Husky `pre-commit` 运行 `lint-staged`（eslint on `*.{ts,tsx}`，prettier --check on `*.{ts,tsx,css,json,md}`）。

## i18n lint 维护

- `pnpm lint:i18n` 是 CI gate（任何回归 exit 1）。
- 新增的合法未用键（暂时没用到但要保留）：跑 `pnpm tsx scripts/lint/find-unused-i18n-keys.ts --update-baseline` 把它加入 `i18n-unused-baseline.json`。
- 清理确认无用的键：跑 `pnpm tsx scripts/lint/find-unused-i18n-keys.ts --delete-unused`（从所有 locale 删除 + 清空 baseline）。
- 基线里的键若已重新被使用（stale），lint 会提示，跑 `--update-baseline` 收缩基线。

## 子站接入 checklist（新增子站时）

1. 在 `app/page.tsx` 的 `PROJECTS` 数组加一项：`{ href, titleKey, descKey, icon }`。
2. 在 **所有 8 个** `messages/*.json` 的 `home` 命名空间同时加 `titleKey` / `descKey` 两个键（`lint:i18n` 强制全 locale 完整）。
3. `icon` 从 `lucide-react` 选一个语义匹配的。
4. 若新子站是 auth 消费者，把它的 origin 加进 `src/lib/auth/index.ts` 的 `trustedOrigins` + `src/lib/safe-subdomain-redirect.ts` 的放行 origin 集合。
5. 跑 `pnpm lint:i18n && pnpm lint:auth && pnpm build` 验证。

## 部署

Vercel，框架选 Next.js。根域名 `lernu.cc`。子域名 DNS 各自指向对应子站的 Vercel project。**必需环境变量**（见 `.env.example`）：`DATABASE_URL`（共享 Postgres）、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`（`https://lernu.cc`）、`SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`。`NEXT_PUBLIC_BASE_URL` 可选（默认 `https://lernu.cc`，控制 `metadataBase`）。改 `BETTER_AUTH_SECRET` 必须同步改两消费者的同环境值，否则 SSO token 跨 app 解析失败。
