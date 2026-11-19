import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Collapse,
  Input,
  Row,
  Space,
  Statistic,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  CopyOutlined,
  DashboardOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { openApi } from '@/api';

const { Title, Paragraph, Text } = Typography;

/** 根据运行环境推导 API 前缀。 */
function resolveApiBase(): string {
  const origin = window.location.origin;
  const prefix = import.meta.env.PROD ? `${origin}/experience/api/v1` : `${origin}/api/v1`;
  return prefix;
}

/** 生成可直接复制给 AI 的提示词。 */
function buildPrompt(apiBase: string): string {
  const submit = `${apiBase}/open/experiences`;
  const meta = `${apiBase}/open/meta`;
  const list = `${apiBase}/open/experiences`;
  const search = `${apiBase}/open/search`;
  return `你是「经验沉淀」站点的助手。通过开放接口完成经验的写入与读取，无需令牌。

## 接口信息
- 基础地址：${apiBase}
- 写入：POST ${submit}（新建经验）
- 元数据：GET ${meta}（分类 / 封面预设）
- 读取列表：GET ${list}?page=1&page_size=20
- 读取详情：GET ${list}/{id}
- 读取正文：GET ${list}/{id}/html
- 读取封面：GET ${list}/{id}/cover
- 搜索：GET ${search}?q=关键词
- 鉴权：无。开放接口免令牌，可直接调用；写入统一归属到站主账号。

## 提交前准备（可选但推荐）
1. 调用 GET ${meta} 获取已有分类列表（category_id / category_name）与封面预设 key（cover_preset）。
2. 根据用户输入判断应归入哪个分类；若用户未指定，提交时只传 title + html 即可，系统会自动归入「草稿」。

## 提交字段（POST ${submit}，multipart/form-data）
- title（必填）：经验标题，1–120 字
- html（必填）：经验正文，直接传 HTML 字符串，例如 <h1>标题</h1><p>内容…</p>。默认只传 HTML 文本，不要传文件
- summary（可选）：一句话简介，≤255 字
- category_id（可选）或 category_name（可选）：二选一。category_name 指定的分类不存在时服务端会自动新建；都不传则归入「草稿」
- group_name（可选）：该分类下的分组名，不存在会自动新建
- cover_preset（可选）：封面预设 key，取自 meta 返回的列表（如 neon-grid）

## 正文 HTML 规范
- 用语义化标签组织内容：标题用 h1/h2、段落用 p、列表用 ul/ol/li、代码用 pre/code、引用用 blockquote。
- 图片用 <img src="https://..."> 引用可公开访问的 URL。
- 不要包裹 <html>/<head>/<body> 外层，只提交正文片段。
- 保持内容干净，避免多余内联 style 与脚本。

## 调用示例（curl）
# 示例一：完整提交（指定分类 + 封面）
curl -X POST '${submit}' \\
  -F 'title=我的经验标题' \\
  -F 'category_name=技术笔记' \\
  -F 'summary=一句话简介' \\
  -F 'html=<h1>正文标题</h1><p>这里是经验正文内容。</p>' \\
  -F 'cover_preset=neon-grid'

# 示例二：最简提交（仅 title + html，自动归入「草稿」）
curl -X POST '${submit}' \\
  -F 'title=我的经验标题' \\
  -F 'html=<h1>正文标题</h1><p>这里是经验正文内容。</p>'

## 读取经验（当用户想查找/查看已有经验时）
# 列表（分页，按发布时间倒序）
curl '${list}?page=1&page_size=20'
# 单条元数据
curl '${list}/{id}'
# 读取报告详情页完整 HTML（自包含：含 <!DOCTYPE>/内联CSS/JS/交互组件，与站内详情页一致）
curl '${list}/{id}/html'                    # 内联展示：浏览器打开此 URL 即可完整渲染，也可 <iframe src="此URL">
curl '${list}/{id}/html?download=true'      # 下载：保存为 {id}.html
# 搜索（mode=meta 只搜标题/简介，content 含正文）
curl '${search}?q=关键词&mode=content&limit=20'
读取列表返回 {items,total,page,page_size,has_more}；每条含 html_url（可直接展示的地址）。
正文接口返回完整 HTML 文档：浏览器直接打开 URL 即完整展示；curl/fetch 得到源码可自行保存或渲染。

## 完成标准与反馈
- 写入：返回 HTTP 200 且响应里包含经验的 id、title 即视为成功。把返回的标题与编号反馈给用户，例如：「已为你沉淀经验《xxx》，编号 {id}」。
- 只要 title 与 html 完整即可提交，分类为可选。
- 读取：把找到经验的标题与 id 反馈给用户；正文可直接展示 HTML。
- 若返回 4xx（如 400 表示缺字段）：先确认 title 与 html 是否完整，必要时补全后重试，不要盲目重复相同请求；若返回 5xx，请提示用户稍后重试。`;
}

