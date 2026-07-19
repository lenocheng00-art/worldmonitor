# WorldMonitor V2.0.2 — Provision Staging and Complete Validation

## 1. 执行结论

**CONDITIONAL GO**

最关键依据：

1. 独立 Supabase Staging、真实 migration、167/167 schema 检查和三角色 RLS（0 skipped）全部通过。
2. 真实 API/数据库/Cron/浏览器链路通过；重复 Source、Observation、Confidence 和 Committee 均为 0 duplicate，浏览器 console error 为 0。
3. TSM/WDC event-window metric 因缺 verified event reference 保持 paused；按验收定义属于可信数据条件下的 Conditional GO。

## 2. Staging Provisioning

| 项目 | 结果 |
| --- | --- |
| Staging 类型 | 独立远程 Supabase + 本地 Next.js Staging app |
| Project host | `esanlgybhxabrlbsijpf.supabase.co` |
| Project ref | `esanlgybhxabrlbsijpf` |
| Region | Singapore / `ap-southeast-1` |
| 与 Production 隔离 | 是；不同 ref、API host、DB host 和 credentials |
| 创建方式 | 已登录 Supabase Dashboard |
| Safe guard | PASS |
| Production 数据复制 | 0 |

## 3. Migration

| 项目 | 结果 |
| --- | --- |
| 空库 | PASS；11/11 required tables |
| V1.8 fixture | PASS；历史 ID、相同 sourcePostId 边界、空 JSON、旧 status 全部保留/回填 |
| Reset/replay | PASS；两次完整重放 |
| Recovery | PASS；事务失败完全回滚，随后迁移成功 |

## 4. Schema

- 检查项：167
- 通过/失败：167/0
- RLS tables：11
- Policies：13
- Required indexes：8/8
- Function search path：`public`，PASS
- Grants：anon/authenticated/service_role 均符合设计

## 5. RLS

| 权限 | anon | authenticated | service_role |
| --- | --- | --- | --- |
| 旧 Signal Inbox 读取 | 允许 | 允许 | 允许 |
| Research 表读取 | 拒绝/0 rows | 允许 | 允许 |
| Signal/Research 写入 | 全部拒绝 | 全部拒绝 | 全部允许 |
| RPC attach | 拒绝 | 拒绝 | 允许 |
| Cron secret | 缺失 403、错误 401 | 同左 | 正确 secret 200 |

## 6. API 与数据库 E2E

- 首次处理：4 Signals、1 Logic Chain、4 Metrics、1 Committee Object。
- 重复处理：连续两次新增 0，全部 scoped counts 不变。
- 旧 Chain Attach：后续反证附加原 Chain，`contradicting`，new chain 0，confidence 34.25 → 26.25。
- Metric Run：MU、SKHY 真实执行成功；TSM/WDC 明确 `data_unavailable` 且未创建错误 observation。
- Cron：鉴权、并发锁、幂等和单 provider failure isolation 通过。
- Database：5 Signals、5 relations、5 metrics、3 observations、5 evidence、4 confidence events、1 Committee Object、4 versions；orphan=0。

## 7. Browser

| 页面/操作 | 结果 |
| --- | --- |
| Signal Inbox | PASS |
| Logic Chains | PASS |
| Logic Chain Detail | PASS |
| Committee | PASS |
| Pause/Resume | PASS |
| Manual Attach/restore | PASS |
| Review Required | PASS |
| Console errors | 0 |
| Network/RLS errors | 0 |

## 8. 指标

| Metric | Result |
| --- | ---: |
| Atomic Signal Precision | 100% |
| Atomic Signal Recall | 94.29% |
| Logic Chain Attachment Precision | 100% |
| Duplicate Logic Chain Rate | 0% |
| Offline Metric Compilation Success Rate | 100% (4/4) |
| Automatic Execution Eligibility Rate | 50% (2/4) |
| Live Metric Execution Success Rate | 100% (2/2 MU/SKHY) |
| Live Metric Data Accuracy | 100% |
| Live Provider Availability | 100% (7/7) |
| Invalid Metric Rejection Rate | 100% |
| Confidence Update Correctness | 100% |
| Idempotency Pass Rate | 100% |
| Committee Duplicate Rate | 0% |
| Narrative False Positive | 0% |

## 9. 测试

| Command | Exit | Passed | Failed | Skipped | 关键结果 |
| --- | ---: | ---: | ---: | ---: | --- |
| `npm run assert:safe-staging` | 0 | 1 | 0 | 0 | ref/host/secrets presence isolated |
| `npm run migrate:research:staging` | 0 | 4 stages | 0 | 0 | empty, fixture, replay, recovery |
| schema validator | 0 | 167 | 0 | 0 | 100% |
| `npm run test:research:staging` | 0 | 1 | 0 | 0 | real RLS matrix |
| `npm run smoke:research:market` | 0 | 7 symbols + 2 derived | 0 | 0 | live public data |
| API/Cron E2E | 0 | 16 checks | 0 | 0 | real Staging |
| persistence verification | 0 | 1 snapshot | 0 | 0 | orphan=0 |
| Browser E2E | PASS | 4 pages + operations | 0 | 0 | console=0 |
| `npm run lint` | 0 | PASS | 0 | 0 | warnings=0 |
| `npm run typecheck` | 0 | PASS | 0 | 0 | TypeScript clean |
| `npm test` | 0 | 53 | 0 | 0 | full unit/integration suite |
| `npm run build` | 0 | PASS | 0 | 0 | Next production build |

## 10. 安全确认

- `main`：未修改。
- Production Supabase connection/write：0/0。
- Production deployment：未执行。
- Production Vercel env/Cron：未修改。
- Branch：`experiment/research-tracking-v2.0.2-staging-complete`。
- `.env.staging.local`：Git ignored、mode `0600`。
- Secrets：未写入报告、日志或 Git。
- 仅 Staging 发生 schema/Auth/API 测试写入。

## 11. 已知限制

- TSM/WDC 需要 verified event reference 后才能自动执行。
- Yahoo Finance 可用性无 SLA；本次为 7/7。
- SKHY 可用近期历史较短，但满足本次五期规则。
- Gold Dataset 为 60 atomic units / 6 source posts，来源多样性仍低于 12-source 目标。
- Staging 未复制 Production 历史体量，不能代表 Production 大数据量性能。
- 浏览器使用本地 Next.js + remote Staging；未创建 Vercel Preview。

## 12. 下一步建议

**允许进入 Production Shadow Mode**

Shadow Mode 仍应保持正式 Production 写入关闭，并先补齐 event-window verified references 与观察性指标。
