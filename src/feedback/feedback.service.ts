// src/feedback/feedback.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WildberriesClient } from '../wildberries-client';
import { AiService, AnalysisResult } from '../ai/ai.service';
import { WbFeedback } from '../types/wb-feedback.types';
import { FeedbackEntity } from '../entities/feedback.entity';
import { AnalysisEntity } from '../entities/analysis.entity';

export interface ProcessedFeedback {
  id: string;
  userName: string;
  text: string;
  pros: string;
  cons: string;
  valuation: number;
  createdDate: string;
  isNew: boolean;
  hasText: boolean;
}

export interface SplitFeedbacksResult {
  imtId: string;
  collectedAt: string;
  periodDays: number;
  periodStart: string;
  periodEnd: string;
  totalCount: number;
  actualReceived: number;
  withText: number;
  dateRange: {
    oldest: string;
    newest: string;
  };
  newFeedbacks: ProcessedFeedback[];
  oldFeedbacks: ProcessedFeedback[];
  stats: {
    newCount: number;
    oldCount: number;
    newWithText: number;
    oldWithText: number;
    newAverageRating: number;
    oldAverageRating: number;
    overallAverageRating: number;
  };
}

@Injectable()
export class FeedbackService {
  constructor(
    private readonly wbClient: WildberriesClient,
    private readonly aiService: AiService,
    @InjectRepository(FeedbackEntity)
    private readonly feedbackRepo: Repository<FeedbackEntity>,
    @InjectRepository(AnalysisEntity)
    private readonly analysisRepo: Repository<AnalysisEntity>,
  ) {}

  private hasTextContent(fb: WbFeedback): boolean {
    const text = (fb.text || '').trim();
    const pros = (fb.pros || '').trim();
    const cons = (fb.cons || '').trim();
    return text.length > 0 || pros.length > 0 || cons.length > 0;
  }

  // ========================
  // РАЗБИЕНИЕ ПО ДАТЕ
  // ========================
  async getSplitFeedbacks(
    imtId: string,
    periodDays: number = 90,
    forceRefresh: boolean = false,
  ): Promise<SplitFeedbacksResult> {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - periodDays);

    // 1. Проверяем, есть ли отзывы в БД и не устарели ли они (старше 24 часов)
    const existingFeedbacks = await this.feedbackRepo.find({
      where: { imtId },
      order: { createdDate: 'DESC' },
    });

    const isCacheFresh = existingFeedbacks.length > 0 && !forceRefresh;
    // Проверяем, что самому свежему отзыву в кеше меньше 24 часов
    const newestCached = existingFeedbacks[0];
    const cacheAge = newestCached
      ? (Date.now() - newestCached.collectedAt.getTime()) / 1000 / 60 / 60
      : null;

    let allProcessed: ProcessedFeedback[];

    if (isCacheFresh && cacheAge !== null && cacheAge < 24) {
      console.log(`[CACHE] Беру ${existingFeedbacks.length} отзывов из БД (кеш ${Math.round(cacheAge)} ч.)`);
      
      // Преобразуем обратно в ProcessedFeedback
      allProcessed = existingFeedbacks.map(fb => ({
        id: fb.id,
        userName: fb.userName,
        text: fb.text,
        pros: fb.pros,
        cons: fb.cons,
        valuation: fb.valuation,
        createdDate: fb.createdDate.toISOString(),
        isNew: new Date(fb.createdDate) >= periodStart,
        hasText: fb.hasText,
      }));
    } else {
      // 2. Собираем с WB
      console.log('[WB] Собираю свежие отзывы...');
      const rawData = await this.wbClient.fetchFeedbacks(imtId);

      allProcessed = rawData.feedbacks.map(fb => {
        const createdDate = new Date(fb.createdDate);
        return {
          id: fb.id,
          userName: fb.wbUserDetails.name,
          text: fb.text || fb.pros || '',
          pros: fb.pros || '',
          cons: fb.cons || '',
          valuation: fb.productValuation,
          createdDate: fb.createdDate,
          isNew: createdDate >= periodStart,
          hasText: this.hasTextContent(fb),
        };
      });

      // 3. Сохраняем в БД
      const entities = allProcessed.map(fb =>
        this.feedbackRepo.create({
          id: fb.id,
          imtId,
          userName: fb.userName,
          text: fb.text,
          pros: fb.pros,
          cons: fb.cons,
          valuation: fb.valuation,
          createdDate: new Date(fb.createdDate),
          hasText: fb.hasText,
        }),
      );

      await this.feedbackRepo
        .createQueryBuilder()
        .insert()
        .into(FeedbackEntity)
        .values(entities)
        .orIgnore()
        .execute();

      console.log(`[DB] Сохранено ${entities.length} отзывов`);
    }

