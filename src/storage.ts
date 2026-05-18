// src/storage.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { WbFeedbackResponse } from './types/wb-feedback.types';

export class FeedbackStorage {
  private readonly outputDir: string;

  constructor(outputDir: string = path.join(process.cwd(), 'data')) {
    this.outputDir = outputDir;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'raw'), { recursive: true });
  }

  /**
   * Сохраняет сырые данные от WB
   */
  async saveRaw(data: WbFeedbackResponse, imtId: string | number): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `feedbacks_${imtId}_${timestamp}.json`;
    const filepath = path.join(this.outputDir, 'raw', filename);

    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[SAVED] Сырые данные: ${filepath}`);
    
    return filepath;
  }

  /**
   * Сохраняет только отзывы в упрощённом формате
   */
  async saveProcessed(data: WbFeedbackResponse, imtId: string | number): Promise<string> {
    const feedbacks = data.feedbacks.map(fb => ({
      id: fb.id,
      userName: fb.wbUserDetails.name,
      country: fb.wbUserDetails.country,
      nmId: fb.nmId,
      text: fb.text || fb.pros || '',
      cons: fb.cons || '',
      valuation: fb.productValuation,
      color: fb.color,
      size: fb.size,
      createdDate: fb.createdDate,
      updatedDate: fb.updatedDate,
      hasPhotos: fb.photo.length > 0,
      photosCount: fb.photo.length,
      hasAnswer: fb.answer !== null,
      answerText: fb.answer?.text || '',
      answerDate: fb.answer?.createDate || '',
      votes: fb.votes,
      tags: fb.tags || [],
      bables: fb.bables || [],
      reasonsGood: fb.reasons.good,
      reasonsBad: fb.reasons.bad,
      excludedFromRating: fb.excludedFromRating.isExcluded,
    }));

    const processed = {
      imtId,
      collectedAt: new Date().toISOString(),
      totalCount: data.feedbackCount,
      withText: data.feedbackCountWithText,
      withPhoto: data.feedbackCountWithPhoto,
      withVideo: data.feedbackCountWithVideo,
      valuation: {
        average: parseFloat(data.valuation),
        sum: data.valuationSum,
        distribution: data.valuationDistribution,
        distributionPercent: data.valuationDistributionPercent,
      },
      feedbacks,
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `processed_${imtId}_${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(processed, null, 2), 'utf-8');
    console.log(`[SAVED] Обработанные данные: ${filepath}`);

    return filepath;
  }

  /**
   * Генерирует статистику по отзывам
   */
  generateStats(data: WbFeedbackResponse): Record<string, any> {
    const feedbacks = data.feedbacks;
    
    // Распределение по месяцам
    const byMonth: Record<string, number> = {};
    feedbacks.forEach(fb => {
      const month = fb.createdDate.substring(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + 1;
    });

    // Средняя длина текста
    const textsWithContent = feedbacks.filter(fb => fb.text || fb.pros);
    const avgTextLength = textsWithContent.length > 0
      ? Math.round(textsWithContent.reduce((sum, fb) => sum + (fb.text + fb.pros).length, 0) / textsWithContent.length)
      : 0;

    // Топ пользователей по количеству отзывов
    const userCounts: Record<string, { name: string; count: number }> = {};
    feedbacks.forEach(fb => {
      if (!userCounts[fb.globalUserId]) {
        userCounts[fb.globalUserId] = { name: fb.wbUserDetails.name, count: 0 };
      }
      userCounts[fb.globalUserId].count++;
    });

    return {
      imtId: null, // Будет заполнено позже
      totalFeedbacks: data.feedbackCount,
      withText: data.feedbackCountWithText,
      withPhoto: data.feedbackCountWithPhoto,
      averageRating: parseFloat(data.valuation),
      byMonth,
      avgTextLength,
      topUsers: Object.values(userCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }
}