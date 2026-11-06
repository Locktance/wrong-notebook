/**
 * 导入 K12 知识图谱（cn-math-taxonomy）到 KnowledgeNode / KnowledgeEdge。
 *
 * 数据来源：prisma/data/kg/{topics.json,dependencies.json}
 * - 幂等：按 cnmId / (fromNodeId,toNodeId) upsert，可重复执行
 * - 不依赖 Prisma Client 的类型生成，直接用参数化 SQL（SQLite ON CONFLICT）
 *
 * 用法：node scripts/import-knowledge-graph.mjs
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 上游 domain → 应用内的学科 key */
const DOMAIN_SUBJECT = {
  '数与代数': 'math',
  '图形与几何': 'math',
  '统计与概率': 'math',
  '综合与实践': 'math',
  '语音': 'english',
  '词汇': 'english',
  '语法': 'english',
  '日常表达': 'english',
  '读写': 'english',
  '识字写字': 'chinese',
  '习作基础': 'chinese',
  '阅读理解': 'chinese',
  '拼音': 'chinese',
  '古诗文积累': 'chinese',
  '句子': 'chinese',
  '词语': 'chinese',
  '运动和相互作用': 'physics',
  '物质': 'physics',
  '能量': 'physics',
  '跨学科实践': 'physics',
  '生命科学': 'science',
  '物质科学': 'science',
  '技术与工程': 'science',
  '地球与宇宙科学': 'science',
  '中国古代史': 'history',
  '中国近代史': 'history',
  '中国现代史': 'history',
  '世界古代史': 'history',
  '世界近代史': 'history',
  '世界现代史': 'history',
  '地球与地图': 'geography',
  '世界地理': 'geography',
  '中国地理': 'geography',
  '生物体的结构层次': 'biology',
  '生物的多样性': 'biology',
  '植物的生活': 'biology',
  '人体生理与健康': 'biology',
  '生物与环境': 'biology',
  '遗传与进化': 'biology',
  '学校生活': 'politics',
  '公民与国家': 'politics',
  '生活与安全': 'politics',
  '社会规则': 'politics',
  '家庭与亲情': 'politics',
  '自然与环境': 'politics',
};

function subjectOf(domain) {
  return DOMAIN_SUBJECT[domain] ?? 'other';
}

function loadJson(rel) {
  const file = path.join(process.cwd(), 'prisma', 'data', 'kg', rel);
  return JSON.parse(readFileSync(file, 'utf8'));
}

async function importNodes(topics) {
  const rows = topics.map((t) => ({
    id: randomUUID(),
    cnmId: t.id,
    name: t.name,
    subject: subjectOf(t.domain),
    domain: t.domain ?? null,
    grade: typeof t.grade === 'number' ? t.grade : null,
    semester: t.semester ?? null,
    chapter: t.chapter ?? null,
    description: t.description ?? null,
    diagnosticQuestion: t.diagnostic_question?.question ?? null,
    diagnosticAnswer: t.diagnostic_question?.answer ?? null,
  }));

  const CHUNK = 200;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    for (const r of batch) {
      values.push('(?,?,?,?,?,?,?,?,?,?,?,?)');
      params.push(
        r.id, r.cnmId, r.name, r.subject, r.domain,
        r.grade, r.semester, r.chapter, r.description,
        r.diagnosticQuestion, r.diagnosticAnswer, new Date(),
      );
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "KnowledgeNode"
         ("id","cnmId","name","subject","domain","grade","semester","chapter","description","diagnosticQuestion","diagnosticAnswer","createdAt")
       VALUES ${values.join(',')}
       ON CONFLICT("cnmId") DO UPDATE SET
         "name"=excluded."name", "subject"=excluded."subject", "domain"=excluded."domain",
         "grade"=excluded."grade", "semester"=excluded."semester", "chapter"=excluded."chapter",
         "description"=excluded."description",
         "diagnosticQuestion"=excluded."diagnosticQuestion",
         "diagnosticAnswer"=excluded."diagnosticAnswer"`,
      ...params,
    );
    done += batch.length;
  }
  return done;
}

async function importEdges(deps) {
  const nodes = await prisma.knowledgeNode.findMany({ select: { id: true, cnmId: true } });
  const byCnm = new Map(nodes.map((n) => [n.cnmId, n.id]));

  let skipped = 0;
  const rows = [];
  for (const d of deps) {
    const from = byCnm.get(d.prerequisiteId);
    const to = byCnm.get(d.topicId);
    if (!from || !to || from === to) {
      skipped += 1;
      continue;
    }
    rows.push({
      id: randomUUID(),
      fromNodeId: from,
      toNodeId: to,
      strength: d.strength === 'soft' ? 'soft' : 'hard',
      reason: d.reason ?? null,
    });
  }

  const CHUNK = 200;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    for (const r of batch) {
      values.push('(?,?,?,?,?)');
      params.push(r.id, r.fromNodeId, r.toNodeId, r.strength, r.reason);
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "KnowledgeEdge" ("id","fromNodeId","toNodeId","strength","reason")
       VALUES ${values.join(',')}
       ON CONFLICT("fromNodeId","toNodeId") DO UPDATE SET
         "strength"=excluded."strength", "reason"=excluded."reason"`,
      ...params,
    );
    done += batch.length;
  }
  return { done, skipped };
}

async function main() {
  // 已导入过就跳过：旧安装升级时由启动脚本调用，避免每次启动重复写 3000+ 行
  const existing = await prisma.knowledgeNode.count().catch(() => 0);
  if (existing >= 3000) {
    console.log(`知识图谱已存在（${existing} 个节点），跳过导入`);
    return;
  }
  const topics = loadJson('topics.json');
  const deps = loadJson('dependencies.json');
  console.log(`读取 ${topics.length} 个节点、${deps.length} 条先修边`);

  const nodes = await importNodes(topics);
  console.log(`写入节点 ${nodes} 个`);

  const { done, skipped } = await importEdges(deps);
  console.log(`写入边 ${done} 条（跳过 ${skipped} 条：节点缺失或自环）`);

  const total = await prisma.knowledgeNode.count();
  const edgeTotal = await prisma.knowledgeEdge.count();
  console.log(`当前库内：${total} 节点 / ${edgeTotal} 边`);
}

main()
  .catch((error) => {
    console.error('导入失败：', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
