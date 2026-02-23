# Jarvis Triage Protocol Spec

> Version 0.1 — 2026-02-23

本文档定义 Jarvis Triage 系统中上游系统与 HUD 客户端之间的数据协议。

---

## 1. 概述

```
上游系统                Relay Server              HUD 客户端 (Even G2)
─────────              ────────────              ──────────────────
    │                       │                           │
    │  POST /push           │                           │
    │  (TriagePayload)      │                           │
    │ ─────────────────────>│                           │
    │                       │  WS: ServerMessage        │
    │                       │  { type: "payload" }      │
    │                       │ ─────────────────────────>│
    │                       │                           │  用户操作
    │                       │  WS: ClientMessage        │
    │                       │  { type: "decision" }     │
    │                       │<───────────────────────── │
    │                       │                           │
```

- **传输**: WebSocket (JSON text frames)
- **编码**: UTF-8
- **心跳**: Server 每 30s 发 `ping`，Client 回 `pong`

---

## 2. TriagePayload（下行数据）

上游系统通过 `POST /push` 向 Relay 提交一个 `TriagePayload` JSON，Relay 包装为 `ServerMessage` 广播给所有连接的客户端。

### 2.1 完整字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `level` | `0 \| 1 \| 2 \| 3 \| 4` | **必须**。分诊级别 |
| `title` | `string` | **必须**。一行标题，所有 level 通用 |
| `source` | `string` | 可选。来源标识，由上游自定义（如 `"claude-code"`, `"ci"`, `"home-assistant"`） |
| `summary` | `string` | 可选。压缩摘要，L3/L4 显示 |
| `hudLines` | `string[]` | 可选。HUD 正文内容，每条是一行显示文本 |
| `decisions` | `Decision[]` | 可选。决策点数组 |
| `risks` | `string[]` | 可选。风险标注列表，L4 显示 |

#### Decision

| 字段 | 类型 | 说明 |
|---|---|---|
| `question` | `string` | **必须**。决策问题 |
| `options` | `DecisionOption[]` | **必须**。选项列表，建议 max 3 |

#### DecisionOption

| 字段 | 类型 | 说明 |
|---|---|---|
| `label` | `string` | **必须**。选项显示文本 |
| `description` | `string` | 可选。选项补充说明 |

### 2.2 各 Level 字段约束

每个 Level 对字段有不同要求。**必须 = 缺失会导致渲染异常，建议 = 缺失可工作但体验下降。**

#### Level 0 — 静默

不产生任何 HUD 输出。记录日志后丢弃。

| 字段 | 要求 |
|---|---|
| `level` | 必须 (`0`) |
| `title` | 必须（仅用于日志） |
| `source` | 可选 |
| 其他 | 忽略 |

语义：后台任务完成，用户不需要知道。

#### Level 1 — 通知

单行文本展示，无交互，无回传。

| 字段 | 要求 |
|---|---|
| `level` | 必须 (`1`) |
| `title` | 必须 |
| `hudLines` | **必须**（至少 1 条），`hudLines[0]` 作为显示内容 |
| `source` | 可选 |
| 其他 | 忽略 |

语义：告诉用户一件事，不需要操作。等同于电脑上的通知弹窗，看了就过。

#### Level 2 — 快速决策

一个问题 + 选项列表，用户点选后回传结果。

| 字段 | 要求 |
|---|---|
| `level` | 必须 (`2`) |
| `title` | 必须 |
| `decisions` | **必须**（恰好 1 个 Decision，含 2-3 个 option） |
| `hudLines` | 可选，覆盖默认问题文本显示 |
| `source` | 可选 |
| 其他 | 忽略 |

语义：简单二选一或三选一，用户不需要额外上下文就能判断。

#### Level 3 — 信息决策

带上下文的决策。比 L2 多一块背景信息区域。

| 字段 | 要求 |
|---|---|
| `level` | 必须 (`3`) |
| `title` | 必须 |
| `decisions` | **必须**（恰好 1 个 Decision，含 2-3 个 option） |
| `summary` 或 `hudLines` | **至少一个必须**，提供决策所需上下文 |
| `source` | 可选 |
| 其他 | 忽略 |

语义：需要背景信息才能做的选择。与 L2 的区别在于用户需要先理解上下文再决策。

#### Level 4 — 方案审批

多步骤串行审批流。每个 Decision 依次呈现，全部完成后进入确认页。

| 字段 | 要求 |
|---|---|
| `level` | 必须 (`4`) |
| `title` | 必须 |
| `decisions` | **必须**（1 个或多个 Decision） |
| `summary` | 可选，overview 页显示 |
| `risks` | 可选，overview + confirmation 页显示 |
| `hudLines` | 可选 |
| `source` | 可选 |

语义：完整的方案审批，等同于电脑上逐步 review 一个 plan 然后点 approve/reject。

### 2.3 场景准入标准

不是所有信息都适合推到 HUD。推送到 G2 的信息必须**同时满足**：

1. **时效性** — 信息有行动时间窗口，不是"有空再看"就行
2. **低复杂度决策** — 用户能在 10 秒内理解并做出选择（最多 3 个选项）
3. **上下文自含** — 4 行文字能传达足够的决策依据，不需要查更多资料

