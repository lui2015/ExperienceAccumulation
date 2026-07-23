import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  CopyOutlined,
  DashboardOutlined,
  KeyOutlined,
  RedoOutlined,
  SafetyOutlined,
  StopOutlined,
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
function buildPrompt(apiBase: string, token: string): string {
  const submit = `${apiBase}/open/experiences`;
  const meta = `${apiBase}/open/meta`;
  return `你是「经验沉淀」站点的提交助手。当用户想记录一条经验时，请通过开放接口自动提交，不要只把内容回显给用户。

## 接口信息
- 基础地址：${apiBase}
- 提交接口：POST ${submit}
- 元数据（分类/封面列表）：GET ${meta}
- 鉴权：请求头必须带 Authorization: Bearer ${token}

## 提交步骤
1. （可选）调用 GET ${meta}（带上同样的 Bearer 头）获取已有分类 category_id / category_name 与封面 preset key。
2. 调用 POST ${submit}（multipart/form-data，字段如下）提交经验。

## 请求字段
- title（必填）：经验标题
- html（必填）：经验正文，直接传 HTML 字符串（例如 <h1>标题</h1><p>内容…</p>），不要传文件
- summary（可选）：一句话简介
- category_id（可选）或 category_name（可选）：分类，二选一。若都不传，系统会自动归入「草稿」分类；category_name 指定的分类不存在时服务端会自动新建
- group_name（可选）：该分类下的分组名，不存在会自动新建
- cover_preset（可选）：封面预设 key，取自 meta 返回的列表（如 neon-grid）

## 调用示例（curl）
# 示例一：完整提交（指定分类）
curl -X POST '${submit}' \\
  -H 'Authorization: Bearer ${token}' \\
  -F 'title=我的经验标题' \\
  -F 'category_name=技术笔记' \\
  -F 'summary=一句话简介' \\
  -F 'html=<h1>正文标题</h1><p>这里是经验正文内容。</p>' \\
  -F 'cover_preset=neon-grid'

# 示例二：最简提交（仅 title + html，自动归入「草稿」）
curl -X POST '${submit}' \\
  -H 'Authorization: Bearer ${token}' \\
  -F 'title=我的经验标题' \\
  -F 'html=<h1>正文标题</h1><p>这里是经验正文内容。</p>'

## 完成标准
- 返回 200 且包含经验的 id、title 即视为成功，把链接或 id 反馈给用户。
- 只要 title 与 html 完整即可提交；分类为可选，不传会进入「草稿」。
- 任何 4xx 都先检查 title / html 是否完整、令牌是否有效，不要反复重试。`;
}

export default function SettingsPage() {
  const [exists, setExists] = useState<boolean | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ total_calls: number; today_calls: number } | null>(null);
  const apiBase = useMemo(resolveApiBase, []);

  const refreshStats = () => {
    openApi
      .getStats()
      .then(setStats)
      .catch(() => setStats({ total_calls: 0, today_calls: 0 }));
  };

  useEffect(() => {
    openApi
      .getStatus()
      .then((r) => setExists(r.exists))
      .catch(() => setExists(false));
    refreshStats();
  }, []);

  const afterMutate = () => {
    // 令牌变更后刷新状态与统计
    openApi.getStatus().then((r) => setExists(r.exists)).catch(() => setExists(false));
    refreshStats();
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const r = await openApi.createToken();
      setToken(r.token);
      message.success('令牌已生成，请立即复制保存');
      afterMutate();
    } catch {
      message.error('生成失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      await openApi.revokeToken();
      setToken('');
      message.success('令牌已吊销');
      afterMutate();
    } catch {
      message.error('吊销失败');
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, okText = '已复制到剪贴板') => {
    navigator.clipboard.writeText(text).then(
      () => message.success(okText),
      () => message.error('复制失败，请手动选择复制'),
    );
  };

  const prompt = buildPrompt(apiBase, token || '{你的开放接口令牌}');

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
            {exists === true && <Tag color="green">已启用</Tag>}
            {exists === false && <Tag color="default">未启用</Tag>}
          </Space>
        }
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          开放平台提供一个接口令牌，让 AI（ChatGPT / Claude / 任意支持 HTTP 调用的智能体）可以直接把
          经验文档（HTML）提交入库，无需手动打开后台。下方展示接口调用情况，并附可直接复制给 AI 的提示词。
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

        <Alert
          type="warning"
          showIcon
          icon={<SafetyOutlined />}
          style={{ marginBottom: 16 }}
          message="令牌等同于后台写入权限，请妥善保管，不要公开到前端代码或公共仓库。"
        />

        {/* 令牌管理 */}
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {token ? (
            <div>
              <Text strong>新令牌（仅显示一次）：</Text>
              <Input.TextArea
                readOnly
                value={token}
                autoSize={{ minRows: 2, maxRows: 4 }}
                style={{ fontFamily: 'var(--cy-font-mono)', marginTop: 6 }}
              />
              <Button
                icon={<CopyOutlined />}
                style={{ marginTop: 8 }}
                onClick={() => copy(token, '令牌已复制，请立即保存')}
              >
                复制令牌
              </Button>
            </div>
          ) : (
            <Space wrap>
              {!exists && (
                <Button
                  type="primary"
                  icon={<KeyOutlined />}
                  loading={loading}
                  onClick={handleCreate}
                >
                  生成接口令牌
                </Button>
              )}
              {exists && (
                <>
                  <Button
                    icon={<RedoOutlined />}
                    loading={loading}
                    onClick={handleCreate}
                  >
                    重新生成
                  </Button>
                  <Button
                    danger
                    icon={<StopOutlined />}
                    loading={loading}
                    onClick={handleRevoke}
                  >
                    吊销令牌
                  </Button>
                </>
              )}
            </Space>
          )}

          {token && (
            <Space wrap>
              <Button
                icon={<RedoOutlined />}
                loading={loading}
                onClick={handleCreate}
              >
                重新生成
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                loading={loading}
                onClick={handleRevoke}
              >
                吊销令牌
              </Button>
            </Space>
          )}

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
        </Space>

        {/* 给 AI 的提示词 */}
        <div style={{ marginTop: 24, borderTop: '1px solid rgba(124, 92, 255, 0.15)', paddingTop: 18 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            给 AI 的提示词（一键复制，粘贴给智能体即可调用）
          </Text>
          <Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 10 }}>
            把下面这段提示词完整复制，粘贴给任意支持 HTTP 调用的 AI。它会自动带上你的令牌，
            把经验整理成 HTML 并提交。若尚未生成令牌，提示词中的令牌占位符需先生成并替换。
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
