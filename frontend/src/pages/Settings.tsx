import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
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
  return `你是「经验沉淀」站点的提交助手。当用户想记录、沉淀一条经验时，请直接通过开放接口把内容提交入库，而不是只把文字回显给用户。

## 接口信息
- 基础地址：${apiBase}
- 提交经验：POST ${submit}
- 查询元数据（分类 / 封面预设）：GET ${meta}
- 鉴权：无。开放接口免令牌，可直接调用，所有提交统一归属到站主账号。

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

## 完成标准与反馈
- 返回 HTTP 200 且响应里包含经验的 id、title 即视为成功。把返回的标题与编号反馈给用户，例如：「已为你沉淀经验《xxx》，编号 {id}」。
- 只要 title 与 html 完整即可提交，分类为可选。
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
    navigator.clipboard.writeText(text).then(
      () => message.success(okText),
      () => message.error('复制失败，请手动选择复制'),
    );
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
          开放平台提供一个免令牌的开放接口，让 AI（ChatGPT / Claude / 任意支持 HTTP 调用的智能体）可以直接把
          经验文档（HTML）提交入库，无需手动打开后台、也无需任何令牌。下方展示接口调用情况，并附可直接复制给 AI 的提示词。
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

        {/* 接口信息 */}
        <div>
          <Text strong>接口地址</Text>
          <Paragraph copyable={{ text: `${apiBase}/open/experiences` }} style={{ marginTop: 6, marginBottom: 2 }}>
            <Text code>POST {apiBase}/open/experiences</Text>
          </Paragraph>
          <Paragraph copyable={{ text: `${apiBase}/open/meta` }} style={{ marginBottom: 0 }}>
            <Text code>GET&nbsp;&nbsp;{apiBase}/open/meta</Text>
          </Paragraph>
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
