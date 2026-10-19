# DHAI 双角色交互原型

DHAI 是一个围绕「整理资料 → 形成画像与分析 → 讨论下一步 → 管理计划与行动」展开的前端交互原型。Emma 面向个人用户，John 面向企业／项目负责人；两个角色共用状态与命令模型，分别呈现个人发展和项目推进的体验。

本仓库交付可运行的前端、合成演示数据、本机模拟 API 和后端接口契约。默认在浏览器本地运行，未接入正式后端、真实模型或语音识别服务。页面中的分析、建议、对话产物和演示语音由本地规则、样例与模拟流程驱动。

## 原型结构

### Emma：个人用户端

1. **角色入口**：进入或继续已有资料整理流程。
2. **Onboarding**：通过问答、草稿和补充资料整理个人经历、目标与条件；资料画板展示当前采集内容，支持查看和调整。
3. **发展分析与工作台**：完成采集后进入 `/emma/result`，首次概览与后续讨论共用工作台页面。可查看基于本地资料生成的演示分析、当前行动、计划、会话历史和讨论产物。
4. **我的路径**：查看、编辑目标和阶段节点，调整节点状态，预览拆分或延期建议。
5. **个人画像与资料**：查看画像，维护本地记忆、关联资料及已提交材料。

### John：企业／项目端

1. **角色入口与需求采集**：整理企业／项目背景、目标与条件，核对资料并确认当前上下文。
2. **工作台**：在讨论、当前任务和计划之间切换；本地提案支持预览、采纳、取消及相应撤销流程。
3. **项目蓝图**：按阶段和节点查看项目计划、依赖与完成标准；可编辑节点、预览延期影响，并关联模拟 Quest 草稿。
4. **企业概览与资料**：展示当前企业／项目画像，维护企业记忆与关联材料；另有个人画像的企业视角页面。

### 共享模块与模拟能力

| 模块 | 当前范围 |
| --- | --- |
| Quest | 两角色均有列表与详情，以及草稿、发布、参与、材料提交、审核和结果回填的本地模拟流程；另含只读案例预览。不是已上线的任务交易或真实多人协作服务。 |
| 会话与计划 | 会话历史、讨论产物、当前行动、计划提案及状态展示；内容来自本地演示逻辑。 |
| 资料与记忆 | 资料 URL 归属与状态、采集画板、个人／企业记忆、模拟任务附件；关联 URL 不代表已抓取、验证或经外部来源认证。 |
| 语音交互展示 | 保留语音球、字幕及本地静默演示。真实语音识别入口关闭，不代表具备在线录音、转写或模型对话能力。 |
| 状态恢复 | 浏览器本地保存、操作日志、单标签防重复提交，以及本机 HTTP 模式下的回执查询与重试。 |

上述内容描述代码中已有的原型页面和模拟交互，不代表全部角色、全部业务链路均已端到端验收。问答策略、目标门槛、报告确认与完成跳转相关的业务规则调整（原需求第 4 项）仍暂停；本次交接没有扩展这些规则或 Quest 业务。

## 页面入口

默认部署前缀为 `/mvp-ui/v2/`，根入口使用 Emma。下表路径均相对此前缀；未完成采集时，受保护的工作台、画像、路径及蓝图页面会按代码守卫返回 onboarding。

| 角色 | 入口 | 主要页面 |
| --- | --- | --- |
| Emma | `emma` | `emma/onboarding`、`emma/result`（分析概览／工作台）、`emma/path`、`emma/profile`、`emma/quest` |
| John | `john` | `john/onboarding`、`john/workbench`、`john/report`（项目蓝图）、`john/profile`、`john/personal-profile`、`john/quest` |

本地示例：

- Emma 新资料演示：<http://127.0.0.1:8932/mvp-ui/v2/?fixture=fresh>
- John 新资料演示：<http://127.0.0.1:8932/mvp-ui/v2/john?fixture=fresh>
- 发展分析样例：<http://127.0.0.1:8932/mvp-ui/v2/emma/result?fixture=v6&overview=1&reopen=1>
- 企业客户报表案例：<http://127.0.0.1:8932/mvp-ui/v2/john/onboarding?fixture=upwork-v1>

合法 `fixture` 为 `fresh`、`v5`、`v6`、`upwork-v1`，使用分开的本地演示存储命名空间；`fresh` 不表示每次打开都清空已有演示。设置中的重置操作会要求确认。合法运行模式为 `demo_mock` 和 `connected`；更换模式需要整页重新打开 URL。

## 技术栈与目录

React 19、TypeScript、React Router 7、Vite 6、Vitest 3；图标使用 Lucide，包含本地字体、语音视觉组件和对应第三方许可。

