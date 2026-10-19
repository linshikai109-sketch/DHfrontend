# 后端接入契约与缺口

本包只定义前端适配目标；云端 PoC 不被视为正式后端，也未要求适配其特殊业务。

| 接口 | 请求 | 成功响应 |
| --- | --- | --- |
| GET `/api/snapshot` | 无个人信息查询参数 | 完整 `Snapshot`，schema=1、runtimeProfile=connected |
| POST `/api/commands` | 原始 `{operationId, role, command}`，`Idempotency-Key` 等于 operationId | 原子提交后的完整 Snapshot |
| GET `/api/operations/:id` | 编码后的原 operationId | 原 Operation；权威未知返回 404 |

HTTP 非 2xx、超时、响应丢失、无效数据均不会被当成成功。错误响应正文不写日志、不展示。失败操作需持久化 failed 回执；成功操作需持久化 succeeded 回执。回执成功后还需取得完整快照才能清理前端日志。过期 revision 拒绝覆盖。

必需后端保证：

1. operationId 持久化且绑定原 role/command；相同 id/相同请求安全重放，相同 id/不同请求明确拒绝；业务写入和回执原子提交。并发请求也遵守此约束。用户点击“重试原操作”可能再次 POST 相同请求，绝不能产生第二次业务变更。
2. 回执保留期、404 的含义、超时/进行中状态及最终一致性策略需商定。目前适配仅认识 succeeded/failed 与 404；不自动重放、不自动创建新 id。
3. Snapshot 全量字段遵循 `src/domain/types.ts` 和 `isPersistedSnapshot(...,'connected')`；其中有原始业务结构检查。不是任意 PoC JSON。Snapshot revision 应在同一用户会话内单调递增。
4. 身份应由后端认证决定，不能信任前端 role；授权、租户隔离、会话过期及 CSRF/CORS 尚未实现/确认。当前请求 credentials=omit，无 token 配置。
5. 当前仅本机模拟允许。正式 HTTPS origin、认证、数据最小化、姓名/个人信息是否出端和模型/语音边界必须先确认，再修改传输限制。禁止在 VITE_* 保存密钥。
6. 待确认跨标签页并发、后端 revision 冲突响应、幂等保留期与前端 journal 保留期、多设备恢复、生产可观测性及日志脱敏。现有本地单标签防重复提交不等于跨设备并发控制。

目前缺少真实后端地址与可验证实现、认证合同、生产环境配置，以及批准的数据边界。没有读取导出密钥、真实数据库或调用外部模型。没有真实后端联调证据。

未来上线前的运行验收：由接入负责人在测试环境检查 INVALID_RESPONSE、STALE_RESPONSE、NETWORK_UNAVAILABLE、持续 pending 的数量与恢复成功率；日志只记脱敏 operationId/错误码，不记录姓名、命令内容或报告。发布后首先检查首次加载/提交/刷新恢复，持续观察首个工作日；出现重复执行、回执丢失或资料外发立即停止接入并恢复 mock 配置。此处仅为后续计划，未执行上线。

连接模式由合法mode查询参数保持，改变模式需整页重新打开；根入口参数丢失缺陷已在修订版修复。此次运行只联通本机合成服务，正式后端缺口保持不变。
