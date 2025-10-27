import React, { useMemo } from 'react';
import { Card, Progress, Statistic, Avatar, Empty, Row, Col, Tag, Tooltip, Timeline } from 'antd';
import { UserOutlined, ClockCircleOutlined, MessageOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { SpeakerStatistics, TranscriptionSegment } from '@/types';
import './styles.css';

interface SpeakerStatisticsProps {
  speakers: SpeakerStatistics[];
  transcriptions: TranscriptionSegment[];
  className?: string;
}

const speakerColors = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d',
  '#722ed1', '#fa8c16', '#13c2c2', '#eb2f96',
  '#2f54eb', '#fa541c'
];

const getSpeakerColor = (speakerId: string): string => {
  let hash = 0;
  for (let i = 0; i < speakerId.length; i++) {
    hash = speakerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return speakerColors[Math.abs(hash) % speakerColors.length];
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}分${remainingSeconds}秒`;
  }
  return `${remainingSeconds}秒`;
};

const SpeakerStatistics: React.FC<SpeakerStatisticsProps> = ({
  speakers,
  transcriptions,
  className = ''
}) => {
  // 按发言时长排序
  const sortedSpeakers = useMemo(() => {
    return [...speakers].sort((a, b) => b.totalDuration - a.totalDuration);
  }, [speakers]);

  // 生成时间线数据
  const timelineData = useMemo(() => {
    return transcriptions
      .sort((a, b) => a.startTime - b.startTime)
      .map(segment => ({
        ...segment,
        color: getSpeakerColor(segment.speakerId)
      }));
  }, [transcriptions]);

  if (!speakers || speakers.length === 0) {
    return (
      <Card className={`speaker-statistics ${className}`}>
        <Empty description="暂无说话人数据" />
      </Card>
    );
  }

  return (
    <div className={`speaker-statistics ${className}`}>
      {/* 概览卡片 */}
      <Card className="overview-card" bordered={false}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="说话人总数"
              value={speakers.length}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="转录片段"
              value={transcriptions.length}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="已识别说话人"
              value={speakers.filter(s => s.isKnown).length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 说话人详情卡片 */}
      <Row gutter={[16, 16]} className="speaker-cards">
        {sortedSpeakers.map((speaker, index) => {
          const color = getSpeakerColor(speaker.speakerId);

          return (
            <Col xs={24} sm={24} md={12} lg={8} key={speaker.speakerId}>
              <Card
                className="speaker-card"
                bordered={false}
                hoverable
              >
                <div className="speaker-header">
                  <Avatar
                    size={48}
                    style={{
                      backgroundColor: color,
                      border: `2px solid ${color}40`
                    }}
                    icon={<UserOutlined />}
                  />
                  <div className="speaker-info">
                    <div className="speaker-name">
                      {speaker.name}
                      {speaker.isKnown && (
                        <Tag color="success" style={{ marginLeft: 8 }}>
                          已识别
                        </Tag>
                      )}
                    </div>
                    <div className="speaker-rank">
                      排名第 {index + 1}
                    </div>
                  </div>
                </div>

                <div className="speaker-stats">
                  <div className="stat-item">
                    <div className="stat-label">发言时长</div>
                    <div className="stat-value">
                      <ClockCircleOutlined style={{ marginRight: 4, color }} />
                      {formatDuration(speaker.totalDuration)}
                    </div>
                  </div>

                  <div className="stat-item">
                    <div className="stat-label">发言片段</div>
                    <div className="stat-value">
                      <MessageOutlined style={{ marginRight: 4, color }} />
                      {speaker.segmentCount} 次
                    </div>
                  </div>

                  <div className="stat-item">
                    <div className="stat-label">平均置信度</div>
                    <div className="stat-value">
                      <Progress
                        type="circle"
                        percent={Math.round(speaker.avgConfidence * 100)}
                        width={40}
                        strokeColor={color}
                        format={percent => `${percent}%`}
                      />
                    </div>
                  </div>
                </div>

                <div className="percentage-bar">
                  <div className="percentage-label">
                    <span>发言占比</span>
                    <span className="percentage-value">{speaker.percentage.toFixed(1)}%</span>
                  </div>
                  <Progress
                    percent={speaker.percentage}
                    strokeColor={color}
                    showInfo={false}
                    strokeWidth={12}
                  />
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 时间线视图 */}
      <Card
        title="发言时间线"
        className="timeline-card"
        bordered={false}
      >
        <Timeline
          mode="left"
          items={timelineData.slice(0, 20).map(segment => ({
            color: segment.color,
            dot: (
              <Avatar
                size="small"
                style={{ backgroundColor: segment.color }}
                icon={<UserOutlined />}
              />
            ),
            children: (
              <div className="timeline-item">
                <div className="timeline-header">
                  <strong>{segment.speakerName}</strong>
                  <Tag color={segment.color}>
                    {formatDuration(segment.endTime - segment.startTime)}
                  </Tag>
                </div>
                <div className="timeline-content">
                  <Tooltip title={`置信度: ${(segment.confidence * 100).toFixed(1)}%`}>
                    <span>{segment.content}</span>
                  </Tooltip>
                </div>
                <div className="timeline-time">
                  {new Date(segment.timestamp).toLocaleTimeString('zh-CN')}
                </div>
              </div>
            )
          }))}
        />
        {timelineData.length > 20 && (
          <div className="timeline-more">
            还有 {timelineData.length - 20} 条发言未显示
          </div>
        )}
      </Card>
    </div>
  );
};

export default SpeakerStatistics;