```text
src/
  main.tsx                  应用挂载、路由前缀与全局样式
  App.tsx                   双角色布局、导航、路由守卫与资料弹窗
  product.tsx               状态订阅、命令提交、恢复与连接提示
  context.ts                页面共享上下文
  pages/                    Onboarding、Workbench、PersonalPath、
                            Profile、Blueprint、Quests 等页面
  components/               采集画板、报告／计划组件、语音视觉与通用 UI
  domain/                   类型、命令、mock 服务、HTTP 适配、
                            回执／日志、画像／路径规则与合成 fixtures
  assets/                   品牌与角色视觉资源
public/fonts/               本地字体及许可
scripts/                    本机模拟 API、HTTP 契约检查与合成冒烟脚本
tests/                      领域规则、传输、路由和页面结构测试
BACKEND-CONTRACT.md          后端接口、幂等与数据边界要求
nginx.conf.example          静态托管及 SPA 回退配置参考
docs/HANDOFF-R3.md           历史交接范围、验证记录与已知缺口
```

`VisualExamples.tsx` 是源码中的视觉示例页面，不在当前 `App.tsx` 主路由表中；设置中的历史动效链接也不代表此仓库提供对应外部页面。

## 本地运行、测试与构建

需要 Node.js 22、npm 10+；版本约束见 `.nvmrc` 和 `package.json`。

```sh
npm ci --ignore-scripts
cp .env.example .env.local
npm run dev
```

默认服务只监听 `127.0.0.1:8932`。另开终端运行：

```sh
npm test
npm run build
npm run preview
```

`build` 先执行 TypeScript 检查，再生成 `dist/`；`preview` 同样使用 8932 端口，需先停止开发服务。依赖、构建产物和本地环境覆盖文件不纳入版本控制。

历史 R3 验证记录为 51 个测试文件、332 项通过，构建通过但保留大 chunk 与 Jost 资源警告；这不是本次文档修订重新执行的测试结果。此前在线干净 `npm ci` 未完成验证，详见历史交接记录。

## Mock 与后端接口边界

默认 `demo_mock` 使用浏览器 `localStorage` 保存合成演示状态。同一浏览器中的两个角色用于原型演练，不能替代真实认证、用户隔离或多人协作。

若要验证真实 loopback HTTP 传输，在两个终端分别启动：

```sh
# 终端一：仅内存保存的合成 API，重启后清空
npm run mock-api

# 终端二：启用本机 HTTP 适配
VITE_ENABLE_LOCAL_HTTP=true npm run dev
```

打开 <http://127.0.0.1:8932/mvp-ui/v2/?mode=connected>，John 使用 `/mvp-ui/v2/john?mode=connected`。必须同时启用环境开关并使用 `mode=connected`，才能使用该 HTTP 适配；仅添加查询参数不代表已连接正式后端。

| 接口 | 用途 |
| --- | --- |
| `GET /api/snapshot` | 获取完整工作区快照 |
| `POST /api/commands` | 提交 `{operationId, role, command}`，携带相同值的 `Idempotency-Key` |
| `GET /api/operations/:id` | 查询原操作的权威回执 |

适配器仅允许本机 HTTP 地址，默认 `http://127.0.0.1:8933/api/`；不携带凭据，拒绝重定向，并校验完整快照及 revision。正式后端必须提供原子幂等回执、认证与权限、持久化及数据边界，完整要求见 [BACKEND-CONTRACT.md](BACKEND-CONTRACT.md)。独立后端 PoC 不属于本仓库，也不视为已完成集成。

## 部署与交接

- `VITE_BASE_PATH` 控制构建路径，默认 `/mvp-ui/v2/`；托管目录、静态资源路径和 SPA fallback 必须一致。`nginx.conf.example` 仅为参考，使用前需按环境调整。
- 所有 `VITE_*` 变量都会进入浏览器包，不能放入密钥。仅提交无秘密的 `.env.example`，不要提交 `.env.local`、真实用户资料或运行日志。
- 真实模型／语音保持关闭；正式后端、认证、跨设备并发与持久化恢复尚未验收。本机单标签防重复提交不等于服务器并发控制。
- 仓库不包含原交接截图、历史运行日志、依赖缓存或 `dist/`。本次仅交接前端与契约，没有另外部署 Vercel、修改演示站或部署后端。
- 仓库既有自动 CI／部署是否执行，应以对应服务中的实际记录为准；没有检查记录不能视为通过。

近期导航布局与路由参数保留等修订范围，以及历史验收限制，见 [R3 交接记录](docs/HANDOFF-R3.md)。
