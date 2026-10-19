# R3 历史交接记录

本文件保留原 R3 交接说明，供追溯修订范围与历史验证使用。仓库整体介绍与当前运行方式见 [README](../README.md)。下文的“此次”“当前”等措辞均指原 R3 交付，不表示本次文档修订重新测试或部署；历史截图、scope.json 与运行日志未收入仓库。

# 前端交接 R3 — onboarding 隐藏一级功能导航

本R3替代旧交接包及R2。根入口mode修复保留；新增仅onboarding隐藏一级功能导航的布局修复。以本包和本说明作为当前交接基准；历史日志中的先前阻塞不代表当前结论。

本交接目录由保存的 R3 前端复制，原始源目录保留未改。GitHub 交接不包含部署配置或线上服务变更。

## 运行

Node22、npm10+：

```sh
npm ci --ignore-scripts
cp .env.example .env.local
npm run dev
npm test
npm run build
npm run preview
```

默认 `http://127.0.0.1:8932/mvp-ui/v2/?fixture=fresh` 使用浏览器本地合成 mock。VITE_BASE_PATH 支持环境文件和shell；VITE_*会进入前端包，不能放密钥。

本机真实 HTTP 契约验收（仍是合成后端）：

```sh
npm run mock-api
# 另一终端：
VITE_ENABLE_LOCAL_HTTP=true npm run dev
```

入口：`http://127.0.0.1:8932/mvp-ui/v2/?mode=connected`（默认Emma）；John为 `/mvp-ui/v2/john?mode=connected`。根入口、角色入口、内部导航及守卫现会保留合法mode和fixture；页面自己的overview/reopen/canvas等参数保持原页面语义，不跨页面粘附。仅接受mode=connected/demo_mock及现有fixture枚举，不把查询参数当成跳转URL。改变模式请整页重新打开URL，不承诺在同一运行实例里热切换模式。

模拟API只在127.0.0.1:8933监听，原createMockService驱动并保存在内存；重启清空状态。connected标记用于验证接口契约，不代表接入正式后端。只输入合成资料。

## 改造范围

- public实体化；依赖锁、Node/npm约束、环境示例、preview、静态部署参考。
- 独立HTTP ConnectedTransport，保留原 `{operationId,role,command}`，本机地址白名单、无凭据、拒绝重定向、超时和完整快照校验。
- 首次加载、失败重试、断线提示、刷新回执同步；原日志及单标签防重复继续生效。显式重试复用原操作身份；查询仍只读。
- R2模式修复新增RuntimeRouting边界与合法参数工具，在同一路径replace查询参数，保留hash/history state，不修改现有业务路由目的地。服务首次初始化使用同一参数规范化，避免重复/注入mode造成模式不一致。
- 实时语音识别入口关闭；原本地静默演示和语音球保持。没有真实模型、录音识别或远程后端开关。

第4项仍挂起：问答策略、目标门槛、报告确认、完成跳转的业务目标和Quest均未改变；保持既有视觉风格，仅按本次授权调整onboarding导航布局。R3只修改App.tsx的onboarding显示条件和main.tsx样式导入，并新增onboarding-shell.css；src/pages、领域规则和语音球绘制相对R2字节不变，原有业务路由目的地不变。

## 历史 R3 验证记录

以下为保存的 R3 交付记录；截图、运行日志和 scope.json 不包含在源码仓库中，引用路径仅用于定位原交付证据，不代表本次重新验收。

- `npm run build`通过；仍有原有大chunk与Jost资源构建警告，截图中现有页面正常显示。
- 51个测试文件、332项通过；原有47文件303项未删改，HTTP新增8项，路由保留10项、首次初始化3项，R3布局新增8项。最终详细报告无失败、pending或todo。
- Chrome无痕本机验收：Emma根入口→引导→合成第1题→双击继续→刷新第2题；John入口同样提交并刷新第2题。各自结果/工作台守卫保持connected；各保存1条合成答案。
- 真实loopback HTTP适配器验收通过：提交、防重复、提交后丢响应恢复、相同id重放不增加revision、failed回执、404后显式原请求重试、CORS预检。不是注入fetch内存响应；丢响应由验收脚本在真实HTTP提交之后主动模拟。
- 桌面截图1251×1020窗口；手机Chrome模拟390×844。截图在evidence/runtime-routing/。不等于实体手机或全页面全角色验收。
- 此前listen EPERM已定位为执行沙箱限制：最小同端口Node程序也失败；通过exec_command规范require_escalated审批后，原127.0.0.1:8932与8933均成功监听，没有改端口或系统安全设置。先前服务停止/重试截图和HTTP故障测试证据保留在独立运行证据包。
- 原目录292文件SHA-256校验修改数0，其中291个应用/静态资源文件和1个原评审记录。没有重新取得10月17日导出做新比对。

## 未覆盖与后续缺口

正式后端、认证、真实模型/语音、实体手机、全部页面/全部角色从头到尾业务流程、跨标签页/跨设备并发与服务器重启后的持久化恢复未验收。修改URL模式需要整页重开。后端必须具备原子幂等回执；见BACKEND-CONTRACT.md。

在线干净npm ci仍未验证：原镜像请求曾被网络沙箱拒绝，离线cache缺包；本次使用现存版本匹配的本地依赖副本完成检查，没有修改代理或绕过权限。nginx.conf.example仅作参考，未部署。

R3此次测试启动的前端和模拟服务已在交付前停止；不影响其他进程。所有真实模型/语音外部调用保持关闭，未读取密钥或真实用户数据库。

## R3布局范围与截图

Emma/John onboarding均不渲染工作台一级导航。John桌面折叠按钮、手机导航按钮及抽屉仅在非onboarding保留；问答期间shell侧栏宽度和padding-left归零，品牌回到正常header布局。右侧采集画板及其开合机制保留，问答占用释放空间。正常工作台的导航完全保留。没有修改问答内容、策略、目标门槛、报告确认、完成流程或语音球样式。

截图在evidence/r3/：John/Emma桌面与390×844手机问答；John正常工作台桌面导航、手机按钮与抽屉。桌面窗口1251×1020；手机为Chrome模拟，不是实体手机。工作台冒烟状态通过既有confirmContext命令准备合成数据，没有将其当成完整问答流程验收。

R3对旧App的改动是显示/布局条件，原始基线目录不变；详见scope.json。evidence/runtime-routing/与旧日志保留为历史证据，当前布局以evidence/r3/为准。
