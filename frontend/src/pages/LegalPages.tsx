import React from 'react';
import { Card, Typography } from 'antd';
import { useLocation } from 'react-router-dom';
import './LegalPages.css';

const { Title, Paragraph } = Typography;

const LegalPages: React.FC = () => {
  const location = useLocation();
  const doc = location.pathname.includes('privacy') ? 'privacy' : location.pathname.includes('terms') ? 'terms' : 'terms';

  return (
    <div className="legal-page">
      <Card className="legal-card">
        {doc === 'privacy' ? (
          <>
            <Title level={2}>隐私政策</Title>
            <Paragraph>本网站（hoyodb.com）重视并保护您的个人信息。本政策说明我们如何收集、使用、存储和保护您的信息。</Paragraph>
            <Title level={4}>一、我们收集的信息</Title>
            <Paragraph>
              1. 注册信息：用户名、密码（加密存储）、邮箱（用于注册验证）。<br />
              2. 实名信息：手机号（用于发表评论前的实名认证，依据《互联网跟帖评论服务管理规定》后台实名要求）。<br />
              3. 使用信息：IP 地址、浏览器信息（用于评论日志留存及安全防护，留存期限不少于 6 个月）。
            </Paragraph>
            <Title level={4}>二、信息的使用</Title>
            <Paragraph>手机号仅用于实名认证与账号安全；日志信息仅用于内容安全管理和依法配合监管。</Paragraph>
            <Title level={4}>三、信息的存储与保护</Title>
            <Paragraph>手机号等敏感信息加密存储；我们采取必要的技术和管理措施防止信息泄露。</Paragraph>
            <Title level={4}>四、您的权利</Title>
            <Paragraph>您可随时修改或注销账号；如对个人信息处理有疑问，可通过网站联系方式与我们联系。</Paragraph>
            <Title level={4}>五、未成年人保护</Title>
            <Paragraph>本网站内容面向全年龄用户；未满 14 周岁的未成年人请在监护人指导下使用。</Paragraph>
          </>
        ) : (
          <>
            <Title level={2}>用户协议</Title>
            <Paragraph>欢迎使用本网站。使用本网站即表示您同意以下条款。</Paragraph>
            <Title level={4}>一、账号与实名</Title>
            <Paragraph>
              1. 注册账号须提供真实、准确的信息。<br />
              2. 发表评论前须完成手机号实名认证（依据《互联网跟帖评论服务管理规定》）。<br />
              3. 不得冒用他人身份注册或发表内容。
            </Paragraph>
            <Title level={4}>二、社区规范</Title>
            <Paragraph>
              发表评论（含评分评语）应当遵守法律法规，遵循公序良俗，不得发布以下内容：<br />
              1. 违反法律法规、危害国家安全、破坏国家统一的内容；<br />
              2. 煽动民族仇恨、民族歧视，破坏民族团结的内容；<br />
              3. 宣扬暴力、色情、赌博、毒品的内容；<br />
              4. 侮辱、诽谤、辱骂他人，侵害他人合法权益的内容；<br />
              5. 虚假信息、广告引流、垃圾信息；<br />
              6. 其他法律法规禁止的内容。
            </Paragraph>
            <Title level={4}>三、审核与处置</Title>
            <Paragraph>
              评论发布后经系统审核与人工巡查。对违反本规范的用户，我们有权采取拒绝发布、删除内容、限制或关闭账号、禁止重新注册等措施，并保存相关记录。
            </Paragraph>
            <Title level={4}>四、举报与申诉</Title>
            <Paragraph>您可对违规内容进行举报；对被处置内容有异议的，可通过网站联系方式提出申诉。</Paragraph>
            <Title level={4}>五、免责声明</Title>
            <Paragraph>本站为米哈游（HoYoVerse）游戏音乐资料与试听站，站内资料来源于公开渠道，版权归原权利方所有。</Paragraph>
          </>
        )}
      </Card>
    </div>
  );
};

export default LegalPages;
