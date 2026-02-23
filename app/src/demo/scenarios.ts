import type { TriagePayload } from '../types';

/**
 * 5 hardcoded demo scenarios — one per triage level.
 *
 * NOTE: G2 firmware fonts do NOT support emoji (U+1F600+).
 * Use plain text markers instead: [OK], [!], [?], etc.
 */
export const scenarios: TriagePayload[] = [
  // ── Level 0: Silent ────────────────────────────────────────
  {
    level: 0,
    title: '定时备份已完成',
    summary: 'Cron job 执行成功，无需操作。',
  },

  // ── Level 1: Notify ────────────────────────────────────────
  {
    level: 1,
    title: '通知',
    hudLines: ['[OK] 邮件已发送 -> 张三'],
    summary: '确认邮件已发送给张三，主题"会议确认"。',
  },

  // ── Level 2: Quick Decision ────────────────────────────────
  {
    level: 2,
    title: '[?] 课程直播时间',
    hudLines: [
      '[?] 课程直播时间',
      '选择一个时间段',
    ],
    decisions: [
      {
        question: '选哪天？',
        options: [
          { label: '周四 8pm (需调会)', description: '周四晚8点，需要调开另一个会议' },
          { label: '周五 8pm (无冲突)', description: '周五晚8点，目前没有冲突' },
        ],
      },
    ],
    summary: '两个可选时段。周四晚8点有冲突但可调，周五晚8点无冲突。',
  },

  // ── Level 3: Info Decision ─────────────────────────────────
  {
    level: 3,
    title: '[i] 云服务商选择',
    hudLines: [
      '[i] 云服务商选择',
      'Next.js + PostgreSQL',
      '流量中等',
    ],
    decisions: [
      {
        question: '选哪个服务商？',
        options: [
          { label: 'AWS $2400/y 最全', description: '服务最全但学习曲线陡' },
          { label: 'Vercel $1200/y 最易', description: '部署简单但vendor lock-in' },
          { label: 'Railway $800/y 性价比', description: '性价比好但社区较小' },
        ],
      },
    ],
    summary: '三家云服务商报价对比，均支持 Next.js + PostgreSQL。',
  },

  // ── Level 4: Plan Approval ─────────────────────────────────
  {
    level: 4,
    title: 'JWT迁移 Plan (7步)',
    summary: '将用户认证从 Session 迁移到 JWT。安装依赖 -> JWT中间件 -> 登录接口 -> 数据迁移 -> 前端 -> 清理 -> 测试。',
    hudLines: [
      '[Plan] JWT迁移 (7步)',
      '2个决策点',
    ],
    decisions: [
      {
        question: 'Token存储方式',
        options: [
          { label: 'Cookie (安全/CORS麻烦)', description: 'HttpOnly Cookie，防XSS但需配CORS' },
          { label: 'LocalStorage (简单/XSS风险)', description: '实现简单但有XSS泄露风险' },
        ],
      },
      {
        question: 'Refresh策略',
        options: [
          { label: 'Rotation (更安全)', description: '每次刷新生成新token对' },
          { label: 'Silent Refresh (更简单)', description: '后台静默刷新，实现简单' },
        ],
      },
    ],
    risks: ['Step 4 数据迁移不可逆，需先备份数据库'],
  },
];