不满足的信息应留在手机/电脑端处理。

### 2.4 显示约束

- HUD 画布: 576 x 288 像素
- 最大 4 个容器/页
- 每行建议 ≤ 20 个中文字符
- 不支持 emoji (U+1F600+)，用文本标记：`[OK]` `[!]` `[?]` `[i]`
- option 数量建议 ≤ 3（超过可滚动，但增加认知负荷）

---

## 3. ServerMessage（WS 下行）

```json
// 推送 payload
{ "type": "payload", "data": { /* TriagePayload */ } }

// 心跳
{ "type": "ping" }
```

---

## 4. ClientMessage（WS 上行 / 回传）

### 4.1 decision — 单个决策结果（L2/L3）

用户在 L2 或 L3 界面点选一个选项后发送。

```json
{
  "type": "decision",
  "source": "claude-code",
  "question": "Token存储方式",
  "selectedIndex": 0,
  "selectedLabel": "Cookie (安全/CORS麻烦)"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | `"decision"` | 固定值 |
| `source` | `string?` | 透传 payload 的 `source` |
| `question` | `string` | 原始问题文本 |
| `selectedIndex` | `number` | 选中的 option 下标 (0-based) |
| `selectedLabel` | `string` | 选中的 option 文本 |

### 4.2 approval — 审批结果（L4）

L4 审批流完成或用户主动暂缓时发送。

**批准：**
```json
{
  "type": "approval",
  "source": "claude-code",
  "approved": true,
  "decisions": [
    { "question": "Token存储方式", "selectedIndex": 0, "selectedLabel": "Cookie" },
    { "question": "Refresh策略", "selectedIndex": 0, "selectedLabel": "Rotation" }
  ]
}
```

**暂缓/拒绝：**
```json
{
  "type": "approval",
  "source": "claude-code",
  "approved": false,
  "decisions": []
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | `"approval"` | 固定值 |
| `source` | `string?` | 透传 payload 的 `source` |
| `approved` | `boolean` | `true` = 确认执行，`false` = 暂缓 |
| `decisions` | `DecisionResult[]` | 每个决策的结构化结果，暂缓时为空数组 |

#### DecisionResult

| 字段 | 类型 | 说明 |
|---|---|---|
| `question` | `string` | 原始问题文本 |
| `selectedIndex` | `number` | 选中的 option 下标 |
| `selectedLabel` | `string` | 选中的 option 文本 |

### 4.3 pong — 心跳响应

```json
{ "type": "pong" }
```

### 4.4 各 Level 回传行为

与电脑端行为保持一致：

| Level | 回传 | 说明 |
|---|---|---|
| L0 | 无 | 静默，等同于后台任务完成不通知 |
| L1 | 无 | 通知，等同于看了关掉 |
| L2 | `decision` | 等同于弹窗点选一个选项 |
| L3 | `decision` | 同 L2 |
| L4 批准 | `approval { approved: true }` | 等同于 review 完点 approve |
| L4 暂缓 | `approval { approved: false }` | 等同于点 reject/defer |

---

## 5. Relay Server HTTP API

### POST /push

接收 `TriagePayload` JSON，广播给所有 WS 客户端。

```
POST /push
Content-Type: application/json

{ "level": 2, "title": "选个时间", "source": "calendar", ... }
```

**响应：**
```json
{ "ok": true, "clients": 1 }
```

### GET /status

```json
{ "clients": 1 }
```

---

## 6. 接入示例

### 最简接入（curl）

```bash
# 推送一个 L1 通知
curl -X POST http://localhost:8080/push \
  -H 'Content-Type: application/json' \
  -d '{"level":1,"title":"构建完成","source":"ci","hudLines":["[OK] main #42 构建通过"]}'

# 推送一个 L2 快速决策
curl -X POST http://localhost:8080/push \
  -H 'Content-Type: application/json' \
  -d '{
    "level": 2,
    "title": "部署确认",
    "source": "deploy-bot",
    "decisions": [{
      "question": "部署到哪个环境？",
      "options": [{"label":"Staging"},{"label":"Production"}]
    }]
  }'

# 推送一个 L4 审批流
curl -X POST http://localhost:8080/push \
  -H 'Content-Type: application/json' \
  -d '{
    "level": 4,
    "title": "JWT迁移 Plan",
    "source": "claude-code",
    "summary": "7步迁移方案",
    "decisions": [
      {"question":"Token存储","options":[{"label":"Cookie"},{"label":"LocalStorage"}]},
      {"question":"刷新策略","options":[{"label":"Rotation"},{"label":"Silent Refresh"}]}
    ],
    "risks": ["数据迁移不可逆，需先备份"]
  }'
```

### 监听回传（WebSocket）

```js
const ws = new WebSocket('ws://localhost:8080');
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === 'decision') {
    console.log(`用户选择: ${msg.question} → ${msg.selectedLabel}`);
  }
  if (msg.type === 'approval') {
    console.log(`审批结果: ${msg.approved ? '批准' : '暂缓'}`);
  }
};
```
