import ESAClient from '@alicloud/esa20240910';
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

class AnalyticsEsaService {
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

  // OriginResponseTime is not listed in the official analytics fields page;
  // keep it optional for accounts that expose extra metrics.
  private readonly fieldLatency = process.env.ESA_FIELD_LATENCY || '';

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
    const range = this.getTimeRange(days);
    const req: any = {
      siteId: this.siteId,
      startTime: range.startTime,
      endTime: range.endTime,
      interval: String(intervalSec),
      fields,
    };
    const resp: any = await client.describeSiteTimeSeriesData(req);
    return resp?.body || {};
  }

  private async describeTop(days: number, limit: number, fields: Array<{ fieldName: string; dimension?: string[] }>): Promise<any> {
    const client = this.getClient();
    const range = this.getTimeRange(days);
    const req: any = {
      siteId: this.siteId,
      startTime: range.startTime,
      endTime: range.endTime,
      limit: String(limit),
      fields,
    };
    const resp: any = await client.describeSiteTopData(req);
    return resp?.body || {};
  }

  private findSummaryValue(body: any, fieldName: string): number {
    if (!fieldName) return 0;
    const rows: any[] = Array.isArray(body?.summarizedData) ? body.summarizedData : [];
    const hit = rows.find((r) => String(r?.fieldName || '').toLowerCase() === fieldName.toLowerCase());
    return toInt(hit?.value, 0);
  }

  private buildOverviewFields(includeLatency: boolean): Array<{ fieldName: string; dimension?: string[] }> {
    const fields: Array<{ fieldName: string; dimension?: string[] }> = [{ fieldName: this.fieldRequests, dimension: ['ALL'] }];
    if (includeLatency && this.fieldLatency) {
      fields.push({ fieldName: this.fieldLatency, dimension: ['ALL'] });
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

  async getOverview(): Promise<{ total: number; today: number; unique7d: number; errors: number; avgMs: number }> {
    const [all30d, today, unique7d, errors] = await Promise.all([
      this.describeTimeSeries(30, 86400, this.buildOverviewFields(false)),
      this.describeTimeSeries(1, 3600, this.buildOverviewFields(true)),
      this.describeTimeSeries(7, 86400, [{ fieldName: this.fieldVisitors, dimension: ['ALL'] }]),
      this.getErrorCountByStatus(1),
    ]);

    return {
      total: this.findSummaryValue(all30d, this.fieldRequests),
      today: this.findSummaryValue(today, this.fieldRequests),
      unique7d: this.findSummaryValue(unique7d, this.fieldVisitors),
      errors,
      avgMs: this.findSummaryValue(today, this.fieldLatency),
    };
  }

  async getTrend(days: number): Promise<Array<{ date: string; requests: number; visitors: number }>> {
    const body = await this.describeTimeSeries(days, 86400, [
      { fieldName: this.fieldRequests, dimension: ['ALL'] },
      { fieldName: this.fieldVisitors, dimension: ['ALL'] },
    ]);

    const dataRows: any[] = Array.isArray(body?.data) ? body.data : [];
    const reqRow = dataRows.find((r) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const visRow = dataRows.find((r) => String(r?.fieldName || '').toLowerCase() === this.fieldVisitors.toLowerCase());

    const reqMap = new Map<string, number>();
    for (const item of reqRow?.detailData || []) {
      reqMap.set(toShanghaiDate(String(item?.timeStamp || '')), toInt(item?.value, 0));
    }

    const visMap = new Map<string, number>();
    for (const item of visRow?.detailData || []) {
      visMap.set(toShanghaiDate(String(item?.timeStamp || '')), toInt(item?.value, 0));
    }

    const keys = Array.from(new Set([...reqMap.keys(), ...visMap.keys()])).filter(Boolean).sort();
    return keys.map((date) => ({ date, requests: reqMap.get(date) || 0, visitors: visMap.get(date) || 0 }));
  }

  async getPages(days: number): Promise<Array<{ path: string; hits: number; visitors: number; avg_ms: number; p95_ms: number; errors: number }>> {
    const body = await this.describeTop(days, 50, [{ fieldName: this.fieldRequests, dimension: ['Path'] }]);
    const rows = (body?.data || []).find((r: any) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const detail: any[] = Array.isArray(rows?.detailData) ? rows.detailData : [];
    return detail.map((item) => ({
      path: String(item?.dimensionValue || '/'),
      hits: toInt(item?.value, 0),
      visitors: 0,
      avg_ms: 0,
      p95_ms: 0,
      errors: 0,
    }));
  }

  async getStatusCodes(days: number): Promise<Array<{ name: string; value: number }>> {
    const body = await this.describeTop(days, 20, [{ fieldName: this.fieldRequests, dimension: ['EdgeResponseStatusCode'] }]);
    const rows = (body?.data || []).find((r: any) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const detail: any[] = Array.isArray(rows?.detailData) ? rows.detailData : [];
    return detail.map((item) => ({ name: String(item?.dimensionValue || 'Unknown'), value: toInt(item?.value, 0) }));
  }

  async getPerformance(days: number): Promise<Array<{ hour: string; avg_ms: number; p95_ms: number; max_ms: number; requests: number }>> {
    const fields: Array<{ fieldName: string; dimension?: string[] }> = [{ fieldName: this.fieldRequests, dimension: ['ALL'] }];
    if (this.fieldLatency) {
      fields.push({ fieldName: this.fieldLatency, dimension: ['ALL'] });
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
    const body = await this.describeTop(days, 20, [{ fieldName: this.fieldRequests, dimension: ['Referer'] }]);
    const rows = (body?.data || []).find((r: any) => String(r?.fieldName || '').toLowerCase() === this.fieldRequests.toLowerCase());
    const detail: any[] = Array.isArray(rows?.detailData) ? rows.detailData : [];
    return detail.map((item) => ({
      referer: String(item?.dimensionValue || 'Direct / None') || 'Direct / None',
      hits: toInt(item?.value, 0),
    }));
  }
}

export default new AnalyticsEsaService();




