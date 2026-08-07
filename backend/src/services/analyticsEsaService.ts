import ESAClient from '@alicloud/esa20240910';
import * as EsaModule from '@alicloud/esa20240910';
import * as OpenApiCore from '@alicloud/openapi-core';

type Mode = 'sql' | 'auto' | 'esa';

const toInt = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

const toShanghaiDate = (isoLike: string): string => {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return '';
  const text = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  return text;
};

const toShanghaiHour = (isoLike: string): string => {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:00:00`;
};

const toShanghaiHourNumber = (isoLike: string): number => {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return -1;
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || '-1');
  return Number.isFinite(hour) ? hour : -1;
};

class AnalyticsEsaService {
  private readonly maxDays = 7;

  private clampDays(days: number): number {
    const n = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : this.maxDays;
    return Math.min(n, this.maxDays);
  }

      private normalizeTopLimit(limit: number): string {
        const n = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 10;
        // Official DescribeSiteTopData enum: 5, 10, 150.
        if (n <= 5) return '5';
        if (n <= 10) return '10';
        return '150';
      }

  private client: ESAClient | null = null;

  private readonly mode: Mode = (String(process.env.ANALYTICS_PROVIDER || 'sql').toLowerCase() as Mode);

  private readonly endpoint = process.env.ESA_ENDPOINT || 'esa.cn-hangzhou.aliyuncs.com';

  private readonly regionId = process.env.ESA_REGION_ID || 'cn-hangzhou';

  private readonly siteId = process.env.ESA_SITE_ID || '';

  private readonly accessKeyId = process.env.ESA_ACCESS_KEY_ID || '';

  private readonly accessKeySecret = process.env.ESA_ACCESS_KEY_SECRET || '';

  private readonly timeoutMs = Math.max(parseInt(process.env.ESA_TIMEOUT_MS || '8000', 10) || 8000, 1000);

  private readonly fieldRequests = process.env.ESA_FIELD_REQUESTS || 'Requests';

  private readonly fieldVisitors = process.env.ESA_FIELD_VISITORS || 'PageView';

  private readonly fieldTraffic = process.env.ESA_FIELD_TRAFFIC || 'Traffic';

  private readonly fieldRequestTraffic = process.env.ESA_FIELD_REQUEST_TRAFFIC || 'RequestTraffic';

  // OriginResponseTime is not listed in the official analytics fields page;
  // keep it optional for accounts that expose extra metrics.
  private readonly fieldLatency = process.env.ESA_FIELD_LATENCY || '';

  // 子域过滤：只统计该 Host 的流量（ESA 站点可能挂多个子域）。
  // 原理：dimension 用 ClientRequestHost 分组，应用层筛 dimensionValue === hostFilter。
  private readonly hostFilter = (process.env.ESA_HOST_FILTER || '').trim().toLowerCase();

  // 有 hostFilter 时用 ClientRequestHost 维度（返回按域名分组，随后过滤）；否则用 ALL 全量
  private getQueryDimension(): string[] {
    return this.hostFilter ? ['ClientRequestHost'] : ['ALL'];
  }

  // 按 host 过滤响应（仅当本次查询以 ClientRequestHost 为维度时生效，
  // 避免误伤 EdgeCacheStatus 等其他维度的查询）
  private filterRowsByHost(body: any, useHostDimension: boolean): any {
    if (!this.hostFilter || !useHostDimension || !Array.isArray(body?.data)) return body;
    const rows: any[] = body.data.filter((r: any) =>
      String(r?.dimensionValue || '').trim().toLowerCase() === this.hostFilter,
    );
    return { ...body, data: rows };
  }

  isEnabled(): boolean {
    return this.mode !== 'sql';
  }

  shouldThrowOnFailure(): boolean {
    return this.mode === 'esa';
  }

  private canInit(): boolean {
    return Boolean(this.siteId && this.accessKeyId && this.accessKeySecret);
  }

  private getClient(): ESAClient {
    if (!this.canInit()) {
      throw new Error('ESA credentials are incomplete');
    }
    if (this.client) return this.client;

    const config = new OpenApiCore.$OpenApiUtil.Config({
      accessKeyId: this.accessKeyId,
      accessKeySecret: this.accessKeySecret,
      regionId: this.regionId,
      endpoint: this.endpoint,
      readTimeout: this.timeoutMs,
      connectTimeout: this.timeoutMs,
    });
    this.client = new ESAClient(config as any);
    return this.client;
  }

  private getTimeRange(days: number): { startTime: string; endTime: string } {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  }

  private async describeTimeSeries(days: number, intervalSec: number, fields: Array<{ fieldName: string; dimension?: string[] }>): Promise<any> {
    const client = this.getClient();
    const range = this.getTimeRange(this.clampDays(days));
    const rawReq: any = {
      siteId: this.siteId,
      startTime: range.startTime,
      endTime: range.endTime,
      interval: String(intervalSec),
      fields,
    };
    const req = new (EsaModule as any).DescribeSiteTimeSeriesDataRequest(rawReq);
    const resp: any = await client.describeSiteTimeSeriesData(req);
    const useHost = fields.some((f) => f.dimension?.includes('ClientRequestHost'));
    return this.filterRowsByHost(resp?.body || {}, useHost);
  }

  private async describeTop(days: number, limit: number, fields: Array<{ fieldName: string; dimension?: string[] }>): Promise<any> {
    const client = this.getClient();
    const range = this.getTimeRange(this.clampDays(days));
    const rawReq: any = {
      siteId: this.siteId,
      startTime: range.startTime,
      endTime: range.endTime,
      limit: this.normalizeTopLimit(limit),
      fields,
    };
    const req = new (EsaModule as any).DescribeSiteTopDataRequest(rawReq);
    const resp: any = await client.describeSiteTopData(req);
    const useHost = fields.some((f) => f.dimension?.includes('ClientRequestHost'));
    return this.filterRowsByHost(resp?.body || {}, useHost);
  }

  private findSummaryValue(body: any, fieldName: string): number {
    if (!fieldName) return 0;
    const rows: any[] = Array.isArray(body?.summarizedData) ? body.summarizedData : [];
    const hit = rows.find((r) => String(r?.fieldName || '').toLowerCase() === fieldName.toLowerCase());
    return toInt(hit?.value, 0);
  }

  private findTopDetail(body: any, fieldName: string): any[] {
    if (!fieldName) return [];
    const rows: any[] = Array.isArray(body?.data) ? body.data : [];
    const hit = rows.find((r) => String(r?.fieldName || '').toLowerCase() === fieldName.toLowerCase());
    return Array.isArray(hit?.detailData) ? hit.detailData : [];
  }

  private async getTopMap(days: number, dimension: string, fieldName: string, limit = 150): Promise<Map<string, number>> {
    const body = await this.describeTop(days, limit, [{ fieldName, dimension: [dimension] }]);
    const detail = this.findTopDetail(body, fieldName);
    const map = new Map<string, number>();
    for (const item of detail) {
      const key = String(item?.dimensionValue || '').trim();
      if (!key) continue;
      map.set(key, toInt(item?.value, 0));
    }
    return map;
  }

  private readonly provinceNameMap: Record<string, string> = {
    beijing: '北京市', tianjin: '天津市', shanghai: '上海市', chongqing: '重庆市',
    hebei: '河北省', shanxi: '山西省', liaoning: '辽宁省', jilin: '吉林省', heilongjiang: '黑龙江省',
    jiangsu: '江苏省', zhejiang: '浙江省', anhui: '安徽省', fujian: '福建省', jiangxi: '江西省',
    shandong: '山东省', henan: '河南省', hubei: '湖北省', hunan: '湖南省', guangdong: '广东省',
    hainan: '海南省', sichuan: '四川省', guizhou: '贵州省', yunnan: '云南省', shaanxi: '陕西省',
    gansu: '甘肃省', qinghai: '青海省', neimenggu: '内蒙古自治区', guangxi: '广西壮族自治区',
    xizang: '西藏自治区', ningxia: '宁夏回族自治区', xinjiang: '新疆维吾尔自治区',
    xianggang: '香港特别行政区', aomen: '澳门特别行政区', taiwan: '台湾省',
  };

  private mapProvinceName(raw: string): string {
    const key = String(raw || '').trim().toLowerCase();
    if (!key || key === '-') return '中国其他';
    return this.provinceNameMap[key] || raw;
  }

  private mapCountryCode(code: string): string {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return 'Unknown';
    if (c === 'CN') return '中国';
    if (c === 'HK') return '香港特别行政区';
    if (c === 'MO') return '澳门特别行政区';
    if (c === 'TW') return '台湾省';
    return c;
  }

  private buildOverviewFields(includeLatency: boolean, includePageView: boolean): Array<{ fieldName: string; dimension?: string[] }> {
    const fields: Array<{ fieldName: string; dimension?: string[] }> = [
      { fieldName: this.fieldRequests, dimension: this.getQueryDimension() },
      { fieldName: this.fieldTraffic, dimension: this.getQueryDimension() },
      { fieldName: this.fieldRequestTraffic, dimension: this.getQueryDimension() },
    ];
    if (includePageView) {
      fields.push({ fieldName: this.fieldVisitors, dimension: this.getQueryDimension() });
    }
    if (includeLatency && this.fieldLatency) {
      fields.push({ fieldName: this.fieldLatency, dimension: this.getQueryDimension() });
    }
    return fields;
  }

  private async getErrorCountByStatus(days: number): Promise<number> {
    const body = await this.describeTop(days, 50, [{ fieldName: this.fieldRequests, dimension: ['EdgeResponseStatusCode'] }]);
    const rows = (body?.data || []).find((r: any) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const detail: any[] = Array.isArray(rows?.detailData) ? rows.detailData : [];
    return detail.reduce((sum, item) => {
      const code = String(item?.dimensionValue || '').trim();
      if (!/^[45]\d\d$/.test(code)) return sum;
      return sum + toInt(item?.value, 0);
    }, 0);
  }

  async getOverview(): Promise<{ total: number; today: number; unique7d: number; errors: number; avgMs: number; traffic: number; requestTraffic: number; pageView: number }> {
    const [all30d, today, unique7d, errors] = await Promise.all([
      this.describeTimeSeries(this.maxDays, 86400, this.buildOverviewFields(false, false)),
      this.describeTimeSeries(1, 3600, this.buildOverviewFields(true, true)),
      this.describeTimeSeries(this.maxDays, 86400, [{ fieldName: this.fieldVisitors, dimension: this.getQueryDimension() }]),
      this.getErrorCountByStatus(1),
    ]);

    return {
      total: this.findSummaryValue(all30d, this.fieldRequests),
      today: this.findSummaryValue(today, this.fieldRequests),
      unique7d: this.findSummaryValue(unique7d, this.fieldVisitors),
      errors,
      avgMs: this.findSummaryValue(today, this.fieldLatency),
      traffic: this.findSummaryValue(today, this.fieldTraffic),
      requestTraffic: this.findSummaryValue(today, this.fieldRequestTraffic),
      pageView: this.findSummaryValue(today, this.fieldVisitors),
    };
  }

  async getTrend(days: number): Promise<Array<{ date: string; requests: number; visitors: number; traffic: number; requestTraffic: number; pageView: number }>> {
    const body = await this.describeTimeSeries(days, 86400, [
      { fieldName: this.fieldRequests, dimension: this.getQueryDimension() },
      { fieldName: this.fieldVisitors, dimension: this.getQueryDimension() },
      { fieldName: this.fieldTraffic, dimension: this.getQueryDimension() },
      { fieldName: this.fieldRequestTraffic, dimension: this.getQueryDimension() },
    ]);

    const dataRows: any[] = Array.isArray(body?.data) ? body.data : [];
    const reqRow = dataRows.find((r) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const visRow = dataRows.find((r) => String(r?.fieldName || '').toLowerCase() === this.fieldVisitors.toLowerCase());
    const trafficRow = dataRows.find((r) => String(r?.fieldName || '').toLowerCase() === this.fieldTraffic.toLowerCase());
    const requestTrafficRow = dataRows.find((r) => String(r?.fieldName || '').toLowerCase() === this.fieldRequestTraffic.toLowerCase());

    const reqMap = new Map<string, number>();
    for (const item of reqRow?.detailData || []) {
      reqMap.set(toShanghaiDate(String(item?.timeStamp || '')), toInt(item?.value, 0));
    }

    const visMap = new Map<string, number>();
    for (const item of visRow?.detailData || []) {
      visMap.set(toShanghaiDate(String(item?.timeStamp || '')), toInt(item?.value, 0));
    }

    const trafficMap = new Map<string, number>();
    for (const item of trafficRow?.detailData || []) {
      trafficMap.set(toShanghaiDate(String(item?.timeStamp || '')), toInt(item?.value, 0));
    }

    const requestTrafficMap = new Map<string, number>();
    for (const item of requestTrafficRow?.detailData || []) {
      requestTrafficMap.set(toShanghaiDate(String(item?.timeStamp || '')), toInt(item?.value, 0));
    }

    const keys = Array.from(new Set([
      ...reqMap.keys(),
      ...visMap.keys(),
      ...trafficMap.keys(),
      ...requestTrafficMap.keys(),
    ])).filter(Boolean).sort();
    return keys.map((date) => ({
      date,
      requests: reqMap.get(date) || 0,
      visitors: visMap.get(date) || 0,
      pageView: visMap.get(date) || 0,
      traffic: trafficMap.get(date) || 0,
      requestTraffic: requestTrafficMap.get(date) || 0,
    }));
  }

  async getHourly(): Promise<Array<{ hour: number; requests: number; visitors: number }>> {
    const body = await this.describeTimeSeries(1, 3600, [
      { fieldName: this.fieldRequests, dimension: this.getQueryDimension() },
      { fieldName: this.fieldVisitors, dimension: this.getQueryDimension() },
    ]);
    const rows: any[] = Array.isArray(body?.data) ? body.data : [];
    const reqRow = rows.find((r) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const visRow = rows.find((r) => String(r?.fieldName || '').toLowerCase() === this.fieldVisitors.toLowerCase());

    const reqMap = new Map<number, number>();
    for (const item of reqRow?.detailData || []) {
      const hour = toShanghaiHourNumber(String(item?.timeStamp || ''));
      if (hour < 0 || hour > 23) continue;
      reqMap.set(hour, (reqMap.get(hour) || 0) + toInt(item?.value, 0));
    }
    const visMap = new Map<number, number>();
    for (const item of visRow?.detailData || []) {
      const hour = toShanghaiHourNumber(String(item?.timeStamp || ''));
      if (hour < 0 || hour > 23) continue;
      visMap.set(hour, (visMap.get(hour) || 0) + toInt(item?.value, 0));
    }

    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      requests: reqMap.get(hour) || 0,
      visitors: visMap.get(hour) || 0,
    }));
  }

  async getCountries(days: number): Promise<Array<{ country: string; requests: number; visitors: number }>> {
    const [provinceReq, provinceVis, countryReq, countryVis] = await Promise.all([
      this.getTopMap(days, 'ClientProvinceCode', this.fieldRequests, 150),
      this.getTopMap(days, 'ClientProvinceCode', this.fieldVisitors, 150),
      this.getTopMap(days, 'ClientCountryCode', this.fieldRequests, 150),
      this.getTopMap(days, 'ClientCountryCode', this.fieldVisitors, 150),
    ]);

    const bucket = new Map<string, { country: string; requests: number; visitors: number }>();
    for (const [k, req] of provinceReq.entries()) {
      if (k === '-') continue;
      const name = this.mapProvinceName(k);
      const item = bucket.get(name) || { country: name, requests: 0, visitors: 0 };
      item.requests += req;
      item.visitors += provinceVis.get(k) || 0;
      bucket.set(name, item);
    }

    for (const [k, req] of countryReq.entries()) {
      if (k === 'CN') continue;
      const name = this.mapCountryCode(k);
      const item = bucket.get(name) || { country: name, requests: 0, visitors: 0 };
      item.requests += req;
      item.visitors += countryVis.get(k) || 0;
      bucket.set(name, item);
    }

    return Array.from(bucket.values()).sort((a, b) => b.visitors - a.visitors).slice(0, 40);
  }

  async getDevices(days: number): Promise<{ browsers: Array<{ name: string; value: number }>; oses: Array<{ name: string; value: number }>; devices: Array<{ name: string; value: number }> }> {
    const [browserMap, osMap, deviceMap] = await Promise.all([
      this.getTopMap(days, 'ClientBrowser', this.fieldRequests, 150),
      this.getTopMap(days, 'ClientOS', this.fieldRequests, 150),
      this.getTopMap(days, 'ClientDevice', this.fieldRequests, 150),
    ]);

    const browsers = Array.from(browserMap.entries()).map(([name, value]) => ({ name, value })).slice(0, 10);
    const oses = Array.from(osMap.entries()).map(([name, value]) => ({ name, value })).slice(0, 8);
    const devices = Array.from(deviceMap.entries()).map(([name, value]) => ({ name: String(name || '').toLowerCase(), value }));
    return { browsers, oses, devices };
  }

  async getPages(days: number): Promise<Array<{ path: string; hits: number; visitors: number; avg_ms: number; p95_ms: number; errors: number }>> {
    const body = await this.describeTop(days, 50, [{ fieldName: this.fieldRequests, dimension: ['ClientRequestPath'] }]);
    const rows = (body?.data || []).find((r: any) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const detail: any[] = Array.isArray(rows?.detailData) ? rows.detailData : [];
    return detail.map((item) => ({
      path: String(item?.dimensionValue || '/'),
      hits: toInt(item?.value, 0),
      visitors: 0,
      avg_ms: 0,
      p95_ms: 0,
      errors: 0,
    })).slice(0, 50);
  }

  async getStatusCodes(days: number): Promise<Array<{ name: string; value: number }>> {
    const body = await this.describeTop(days, 20, [{ fieldName: this.fieldRequests, dimension: ['EdgeResponseStatusCode'] }]);
    const rows = (body?.data || []).find((r: any) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const detail: any[] = Array.isArray(rows?.detailData) ? rows.detailData : [];
    return detail
      .map((item) => ({ name: String(item?.dimensionValue || 'Unknown'), value: toInt(item?.value, 0) }))
      .slice(0, 20);
  }

  async getPerformance(days: number): Promise<Array<{ hour: string; avg_ms: number; p95_ms: number; max_ms: number; requests: number }>> {
    const fields: Array<{ fieldName: string; dimension?: string[] }> = [{ fieldName: this.fieldRequests, dimension: this.getQueryDimension() }];
    if (this.fieldLatency) {
      fields.push({ fieldName: this.fieldLatency, dimension: this.getQueryDimension() });
    }
    const body = await this.describeTimeSeries(days, 3600, fields);
    const rows: any[] = Array.isArray(body?.data) ? body.data : [];
    const reqRow = rows.find((r) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const latRow = rows.find((r) => String(r?.fieldName || '').toLowerCase() === this.fieldLatency.toLowerCase());

    const reqMap = new Map<string, number>();
    for (const item of reqRow?.detailData || []) {
      reqMap.set(toShanghaiHour(String(item?.timeStamp || '')), toInt(item?.value, 0));
    }
    const latMap = new Map<string, number>();
    for (const item of latRow?.detailData || []) {
      latMap.set(toShanghaiHour(String(item?.timeStamp || '')), toInt(item?.value, 0));
    }

    const keys = Array.from(new Set([...reqMap.keys(), ...latMap.keys()])).filter(Boolean).sort();
    return keys.map((hour) => ({
      hour,
      avg_ms: latMap.get(hour) || 0,
      p95_ms: 0,
      max_ms: 0,
      requests: reqMap.get(hour) || 0,
    }));
  }

  async getReferers(days: number): Promise<Array<{ referer: string; hits: number }>> {
    const body = await this.describeTop(days, 20, [{ fieldName: this.fieldRequests, dimension: ['ClientRequestReferer'] }]);
    const rows = (body?.data || []).find((r: any) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const detail: any[] = Array.isArray(rows?.detailData) ? rows.detailData : [];
    return detail.map((item) => ({
      referer: String(item?.dimensionValue || 'Direct / None') || 'Direct / None',
      hits: toInt(item?.value, 0),
    })).slice(0, 20);
  }

  /**
   * ESA 独有口径：缓存命中分布（EdgeCacheStatus 维度，站点全量口径——无法叠加域名维度，返回时标注 host）
   * 命中判定：EdgeCacheStatus 值为 Hit / Dynamic / Miss（Revalidate 等按实际返回）
   */
  async getCacheStatus(days: number): Promise<{
    enabled: boolean;
    host: string;
    distribution: Array<{ status: string; requests: number }>;
    hit_rate: number | null;
  }> {
    const body = await this.describeTop(days, 10, [{ fieldName: this.fieldRequests, dimension: ['EdgeCacheStatus'] }]);
    const rows = (body?.data || []).find((r: any) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const detail: any[] = Array.isArray(rows?.detailData) ? rows.detailData : [];
    const distribution = detail
      .map((item: any) => ({ status: String(item?.dimensionValue || 'Unknown'), requests: toInt(item?.value, 0) }))
      .filter((d: any) => d.requests > 0);

    const hit = distribution.filter((d: any) => /hit/i.test(d.status)).reduce((s, d) => s + d.requests, 0);
    const total = distribution.reduce((s, d) => s + d.requests, 0);
    const hitRate = total > 0 ? Math.round((hit / total) * 1000) / 10 : null;

    return {
      enabled: true,
      host: this.hostFilter || 'ALL（站点全量）',
      distribution,
      hit_rate: hitRate,
    };
  }

  /** ESA 是否已配置可用（有凭据且非 sql 模式） */
  isReady(): boolean {
    return this.isEnabled() && this.canInit();
  }
}

export default new AnalyticsEsaService();








