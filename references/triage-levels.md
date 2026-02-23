# Triage Levels 详细定义与边界案例

## Level 0 - 静默

**判定条件:** 纯执行确认，用户不关心过程
**边界:** 如果有任何失败或异常，升级到 Level 1

示例:
- "定时备份已完成" → Level 0
- "Cron job 执行成功" → Level 0
- "定时备份失败" → 升级 Level 1

## Level 1 - 通知

**判定条件:** 用户应该知道，但不需要做任何操作
**输出:** 1行HUD + 语音1句话

示例输入:
> "邮件已发送给张三，主题:会议确认"

示例输出:
```
Triage Level: 1 - 通知

语音版:
邮件已经发给张三了。

HUD版:
L1: [OK] 邮件已发送 -> 张三

决策点:
无

压缩摘要:
确认邮件已发送给张三，主题"会议确认"。
```

## Level 2 - 快速决策

**判定条件:** 需要用户做简单选择(2-3选1)或确认
**输出:** 2-3行HUD + 语音2-3句

示例输入:
> "课程直播时间需要确定。周四晚8点和周五晚8点都可以，周四有另一个会议但可以调开，周五目前没有冲突。"

示例输出:
```
Triage Level: 2 - 快速决策

语音版:
课程直播时间要定一下，周四和周五晚8点都行。周五没冲突，周四的话要调一个会。

HUD版:
L1: [?] 课程直播时间
L2:   A: 周四 8pm(需调会)
L3:   B: 周五 8pm(无冲突)

决策点:
- 决策1: 选哪天? -> 周四 / 周五

压缩摘要:
两个可选时段。周四晚8点(有冲突但可调)，周五晚8点(无冲突)。
```

## Level 3 - 信息决策

**判定条件:** 需要了解背景信息才能做判断，但不是多步骤计划
**输出:** 3-4行HUD + 语音15-30秒
**典型场景:** 方案对比、报价评估、策略选择

示例输入:
> "分析了三个云服务商的报价:AWS年费约$2400，提供最全的服务但学习曲线陡；Vercel年费约$1200，部署最简单但vendor lock-in严重；Railway年费约$800，性价比最高但社区较小。你的项目目前是Next.js + PostgreSQL，流量中等。"

示例输出:
```
Triage Level: 3 - 信息决策

语音版:
三个云服务商帮你比了。AWS两千四最贵但最全，Vercel一千二部署最省事但锁定严重，Railway八百性价比最高但社区小。你的技术栈用哪个都行，主要看你更在意省钱还是省心。

HUD版:
L1: [i] 云服务商选择
L2: A: AWS $2400/y 最全
L3: B: Vercel $1200/y 最易
L4: C: Railway $800/y 性价比

决策点:
- 决策1: 选哪个服务商? -> AWS(最全)/ Vercel(最易)/ Railway(最省)

压缩摘要:
三家对比:
- AWS: $2400/年，服务最全，学习曲线高
- Vercel: $1200/年，Next.js原生支持，vendor lock-in
- Railway: $800/年，性价比好，社区较小
项目技术栈(Next.js + PostgreSQL)三家都支持。
```

## Level 4 - Plan 审批

**判定条件:** Claude Code Plan Mode 输出，或任何包含多个步骤且步骤间有依赖关系的实施计划
**输出:** 专用审批流程
**和 Level 3 的区别:** Level 3 是"选一个方案"，Level 4 是"审批一个执行计划里的多个决策点"

示例输入:
> (Claude Code Plan Mode 输出，45行)
> Plan: 将用户认证从 Session 迁移到 JWT
> 1. 安装 jsonwebtoken 和 bcryptjs 依赖
> 2. 创建 JWT 中间件 (middleware/auth.js)
>    - 需要决定 token 存储方式:HttpOnly Cookie vs LocalStorage
>    - Cookie 更安全(防XSS)但 CORS 配置更复杂
>    - LocalStorage 实现简单但有 XSS 风险
> 3. 重写登录接口 (routes/auth.js)
>    - 生成 access token (15min) + refresh token (7d)
>    - 需要决定 refresh 策略:Rotation vs Silent Refresh
> 4. 数据迁移脚本
>    - 备份现有 session 数据
>    - 为现有用户生成 JWT 密钥对
>    - [!] 此步骤不可逆，需要先备份数据库
> 5. 更新前端 Token 处理
> 6. 废弃 Session 相关代码
> 7. 编写集成测试
> ...(详细实现代码省略)

示例输出:
```
Triage Level: 4 - Plan审批

语音版:
认证迁移计划出来了，分7步。安装依赖、建JWT中间件、改登录接口、迁移数据、改前端、清理旧代码、写测试。有两个需要你决定的，一个是token存哪里，一个是刷新策略。另外数据迁移那步不可逆，执行前会先备份。

HUD版(第一个决策):
L1: [Plan] JWT迁移 Plan (7步)
L2: [?] 决策1/2: Token存储方式
L3:   A: Cookie(安全/CORS麻烦)
L4:   B: LocalStorage(简单/XSS风险)

决策点:
- 决策1: Token存储方式 -> Cookie(更安全但CORS复杂)/ LocalStorage(简单但有XSS风险)
- 决策2: Refresh策略 -> Rotation(更安全)/ Silent Refresh(更简单)

[!] 风险:
- Step 4 数据迁移不可逆，需先备份数据库

压缩摘要:
7步计划:
1. 安装 jsonwebtoken + bcryptjs
2. 创建 JWT 中间件 [决策:Token存储方式]
3. 重写登录接口 [决策:Refresh策略]
4. 数据迁移 [[!] 不可逆，需备份]
5. 更新前端 Token 处理
6. 废弃 Session 代码
7. 集成测试
```

## 边界案例

### QA 问答(Claude Code 提问)
Claude Code 有时不生成完整 Plan 而是先问问题。这种情况判定为 **Level 2**，直接呈现问题和选项。

### 混合输出(部分结果 + 部分需要决策)
如果输出既有已完成的结果又有待决策的内容，分别处理:已完成部分用 Level 1 通知，待决策部分按对应 Level 处理。

### 错误和失败
任何包含错误、失败、异常的输出，至少 **Level 1**。如果需要用户介入修复，升级到 **Level 2 或 3**。