export default function SettingsPage() {
  const [stats, setStats] = useState<{ total_calls: number; today_calls: number } | null>(null);
  const apiBase = useMemo(resolveApiBase, []);

  const refreshStats = () => {
    openApi
      .getStats()
      .then(setStats)
      .catch(() => setStats({ total_calls: 0, today_calls: 0 }));
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const copy = (text: string, okText = '已复制到剪贴板') => {
    const fallback = () => {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.top = '-9999px';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      try {
        document.execCommand('copy');
        message.success(okText);
      } catch {
        message.error('复制失败，请手动选择复制');
      }
      document.body.removeChild(el);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => message.success(okText),
        () => fallback(),
      );
    } else {
      fallback();
    }
  };

  const prompt = buildPrompt(apiBase);

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '8px 4px 40px' }}>
      <Title level={3} className="cy-neon-title" style={{ marginBottom: 4 }}>
        设置
      </Title>
      <Paragraph type="secondary">
        站点级配置与能力开关。当前仅站主可访问。
      </Paragraph>

      {/* ===== 开放平台 ===== */}
      <Card
        className="cy-card"
        style={{ marginTop: 16 }}
        title={
          <Space>
            <ApiOutlined style={{ color: 'var(--cy-neon-pink)' }} />
            <span>开放平台</span>
          </Space>
        }
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          开放平台提供免令牌开放接口：让 AI（ChatGPT / Claude / 任意支持 HTTP 调用的智能体）既能把经验文档（HTML）
          提交入库，也能分页读取、搜索已有经验。下方展示调用统计、接口文档，以及可直接复制给 AI 的提示词。
        </Paragraph>

        {/* 调用统计 */}
        <div
          style={{
            background: 'rgba(124, 92, 255, 0.06)',
            border: '1px solid rgba(124, 92, 255, 0.2)',
            borderRadius: 12,
            padding: '18px 20px',
            marginBottom: 18,
          }}
        >
          <Space align="center" style={{ marginBottom: 10 }} size={8}>
            <DashboardOutlined style={{ color: 'var(--cy-neon-cyan)' }} />
            <Text strong style={{ fontSize: 13, letterSpacing: '0.04em' }}>
              接口调用统计
            </Text>
            <Button
              size="small"
              type="text"
              icon={<RedoOutlined />}
              onClick={refreshStats}
              style={{ marginLeft: 4 }}
            >
              刷新
            </Button>
          </Space>
          <Row gutter={24}>
            <Col xs={12} sm={8}>
              <Statistic
                title="当日调用次数"
                value={stats?.today_calls ?? 0}
                valueStyle={{ color: 'var(--cy-neon-cyan)', fontWeight: 600 }}
              />
            </Col>
            <Col xs={12} sm={8}>
              <Statistic
                title="累计调用次数"
                value={stats?.total_calls ?? 0}
                valueStyle={{ color: 'var(--cy-neon-pink)', fontWeight: 600 }}
              />
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ paddingTop: 2 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  统计范围：开放接口（/open/*）成功调用
                </Text>
              </div>
            </Col>
          </Row>
        </div>

        {/* 接口文档 */}
        <div style={{ marginTop: 20 }}>
          <Space align="center" style={{ marginBottom: 8 }} size={8} wrap>
            <Text strong style={{ fontSize: 13 }}>接口文档</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              免令牌 · 基础地址 {apiBase}
            </Text>
            <Button
              size="small"
              type="link"
              href={`${window.location.origin}/experience/docs`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: 0 }}
            >
              打开 Swagger 交互式文档 ↗
            </Button>
          </Space>

          <Collapse
            size="small"
            defaultActiveKey={['read']}
            items={[
              {
                key: 'read',
                label: <Text strong>读取数据接口（免令牌）</Text>,
                children: (
                  <div style={{ fontFamily: 'var(--cy-font-mono)', fontSize: 12, lineHeight: 1.9 }}>
                    <div><Text code>GET {apiBase}/open/experiences?page=1&amp;page_size=20</Text> — 经验列表（分页，按时间倒序）</div>
                    <div><Text code>GET {apiBase}/open/experiences/{'{id}'}</Text> — 单条元数据</div>
                    <div><Text code>GET {apiBase}/open/experiences/{'{id}'}/html</Text> — 报告详情页完整 HTML（可展示，见下）</div>
                    <div><Text code>GET {apiBase}/open/experiences/{'{id}'}/cover</Text> — 封面图</div>
                    <div><Text code>GET {apiBase}/open/search?q=关键词&amp;mode=content</Text> — 全文搜索（meta 仅元数据）</div>
                    <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
                      列表返回 {'{'}items, total, page, page_size, has_more{'}'}，每条含 html_url；搜索返回 {'{'}items(experience_id, snippet, score), query{'}'}。
                    </Paragraph>
                  </div>
                ),
              },
              {
                key: 'html',
                label: <Text strong>如何拉取并展示完整 HTML 报告详情页</Text>,
                children: (
                  <div style={{ fontSize: 12, lineHeight: 1.9 }}>
                    <Paragraph style={{ marginTop: 0, marginBottom: 8 }}>
                      <Text code>GET {apiBase}/open/experiences/{'{id}'}/html</Text> 返回的是<Text strong>完整 HTML 文档</Text>
                      （含 <Text code>&lt;!DOCTYPE html&gt;</Text>、内联 CSS/JS、图表与交互组件），与站内报告详情页完全一致。
                      列表/详情接口每条都带 <Text code>html_url</Text>，可直接使用。三种展示方式：
                    </Paragraph>
                    <div>① <Text strong>浏览器直接打开</Text>：把 <Text code>html_url</Text> 作为链接，或 <Text code>window.open(url)</Text>，按 text/html 完整渲染。</div>
                    <div>② <Text strong>iframe 嵌入自己的系统</Text>：<Text code>&lt;iframe src="{apiBase}/open/experiences/"+id+"/html" width="100%" height="800px"&gt;&lt;/iframe&gt;</Text>。</div>
                    <div>③ <Text strong>程序拉取源码</Text>：<Text code>curl url &gt; report.html</Text> 保存，或前端 fetch 后自行渲染。</div>
                    <div>④ <Text strong>下载为文件</Text>：<Text code>url + '?download=true'</Text> 触发浏览器保存为 {'{'}id{'}'}.html。</div>
                    <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
                      注意：HTML 内含 &lt;script&gt; 交互逻辑。若用 iframe 展示无需处理；若注入自有页面请用沙箱 iframe 或先做安全过滤。
                    </Paragraph>
                  </div>
                ),
              },
              {
                key: 'write',
                label: <Text strong>写入与元数据接口（免令牌）</Text>,
                children: (
                  <div style={{ fontFamily: 'var(--cy-font-mono)', fontSize: 12, lineHeight: 1.9 }}>
                    <div><Text code>POST {apiBase}/open/experiences</Text> — 新建经验（multipart/form-data）</div>
                    <div><Text code>GET {apiBase}/open/meta</Text> — 分类与封面预设列表</div>
                    <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
                      字段：title / html / summary / category_id / category_name / group_name / cover_preset；详情见下方 AI 提示词。
                    </Paragraph>
                  </div>
                ),
              },
              {
                key: 'curl',
                label: <Text strong>curl 调用示例</Text>,
                children: (
                  <Input.TextArea
                    readOnly
                    value={[
                      `# 经验列表`,
                      `curl '${apiBase}/open/experiences?page=1&page_size=20'`,
                      ``,
                      `# 拉取报告详情页完整 HTML（浏览器打开此 URL 即完整展示）`,
                      `curl '${apiBase}/open/experiences/{id}/html' > report.html`,
                      `# 下载为附件 / iframe 内嵌用同一个 URL（加 ?download=true 可下载）`,
                      `curl '${apiBase}/open/experiences/{id}/html?download=true' -o report.html`,
                      ``,
                      `# 搜索`,
                      `curl '${apiBase}/open/search?q=AI&mode=content&limit=10'`,
                      ``,
                      `# 新建经验`,
                      `curl -X POST '${apiBase}/open/experiences' \\`,
                      `  -F 'title=标题' \\`,
                      `  -F 'html=<h1>正文</h1>' \\`,
                      `  -F 'category_name=技术笔记'`,
                    ].join('\n')}
                    autoSize={{ minRows: 10, maxRows: 20 }}
                    style={{ fontFamily: 'var(--cy-font-mono)', fontSize: 12, lineHeight: 1.6 }}
                  />
                ),
              },
            ]}
          />
        </div>

        {/* 给 AI 的提示词 */}
        <div style={{ marginTop: 24, borderTop: '1px solid rgba(124, 92, 255, 0.15)', paddingTop: 18 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            给 AI 的提示词（一键复制，粘贴给智能体即可调用）
          </Text>
          <Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 10 }}>
            把下面这段提示词完整复制，粘贴给任意支持 HTTP 调用的 AI。开放接口无需令牌，它会直接把经验
            整理成 HTML 并提交。
          </Paragraph>
          <Input.TextArea
            readOnly
            value={prompt}
            autoSize={{ minRows: 16, maxRows: 40 }}
            style={{
              fontFamily: 'var(--cy-font-mono)',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          />
          <Button
            icon={<CopyOutlined />}
            type="primary"
            style={{ marginTop: 8 }}
            onClick={() => copy(prompt, '提示词已复制，去粘贴给 AI 吧')}
          >
            复制提示词
          </Button>
        </div>
      </Card>
    </div>
  );
}