    // 4. Дальше обычная логика разбиения
    const overallAverageRating = this.calculateAverageRating(allProcessed);
    const withTextOnly = allProcessed.filter(fb => fb.hasText);

    console.log(`[INFO] Всего получено: ${allProcessed.length}`);
    console.log(`[INFO] С текстом: ${withTextOnly.length}`);

    const newFeedbacks = withTextOnly.filter(fb => fb.isNew);
    const oldFeedbacks = withTextOnly.filter(fb => !fb.isNew);

    const allDates = allProcessed.map(fb => new Date(fb.createdDate).getTime());
    const oldestDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : now;
    const newestDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : now;

    console.log(`[INFO] Новых: ${newFeedbacks.length}, Старых: ${oldFeedbacks.length}`);

    return {
      imtId,
      collectedAt: now.toISOString(),
      periodDays,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      totalCount: allProcessed.length,
      actualReceived: allProcessed.length,
      withText: withTextOnly.length,
      dateRange: {
        oldest: oldestDate.toISOString(),
        newest: newestDate.toISOString(),
      },
      newFeedbacks,
      oldFeedbacks,
      stats: {
        newCount: newFeedbacks.length,
        oldCount: oldFeedbacks.length,
        newWithText: newFeedbacks.filter(fb => fb.hasText).length,
        oldWithText: oldFeedbacks.filter(fb => fb.hasText).length,
        newAverageRating: this.calculateAverageRating(newFeedbacks),
        oldAverageRating: this.calculateAverageRating(oldFeedbacks),
        overallAverageRating,
      },
    };
  }

  // ========================
  // AI-АНАЛИЗ
  // ========================
  async getFeedbackSummary(
    imtId: string,
    periodDays: number = 90,
  ): Promise<{
    imtId: string;
    periodDays: number;
    collectedAt: string;
    stats: SplitFeedbacksResult['stats'];
    analysis: AnalysisResult;
    cached: boolean;
  }> {
    // 1. Проверяем кеш анализа (не старше 24 часов)
    const cachedAnalysis = await this.analysisRepo.findOne({
      where: { imtId, periodDays },
      order: { createdAt: 'DESC' },
    });

    const cacheAge = cachedAnalysis
      ? (Date.now() - cachedAnalysis.createdAt.getTime()) / 1000 / 60 / 60
      : null;

    let analysis: AnalysisResult;
    let stats: SplitFeedbacksResult['stats'];
    let collectedAt: string;
    let cached = false;

    if (cachedAnalysis && cacheAge !== null && cacheAge < 24) {
      // Берём из кеша
      console.log(`[CACHE] Анализ из кеша (${Math.round(cacheAge)} ч.)`);
      analysis = cachedAnalysis.data.analysis;
      stats = cachedAnalysis.data.stats;
      collectedAt = cachedAnalysis.createdAt.toISOString();
      cached = true;
    } else {
      // 2. Собираем отзывы (из БД или с WB)
      const splitData = await this.getSplitFeedbacks(imtId, periodDays);

      const newFeedbacks = splitData.newFeedbacks;
      const oldFeedbacks = splitData.oldFeedbacks;

      console.log(`[AI] Данные: ${newFeedbacks.length} новых, ${oldFeedbacks.length} старых`);

      // 3. AI-анализ
      if (oldFeedbacks.length === 0) {
        console.log('[AI] Старых нет, сводка без сравнения');
        analysis = await this.aiService.summarize(newFeedbacks);
      } else {
        analysis = await this.aiService.analyze(oldFeedbacks, newFeedbacks);
      }

      // 4. Сохраняем анализ в БД
      const analysisEntity = this.analysisRepo.create({
        imtId,
        periodDays,
        data: { stats: splitData.stats, analysis },
      });
      await this.analysisRepo.save(analysisEntity);

      stats = splitData.stats;
      collectedAt = splitData.collectedAt;
      cached = false;
    }

    // 5. Логи (выводятся всегда — и для кеша, и для свежего)
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 РЕЗУЛЬТАТЫ АНАЛИЗА`);
    console.log(`${'='.repeat(50)}`);

    console.log(`\n📝 ОБЩЕЕ ВПЕЧАТЛЕНИЕ:`);
    console.log(`   ${analysis?.overview || 'Нет данных'}`);

    console.log(`\n🔑 КЛЮЧЕВЫЕ ТЕЗИСЫ:`);
    const hl = analysis?.highlights || [];
    if (hl.length > 0) {
      hl.forEach((h, i) => console.log(`   ${i + 1}. ${h}`));
    } else {
      console.log(`   (нет данных)`);
    }

    const pos = analysis?.changes?.positive || [];
    const neg = analysis?.changes?.negative || [];
    const hasChanges = pos.length > 0 || neg.length > 0;

    console.log(`\n🔄 ИЗМЕНЕНИЯ:`);
    console.log(`   ${analysis?.changes?.summary || 'Нет данных'}`);

    if (hasChanges) {
      if (pos.length > 0) {
        console.log(`\n   🟢 ПОЗИТИВНЫЕ:`);
        pos.forEach(p => console.log(`      • ${p}`));
      }
      if (neg.length > 0) {
        console.log(`\n   🔴 НЕГАТИВНЫЕ:`);
        neg.forEach(n => console.log(`      • ${n}`));
      }
    }

    if (analysis?.rawResponse) {
      console.log(`\n⚠️ GigaChat заблокировал тему. Полный ответ:`);
      console.log(`   ${analysis.rawResponse.substring(0, 500)}`);
    }

    console.log(`\n${'='.repeat(50)}\n`);

    return { imtId, periodDays, collectedAt, stats, analysis, cached };
  }


  // ========================
  // ДЕМО
  // ========================
  async getDemoSplitFeedbacks(
    imtId: string,
    periodDays: number = 90,
    splitRatio: number = 0.3,
  ): Promise<SplitFeedbacksResult> {
    const rawData = await this.wbClient.fetchFeedbacks(imtId);
    const allFeedbacks = rawData.feedbacks;

    const sorted = [...allFeedbacks].sort(
      (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
    );

    const allProcessed: ProcessedFeedback[] = sorted.map(fb => ({
      id: fb.id,
      userName: fb.wbUserDetails.name,
      text: fb.text || fb.pros || '',
      pros: fb.pros || '',
      cons: fb.cons || '',
      valuation: fb.productValuation,
      createdDate: fb.createdDate,
      isNew: true,
      hasText: this.hasTextContent(fb),
    }));

    const overallAverageRating = this.calculateAverageRating(allProcessed);
    const withTextOnly = allProcessed.filter(fb => fb.hasText);

    const splitIndex = Math.floor(withTextOnly.length * (1 - splitRatio));

    const processed = withTextOnly.map((fb, index) => ({
      ...fb,
      isNew: index < splitIndex,
    }));

    const newFeedbacks = processed.filter(fb => fb.isNew);
    const oldFeedbacks = processed.filter(fb => !fb.isNew);

    const allDates = allProcessed.map(fb => new Date(fb.createdDate).getTime());
    const oldestDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
    const newestDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - periodDays);

    console.log(`[DEMO] Всего: ${allProcessed.length}, С текстом: ${withTextOnly.length}`);
    console.log(`[DEMO] Новых: ${newFeedbacks.length}, Старых: ${oldFeedbacks.length}`);

    return {
      imtId,
      collectedAt: now.toISOString(),
      periodDays,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      totalCount: rawData.feedbackCount,
      actualReceived: allProcessed.length,
      withText: withTextOnly.length,
      dateRange: { oldest: oldestDate.toISOString(), newest: newestDate.toISOString() },
      newFeedbacks,
      oldFeedbacks,
      stats: {
        newCount: newFeedbacks.length,
        oldCount: oldFeedbacks.length,
        newWithText: newFeedbacks.length,
        oldWithText: oldFeedbacks.length,
        newAverageRating: this.calculateAverageRating(newFeedbacks),
        oldAverageRating: this.calculateAverageRating(oldFeedbacks),
        overallAverageRating,
      },
    };
  }

  private calculateAverageRating(feedbacks: ProcessedFeedback[]): number {
    if (feedbacks.length === 0) return 0;
    const sum = feedbacks.reduce((acc, fb) => acc + fb.valuation, 0);
    return Math.round((sum / feedbacks.length) * 100) / 100;
  }
}